/**
 * Hex Status 3.0 - Discord Bot Module
 * Enhanced implementation with improved reliability and flap protection
 */
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const moment = require('moment');

// Configuration and state variables
let config = null;
let client = null;
let isReady = false;
let statusMessage = null;
let statusMessageId = null;
let alertQueue = [];
let processingAlerts = false;
let pendingStatusUpdates = [];
let reconnectAttempts = 0;
let reconnectTimer = null;
let latestServicesData = [];
let serviceHistory = {};

// Constants
const MAX_HISTORY_POINTS = 50;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 30000; // Initial delay (30s)
const FLAP_STABILIZATION_WEIGHT = 0.7; // Higher = more stable/less responsive
const DATA_DIR = './data';
const STATE_FILE = path.join(DATA_DIR, 'discord_state.json');

/**
 * Load configuration from file
 */
function loadConfig() {
    try {
        // Changed to load from config.json at project root instead of YAML
        const configPath = path.join(process.cwd(), 'config.json');
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Validate essential discord configuration
        if (!configData.discord) {
            throw new Error('Discord configuration section missing');
        }
        
        if (!configData.discord.token) {
            throw new Error('Discord bot token missing');
        }
        
        if (!configData.discord.channelId) {
            throw new Error('Discord status channel ID missing');
        }
        
        return configData;
    } catch (error) {
        console.error(chalk.red('[Bot]'), 'Failed to load configuration:', error.message);
        return null;
    }
}

/**
 * Save bot state to disk
 */
function saveState() {
    try {
        // Create data directory if it doesn't exist
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        
        const state = {
            statusMessageId,
            channelId: config.discord.channelId,
            lastUpdate: new Date().toISOString()
        };
        
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        return true;
    } catch (error) {
        console.log(chalk.yellow('[Bot]'), 'Failed to save state:', error.message);
        return false;
    }
}

/**
 * Load bot state from disk
 */
function loadState() {
    try {
        if (!fs.existsSync(STATE_FILE)) {
            return null;
        }
        
        const data = fs.readFileSync(STATE_FILE, 'utf8');
        const state = JSON.parse(data);
        
        // Only restore if channel ID matches config
        if (state.channelId === config.discord.channelId) {
            statusMessageId = state.statusMessageId;
            console.log(chalk.blue('[Bot]'), 'Restored previous message ID:', statusMessageId);
            return state;
        } else {
            console.log(chalk.yellow('[Bot]'), 'Channel ID mismatch, not restoring previous state');
            return null;
        }
    } catch (error) {
        console.log(chalk.yellow('[Bot]'), 'Failed to load state:', error.message);
        return null;
    }
}

/**
 * Get appropriate status color based on service status
 */
function getStatusColor(metrics) {
    if (metrics.flappingServices > 0) {
        return '#ffaa00'; // Amber for flapping services
    }
    
    if (metrics.offlineServices > 0) {
        if (metrics.offlineServices === metrics.totalServices) {
            return '#ff0000'; // Red for all offline
        }
        return '#ff4500'; // Orange-red for partial outage
    }
    
    if (metrics.degradedServices > 0) {
        return '#ffcc00'; // Yellow for degraded
    }
    
    return '#00ff00'; // Green for all good
}

/**
 * Get emoji for current status
 */
function getStatusEmoji(metrics) {
    if (metrics.flappingServices > 0) {
        return '🟠'; // Orange for flapping
    }
    
    if (metrics.offlineServices > 0) {
        if (metrics.offlineServices === metrics.totalServices) {
            return '🔴'; // Red for all offline
        }
        return '🟠'; // Orange for partial outage
    }
    
    if (metrics.degradedServices > 0) {
        return '🟡'; // Yellow for degraded
    }
    
    return '🟢'; // Green for all good
}

/**
 * Get human-readable status message
 */
