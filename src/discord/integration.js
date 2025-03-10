/**
 * Discord Bot Integration
 * Connects the service status system with the Discord notification bot
 */
const discordBot = require('./bot');
const chalk = require('chalk');

// Bot instance
let bot = null;
// Tracks previous service states to detect changes
let previousServiceStates = {};
// Initialized flag
let isInitialized = false;

/**
 * Initialize the Discord bot integration
 */
async function initialize() {
  try {
    console.log(chalk.blue('[Discord]'), 'Initializing Discord bot integration...');
    
    // Initialize the Discord bot
    bot = await discordBot.initialize();
    
    if (!bot) {
      console.log(chalk.yellow('[Discord]'), 'Discord bot is disabled or failed to initialize');
      return false;
    }
    
    isInitialized = true;
    console.log(chalk.green('[Discord]'), 'Bot integration initialized successfully');
    return true;
  } catch (error) {
    console.error(chalk.red('[Discord]'), 'Failed to initialize bot integration:', error.message);
    return false;
  }
}

/**
 * Update service statuses in Discord
 * @param {Array} services - Current service data
 */
async function updateServiceStatuses(services) {
  if (!isInitialized || !bot) {
    return false;
  }
  
  try {
    // Format services for the Discord bot embed
    const formattedServices = services.map(service => {
      // Extract the status data from service
      const { id, name, url } = service;
      const { current, uptime, responseTime } = service.statusData || {};
      
      // Create a service object the bot can understand
      return {
        name: name,
        id: id,
        url: url,
        status: current === 'up' ? 'up' : 'down',
        uptime: uptime || 0,
        isFlapping: service.isFlapping || false,
        ping: Array.isArray(responseTime) 
          ? responseTime.map(rt => rt.value).filter(v => v !== null && v !== undefined)
          : []
      };
    });
    
    // Update the Discord embed with current services data
    await bot.updateStatusEmbed(formattedServices);
    
    // Check for status changes and send alerts
    await checkForStatusChanges(services);
    
    return true;
  } catch (error) {
    console.error(chalk.red('[Discord]'), 'Failed to update service statuses:', error.message);
    return false;
  }
}

/**
 * Check for service status changes and send alerts
 * @param {Array} services - Current service data 
 */
async function checkForStatusChanges(services) {
  if (!isInitialized || !bot) {
    return;
  }
  
  try {
    services.forEach(service => {
      const serviceId = service.id;
      const currentStatus = service.statusData?.current || 'unknown';
      const previousStatus = previousServiceStates[serviceId]?.status || null;
      
      // Skip if it's the first check or status is unknown
      if (previousStatus === null || currentStatus === 'unknown') {
        previousServiceStates[serviceId] = { 
          status: currentStatus,
          lastChange: new Date().toISOString()
        };
        return;
      }
      
      // Status has changed, send an alert
      if (previousStatus !== currentStatus) {
        const responseTime = service.statusData?.responseTime;
        const latestResponseTime = responseTime && responseTime.length > 0 
          ? responseTime[responseTime.length - 1].value
          : null;
        
        console.log(chalk.blue('[Discord]'), 
          `Service ${service.name} changed status from ${previousStatus} to ${currentStatus}`);
        
        // Send alert to Discord
        bot.sendAlert({
          service: service.name,
          status: currentStatus,
          time: new Date(),
          message: `Service ${service.name} is now ${currentStatus === 'up' ? 'operational' : 'experiencing issues'}.`,
          responseTime: latestResponseTime,
          failures: currentStatus === 'down' ? 1 : 0
        });
        
        // Update the service history
        if (latestResponseTime) {
          bot.updateServiceHistory(service.name, latestResponseTime);
        }
        
        // Update previous state
        previousServiceStates[serviceId] = {
          status: currentStatus,
          lastChange: new Date().toISOString()
        };
      }
    });
  } catch (error) {
    console.error(chalk.red('[Discord]'), 'Error checking for status changes:', error.message);
  }
}

/**
 * Detect and alert on flapping services
 * @param {Object} service - Service with flapping status
 * @param {Number} changes - Number of status changes detected 
 */
async function alertServiceFlapping(service, changes) {
  if (!isInitialized || !bot) {
    return false;
  }
  
  try {
    // Calculate flapping stabilization time (5 minutes from now)
    const flappingUntil = new Date();
    flappingUntil.setMinutes(flappingUntil.getMinutes() + 5);
    
    await bot.sendFlappingAlert({
      service: service.name,
      changes: changes,
      flappingUntil: flappingUntil.toISOString()
    });
    
    return true;
  } catch (error) {
    console.error(chalk.red('[Discord]'), 'Failed to send flapping alert:', error.message);
    return false;
  }
}

/**
 * Cleanup before shutdown
 */
async function cleanup() {
  if (!isInitialized || !bot) {
    return;
  }
  
  try {
    await bot.cleanup();
    console.log(chalk.blue('[Discord]'), 'Bot integration cleaned up successfully');
  } catch (error) {
    console.error(chalk.red('[Discord]'), 'Error during cleanup:', error.message);
  }
}

module.exports = {
  initialize,
  updateServiceStatuses,
  alertServiceFlapping,
  cleanup
};
