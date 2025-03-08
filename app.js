/**
 * Hex Status 2.0 - Main Application
 * Enhanced implementation with improved monitoring and Discord integration
 */

const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);
const ping = require("ping");
const moment = require("moment");
const yaml = require("js-yaml");
const fs = require("fs");
const chalk = require("chalk");
const figlet = require("figlet");
const axios = require("axios");
const path = require("path");
const { version } = require("./package.json");
const discordBot = require("./discord/bot.js");
const isValidUrl = require("is-valid-http-url");

/**
 * HexStatus - Modern Status Page System
 * Enhanced and optimized implementation
 */
class HexStatus {
  // Constants
  static HEALTH_DECAY_RATE = 0.5;
  static HEALTH_RECOVERY_RATE = 1;
  static OFFLINE_RESPONSE_TIME = 9999;
  static MAX_HISTORY_LENGTH = 100;
  static NOTIFICATION_THRESHOLD = 2; // Number of consecutive failures before notification
  static STATUS_UPDATE_THROTTLE = 250; // Ms to throttle status updates
  static FLAPPING_WINDOW = 5 * 60 * 1000; // 5 minutes window for flapping detection
  static FLAPPING_THRESHOLD = 3; // Number of status changes to consider as flapping
  static FLAPPING_COOLDOWN = 15 * 60 * 1000; // 15 minutes stabilization period
  static STABLE_DURATION = 2 * 60 * 1000; // 2 minutes of stability required during flapping

  // Private properties
  #PRODUCT_ID = "Hex Status 2.0";
  #currentVersion = version;
  #configWatcher = null;
  #monitorInterval = null;
  #lastStatusUpdate = {};
  #discordReconnectTimer = null;

  constructor() {
    this.discordBot = null;
    this.server = http;
    this.isShuttingDown = false;
    this.serviceData = new Map();
    this.config = this.loadConfig();
    this.setupSocketIO();
    this.initializeServices();
    this.setupConfigWatcher();

    // Create data directory if it doesn't exist
    if (!fs.existsSync("./data")) {
      fs.mkdirSync("./data", { recursive: true });
    }
  }

  /**
   * Load configuration from YAML file
   */
  loadConfig() {
    try {
      return yaml.load(fs.readFileSync("./config/config.yml", "utf8"));
    } catch (error) {
      console.log(
        chalk.red("[Config]"),
        "Error loading configuration:",
        error.message
      );
      process.exit(1);
    }
  }

  /**
   * Initialize service monitoring data
   */
  initializeServices() {
    this.config.services.forEach((service) => {
      // Fix service URL if protocol is missing
      if (
        service.url &&
        !service.url.startsWith("http://") &&
        !service.url.startsWith("https://")
      ) {
        service.url = "https://" + service.url;
      }

      if (!this.serviceData.has(service.name)) {
        this.serviceData.set(service.name, {
          ping: [],
          status: "unknown",
          uptime: 100,
          lastCheck: Date.now(),
          downtimes: [],
          healthScore: 100,
          responseTime: [],
          consecutiveFailures: 0,
          lastNotification: null,
          incidents: [],
          maintenance: false,
          statusHistory: [], // For flapping detection
          isFlapping: false,
          flappingUntil: null,
        });
      }
    });

    // Clean up any removed services
    const activeServiceNames = this.config.services.map((s) => s.name);
    for (const [serviceName, _] of this.serviceData) {
      if (!activeServiceNames.includes(serviceName)) {
        this.serviceData.delete(serviceName);
      }
    }
  }

  /**
   * Set up Socket.IO for real-time updates
   */
  setupSocketIO() {
    io.on("connection", (socket) => {
      // Send initial data to new clients
      this.sendInitialDataToClient(socket);

      // Handle various client events
      socket.on("requestRefresh", () => {
        this.monitorServices();
      });
    });
  }

  /**
   * Send initial data to a new client
   */
  sendInitialDataToClient(socket) {
    // Prepare the service data for client
    const clientServiceData = {};

    for (const [name, data] of this.serviceData.entries()) {
      clientServiceData[name] = {
        status: data.status,
        ping: data.ping,
        uptime: data.uptime,
        healthScore: data.healthScore,
        lastCheck: data.lastCheck,
        responseTime: data.ping[data.ping.length - 1] || 0,
        isFlapping: data.isFlapping || false,
      };
    }

    // Calculate stats
    const stats = this.calculateStats();

    // Emit to the specific client
    socket.emit("initialData", {
      services: this.config.services,
      serviceData: clientServiceData,
      stats: stats,
    });
  }