function getStatusMessage(metrics) {
    if (metrics.flappingServices > 0) {
        return `Service Instability (${metrics.flappingServices} flapping)`;
    }
    
    if (metrics.offlineServices > 0) {
        if (metrics.offlineServices === metrics.totalServices) {
            return 'Major System Outage';
        }
        return `Partial Outage (${metrics.onlineServices}/${metrics.totalServices} Online)`;
    }
    
    if (metrics.degradedServices > 0) {
        return `Degraded Performance (${metrics.degradedServices} service${metrics.degradedServices > 1 ? 's' : ''})`;
    }
    
    return 'All Systems Operational';
}

/**
 * Calculate metrics from service data
 */
function calculateStatusMetrics(servicesData) {
    // Handle both array and object formats for backwards compatibility
    const services = Array.isArray(servicesData) ? servicesData : Object.values(servicesData);
    
    // Count services by status
    const onlineServices = services.filter(s => s.status === 'up' && !s.isFlapping);
    const offlineServices = services.filter(s => s.status === 'down' && !s.isFlapping);
    const flappingServices = services.filter(s => s.isFlapping);
    const unknownServices = services.filter(s => s.status !== 'up' && s.status !== 'down' && !s.isFlapping);
    
    // Detect degraded services (high response time but still up)
    const degradedServices = onlineServices.filter(s => {
        if (!s.ping || !s.ping.length) return false;
        const lastPing = s.ping[s.ping.length - 1];
        return lastPing > 1000 && lastPing < 9999;
    });
    
    // Calculate average response time (only for online services)
    let avgResponseTime = 0;
    let pingCount = 0;
    
    onlineServices.forEach(s => {
        if (s.ping && s.ping.length) {
            const validPings = s.ping.filter(p => p < 9999);
            if (validPings.length) {
                avgResponseTime += validPings.reduce((sum, val) => sum + val, 0);
                pingCount += validPings.length;
            }
        }
    });
    
    // Calculate uptime
    const totalUptime = services.length > 0
        ? services.reduce((sum, s) => sum + parseFloat(s.uptime || 0), 0) / services.length
        : 100;

    return {
        onlineServices: onlineServices.length,
        offlineServices: offlineServices.length,
        flappingServices: flappingServices.length,
        unknownServices: unknownServices.length,
        totalServices: services.length,
        avgResponseTime: pingCount ? (avgResponseTime / pingCount) : 0,
        degradedServices: degradedServices.length,
        totalUptime,
        
        // Keep the actual service lists for rendering
        onlineServicesList: onlineServices,
        offlineServicesList: offlineServices,
        flappingServicesList: flappingServices,
        degradedServicesList: degradedServices
    };
}

/**
 * Create the status embed with current metrics
 */
