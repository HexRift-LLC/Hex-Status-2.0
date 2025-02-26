const { Client, GatewayIntentBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const yaml = require('js-yaml');
const fs = require('fs');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const chalk = require('chalk');
const { createCanvas, registerFont } = require('canvas');
const path = require('path');
const moment = require('moment');

const config = yaml.load(fs.readFileSync(path.join(__dirname, '..', 'config', 'config.yml'), 'utf8'));

const MAX_HISTORY_POINTS = 20;
const SERVICE_COLORS = ['#00ff00', '#00ccff', '#ff3399', '#ffcc00', '#9933ff', '#ff6600'];

// Initialize Chart Canvas
const chartCanvas = new ChartJSNodeCanvas({
    width: 800,
    height: 300,
    backgroundColour: 'transparent'
});

// Service History Management
const serviceHistory = new Map();

// Font Setup
function setupFonts() {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Arial.ttf');
    registerFont(fontPath, { family: 'Arial' });
}

// Service History Management
function updateServiceHistory(service, ping) {
    const history = serviceHistory.get(service.name) || [];
    history.push(ping);
    serviceHistory.set(service.name, history.slice(-MAX_HISTORY_POINTS));
}

// Chart Generation
async function generateStatsGraph(services) {
    const datasets = services.map((service, index) => ({
        label: service.name,
        data: serviceHistory.get(service.name) || Array(MAX_HISTORY_POINTS).fill(null),
        borderColor: SERVICE_COLORS[index % SERVICE_COLORS.length],
        backgroundColor: SERVICE_COLORS[index % SERVICE_COLORS.length].replace('1)', '0.3)'),
        tension: 0.4,
        borderWidth: 2,
        pointRadius: 2,
        fill: true
    }));

    const timeLabels = Array.from({ length: MAX_HISTORY_POINTS }, (_, i) => {
        const timestamp = new Date(Date.now() - (MAX_HISTORY_POINTS - i) * 60000);
        return timestamp.toLocaleTimeString('en-US', { hour12: false });
    });

    try {
        return await chartCanvas.renderToBuffer({
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
                            font: { size: 14, family: 'Arial' }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.2)' },
                        ticks: { color: '#ffffff', font: { size: 12, family: 'Arial' } }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { 
                            color: '#ffffff', 
                            font: { size: 12, family: 'Arial' }, 
                            maxRotation: 0, 
                            minRotation: 0, 
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    }
                },
                animation: { duration: 400, easing: 'easeInOutQuad' }
            }
        });
    } catch (error) {
        console.log(chalk.red("[System]"), "Error generating graph:", error);
        return null;
    }
}

// Status Utilities
const StatusUtils = {
    getColor: (online, total) => online === total ? '#00ff00' : online === 0 ? '#ff0000' : '#ffaa00',
    getEmoji: (online, total) => online === total ? '🟢' : online === 0 ? '🔴' : '🟡',
    getMessage: (online, total) => online === total ? 'All Systems Operational' :
        online === 0 ? 'Major System Outage' : `Partial Outage (${online}/${total} Online)`
};

// Metrics Calculation
function calculateStatusMetrics(servicesData) {
    const services = Array.isArray(servicesData) ? servicesData : Object.values(servicesData);
    const onlineServices = services.filter(s => s.status !== 'down');
    
    return {
        onlineServices,
        totalServices: services.length,
        avgResponseTime: services.reduce((acc, s) => acc + s.ping, 0) / services.length,
        degradedServices: services.filter(s => s.ping > 1000).length,
        totalUptime: Math.min(100, services.reduce((acc, s) => acc + s.uptime, 0) / services.length),
        offlineServices: services.filter(s => s.status === 'down')
    };
}