  /**
   * Set up file watcher for config changes
   */
  setupConfigWatcher() {
    // Clear existing watcher if any
    if (this.#configWatcher) {
      this.#configWatcher.close();
    }

    this.#configWatcher = fs.watch(
      "./config/config.yml",
      (eventType, filename) => {
        if (eventType === "change") {
          try {
            const newConfig = yaml.load(
              fs.readFileSync("./config/config.yml", "utf8")
            );

            // Check for added services
            const newServices = newConfig.services.filter(
              (newSvc) =>
                !this.config.services.some(
                  (oldSvc) => oldSvc.name === newSvc.name
                )
            );

            // Check for removed services
            const removedServices = this.config.services.filter(
              (oldSvc) =>
                !newConfig.services.some(
                  (newSvc) => newSvc.name === oldSvc.name
                )
            );

            this.config = newConfig;

            // Reinitialize services to add new ones and update existing ones
            this.initializeServices();

            console.log(
              chalk.green("[Config]"),
              "Configuration updated successfully"
            );

            // Notify about added services
            newServices.forEach((service) => {
              console.log(
                chalk.green("[Config]"),
                `New service added: ${service.name}`
              );
              io.emit("serviceAdded", service);
            });

            // Notify about removed services
            removedServices.forEach((service) => {
              console.log(
                chalk.yellow("[Config]"),
                `Service removed: ${service.name}`
              );
              io.emit("serviceRemoved", service.name);
            });

            // Notify all clients about the config update
            io.emit("configUpdate", {
              config: this.config,
              services: this.config.services,
            });

            // Force an immediate monitoring run
            this.monitorServices();
          } catch (error) {
            console.log(
              chalk.red("[Config]"),
              "Error updating configuration:",
              error.message
            );
          }
        }
      }
    );
  }

  /**
   * Start the application server
   */
  async startServer() {
    try {
      this.displayWelcome();
      const AuthModule = require('./API/checker.js');
      const AuthenticationManager = AuthModule.default || AuthModule;
      const authManager = new AuthenticationManager();
      await authManager.validate();
      this.setupRoutes();

      // Set up Discord bot if enabled
      if (this.config.discord && this.config.discord.enabled) {
        try {
          console.log(chalk.blue("[Discord]"), "Setting up Discord bot...");
          this.discordBot = await discordBot.initialize();
          // Only after initialization is complete, the bot is ready
          console.log(chalk.green("[Discord]"), "Discord bot initialized");
        } catch (error) {
          console.log(
            chalk.yellow("[Discord]"),
            "Discord integration disabled due to error:",
            error.message
          );
        }
      }

      // Start monitoring
      this.setupMonitoring();
      this.setupGracefulShutdown();

      // Start the HTTP server
      this.server.listen(this.config.app.port, () => {
        console.log(
          chalk.green("[Server]"),
          `Running on port ${this.config.app.port}`
        );
        console.log(
          chalk.blue("[Server]"),
          `Dashboard available at http://localhost:${this.config.app.port}`
        );
      });
    } catch (error) {
      console.log(
        chalk.red("[Error]"),
        "Failed to start server:",
        error.message
      );
      process.exit(1);
    }
  }

  /**
   * Set up Express routes
   */
  setupRoutes() {
    // Set up EJS template engine
    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "views"));

    // Serve static files
    app.use(express.static("public"));

    // Make config available to templates
    app.locals.config = this.config;

    // Main dashboard route
    app.get("/", (req, res) => {
      res.render("index", {
        config: this.config,
        version: this.#currentVersion,
        services: this.config.services,
        serviceData: this.serviceData,
        stats: this.calculateStats(),
        moment: moment,
      });
    });

    // API routes for data access
    app.get("/api/status", (req, res) => {
      res.json({
        status: "operational",
        version: this.#currentVersion,
        stats: this.calculateStats(),
        services: this.config.services.map((service) => {
          const data = this.serviceData.get(service.name);
          return {
            name: service.name,
            category: service.category,
            status: data.status,
            uptime: data.uptime,
            healthScore: data.healthScore,
            lastCheck: data.lastCheck,
            isFlapping: data.isFlapping || false,
          };
        }),
      });
    });

    // Individual service status API
    app.get("/api/services/:name", (req, res) => {
      const service = this.config.services.find(
        (s) => s.name === req.params.name
      );
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      const data = this.serviceData.get(service.name);
      res.json({
        name: service.name,
        url: service.url,
        category: service.category,
        status: data.status,
        uptime: data.uptime,
        healthScore: data.healthScore,
        responseTime: data.ping[data.ping.length - 1] || 0,
        lastCheck: data.lastCheck,
        incidents: data.incidents,
        isFlapping: data.isFlapping || false,
      });
    });
  }

  /**
   * Set up the monitoring interval
   */
  setupMonitoring() {
    // Clear existing interval if any
    if (this.#monitorInterval) {
      clearInterval(this.#monitorInterval);
    }

    // Set up new monitoring interval
    this.#monitorInterval = setInterval(
      () => this.monitorServices(),
      this.config.app.refreshInterval
    );

    // Run monitoring immediately on startup
    this.monitorServices();
  }

  /**
   * Calculate uptime percentage for a service
   */
  calculateUptime(downtimes) {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000; // 24 hours ago

    const totalDowntime = downtimes.reduce((total, downtime) => {
      // Only count downtimes that started or continued in the last 24 hours
      if (
        new Date(downtime.start).getTime() > dayAgo ||
        (downtime.end && new Date(downtime.end).getTime() > dayAgo)
      ) {
        const start = Math.max(dayAgo, new Date(downtime.start).getTime());
        const end = downtime.end
          ? Math.min(now, new Date(downtime.end).getTime())
          : now;
        return total + (end - start);
      }
      return total;
    }, 0);

    const uptimePercentage =
      ((24 * 60 * 60 * 1000 - totalDowntime) / (24 * 60 * 60 * 1000)) * 100;
    return Math.max(0, Math.min(100, uptimePercentage)).toFixed(2);
  }

  /**
   * Monitor all services
   */
  async monitorServices() {
    if (this.isShuttingDown) return;

    const startTime = Date.now();

    const monitoringPromises = this.config.services.map((service) =>
      this.monitorService(service)
    );
    await Promise.all(monitoringPromises);

    // Update overall stats
    const stats = this.calculateStats();
    io.emit("statsUpdate", stats);

    const duration = Date.now() - startTime;

    // Update Discord status if bot is available
    if (
      this.discordBot &&
      typeof this.discordBot.updateStatusEmbed === "function"
    ) {
      try {
        // Convert your serviceData Map to an array of service objects
        const servicesDataArray = Array.from(this.serviceData.entries()).map(
          ([name, data]) => {
            return {
              name,
              status: data.status,
              ping: data.ping,
              uptime: data.uptime,
              downtimes: data.downtimes,
              healthScore: data.healthScore,
              isFlapping: data.isFlapping || false,
            };
          }
        );

        // Pass the current service data to the bot
        await this.discordBot.updateStatusEmbed(servicesDataArray);
      } catch (error) {
        this.handleDiscordError(error);
      }
    }
  }

  /**
   * Check if service is flapping and should be stabilized
   */
  checkFlapping(serviceName, data, newStatus) {
    // Initialize flapping detection data if not present
    if (!data.statusHistory) {
      data.statusHistory = [];
    }

    const now = Date.now();

    // Add current status change to history
    data.statusHistory.push({
      timestamp: now,
      status: newStatus,
    });

    // Keep only recent history
    data.statusHistory = data.statusHistory.filter(
      (entry) => entry.timestamp > now - HexStatus.FLAPPING_WINDOW
    );

    // If we're in a flapping cooldown period, we need special handling
    if (data.flappingUntil && data.flappingUntil > now) {
      console.log(
        chalk.yellow("[Monitor]"),
        `Service ${serviceName} in flapping cooldown period until ${new Date(
          data.flappingUntil
        ).toLocaleTimeString()}`
      );

      // During flapping cooldown, we only change status if it's been stable for some time
      const lastChanges = [];
      let lastStatus = null;

      // Find status transitions in history
      for (let i = 0; i < data.statusHistory.length; i++) {
        const entry = data.statusHistory[i];
        if (lastStatus !== null && entry.status !== lastStatus) {
          lastChanges.push(entry.timestamp);
        }
        lastStatus = entry.status;
      }

      // If no status changes or last change was long enough ago, we can accept it
      if (
        lastChanges.length === 0 ||
        now - lastChanges[lastChanges.length - 1] > HexStatus.STABLE_DURATION
      ) {
        console.log(
          chalk.green("[Monitor]"),
          `Service ${serviceName} status stable enough to accept change during flapping period`
        );

        // If service has been stable for a while, we can end the flapping period
        if (
          lastChanges.length === 0 ||
          now - lastChanges[lastChanges.length - 1] >
            HexStatus.FLAPPING_COOLDOWN / 2
        ) {
          console.log(
            chalk.green("[Monitor]"),
            `Service ${serviceName} is now STABLE - ending flapping period early`
          );
          data.isFlapping = false;
          data.flappingUntil = null;

          io.emit("serviceStable", {
            service: serviceName,
          });
        }

        return false; // Allow status change
      }

      return true; // Block status change
    }

    // Count status changes in window
    let changes = 0;
    for (let i = 1; i < data.statusHistory.length; i++) {
      if (data.statusHistory[i].status !== data.statusHistory[i - 1].status) {
        changes++;
      }
    }

    // Detect new flapping condition
    if (changes >= HexStatus.FLAPPING_THRESHOLD) {
      console.log(
        chalk.yellow("[Monitor]"),
        `Service ${serviceName} detected as FLAPPING (${changes} changes in window)`
      );
      data.flappingUntil = now + HexStatus.FLAPPING_COOLDOWN;
      data.isFlapping = true;

      // Emit flapping notification
      io.emit("serviceFlapping", {
        service: serviceName,
        flappingUntil: data.flappingUntil,
        changes: changes,
      });

      return true;
    }

    return false;
  }

  /**
   * Monitor a single service
   */
  async monitorService(service) {
    try {
      // Skip services in maintenance mode
      const data = this.serviceData.get(service.name);
      if (!data) {
        console.log(
          chalk.red("[Monitor]"),
          `Service data not found for ${service.name}`
        );
        return;
      }

      if (data.maintenance) {
        console.log(
          chalk.blue("[Monitor]"),
          `Skipping ${service.name} (in maintenance mode)`
        );
        return;
      }

      const previousStatus = data.status;
      let result = { alive: false, time: HexStatus.OFFLINE_RESPONSE_TIME };

      try {
        // Check if using HTTP or ping for monitoring
        if (service.url && isValidUrl(service.url)) {
          // HTTP monitoring
          const timeout =
            service.timeout ||
            (this.config.monitoring && this.config.monitoring.pingTimeout) ||
            5000;
          const startTime = Date.now();

          try {
            // Use axios for HTTP checks with appropriate timeout
            const response = await axios({
              method: service.method || "GET",
              url: service.url,
              timeout: timeout,
              validateStatus: null, // Don't throw on any status code
            });

            const responseTime = Date.now() - startTime;
            const expectedStatus = service.expectedStatus || [200];

            // Check if status code matches expected
            if (expectedStatus.includes(response.status)) {
              result = {
                alive: true,
                time: responseTime,
              };
            } else {
              result = {
                alive: false,
                time: responseTime,
                error: `Unexpected status code: ${response.status}`,
              };
            }
          } catch (error) {
            result = {
              alive: false,
              time: Date.now() - startTime,
              error: error.code || error.message,
            };
          }
        } else {
          // Traditional ping monitoring - handle potential errors
          try {
            const pingTimeout = Math.floor(
              (service.timeout ||
                (this.config.monitoring &&
                  this.config.monitoring.pingTimeout) ||
                3000) / 1000
            );

            result = await ping.promise.probe(
              service.url || service.host || service.ip,
              {
                timeout: pingTimeout,
                extra: ["-c", "1"],
              }
            );

            // Ensure result has expected properties
            if (!result || typeof result !== "object") {
              result = {
                alive: false,
                time: HexStatus.OFFLINE_RESPONSE_TIME,
                error: "Invalid ping result",
              };
            }
          } catch (pingError) {
            console.log(
              chalk.yellow("[Monitor]"),
              `Ping error for ${service.name}: ${pingError.message}`
            );
            result = {
              alive: false,
              time: HexStatus.OFFLINE_RESPONSE_TIME,
              error: pingError.message,
            };
          }
        }
      } catch (monitorError) {
        console.log(
          chalk.yellow("[Monitor]"),
          `Error checking ${service.name}: ${monitorError.message}`
        );
        result = {
          alive: false,
          time: HexStatus.OFFLINE_RESPONSE_TIME,
          error: monitorError.message,
        };
      }

      // Determine new status
      const newStatus = result.alive ? "up" : "down";

      // If status would change, check for flapping
      if (previousStatus !== "unknown" && previousStatus !== newStatus) {
        if (this.checkFlapping(service.name, data, newStatus)) {
          // Service is flapping - don't change status, just update timestamp
          data.lastCheck = Date.now();

          // Still update ping history for metrics
          if (result.alive) {
            data.ping.push(parseFloat(result.time) || 0);
          } else {
            data.ping.push(HexStatus.OFFLINE_RESPONSE_TIME);
          }

          if (data.ping.length > HexStatus.MAX_HISTORY_LENGTH) {
            data.ping.shift();
          }

          // Update Discord bot service history if available
          if (
            this.discordBot &&
            typeof this.discordBot.updateServiceHistory === "function"
          ) {
            const pingValue = result.alive
              ? parseFloat(result.time)
              : HexStatus.OFFLINE_RESPONSE_TIME;
            this.discordBot.updateServiceHistory(service.name, pingValue);
          }

          return; // Skip further processing during flapping
        }
      }

      // Update service status
      data.status = newStatus;
      data.lastCheck = Date.now();

      // Update consecutive failures count
      if (!result.alive) {
        data.consecutiveFailures++;

        // Send notification if threshold is reached and we haven't recently notified
        if (
          !data.isFlapping &&
          data.consecutiveFailures >= HexStatus.NOTIFICATION_THRESHOLD &&
          (!data.lastNotification ||
            Date.now() - data.lastNotification > 30 * 60 * 1000)
        ) {
          this.sendNotification(service, data, result.error);
          data.lastNotification = Date.now();
        }
      } else {
        // Reset failures on success
        if (data.consecutiveFailures > 0) {
          data.consecutiveFailures = 0;

          // Only send recovery notification if service was previously down
          if (previousStatus === "down") {
            this.sendRecoveryNotification(service, data, result.time);
          }
        }
      }

      // Track downtimes
      this.updateDowntimeTracking(service.name, data, previousStatus);

      // Calculate current uptime
      data.uptime = this.calculateUptime(data.downtimes);

      // Update health score
      if (result.alive) {
        // Base recovery on response time quality
        data.ping.push(parseFloat(result.time));
        const responseQuality = Math.max(
          0,
          Math.min(1, 1 - result.time / 1000)
        );
        const recoveryRate =
          HexStatus.HEALTH_RECOVERY_RATE * (0.5 + responseQuality * 0.5);
        data.healthScore = Math.min(100, data.healthScore + recoveryRate);
      } else {
        data.healthScore = Math.max(
          0,
          data.healthScore - HexStatus.HEALTH_DECAY_RATE
        );
        data.ping.push(HexStatus.OFFLINE_RESPONSE_TIME);
      }

      // Maintain history limit
      if (data.ping.length > HexStatus.MAX_HISTORY_LENGTH) {
        data.ping.shift();
      }

      // Send real-time update
      this.emitStatusUpdate(service.name, data);

      if (
        this.discordBot &&
        typeof this.discordBot.updateServiceHistory === "function"
      ) {
        // Record the response time for the bot's charts
        const pingValue = result.alive
          ? parseFloat(result.time)
          : HexStatus.OFFLINE_RESPONSE_TIME;
        this.discordBot.updateServiceHistory(service.name, pingValue);
      }
    } catch (error) {
      this.handleMonitoringError(service.name, error);
    }
  }

  /**
   * Send a notification about a service outage
   */
  sendNotification(service, data, errorDetails) {
    // Don't send notifications for flapping services
    if (data.isFlapping) {
      console.log(
        chalk.yellow("[Monitor]"),
        `Suppressing notification for flapping service ${service.name}`
      );
      return;
    }

    // Log the incident
    console.log(
      chalk.red("[Incident]"),
      `Service ${service.name} is down! Consecutive failures: ${data.consecutiveFailures}`
    );

    // Add to incidents list if not already tracking this outage
    const hasActiveIncident = data.incidents.some(
      (inc) => inc.status === "ongoing"
    );

    if (!hasActiveIncident) {
      data.incidents.push({
        id: Date.now(),
        start: new Date().toISOString(),
        end: null,
        status: "ongoing",
        title: `${service.name} Outage Detected`,
        description: errorDetails
          ? `Service is down: ${errorDetails}`
          : `Service ${service.name} is currently experiencing issues.`,
      });
    }

    // Send Discord notification if enabled
    if (this.discordBot && this.config.discord && this.config.discord.enabled) {
      try {
        io.emit("incident", {
          service: service.name,
          status: "down",
          message: errorDetails || `Service is down`,
        });

        if (typeof this.discordBot.sendAlert === "function") {
          this.discordBot
            .sendAlert({
              service: service.name,
              status: "down",
              time: new Date().toISOString(),
              failures: data.consecutiveFailures,
              message: `Service ${service.name} is down! ${
                errorDetails ? `Error: ${errorDetails}` : ""
              }`,
            })
            .catch((error) => {
              this.handleDiscordError(error);
            });
        }
      } catch (error) {
        this.handleDiscordError(error);
      }
    }
  }

  /**
   * Send a recovery notification
   */
  sendRecoveryNotification(service, data, responseTime) {
    // Don't send recovery notifications for flapping services
    if (data.isFlapping) {
      console.log(
        chalk.yellow("[Monitor]"),
        `Suppressing recovery notification for flapping service ${service.name}`
      );
      return;
    }

    console.log(
      chalk.green("[Recovery]"),
      `Service ${service.name} has recovered!`
    );

    // Update any ongoing incidents
    data.incidents.forEach((incident) => {
      if (incident.status === "ongoing") {
        incident.status = "resolved";
        incident.end = new Date().toISOString();
        incident.resolution = "Service recovered automatically";
      }
    });

    // Send recovery notification if Discord is enabled
    if (this.discordBot && this.config.discord && this.config.discord.enabled) {
      try {
        io.emit("incident", {
          service: service.name,
          status: "up",
          message: `Service has recovered (${Math.round(responseTime)}ms)`,
        });

        if (typeof this.discordBot.sendAlert === "function") {
          this.discordBot
            .sendAlert({
              service: service.name,
              status: "up",
              time: new Date().toISOString(),
              responseTime: Math.round(responseTime),
              message: `Service ${service.name} has recovered!`,
            })
            .catch((error) => {
              this.handleDiscordError(error);
            });
        }
      } catch (error) {
        this.handleDiscordError(error);
      }
    }
  }

  /**
   * Handle Discord bot errors with reconnection logic
   */
  handleDiscordError(error) {
    console.log(chalk.red("[Discord]"), "Error:", error.message);

    // Check for connection issues
    if (
      error.message.includes("other side closed") ||
      error.message.includes("connection") ||
      error.message.includes("network") ||
      error.code === "ECONNRESET"
    ) {
      console.log(
        chalk.yellow("[Discord]"),
        "Connection issue detected. Attempting to reconnect..."
      );

      // Avoid multiple reconnect attempts
      if (this.#discordReconnectTimer) {
        return;
      }

      // Schedule reconnection after delay
      this.#discordReconnectTimer = setTimeout(() => {
        this.reconnectDiscord();
        this.#discordReconnectTimer = null;
      }, 30000); // 30 second delay before reconnect attempt
    }
  }

  /**
   * Attempt to reconnect the Discord bot
   */
  async reconnectDiscord() {
    try {
      console.log(
        chalk.blue("[Discord]"),
        "Attempting to reconnect Discord bot..."
      );

      // Clean up existing bot resources if any
      if (this.discordBot && typeof this.discordBot.cleanup === "function") {
        await this.discordBot.cleanup();
      }

      // Reinitialize the Discord bot
      this.discordBot = await discordBot.initialize();

      console.log(
        chalk.green("[Discord]"),
        "Discord bot reconnected successfully"
      );

      // Force an update with current data
      const servicesDataArray = Array.from(this.serviceData.entries()).map(
        ([name, data]) => ({
          name,
          status: data.status,
          ping: data.ping,
          uptime: data.uptime,
          downtimes: data.downtimes,
          healthScore: data.healthScore,
          isFlapping: data.isFlapping || false,
        })
      );

      await this.discordBot.updateStatusEmbed(servicesDataArray);
    } catch (error) {
      console.log(
        chalk.red("[Discord]"),
        "Reconnection failed:",
        error.message
      );

      // Schedule another reconnect attempt with exponential backoff
      const backoffTime = this.#discordReconnectTimer ? 120000 : 60000; // 1 or 2 minutes based on previous attempts

      this.#discordReconnectTimer = setTimeout(() => {
        this.reconnectDiscord();
        this.#discordReconnectTimer = null;
      }, backoffTime);
    }
  }

  /**
   * Update the downtime tracking for a service
   */
  updateDowntimeTracking(serviceName, data, previousStatus) {
    if (previousStatus === "up" && data.status === "down") {
      // Service just went down
      data.downtimes.push({
        start: new Date().toISOString(),
        end: null,
      });
      console.log(chalk.red("[Status]"), `Service ${serviceName} is DOWN`);
    } else if (previousStatus === "down" && data.status === "up") {
      // Service just recovered
      const lastDowntime = data.downtimes[data.downtimes.length - 1];
      if (lastDowntime && !lastDowntime.end) {
        lastDowntime.end = new Date().toISOString();
      }
      console.log(chalk.green("[Status]"), `Service ${serviceName} is UP`);
    }
  }

  /**
   * Send real-time status update to clients
   */
  emitStatusUpdate(serviceName, data) {
    // Throttle updates to avoid flooding clients
    const now = Date.now();
    const lastUpdate = this.#lastStatusUpdate[serviceName] || 0;

    if (now - lastUpdate < HexStatus.STATUS_UPDATE_THROTTLE) {
      return;
    }

    this.#lastStatusUpdate[serviceName] = now;

    io.emit("statusUpdate", {
      service: serviceName,
      data: {
        status: data.status,
        ping: data.ping,
        uptime: data.uptime,
        healthScore: data.healthScore,
        lastCheck: data.lastCheck,
        responseTime: data.ping[data.ping.length - 1] || 0,
        isFlapping: data.isFlapping || false,
      },
      stats: this.calculateStats(),
    });
  }

  /**
   * Handle errors that occur during monitoring
   */
  handleMonitoringError(serviceName, error) {
    console.log(
      chalk.red("[Error]"),
      `Error monitoring ${serviceName}:`,
      error.message
    );

    const data = this.serviceData.get(serviceName);
    if (!data) return;

    // Mark as down due to error
    const previousStatus = data.status;
    data.status = "down";
    data.healthScore = Math.max(
      0,
      data.healthScore - HexStatus.HEALTH_DECAY_RATE * 2
    );
    data.consecutiveFailures++;

    // Mark as offline in ping history
    data.ping.push(HexStatus.OFFLINE_RESPONSE_TIME);
    if (data.ping.length > HexStatus.MAX_HISTORY_LENGTH) {
      data.ping.shift();
    }

    // Update downtime tracking
    this.updateDowntimeTracking(serviceName, data, previousStatus);

    // Calculate current uptime
    data.uptime = this.calculateUptime(data.downtimes);

    // Send real-time update
    io.emit("statusUpdate", {
      service: serviceName,
      data: {
        status: "down",
        healthScore: data.healthScore,
        uptime: data.uptime,
        error: error.message,
        lastCheck: Date.now(),
        isFlapping: data.isFlapping || false,
      },
      stats: this.calculateStats(),
    });
  }

  /**
   * Calculate overall statistics
   */
  calculateStats() {
    let totalUp = 0;
    let totalDown = 0;
    let totalUnknown = 0;
    let totalFlapping = 0;
    let avgPing = 0;
    let pingCount = 0;
    let totalHealth = 0;

    this.serviceData.forEach((data) => {
      if (data.isFlapping) {
        totalFlapping++;
      } else if (data.status === "up") {
        totalUp++;
      } else if (data.status === "down") {
        totalDown++;
      } else {
        totalUnknown++;
      }

      // Calculate average ping only for services that are up
      if (data.status === "up" && data.ping.length) {
        const validPings = data.ping.filter(
          (p) => p < HexStatus.OFFLINE_RESPONSE_TIME
        );
        if (validPings.length > 0) {
          avgPing += validPings.reduce((a, b) => a + b, 0);
          pingCount += validPings.length;
        }
      }

      totalHealth += data.healthScore || 0;
    });

    return {
      totalServices: this.config.services.length,
      servicesUp: totalUp,
      servicesDown: totalDown,
      servicesUnknown: totalUnknown,
      servicesFlapping: totalFlapping,
      averagePing: pingCount ? (avgPing / pingCount).toFixed(2) : 0,
      overallHealth: this.config.services.length
        ? (totalHealth / this.config.services.length).toFixed(1)
        : 0,
    };
  }

  /**
   * Display welcome message on startup
   */
  displayWelcome() {
    console.clear();
    console.log("\n");
    console.log(
      chalk.hex("#8b5cf6")(
        figlet.textSync("Hex Status", {
          font: "ANSI Shadow",
          horizontalLayout: "full",
        })
      )
    );
    console.log("\n");
    console.log(chalk.hex("#8b5cf6")("━".repeat(75)));
    console.log(
      chalk.white.bold(
        "      Welcome to Hex Status - The Ultimate Status Page Solution   "
      )
    );
    console.log(chalk.hex("#8b5cf6")("━".repeat(75)), "\n");
    console.log("\n");
  }

  /**
   * Set up graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      console.log(
        chalk.yellow("[System]"),
        `Graceful shutdown initiated... (${signal || "manual"})`
      );

      const forceKillTimeout = setTimeout(() => {
        console.log(
          chalk.red("[System]"),
          "Force killing process after timeout"
        );
        process.exit(1);
      }, 5000);

      try {
        // Stop monitoring
        if (this.#monitorInterval) {
          clearInterval(this.#monitorInterval);
          this.#monitorInterval = null;
          console.log(chalk.blue("[System]"), "Monitoring stopped");
        }

        // Clear any Discord reconnect timers
        if (this.#discordReconnectTimer) {
          clearTimeout(this.#discordReconnectTimer);
          this.#discordReconnectTimer = null;
        }

        // Close config watcher
        if (this.#configWatcher) {
          this.#configWatcher.close();
          this.#configWatcher = null;
          console.log(chalk.blue("[System]"), "Config watcher closed");
        }

        // Close server
        if (this.server) {
          await new Promise((resolve) => this.server.close(resolve));
          console.log(chalk.blue("[System]"), "HTTP server closed");
        }

        // Clean up Discord bot
        if (this.discordBot) {
          try {
            if (typeof this.discordBot.cleanup === "function") {
              await this.discordBot.cleanup();
              console.log(
                chalk.blue("[System]"),
                "Discord bot cleanup completed"
              );
            }
          } catch (error) {
            console.error(
              chalk.red("[Discord]"),
              "Error during bot cleanup:",
              error.message
            );
          }
        }

        clearTimeout(forceKillTimeout);
        console.log(chalk.green("[System]"), "Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        clearTimeout(forceKillTimeout);
        console.error(chalk.red("[Error]"), "Shutdown error:", error.message);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    process.on("uncaughtException", (error) => {
      console.error(chalk.red("[Error]"), "Uncaught Exception:", error);
      shutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error(
        chalk.red("[Error]"),
        "Unhandled Rejection at:",
        promise,
        "reason:",
        reason
      );
      // Don't shutdown for unhandled rejections, just log them
    });
  }
}

// Global error handlers for unexpected errors
process.on("unhandledRejection", (reason, promise) => {
  console.error(
    chalk.red("[Error]"),
    "Unhandled Rejection at:",
    promise,
    "reason:",
    reason
  );
});

// Create and start the application
const hexStatus = new HexStatus();
hexStatus.startServer().catch((error) => {
  console.error(chalk.red("[Fatal]"), "Failed to start Hex Status:", error);
  process.exit(1);
});