function createStatusEmbed(metrics) {
    const statusColor = getStatusColor(metrics);
    const statusEmoji = getStatusEmoji(metrics);
    const statusMessage = getStatusMessage(metrics);
    
    const embed = new EmbedBuilder()
        .setColor(statusColor)
        .setTitle(`${statusEmoji} ${config.siteName} Status`)
        .setThumbnail(config.discord.thumbnail || 'https://img.hexrift.net/HS.png')
        .setDescription(`**Current Status:** ${statusMessage}`)
        .setTimestamp();
        
    // Add banner image if provided
    if (config.discord.image) {
        embed.setImage(config.discord.image);
    }
    
    // Add operational services field if any exist
    if (metrics.onlineServices > 0) {
        embed.addFields({
            name: '🟢 Operational Services',
            value: metrics.onlineServicesList.map(s => {
                const pingValue = s.ping && s.ping.length
                    ? Math.round(s.ping[s.ping.length - 1])
                    : 'N/A';
                return `\`${s.name}\` • ${pingValue}ms • ${parseFloat(s.uptime).toFixed(2)}% uptime`;
            }).join('\n') || 'None',
            inline: false
        });
    }

    // Add degraded services field if any exist
    if (metrics.degradedServices > 0) {
        embed.addFields({
            name: '🟡 Degraded Services',
            value: metrics.degradedServicesList.map(s => {
                const pingValue = s.ping && s.ping.length
                    ? Math.round(s.ping[s.ping.length - 1])
                    : 'N/A';
                return `\`${s.name}\` • ${pingValue}ms • ${parseFloat(s.uptime).toFixed(2)}% uptime`;
            }).join('\n'),
            inline: false
        });
    }
    
    // Add flapping services field if any exist
    if (metrics.flappingServices > 0) {
        embed.addFields({
            name: '🟠 Unstable Services (Flapping)',
            value: metrics.flappingServicesList.map(s => {
                return `\`${s.name}\` • Status unstable • ${parseFloat(s.uptime).toFixed(2)}% uptime`;
            }).join('\n'),
            inline: false
        });
    }

    // Add outage field if any services are down
    if (metrics.offlineServices > 0) {
        embed.addFields({
            name: '🔴 Service Outages',
            value: metrics.offlineServicesList.map(s => {
                // Calculate downtime if available
                let downtime = "Just now";
                let downtimeDuration = "0 minutes";
                
                if (s.downtimes && s.downtimes.length > 0) {
                    const lastDowntime = s.downtimes[s.downtimes.length - 1];
                    if (lastDowntime && !lastDowntime.end) {
                        const start = new Date(lastDowntime.start);
                        downtime = moment(start).fromNow(true);
                    }
                }
                
                return `\`${s.name}\` • Down for: ${downtime || downtimeDuration}`;
            }).join('\n'),
            inline: false
        });
    }

    // Add metrics field
    embed.addFields({
        name: '📈 Real-Time Metrics',
        value: [
            `• Online: \`${metrics.onlineServices}/${metrics.totalServices}\``,
            `• Response Time: \`${Math.round(metrics.avgResponseTime)}ms\``,
            `• Degraded Services: \`${metrics.degradedServices}\``,
            metrics.flappingServices > 0 ? `• Unstable Services: \`${metrics.flappingServices}\`` : null,
            `• System Uptime: \`${metrics.totalUptime.toFixed(2)}%\``
        ].filter(line => line !== null).join('\n'),
        inline: false
    });
    
    embed.setFooter({
        text: `${config.siteName} • Refreshes every ${Math.round(config.discord.updateInterval / 1000)}s`,
        iconURL: config.discord.thumbnail || 'https://img.hexrift.net/HS.png'
    });

    return embed;
}

/**
 * Update the service history for charting
 */
function updateServiceHistory(serviceName, pingValue) {
    if (!serviceHistory[serviceName]) {
        serviceHistory[serviceName] = [];
    }
    
    // Check if service is flapping
    const service = latestServicesData.find(s => s.name === serviceName);
    const isFlapping = service && service.isFlapping;
    
    // If service is flapping, apply smoothing to the history values
    if (isFlapping) {
        if (serviceHistory[serviceName].length > 0) {
            const lastValue = serviceHistory[serviceName][serviceHistory[serviceName].length - 1];
            
            // Weighted smoothing (70% previous, 30% new)
            let smoothedValue;
            
            if (pingValue >= 9999) { // Service is down
                // Show a high but not maximum value to indicate degradation
                smoothedValue = Math.min(8000, lastValue + 500);
            } else if (lastValue >= 9999) { // Previous was down, current is up
                // Show a recovery that's not too abrupt
                smoothedValue = Math.max(1000, pingValue * 2);
            } else {
                // Normal smoothing for online but fluctuating services
                smoothedValue = (lastValue * FLAP_STABILIZATION_WEIGHT) + 
                               (pingValue * (1 - FLAP_STABILIZATION_WEIGHT));
            }
            
            pingValue = smoothedValue;
        }
    }
    
    // Add value to history
    serviceHistory[serviceName].push(pingValue);
    
    // Limit history length
    if (serviceHistory[serviceName].length > MAX_HISTORY_POINTS) {
        serviceHistory[serviceName].shift();
    }
}

/**
 * Update the status embed in Discord
 */
