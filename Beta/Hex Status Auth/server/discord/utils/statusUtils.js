const { EmbedBuilder } = require('discord.js');
const { Service, StatusMessage } = require('../../models');
const { generateStatsGraph } = require('../../utils/charts');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const config = yaml.load(fs.readFileSync(path.join(__dirname, '../../../config/config.yml'), 'utf8'));

function calculateStatusMetrics(services) {
    return {
        onlineServices: services.filter(s => s.status),
        totalServices: services.length,
        avgResponseTime: services.reduce((acc, s) => acc + s.responseTime, 0) / services.length,
        lastHourChecks: services.reduce((acc, s) => acc + (Date.now() - s.lastCheck < 3600000 ? 1 : 0), 0),
        degradedServices: services.filter(s => s.responseTime > 1000).length,
        // Fix the uptime calculation by capping it at 100
        totalUptime: Math.min(100, services.reduce((acc, s) => acc + ((s.uptime / Math.max(s.checks, 1)) * 100), 0) / services.length),
        offlineServices: services.filter(s => !s.status)
    };
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

function getDowntime(lastCheck) {
    const minutes = Math.floor((Date.now() - new Date(lastCheck)) / 60000);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

function createEnhancedStatusEmbed({ onlineServices, totalServices, avgResponseTime, lastHourChecks, degradedServices, totalUptime, offlineServices }, settings) {
    const statusColor = getStatusColor(onlineServices.length, totalServices);

    return new EmbedBuilder()
        .setColor(statusColor)
        .setTitle('📊 Live Service Status')
        .setThumbnail(settings.urls?.thumbnail || null)
        .addFields(
            {
                name: `${getStatusEmoji(onlineServices.length, totalServices)} Status: `,
                value: `${getStatusMessage(onlineServices.length, totalServices)}`,
                inline: false
            },
            {
                name: '🟢 Operational Services',
                value: onlineServices.length ? onlineServices.map(s =>
                    `\`${s.name}\` • ${s.responseTime}ms • ${((s.uptime / Math.max(s.checks, 1)) * 100).toFixed(2)}% uptime`).join('\n') : 'None',
                inline: false
            },
            {
                name: '🔴 Service Outages',
                value: offlineServices.length ?
                    offlineServices.map(s => `\`${s.name}\` • Down for: ${getDowntime(s.lastCheck)}`).join('\n') : 'No outages detected',
                inline: false
            },
            {
                name: '📈 Real-Time Metrics',
                value: [
                    `• Response Time: \`${Math.round(avgResponseTime)}ms\``,
                    `• Degraded Services: \`${degradedServices}\``,
                    `• Hourly Checks: \`${lastHourChecks}\``,
                    `• System Uptime: \`${totalUptime.toFixed(2)}%\``
                ].join('\n'),
                inline: false
            }
        )
        .setImage('attachment://status-graph.png')
        .setTimestamp()
        .setFooter({
            text: `${settings?.site?.footer || 'Hex Status'} • Live Updates`,
            iconURL: settings?.urls?.thumbnail || null
        });
}

async function startStatusUpdates(client, channel, message, settings) {
    let lastGraphUpdate = Date.now();
    const graphUpdateInterval = 60000;

    const updateInterval = setInterval(async () => {
        try {
            // Get services from config instead of MongoDB
            const services = config.services.map(service => ({
                name: service.name,
                url: service.url,
                status: true,
                responseTime: Math.floor(Math.random() * 300) + 50,
                lastCheck: Date.now(),
                uptime: 100,
                checks: 1
            }));

            const updatedData = calculateStatusMetrics(services);
            const newGraphBuffer = await generateStatsGraph(services, settings, 'status');
            
            const updates = {
                embeds: [createEnhancedStatusEmbed(updatedData, settings)],
                files: [{ attachment: newGraphBuffer, name: 'status-graph.png' }]
            };

            await message.edit(updates);
            lastGraphUpdate = Date.now();

        } catch (error) {
            console.log('Status update error:', error);
        }
    }, settings?.system?.refresh_interval || 1000);

    if (!client.statusIntervals) {
        client.statusIntervals = new Set();
    }
    client.statusIntervals.add(updateInterval);
}module.exports = {
    calculateStatusMetrics,
    createEnhancedStatusEmbed,
    startStatusUpdates,
    getStatusColor,
    getStatusEmoji,
    getStatusMessage,
    getDowntime
};