// Embed Creation
function createStatusEmbed(metrics) {
    const statusColor = StatusUtils.getColor(metrics.onlineServices.length, metrics.totalServices);
    
    return new EmbedBuilder()
        .setColor(statusColor)
        .setTitle('📊 Live Service Status')
        .setThumbnail(config.discord.thumbnail)
        .addFields([
            {
                name: `${StatusUtils.getEmoji(metrics.onlineServices.length, metrics.totalServices)} Status:`,
                value: StatusUtils.getMessage(metrics.onlineServices.length, metrics.totalServices),
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
        ])
        .setImage('attachment://status-graph.png')
        .setTimestamp()
        .setFooter({
            text: `${config.app.name} • Live Updates`,
            iconURL: config.discord.thumbnail
        });
}

// State Management
const db = require('../config/database');

const StateManager = {
    save: async (statusMessage) => {
        await db.BotState.findOneAndUpdate(
            {},
            {
                lastMessageId: statusMessage?.id,
                serviceHistoryData: serviceHistory,
                lastUpdate: Date.now()
            },
            { upsert: true }
        );
    },

    load: async () => {
        const state = await db.BotState.findOne();
        if (state) {
            serviceHistory.clear();
            state.serviceHistoryData.forEach((value, key) => {
                serviceHistory.set(key, value);
            });
        }
        return state;
    }
};
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
    async function loadState() {
        try {
            const state = await db.BotState.findOne();
            if (state && state.serviceHistoryData) {
                serviceHistory.clear();
                state.serviceHistoryData.forEach((value, key) => {
                    serviceHistory.set(key, value);
                });
            } else {
                // Initialize empty state if none exists
                serviceHistory.clear();
                config.services.forEach(service => {
                    serviceHistory.set(service.name, []);
                });
            }
            return state;
        } catch (error) {
            console.log(chalk.red("[System]"), "Error loading state:", error);
            return null;
        }
    }
    client.once('ready', () => {
        console.log(chalk.green("[Bot]"), `Is Online & Login as: ${client.user.tag}`);
        clearCommands(client);
        loadState();
        startStatusUpdates(client);
    });
      startStatusUpdates(client); // Start the status update loop

  function startStatusUpdates(client) {
      updateStatusEmbed(client);
      setInterval(() => updateStatusEmbed(client), config.discord.updateInterval || 60000);
  }

  client.login(config.discord.token);

  module.exports = { client, updateStatusEmbed };

  let statusMessage = null;
    async function updateStatusEmbed(client) {
        const channel = client.channels.cache.get(config.discord.channelId);
        if (!channel) return;

        const services = await Promise.all(config.services.map(async service => {
            const serviceData = await db.Service.findOne({ name: service.name });
        
            return {
                name: service.name,
                status: serviceData?.status || 'unknown',
                ping: serviceData?.ping[serviceData.ping.length - 1] || 0,
                uptime: serviceData?.uptime || 0,
                downtime: serviceData?.status === 'down' ? 
                    moment(serviceData.downtimes[serviceData.downtimes.length - 1]?.start).fromNow() : null
            };
        }));

        const metrics = calculateStatusMetrics(services);
        const graphBuffer = await generateStatsGraph(services);
        const attachment = new AttachmentBuilder(graphBuffer, { name: 'status-graph.png' });
        const embed = createStatusEmbed(metrics);

        try {
            const state = await db.BotState.findOne();
  
            if (state?.lastMessageId) {
                try {
                    statusMessage = await channel.messages.fetch(state.lastMessageId);
                    await statusMessage.edit({ embeds: [embed], files: [attachment] });
                } catch (error) {
                    // Message not found or other error, create new message
                    await db.BotState.updateOne({}, { $unset: { lastMessageId: "" } });
                    statusMessage = await channel.send({ embeds: [embed], files: [attachment] });
                    await db.BotState.findOneAndUpdate({}, {
                        lastMessageId: statusMessage.id,
                        lastUpdate: Date.now()
                    }, { upsert: true });
                }
            } else {
                statusMessage = await channel.send({ embeds: [embed], files: [attachment] });
                await db.BotState.findOneAndUpdate({}, {
                    lastMessageId: statusMessage.id,
                    lastUpdate: Date.now()
                }, { upsert: true });
            }
        } catch (error) {
            console.log(chalk.red("[System]"), 'Error updating status:', error);
        }
    }module.exports = { updateStatusEmbed };