async function updateStatusEmbed(servicesData) {
    try {
        if (!client || !isReady) {
            console.log(chalk.yellow('[Bot]'), 'Cannot update status: Bot not ready');
            pendingStatusUpdates.push(servicesData);
            return false;
        }
        
        // Save the latest data
        // Save the latest data
        latestServicesData = Array.isArray(servicesData) ? servicesData : [];
        
        // Process pending updates first (only use the latest one)
        if (pendingStatusUpdates.length > 0) {
            const latestUpdate = pendingStatusUpdates.pop(); // Get most recent
            pendingStatusUpdates = []; // Clear the queue
            return updateStatusEmbed(latestUpdate);
        }
        
        config = config || loadConfig();
        if (!config) {
            console.log(chalk.red('[Bot]'), 'Cannot update status: Configuration not loaded');
            return false;
        }
        
        // Get the status channel
        let channel;
        try {
            channel = await client.channels.fetch(config.discord.channelId);
        } catch (err) {
            console.log(chalk.red('[Bot]'), `Error fetching channel: ${err.message}`);
            return false;
        }
        
        if (!channel) {
            console.log(chalk.red('[Bot]'), `Channel with ID ${config.discord.channelId} not found`);
            return false;
        }
        
        // Calculate metrics
        const metrics = calculateStatusMetrics(servicesData || []);
        
        // Create embed
        const embed = createStatusEmbed(metrics);
        
        // Update or send status message
        try {
            if (statusMessage) {
                // Update existing message
                await statusMessage.edit({ embeds: [embed] });
                return true;
            } else {
                // Try to load previous message ID
                if (!statusMessageId) {
                    const state = loadState();
                    if (state?.statusMessageId) {
                        statusMessageId = state.statusMessageId;
                    }
                }
                
                if (statusMessageId) {
                    try {
                        statusMessage = await channel.messages.fetch(statusMessageId);
                        await statusMessage.edit({ embeds: [embed] });
                        console.log(chalk.blue('[Bot]'), 'Retrieved and updated previous status message');
                        return true;
                    } catch (error) {
                        console.log(chalk.yellow('[Bot]'), 'Previous message not found, sending new one');
                        statusMessageId = null;
                    }
                }
                
                // Send new message
                statusMessage = await channel.send({ embeds: [embed] });
                statusMessageId = statusMessage.id;
                
                // Save message ID
                saveState();
                console.log(chalk.green('[Bot]'), 'New status message created');
                return true;
            }
        } catch (error) {
            console.log(chalk.red('[Bot]'), 'Error updating status message:', error.message);
            
            // If editing failed, try to send a new message
            try {
                statusMessage = await channel.send({ embeds: [embed] });
                statusMessageId = statusMessage.id;
                saveState();
                console.log(chalk.yellow('[Bot]'), 'Recreated status message after error');
                return true;
            } catch (sendError) {
                console.log(chalk.red('[Bot]'), 'Failed to send new message:', sendError.message);
                return false;
            }
        }
    } catch (error) {
        console.log(chalk.red('[Bot]'), 'Error in updateStatusEmbed:', error);
        return false;
    }
}

/**
 * Send an alert about a service status change
 */
async function sendAlert(alertData) {
    // Queue the alert and process async
    alertQueue.push(alertData);
    
    if (!processingAlerts) {
        processAlertQueue();
    }
    
    return true;
}

/**
 * Process queued alerts sequentially
 */
