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
const db = require('./config/database');
const chokidar = require('chokidar');
const path = require('path');

const config = yaml.load(fs.readFileSync(path.join(__dirname, 'config', 'config.yml'), 'utf8'));

class HexStatus {
    #PRODUCT_ID = "Hex Status 2.0";
    #currentVersion = "1.0.0";
    
    constructor() {
        this.botService = null;
        this.server = http;
        this.isShuttingDown = false;
        this.serviceData = new Map();
        this.setupConfigWatcher();
        this.setupMonitoring = this.setupMonitoring.bind(this); // Bind the method to ensure proper `this`

    }

    async setupMonitoring() {
        this.monitorServices();
        setInterval(() => this.monitorServices(), config.app.refreshInterval);
    }

    setupConfigWatcher() {
        const configPath = path.join(__dirname, 'config', 'config.yml');
        chokidar.watch(configPath).on('change', () => {
            try {
                const newConfig = yaml.load(fs.readFileSync(configPath, 'utf8'));
                Object.assign(config, newConfig);

                this.initializeServices().then(() => this.monitorServices());

                console.log(chalk.green("[Config]"), "Configuration reloaded successfully");
            } catch (error) {
                console.error(chalk.red("[Config]"), "Error reloading configuration:", error);
            }
        });
    }

    async initializeServices() {
        try {
            for (const service of config.services) {
                const serviceDoc = await db.Service.findOneAndUpdate(
                    { name: service.name },
                    {
                        name: service.name,
                        status: 'unknown',
                        ping: [],
                        uptime: 100,
                        lastCheck: Date.now(),
                        downtimes: [],
                        healthScore: 100,
                        responseTime: [],
                        uptimeHistory: [],
                        healthScoreHistory: [],
                        category: service.category
                    },
                    { upsert: true, new: true }
                );
                this.serviceData.set(service.name, serviceDoc);
            }
        } catch (error) {
            console.error(chalk.red("[Database]"), "Service initialization failed:", error);
            throw error;
        }
    }

    setupSocketIO() {
        io.on('connection', (socket) => {
            console.log(chalk.green("[Socket]"), "Client connected");

            socket.on('requestUpdate', async () => {
                const stats = await this.calculateStats();
                const services = Array.from(this.serviceData.values());
                socket.emit('statsUpdate', { stats, services });
            });

            socket.on('disconnect', () => {
                console.log(chalk.yellow("[Socket]"), "Client disconnected");
            });
        });
    }

    async startServer() {
        try {
            this.displayWelcome();
            await db.connect();
            await this.initializeServices();
            await this.checkVersion();
            this.setupSocketIO();
            this.setupRoutes();
            this.setupMonitoring();
            this.setupGracefulShutdown();
            
            this.server.listen(config.app.port, () => {
                console.log(chalk.yellow("[System]"), `Server running on port ${config.app.port}`);
            });
        } catch (error) {
            console.error(chalk.red("[Error]"), "Failed to start server:", error.message);
            process.exit(1);
        }
    }

    async checkVersion() {
        try {
            const response = await axios.get(
                `https://hexarion.net/api/version/${this.#PRODUCT_ID}?current=${this.#currentVersion}`,
                { 
                    headers: { "x-api-key": "8IOLaAYzGJNwcYb@bm1&WOcr%aK5!O" },
                    timeout: 5000
                }
            );

            if (!response.data.version) {
                console.log(chalk.yellow("[Updater]"), "Version information not available");
                return;
            }

            if (response.data.same) {
                console.log(chalk.green("[Updater]"), `Hex Status (v${this.#currentVersion}) is up to date!`);
            } else {
                console.log(chalk.red("[Updater]"), `Hex Status (v${this.#currentVersion}) is outdated. Update to v${response.data.version}.`);
                await this.cleanup();
                process.exit(1);
            }
        } catch (error) {
            console.error(chalk.red("[Updater]"), "Version check failed:", error.response?.data?.error || error.message);
        }
    }

