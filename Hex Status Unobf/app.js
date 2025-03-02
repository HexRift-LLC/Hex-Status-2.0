const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const ping = require('ping');
const moment = require('moment');
const discordBot = require('./discord/bot.js');
const yaml = require('js-yaml');
const fs = require('fs');
const chalk = require('chalk');
const figlet = require('figlet');
const axios = require('axios');
const { version } = require('./package.json');

// Load configuration
const config = yaml.load(fs.readFileSync('./config/config.yml', 'utf8'));
  class HexStatus {
      static HEALTH_DECAY_RATE = 0.5;
      static HEALTH_RECOVERY_RATE = 1;
      static OFFLINE_RESPONSE_TIME = 9999;

      #PRODUCT_ID = "Hex Status 2.0";
      #currentVersion = version;
    
      constructor() {
          this.botService = null;
          this.server = http;
          this.isShuttingDown = false;
          this.serviceData = new Map();
          this.initializeServices();
        
          fs.watch('./config/config.yml', (eventType, filename) => {
              if (eventType === 'change') {
                  try {
                      const newConfig = yaml.load(fs.readFileSync('./config/config.yml', 'utf8'));
                      Object.assign(config, newConfig);
                    
                      this.serviceData.clear();
                      this.initializeServices();
                    
                      console.log(chalk.green('[Config]'), 'Configuration updated successfully');
                    
                      io.emit('configUpdate', {
                          config: config,
                          services: config.services
                      });
                  } catch (error) {
                      console.log(chalk.red('[Config]'), 'Error updating configuration:', error.message);
                  }
              }
          });
      }

      initializeServices() {
          config.services.forEach(service => {
              this.serviceData.set(service.name, {
                  ping: [],
                  status: 'unknown',
                  uptime: {
                      total: 100,
                      history: [],
                      lastDowntime: null,
                      totalDowntime: 0
                  },
                  lastCheck: Date.now(),
                  downtimes: [],
                  healthScore: 100,
                  responseTime: []
              });
          });
      }

      async startServer() {
          try {
              this.displayWelcome();
              await this.checkVersion();
              this.setupRoutes();
              this.setupMonitoring();
              this.setupGracefulShutdown();
            
              this.server.listen(config.app.port, () => {
                  console.log(chalk.yellow("[System]"), `Server running on port ${config.app.port}`);
              });
          } catch (error) {
              console.log(chalk.red("[Error]"), "Failed to start server:", error.message);
              process.exit(1);
          }
      }

      async checkVersion() {
          try {
              const response = await axios.get(
                  `https://hexarion.net/api/version/${this.#PRODUCT_ID}?current=${this.#currentVersion}`,
                  {
                      headers: {
                          "x-api-key": "8IOLaAYzGJNwcYb@bm1&WOcr%aK5!O",
                      },
                  }
              );

              if (!response.data.version) {
                  console.log(chalk.yellow("[Updater]"), "Version information not available");
                  return;
              }

              if (response.data.same) {
                  console.log(chalk.green("[Updater]"), `Hex Status (v${this.#currentVersion}) is up to date!`);
              } else {
                  console.log(chalk.red("[Updater]"), 
                      `Hex Status (v${this.#currentVersion}) is outdated. Update to v${response.data.version}.`);
              }
          } catch (error) {
              console.log(chalk.red("[Updater]"), "Version check failed:", 
                  error.response?.data?.error || error.message);
          }
      }

      setupRoutes() {
          app.set('view engine', 'ejs');
          app.use(express.static('public'));
          app.locals.config = config;
          app.get('/', (req, res) => {
              res.render('index', {
                  config: config,
                  version: this.#currentVersion,
                  services: config.services,
                  serviceData: this.serviceData,
                  stats: this.calculateStats(),
                  moment: moment
              });
          });
      }

      setupMonitoring() {
          const monitorInterval = setInterval(
              () => this.monitorServices(), 
              config.app.refreshInterval
          );
      }

      calculateUptime(downtimes) {
          const now = Date.now();
          const dayAgo = now - (24 * 60 * 60 * 1000); // 24 hours ago
          
          const totalDowntime = downtimes.reduce((total, downtime) => {
              const start = Math.max(dayAgo, new Date(downtime.start).getTime());
              const end = downtime.end ? new Date(downtime.end).getTime() : now;
              return total + (end - start);
          }, 0);

          const uptimePercentage = ((24 * 60 * 60 * 1000) - totalDowntime) / (24 * 60 * 60 * 1000) * 100;
          return Math.max(0, Math.min(100, uptimePercentage));
      }

      async monitorServices() {
          for (const service of config.services) {
              try {
                  const result = await ping.promise.probe(service.url);
                  const data = this.serviceData.get(service.name);
                  const previousStatus = data.status;
                  
                  data.status = result.alive ? 'up' : 'down';
                  data.lastCheck = Date.now();

                  // Update downtimes tracking
                  if (data.status === 'down' && previousStatus !== 'down') {
                      data.downtimes.push({
                          start: new Date().toISOString(),
                          end: null
                      });
                  } else if (data.status === 'up' && previousStatus === 'down') {
                      const lastDowntime = data.downtimes[data.downtimes.length - 1];
                      if (lastDowntime) {
                          lastDowntime.end = new Date().toISOString();
                      }
                  }

                  // Calculate current uptime
                  data.uptime = this.calculateUptime(data.downtimes);

                  if (result.alive) {
                      data.healthScore = Math.min(100, data.healthScore + HexStatus.HEALTH_RECOVERY_RATE);
                  } else {
                      data.healthScore = Math.max(0, data.healthScore - HexStatus.HEALTH_DECAY_RATE);
                  }

                  if (result.alive) {
                      data.ping.push(result.time);
                  } else {
                      data.ping.push(HexStatus.OFFLINE_RESPONSE_TIME);
                  }

                  if (data.ping.length > config.monitoring.maxHistoryPoints) {
                      data.ping.shift();
                  }

                  this.emitStatusUpdate(service.name, data);

              } catch (error) {
                  this.handleMonitoringError(service.name, error);
              }
          }
      }

      updateDowntimeTracking(data, previousStatus) {
          if (previousStatus === 'up' && data.status === 'down') {
              data.downtimes.push({
                  start: moment().format(),
                  end: null
              });
          } else if (previousStatus === 'down' && data.status === 'up') {
              const lastDowntime = data.downtimes[data.downtimes.length - 1];
              if (lastDowntime) lastDowntime.end = moment().format();
          }
      }

      emitStatusUpdate(serviceName, data) {
          io.emit('statusUpdate', {
              service: serviceName,
              data: {
                  status: data.status,
                  ping: data.ping,
                  uptime: data.uptime,
                  healthScore: data.healthScore,
                  lastCheck: data.lastCheck,
                  responseTime: data.responseTime
              },
              stats: this.calculateStats()
          });
      }

      handleMonitoringError(serviceName, error) {
          const data = this.serviceData.get(serviceName);
          data.status = 'down';
          data.healthScore = 0;
          data.uptime = 0;
        
          io.emit('statusUpdate', {
              service: serviceName,
              data: {
                  status: 'down',
                  healthScore: 0,
                  uptime: 0,
                  error: error.message
              },
              stats: this.calculateStats()
          });
      }

      calculateStats() {
          let totalUp = 0;
          let totalDown = 0;
          let avgPing = 0;
          let pingCount = 0;

          this.serviceData.forEach(data => {
              if (data.status === 'up') totalUp++;
              if (data.status === 'down') totalDown++;
              if (data.ping.length) {
                  avgPing += data.ping.reduce((a, b) => a + b, 0);
                  pingCount += data.ping.length;
              }
          });

          return {
              totalServices: config.services.length,
              servicesUp: totalUp,
              servicesDown: totalDown,
              averagePing: pingCount ? (avgPing / pingCount).toFixed(2) : 0,
              overallHealth: ((totalUp / config.services.length) * 100).toFixed(1)
          };
      }

      calculateUptime(downtimes) {
        const now = Date.now();
        const dayAgo = now - (24 * 60 * 60 * 1000);
        
        const totalDowntime = downtimes.reduce((total, downtime) => {
            const start = Math.max(dayAgo, new Date(downtime.start).getTime());
            const end = downtime.end ? new Date(downtime.end).getTime() : now;
            return total + (end - start);
        }, 0);
    
        const uptimePercentage = ((24 * 60 * 60 * 1000) - totalDowntime) / (24 * 60 * 60 * 1000) * 100;
        return uptimePercentage.toFixed(2);
    }
    

      displayWelcome() {
          console.clear();
          console.log("\n");
          console.log(
              chalk.red(
                  figlet.textSync("Hex Status", {
                      font: "ANSI Shadow",
                      horizontalLayout: "full",
                  })
              )
          );
          console.log("\n");
          console.log(chalk.red("━".repeat(70)));
          console.log(
              chalk.white.bold(
                  "      Welcome to Hex Status - The Ultimate Status Page Solution   "
              )
          );
          console.log(chalk.red("━".repeat(70)), "\n");
      }

      setupGracefulShutdown() {
          const shutdown = async () => {
              if (this.isShuttingDown) return;
              this.isShuttingDown = true;
    
              console.log(chalk.yellow("[System]"), "Graceful shutdown initiated...");
    
              const forceKillTimeout = setTimeout(() => {
                  console.log(chalk.red("[System]"), "Force killing process after timeout");
                  process.exit(1);
              }, 5000);
    
              try {
                  if (this.server) {
                      await new Promise(resolve => this.server.close(resolve));
                  }
    
                  if (this.botService) {
                      await this.botService.cleanup();
                  }
    
                  clearTimeout(forceKillTimeout);
                  console.log(chalk.green("[System]"), "Graceful shutdown completed");
                  process.exit(0);
              } catch (error) {
                  clearTimeout(forceKillTimeout);
                  console.error(chalk.red("[Error]"), "Shutdown error:", error);
                  process.exit(1);
              }
          };
    
          process.on('SIGTERM', shutdown);
          process.on('SIGINT', shutdown);
          process.on('uncaughtException', (error) => {
              console.error(chalk.red("[Error]"), "Uncaught Exception:", error);
              shutdown();
          });
      }
}  

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error(chalk.red("[Error]"), 'Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the application
new HexStatus().startServer();