async function processAlertQueue() {
    if (processingAlerts || alertQueue.length === 0) return;
    
    processingAlerts = true;
    
    try {
        while (alertQueue.length > 0) {
            const alertData = alertQueue.shift();
            await sendAlertMessage(alertData);
            
            // Small delay between alerts to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    } catch (error) {
        console.log(chalk.red('[Bot]'), 'Error processing alert queue:', error.message);
    } finally {
        processingAlerts = false;
    }
}

/**
 * Send an individual alert message
 */
async function sendAlertMessage(alertData) {
    try {
        if (!client || !isReady) {
            console.log(chalk.yellow('[Bot]'), 'Cannot send alert: Bot not ready');
            return false;
        }
        
        config = config || loadConfig();
        if (!config.discord?.alerts?.enabled) {
            return false; // Alerts disabled
        }
        
        // Skip alerts for services that are in flapping state
        if (isServiceFlapping(alertData.service)) {
            console.log(chalk.yellow('[Bot]'), `Suppressing alert for flapping service: ${alertData.service}`);
            return false;
        }
        
        // Get alert channel (may be different from status channel)
        const channelId = config.discord.alerts?.channelId || config.discord.channelId;
        
        let channel;
        try {
            channel = await client.channels.fetch(channelId);
        } catch (err) {
            console.log(chalk.red('[Bot]'), `Error fetching alert channel: ${err.message}`);
            return false;
        }
        
        if (!channel) {
            console.log(chalk.red('[Bot]'), `Alert channel with ID ${channelId} not found`);
            return false;
        }
        
        // Determine color and title based on alert type
        let color, title, description;
        
        if (alertData.status === 'down') {
            color = '#ff0000';
            title = `🔴 Service Down: ${alertData.service}`;
            description = alertData.message || `Service ${alertData.service} is currently down.`;
        } else if (alertData.status === 'up') {
            color = '#00ff00';
            title = `🟢 Service Recovered: ${alertData.service}`;
            description = alertData.message || `Service ${alertData.service} has recovered.`;
        } else {
            color = '#ffaa00';
            title = `⚠️ Service Alert: ${alertData.service}`;
            description = alertData.message || `Service ${alertData.service} has an issue.`;
        }
        
        // Create embed for alert
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setDescription(description)
            .setThumbnail(config.discord.thumbnail || 'https://img.hexrift.net/HS.png')
            .addFields(
                {
                    name: 'Details',
                    value: [
                        `**Service:** ${alertData.service}`,
                        `**Time:** ${moment(alertData.time || new Date()).format('YYYY-MM-DD HH:mm:ss')}`,
                        alertData.status === 'up' && alertData.responseTime ? 
                            `**Response Time:** ${alertData.responseTime}ms` : 
                            `**Consecutive Failures:** ${alertData.failures || 1}`
                    ].join('\n'),
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({
                text: config.siteName,
                iconURL: config.discord.thumbnail
            });
        
        // Send the alert message
        await channel.send({ embeds: [embed] });
        console.log(chalk.blue('[Bot]'), `Sent ${alertData.status} alert for ${alertData.service}`);
        return true;
    } catch (error) {
        console.log(chalk.red('[Bot]'), 'Error sending alert:', error.message);
        return false;
    }
}

/**
 * Send alert about service flapping
 */
async function sendFlappingAlert(data) {
    try {
        if (!client || !isReady) {
            console.log(chalk.yellow('[Bot]'), 'Cannot send flapping alert: Bot not ready');
            return false;
        }
        
        config = config || loadConfig();
        if (!config.discord?.alerts?.enabled) {
            return false; // Alerts disabled
        }
        
        // Get alert channel (may be different from status channel)
        const channelId = config.discord.alerts?.channelId || config.discord.channelId;
        
        let channel;
        try {
            channel = await client.channels.fetch(channelId);
        } catch (err) {
            console.log(chalk.red('[Bot]'), `Error fetching alert channel: ${err.message}`);
            return false;
        }
        
        if (!channel) {
            console.log(chalk.red('[Bot]'), `Alert channel with ID ${channelId} not found`);
            return false;
        }
        
        // Create embed for flapping alert
        const embed = new EmbedBuilder()
            .setColor('#ffaa00')
            .setTitle(`🟠 Service Instability: ${data.service}`)
            .setDescription(`Service ${data.service} is rapidly changing state (flapping)`)
            .setThumbnail(config.discord.thumbnail || 'https://img.hexrift.net/HS.png')
            .addFields(
                {
                    name: 'Details',
                    value: [
                        `**Service:** ${data.service}`,
                        `**Detected:** ${moment().format('YYYY-MM-DD HH:mm:ss')}`,
                        `**State Changes:** ${data.changes} changes in monitoring window`,
                        `**Stabilization:** Service monitoring stabilized until ${moment(data.flappingUntil).format('HH:mm:ss')}`
                    ].join('\n'),
                    inline: false
                }
            )
            .setTimestamp()
            .setFooter({
                text: config.siteName,
                iconURL: config.discord.thumbnail
            });
        
        // Send the flapping alert message
        await channel.send({ embeds: [embed] });
        console.log(chalk.blue('[Bot]'), `Sent flapping alert for ${data.service}`);
        return true;
    } catch (error) {
        console.log(chalk.red('[Bot]'), 'Error sending flapping alert:', error.message);
        return false;
    }
}

/**
 * Check if a service is currently in flapping state
 */
function isServiceFlapping(serviceName) {
    if (!latestServicesData || !Array.isArray(latestServicesData)) return false;
    
    const service = latestServicesData.find(s => s.name === serviceName);
    return service && service.isFlapping;
}

/**
 * Initialize the Discord bot
 */
async function initialize() {
    return new Promise((resolve, reject) => {
        try {
            config = loadConfig();
            
            if (!config) {
                return reject(new Error('Failed to load configuration'));
            }
            
            if (!config.discord.enabled) {
                console.log(chalk.yellow('[Bot]'), 'Discord bot is disabled in config');
                return resolve(null);
            }
            
            // Set timeout for connection
            const timeoutId = setTimeout(() => {
                if (!isReady) {
                    reject(new Error('Discord bot failed to connect within timeout period'));
                }
            }, 30000);
            
            // Create the Discord client
            client = new Client({
                intents: [
                    GatewayIntentBits.Guilds, 
                    GatewayIntentBits.GuildMessages
                ]
            });
            
            // Set up ready event handler
            client.once('ready', () => {
                clearTimeout(timeoutId);
                console.log(chalk.green('[Bot]'), `Connected as ${client.user.tag}`);
                
                // Set bot presence
                client.user.setPresence({
                    activities: [{
                      name: `${config.siteName} Status`,
                      type: ActivityType.Watching
                    }],
                    status: 'online'
                  });
                
                isReady = true;
                
                // Load previous state
                loadState();
                
                // Process any pending status updates
                if (pendingStatusUpdates.length > 0) {
                    const latestUpdate = pendingStatusUpdates.pop();
                    pendingStatusUpdates = [];
                    updateStatusEmbed(latestUpdate);
                }
                
                // Reset reconnection variables
                reconnectAttempts = 0;
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                    reconnectTimer = null;
                }
                
                // Resolve with bot API
                resolve({
                    updateStatusEmbed,
                    updateServiceHistory,
                    sendAlert,
                    sendFlappingAlert,
                    cleanup
                });
            });
            
            // Error handling
            client.on('error', (error) => {
                console.log(chalk.red('[Bot]'), 'Client error:', error.message);
                handleConnectionError(error);
            });
            
            // Reconnection handling
            client.on('shardDisconnect', () => {
                console.log(chalk.yellow('[Bot]'), 'Disconnected from Discord');
                isReady = false;
                handleConnectionError(new Error('Disconnected from Discord'));
            });
            
            client.on('shardReconnecting', () => {
                console.log(chalk.blue('[Bot]'), 'Attempting to reconnect to Discord...');
            });
            
            client.on('shardResume', () => {
                console.log(chalk.green('[Bot]'), 'Reconnected to Discord');
                isReady = true;
            });
            
            // Login to Discord
            console.log(chalk.blue('[Bot]'), 'Connecting to Discord...');
            client.login(config.discord.token).catch(err => {
                clearTimeout(timeoutId);
                reject(err);
            });
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Handle connection errors with reconnection logic
 */
function handleConnectionError(error) {
    console.log(chalk.red('[Bot]'), 'Connection error:', error.message);
    
    if (reconnectTimer) {
        return; // Already attempting to reconnect
    }
    
    // Mark as not ready
    isReady = false;
    
    // Implement exponential backoff
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = RECONNECT_DELAY * Math.pow(1.5, reconnectAttempts);
        reconnectAttempts++;
        
        console.log(chalk.yellow('[Bot]'), 
            `Attempting reconnect ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${Math.round(delay/1000)}s...`);
        
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            attemptReconnect();
        }, delay);
    } else {
        console.log(chalk.red('[Bot]'), 'Maximum reconnection attempts reached. Giving up.');
    }
}

/**
 * Attempt to reconnect to Discord
 */
async function attemptReconnect() {
    try {
        if (client) {
            // Try to destroy the client first
            try {
                await client.destroy();
            } catch (destroyError) {
                console.log(chalk.yellow('[Bot]'), 'Error destroying client:', destroyError.message);
                // Continue despite error
            }
        }
        
        // Create a new client
        client = new Client({
            intents: [
                GatewayIntentBits.Guilds, 
                GatewayIntentBits.GuildMessages
            ]
        });
        
        // Set up event handlers
        client.once('ready', () => {
            console.log(chalk.green('[Bot]'), `Reconnected as ${client.user.tag}`);
            
            // Set bot presence
            client.user.setPresence({
                activities: [{
                    name: `${config.siteName}`,
                    type: ActivityType.Watching
                }],
                status: 'online'
            });
            
            isReady = true;
            statusMessage = null; // Reset message reference
            
            // Process any pending status updates
            if (pendingStatusUpdates.length > 0) {
                const latestUpdate = pendingStatusUpdates.pop();
                pendingStatusUpdates = [];
                updateStatusEmbed(latestUpdate);
            } else {
                // Force a refresh with latest data
                if (latestServicesData.length > 0) {
                    updateStatusEmbed(latestServicesData);
                }
            }
        });
        
        // Error handling
        client.on('error', (error) => {
            console.log(chalk.red('[Bot]'), 'Client error during reconnect:', error.message);
            handleConnectionError(error);
        });
        
        // Reconnection events
        client.on('shardDisconnect', () => {
            console.log(chalk.yellow('[Bot]'), 'Disconnected from Discord during reconnect');
            isReady = false;
            handleConnectionError(new Error('Disconnected from Discord during reconnect'));
        });
        
        // Attempt to login
        await client.login(config.discord.token);
    } catch (error) {
        console.log(chalk.red('[Bot]'), 'Reconnection attempt failed:', error.message);
        handleConnectionError(error);
    }
}

/**
 * Start scheduled status updates
 */
function startStatusUpdates() {
    // Update immediately, then start interval
    updateStatusEmbed(latestServicesData);
    
    // Set up interval for updates
    const updateInterval = config.discord.updateInterval || 60000;
    const intervalId = setInterval(() => {
        if (isReady && latestServicesData.length > 0) {
            updateStatusEmbed(latestServicesData);
        }
    }, updateInterval);
    
    console.log(chalk.blue('[Bot]'), `Status updates scheduled every ${updateInterval / 1000} seconds`);
    
    // Return interval ID for cleanup
    return intervalId;
}

/**
 * Clean up resources before shutdown
 */
async function cleanup() {
    try {
        console.log(chalk.blue('[Bot]'), 'Cleaning up Discord bot resources...');
        
        // Save current state
        if (statusMessageId) {
            saveState();
        }
        
        // Clear any timers
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        
        // Destroy client if connected
        if (client) {
            try {
                await client.destroy();
                client = null;
                isReady = false;
                console.log(chalk.green('[Bot]'), 'Discord connection closed');
            } catch (error) {
                console.log(chalk.red('[Bot]'), 'Error destroying client:', error.message);
            }
        }
        
        return true;
    } catch (error) {
        console.log(chalk.red('[Bot]'), 'Error during cleanup:', error.message);
        return false;
    }
}

// Export the bot API
module.exports = {
    initialize,
    updateStatusEmbed,
    updateServiceHistory,
    sendAlert,
    sendFlappingAlert,
    cleanup
};