    setupRoutes() {
        app.set('view engine', 'ejs');
        app.use(express.static('public'));

        app.get('/', async (req, res) => {
            try {
                const services = Array.from(this.serviceData.entries()).map(([name, data]) => ({
                    name,
                    ...data.toObject()
                }));

                res.render('index', {
                    config,
                    services,
                    serviceData: this.serviceData,
                    stats: await this.calculateStats(),
                    moment
                });
            } catch (error) {
                res.status(500).send('Internal Server Error');
            }
        });

        app.get('/api/status', async (req, res) => {
            try {
                const stats = await this.calculateStats();
                const services = Array.from(this.serviceData.values());
                res.json({ stats, services });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    async monitorServices() {
        const monitoringPromises = config.services.map(service => this.monitorService(service));
        await Promise.allSettled(monitoringPromises);
        await this.updateDiscordStatus();
    }

    async monitorService(service) {
        try {
            const startTime = Date.now();
            const result = await ping.promise.probe(service.url, {
                timeout: config.monitoring.pingTimeout
            });

            const serviceData = this.serviceData.get(service.name);
            const previousStatus = serviceData.status;
            const currentStatus = result.alive ? 'up' : 'down';

            serviceData.status = currentStatus;
            serviceData.lastCheck = Date.now();

            if (currentStatus === 'up') {
                serviceData.ping.push(result.time);
                serviceData.healthScore = Math.min(100, parseFloat(serviceData.healthScore) + 0.5).toFixed(1);
                serviceData.uptime = Math.min(100, parseFloat(serviceData.uptime) + 0.2).toFixed(2);
            } else {
                serviceData.ping.push(0);
                serviceData.healthScore = Math.max(0, parseFloat(serviceData.healthScore) - 2).toFixed(1);
                serviceData.uptime = Math.max(0, parseFloat(serviceData.uptime) - 1).toFixed(2);
            }

            if (serviceData.ping.length > config.monitoring.maxHistoryPoints) {
                serviceData.ping.shift();
            }

            await serviceData.save();

            io.emit('statusUpdate', {
                service: service.name,
                data: {
                    status: serviceData.status,
                    ping: serviceData.ping,
                    healthScore: serviceData.healthScore,
                    uptime: serviceData.uptime,
                    lastCheck: serviceData.lastCheck
                },
                stats: await this.calculateStats()
            });
        } catch (error) {
            await this.handleMonitoringError(service.name, error);
        }
    }

    async handleMonitoringError(serviceName, error) {
        try {
            const serviceData = this.serviceData.get(serviceName);
            const previousStatus = serviceData.status;

            serviceData.status = 'down';
            serviceData.healthScore = 0;
            serviceData.lastCheck = Date.now();

            this.updateDowntimeTracking(serviceData, previousStatus);
            serviceData.uptime = this.calculateUptime(serviceData.downtimes);

            await serviceData.save();

            io.emit('statusUpdate', {
                service: serviceName,
                data: serviceData,
                error: error.message,
                stats: await this.calculateStats()
            });

            console.error(chalk.red("[Monitoring]"), `Error monitoring ${serviceName}:`, error.message);
        } catch (dbError) {
            console.error(chalk.red("[Database]"), "Error saving service state:", dbError);
        }
    }

    displayWelcome() {
        figlet('Hex Status 2.0', (err, data) => {
            if (err) console.log(chalk.red("[System]"), "Welcome message error:", err);
            else console.log(chalk.cyan(data));
        });
    }

    async cleanup() {
        try {
            await db.disconnect();
            console.log(chalk.green("[System]"), "Clean shutdown complete.");
        } catch (error) {
            console.error(chalk.red("[System]"), "Cleanup failed:", error);
        }
    }

    async setupGracefulShutdown() {
        process.on('SIGINT', async () => {
            console.log(chalk.yellow("[System]"), "Shutting down...");
            await this.cleanup();
            process.exit();
        });
    }
}

const hexStatus = new HexStatus();
hexStatus.startServer();
