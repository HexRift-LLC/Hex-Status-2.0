const fs = require("fs");
const axios = require("axios");
const chalk = require("chalk");
const figlet = require("figlet");
const path = require("path");
const { version } = require("./package.json");

// Constants and utilities
const PRODUCT_ID = "Hex Status";
const logger = {
  info: (msg) => console.log(chalk.blue("[Info]"), msg),
  warn: (msg) => console.log(chalk.yellow("[Warning]"), msg),
  error: (msg) => console.log(chalk.red("[Error]"), msg),
};

// Display welcome message
function displayWelcome(config) {
  console.clear();
  console.log("\n");
  console.log(
    chalk.hex(config?.theme?.primaryColor || "#8b5cf6")(
      figlet.textSync("Hex Status", {
        font: "ANSI Shadow",
        horizontalLayout: "full",
      })
    )
  );

  console.log("\n");
  // Use the color from config with a fallback
  const primaryColor = "#8b5cf6";
  console.log(chalk.hex(primaryColor)("━".repeat(80)));
  console.log(
    chalk.white.bold(
      "      Welcome to Hex Status - Your all-in-one status page for your services."
    )
  );
  console.log(chalk.hex(primaryColor)("━".repeat(80)), "\n");
  console.log(chalk.cyan("[System]"), `Version: ${version}`);
  console.log(chalk.cyan("[System]"), `Node.js: ${process.version}`);
  console.log("");
}

// Check for version updates
async function checkVersion() {
  try {
    console.log(chalk.yellow("[Updater]"), `Checking for updates...`);

    const response = await axios.get(
      `https://hexrift.net/api/version/${PRODUCT_ID}?current=${version}`,
      {
        headers: {
          "x-api-key": "8IOLaAYzGJNwcYb@bm1&WOcr%aK5!O",
        },
        timeout: 5000, // 5 second timeout
      }
    );

    if (!response.data.version) {
      console.log(
        chalk.yellow("[Updater]"),
        `Version information not available`
      );
      return true;
    }

    if (response.data.same) {
      console.log(
        chalk.green("[Updater]"),
        `Hex Status (v${version}) is up to date!`
      );
      return true;
    } else {
      console.error(
        chalk.red("[Updater]"),
        `Hex Status (v${version}) is outdated. Update to v${response.data.version}.`
      );
      return false;
    }
  } catch (error) {
    console.error(
      chalk.red("[Updater]"),
      `Version check failed: ${error.response?.data?.error || error.message}`
    );

    // Don't exit on version check failure, just continue
    console.log(
      chalk.yellow("[Updater]"),
      "Continuing startup despite version check failure"
    );
    return true;
  }
}

// Get configuration
function getConfig() {
  try {
    const configPath = path.join(__dirname, "config.json");
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    logger.error(`Failed to load configuration: ${error.message}`);
    process.exit(1);
  }
}
  // Load configuration
  const config = getConfig();
  const PORT = config.port || 3000;

