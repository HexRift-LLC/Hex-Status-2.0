const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const yaml = require('js-yaml');
const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const chalk = require('chalk');

const config = yaml.load(fs.readFileSync('./config/config.yml', 'utf8'));
let statusMessage = null;

const chartCanvas = new ChartJSNodeCanvas({
    width: 800,
    height: 300,
    backgroundColour: 'transparent'
});

const serviceHistory = new Map();
const MAX_HISTORY_POINTS = 20;

function updateServiceHistory(service, ping) {
    if (!serviceHistory.has(service.name)) {
        serviceHistory.set(service.name, []);
    }

    let history = serviceHistory.get(service.name);
    history.push(ping);

    if (history.length > MAX_HISTORY_POINTS) {
        history = history.slice(-MAX_HISTORY_POINTS);
    }

    serviceHistory.set(service.name, history);
}

async function generateStatsGraph(services) {
    function movingAverage(data, windowSize = 5) {
        return data.map((_, idx, arr) => {
            if (idx < windowSize - 1) return arr[idx];
            const subset = arr.slice(idx - windowSize + 1, idx + 1);
            return subset.reduce((sum, val) => sum + (val || 0), 0) / subset.length;
        });
    }

    const datasets = services.map((service, index) => {
        const rawHistory = serviceHistory.get(service.name) || Array(MAX_HISTORY_POINTS).fill(null);
        const smoothedHistory = movingAverage(rawHistory, 5);

        return {
            label: service.name,
            data: smoothedHistory,
            borderColor: getServiceColor(service.name),
            backgroundColor: getServiceColor(service.name).replace('1)', '0.5)'), // Adjusted opacity
            tension: 0.3, // Adjusted for a more controlled curve
            borderWidth: 1.5,
            pointRadius: 0,
            fill: true, // Ensures filled area
            order: services.length - index, // Ensures correct layering
        };
    });

    const timeLabels = Array.from({ length: MAX_HISTORY_POINTS }, (_, i) => {
        const timestamp = new Date(Date.now() - (MAX_HISTORY_POINTS - i) * 60000);
        return timestamp.toLocaleTimeString('en-US', { hour12: false });
    });

    try {
        const buffer = await chartCanvas.renderToBuffer({
            type: 'line',
            data: { labels: timeLabels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#ffffff',
                            font: { size: 13 }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        stacked: true, // Ensures layering consistency
                        grid: { color: 'rgba(255, 255, 255, 0.2)' },
                        ticks: { color: '#ffffff', font: { size: 12 } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#ffffff', maxRotation: 10, minRotation: 10, font: { size: 12 } }
                    }
                },
                animation: {
                    duration: 500, // Slightly increased for smoother transitions
                    easing: 'easeInOutQuad'
                }
            }
        });
        return buffer;
    } catch (error) {
        console.log(chalk.red("[System]"),"Error generating graph:", error);
        return null;
    }
}

function getServiceColor(serviceName) {
    const colors = [
        '#00ff00', '#00ccff', '#ff3399', '#ffcc00', '#9933ff', '#ff6600'
    ];
    
    const index = serviceName.length % colors.length;
    return colors[index];
}

function getStatusColor(online, total) {
    return online === total ? '#00ff00' : online === 0 ? '#ff0000' : '#ffaa00';
}

function getStatusEmoji(online, total) {
    return online === total ? '🟢' : online === 0 ? '🔴' : '🟡';
}

function getStatusMessage(online, total) {
    return online === total ? 'All Systems Operational' :
           online === 0 ? 'Major System Outage' :
           `Partial Outage (${online}/${total} Online)`;
}

function calculateStatusMetrics(servicesData) {
    const services = Array.isArray(servicesData) ? servicesData : Object.values(servicesData);
    
    const onlineServices = services.filter(s => s.status === 'up');
    return {
        onlineServices,
        totalServices: services.length,
        avgResponseTime: services.reduce((acc, s) => acc + s.ping, 0) / services.length,
        degradedServices: services.filter(s => s.ping > 1000).length,
        totalUptime: Math.min(100, services.reduce((acc, s) => acc + s.uptime, 0) / services.length),
        offlineServices: services.filter(s => s.status === 'down')
    };
}