// Initialize the full application
async function initializeFullApplication() {
  const discordBot = require("./src/discord/bot");
  const express = require("express");
  const cors = require("cors");
  const app = express();
  const PORT = config.port || 3000;

  // Enable CORS and JSON parsing
  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "build")));

  // Store service status history (in-memory storage for simplicity)
  const serviceStatus = {};
  config.services.forEach((service) => {
    serviceStatus[service.id] = {
      current: "unknown",
      history: [],
      uptime: 100,
      responseTime: [],
    };
  });

  // Discord bot instance
  let bot = null;
  // Previous states of services for detecting changes
  const previousServiceStates = {};

  // Initialize Discord bot if enabled
  async function initializeBot() {
    if (config.discord && config.discord.enabled) {
      try {
        console.log(chalk.yellow("[Bot]"), "Initializing");
        bot = await discordBot.initialize();
        console.log(chalk.green("[Bot]"), "initialized successfully");
        return true;
      } catch (error) {
        console.error(
          chalk.red("[Bot]"),
          "Failed to initialize:",
          error.message
        );
        return false;
      }
    }
    return false;
  }

  // Update Discord status
  async function updateDiscordStatus() {
    if (!bot) return;

    try {
      // Format services data for Discord
      const formattedServices = config.services.map((service) => {
        const status = serviceStatus[service.id];

        // Get latest response time if available
        let latestResponseTime = null;
        if (status.responseTime && status.responseTime.length > 0) {
          const latest = status.responseTime[status.responseTime.length - 1];
          if (latest && typeof latest.value === "number") {
            latestResponseTime = latest.value;
          }
        }

        return {
          name: service.name,
          id: service.id,
          url: service.url,
          status: status.current || "unknown",
          uptime: status.uptime || 100,
          ping: status.responseTime
            ? status.responseTime.map((rt) => rt.value).filter(Boolean)
            : [],
          isFlapping: false, // Could implement flap detection
        };
      });

      // Update the Discord status embed
      await bot.updateStatusEmbed(formattedServices);

      // Check for status changes and send alerts
      checkForStatusChanges();
    } catch (error) {
      console.error(
        chalk.red("[Bot]"),
        `Error updating status:`,
        error.message
      );
    }
  }

  // Check for service status changes and send alerts
  function checkForStatusChanges() {
    if (!bot) return;

    config.services.forEach((service) => {
      const currentState = serviceStatus[service.id];
      const prevState = previousServiceStates[service.id];

      // Skip if no previous state
      if (!prevState) {
        previousServiceStates[service.id] = { ...currentState };
        return;
      }

      // Check if status changed
      if (prevState.current !== currentState.current) {
        console.log(
          chalk.cyan("[System]"),
          `Service ${service.name} changed status from ${prevState.current} to ${currentState.current}`
        );

        // Get the latest response time if available
        let latestResponseTime = null;
        if (currentState.responseTime && currentState.responseTime.length > 0) {
          const latest =
            currentState.responseTime[currentState.responseTime.length - 1];
          if (latest && typeof latest.value === "number") {
            latestResponseTime = latest.value;
          }
        }

        // Send alert to Discord
        bot.sendAlert({
          service: service.name,
          status: currentState.current,
          time: new Date(),
          message: `Service ${service.name} is now ${
            currentState.current === "up"
              ? "operational"
              : "experiencing issues"
          }.`,
          responseTime: latestResponseTime,
          failures: currentState.current === "down" ? 1 : 0,
        });

        // Update service history in bot
        if (latestResponseTime) {
          bot.updateServiceHistory(service.name, latestResponseTime);
        }

        // Update previous state
        previousServiceStates[service.id] = { ...currentState };
      }
    });
  }

  // Check service status
  async function checkServiceStatus() {
    const timestamp = Date.now();

    for (const service of config.services) {
      try {
        const startTime = Date.now();
        const response = await axios.get(service.url, { timeout: 5000 });
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        const status =
          response.status === service.expectedStatus ? "up" : "down";

        serviceStatus[service.id].current = status;
        serviceStatus[service.id].responseTime.push({
          time: timestamp,
          value: responseTime,
        });
        serviceStatus[service.id].history.push({ time: timestamp, status });

        // Keep only the last 24 hours of data
        const dayAgo = timestamp - 24 * 60 * 60 * 1000;
        serviceStatus[service.id].history = serviceStatus[
          service.id
        ].history.filter((item) => item.time > dayAgo);
        serviceStatus[service.id].responseTime = serviceStatus[
          service.id
        ].responseTime.filter((item) => item.time > dayAgo);

        // Calculate uptime
        const totalChecks = serviceStatus[service.id].history.length;
        const upChecks = serviceStatus[service.id].history.filter(
          (item) => item.status === "up"
        ).length;
        serviceStatus[service.id].uptime =
          totalChecks > 0 ? (upChecks / totalChecks) * 100 : 100;
      } catch (error) {
        serviceStatus[service.id].current = "down";
        serviceStatus[service.id].history.push({
          time: timestamp,
          status: "down",
        });

        // Recalculate uptime
        const totalChecks = serviceStatus[service.id].history.length;
        const upChecks = serviceStatus[service.id].history.filter(
          (item) => item.status === "up"
        ).length;
        serviceStatus[service.id].uptime =
          totalChecks > 0 ? (upChecks / totalChecks) * 100 : 0;
      }
    }

    // Update Discord status after checks are complete
    if (bot) {
      await updateDiscordStatus();
    }
  }
  app.get("/config", (req, res) => {
    const configPath = path.join(__dirname, "config.json");
    fs.readFile(configPath, "utf8", (err, data) => {
      if (err) {
        res.status(500).json({ error: "Could not load config" });
      } else {
        res.json(JSON.parse(data));
      }
    });
  });

  // API endpoint to get configuration
  app.get("/api/config", (req, res) => {
    // Remove sensitive information before sending
    const clientConfig = { ...config };
    delete clientConfig.discord; // Remove Discord config
    clientConfig.services = clientConfig.services.map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
    }));
    res.json(clientConfig);
  });

  // API endpoint to get services status
  app.get("/api/status", (req, res) => {
    res.json(serviceStatus);
  });

  // Combined endpoint for service data with status
  app.get("/api/services/status", (req, res) => {
    const servicesWithStatus = config.services.map((service) => ({
      ...service,
      statusData: serviceStatus[service.id],
    }));

    res.json(servicesWithStatus);
  });

  app.get('/', (req, res) => {
    fs.readFile(path.join(__dirname, 'build', 'index.html'), 'utf8', (err, data) => {
      if (err) {
        return res.status(500).send('Error loading page');
      }
    
      const modifiedHtml = data.replace(
        /<title>Status Dashboard<\/title>/,
        `<title>${config.siteName || 'Status Dashboard'}</title>`
      );
    
      res.setHeader('Content-Type', 'text/html');
      res.send(modifiedHtml);
    });
  });
  // Keep your catch-all route for other paths
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });

  // Start the server
  app.listen(PORT, async () => {
    console.log(
      chalk.green("[System]"),
      `Hex Status is running on port ${PORT}`
    );

    // Initialize Discord bot
    await initializeBot();

    // Initial check
    await checkServiceStatus();

    // Schedule regular checks
    setInterval(checkServiceStatus, config.refreshInterval || 60000);
  });

  // Cleanup on exit
  process.on("SIGINT", async () => {
    console.log(chalk.red("[System]"), "Shutting down...");
    if (bot) {
      await bot.cleanup();
    }
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log(chalk.red("[System]"), "Shutting down...");
    if (bot) {
      await bot.cleanup();
    }
    process.exit(0);
  });
}
  // Main application entry point
  async function main() {
    try {
      // Load config first
      const config = getConfig();

      // Then display welcome with the config
      displayWelcome(config);

      // Check for updates
      await checkVersion();

      // License validation step
      console.log(chalk.cyan("[System]"), "Initializing license verification...");
      const AuthManager = require("./src/api/checker");
      const authManager = new AuthManager();

      // Validate license - must happen before anything else
      const isLicenseValid = await authManager.validate();

      if (!isLicenseValid) {
        process.exit(1);
      }

      console.log(chalk.green("[Auth]"), "License validated successfully");

      const server = await initializeFullApplication();

      return server;
    } catch (error) {
      logger.error(`Application startup failed: ${error.message}`);
      console.error(chalk.red("[Fatal]"), `Startup error: ${error.message}`);
      process.exit(1);
    }
  }

// Call main only if this file is run directly
if (require.main === module) {
  main().catch((err) => {
    console.error(
      chalk.red("[Fatal]"),
      `Unhandled error in main application:`,
      err
    );
    process.exit(1);
  });
}
// Export for testing purposes
module.exports = { main };