function createStatusEmbed(metrics) {
    const statusColor = getStatusColor(metrics.onlineServices.length, metrics.totalServices);

    return new EmbedBuilder()
        .setColor(statusColor)
        .setTitle('📊 Live Service Status')
        .setThumbnail(config.discord.thumbnail)
        .addFields(
            {
                name: `${getStatusEmoji(metrics.onlineServices.length, metrics.totalServices)} Status:`,
                value: getStatusMessage(metrics.onlineServices.length, metrics.totalServices),
                inline: false
            },
            {
                name: '🟢 Operational Services',
                value: metrics.onlineServices.length ? 
                    metrics.onlineServices.map(s => 
                        `\`${s.name}\` • ${s.ping}ms • ${s.uptime.toFixed(2)}% uptime`
                    ).join('\n') : 'None',
                inline: false
            },
            {
                name: '🔴 Service Outages',
                value: metrics.offlineServices.length ?
                    metrics.offlineServices.map(s => `\`${s.name}\` • Down for: ${s.downtime}`).join('\n') : 'No outages detected',
                inline: false
            },
            {
                name: '📈 Real-Time Metrics',
                value: [
                    `• Response Time: \`${Math.round(metrics.avgResponseTime)}ms\``,
                    `• Degraded Services: \`${metrics.degradedServices}\``,
                    `• System Uptime: \`${metrics.totalUptime.toFixed(2)}%\``
                ].join('\n'),
                inline: false
            }
        )
        .setImage('attachment://status-graph.png')
        .setTimestamp()
        .setFooter({
            text: `${config.app.name} • Live Updates`,
            iconURL: config.discord.thumbnail
        });
}

async function updateStatusEmbed(client) {
    const channel = client.channels.cache.get(config.discord.channelId);
    if (!channel) return;

    const services = config.services.map(service => {
        const ping = service.ping || Math.floor(Math.random() * 300) + 50;
        updateServiceHistory(service, ping);
        return {
            name: service.name,
            status: service.status || 'up',
            ping: ping,
            uptime: service.uptime || 99.9
        };
    });

    const metrics = calculateStatusMetrics(services);
    const graphBuffer = await generateStatsGraph(services);
    const attachment = new AttachmentBuilder(graphBuffer, { name: 'status-graph.png' });
    const embed = createStatusEmbed(metrics);

    try {
        if (statusMessage) {
            await statusMessage.edit({ embeds: [embed], files: [attachment] });
        } else {
            const state = loadState();
            if (state?.lastMessageId) {
                statusMessage = await channel.messages.fetch(state.lastMessageId);
                await statusMessage.edit({ embeds: [embed], files: [attachment] });
            } else {
                statusMessage = await channel.send({ embeds: [embed], files: [attachment] });
            }
        }
        saveState();
    } catch (error) {
        console.log(chalk.red("[System]"),'Error updating status:', error);
        statusMessage = await channel.send({ embeds: [embed], files: [attachment] });
        saveState();
    }
}

function saveState() {
    const state = {
        lastMessageId: statusMessage?.id,
        serviceHistoryData: Object.fromEntries(serviceHistory),
        lastUpdate: Date.now()
    };
    fs.writeFileSync('./data/botState.json', JSON.stringify(state, null, 2));
}

function loadState() {
    try {
        const data = fs.readFileSync('./data/botState.json', 'utf8');
        const state = JSON.parse(data);
        
        // Restore service history
        serviceHistory.clear();
        Object.entries(state.serviceHistoryData).forEach(([key, value]) => {
            serviceHistory.set(key, value);
        });
        
        return state;
    } catch {
        return null;
    }
}


function saveMessageId(messageId) {
    const data = { lastMessageId: messageId };
    fs.writeFileSync('./data/messageStore.json', JSON.stringify(data));
}

function getStoredMessageId() {
    try {
        const data = fs.readFileSync('./data/messageStore.json', 'utf8');
        return JSON.parse(data).lastMessageId;
    } catch {
        return null;
    }
}

function startStatusUpdates(client) {
    updateStatusEmbed(client);
    setInterval(() => updateStatusEmbed(client), config.discord.updateInterval || 60000);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

async function clearCommands(client) {
    const rest = new REST({ version: '10' }).setToken(config.discord.token);
    
    try {
        console.log(chalk.yellow("[Bot]"), "Started clearing application (/) commands.");
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        console.log(chalk.blue("[Bot]"), "Successfully cleared all application commands.");
    } catch (error) {
        console.log(chalk.red("[System]"), error);
    }
}

client.once('ready', () => {
    console.log(chalk.green("[Bot]"), `Is Online & Login as: ${client.user.tag}`);
    clearCommands(client);
    loadState(); // Load the previous state
    startStatusUpdates(client);
});

client.login(config.discord.token);

module.exports = { updateStatusEmbed };
