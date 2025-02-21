const express = require("express");
const cors = require("cors");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
const discordBot = require("./discord/bot");
const { spawn } = require("child_process");
const findProcess = require("find-process");

async function startServer() {
  try {
    const configPath = path.resolve(__dirname, "../config/config.yml");
    const config = yaml.load(fs.readFileSync(configPath, "utf8"));
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cors());

    const { monitorServices, getServices } = require("./services/monitor");

    // Run the monitor every 30 seconds
    setInterval(monitorServices, 30000);

    // Define API routes first
    app.get('/api/services', (req, res) => {
        try {
            if (!config.services || !Array.isArray(config.services)) {
                return res.status(500).json({ error: "Invalid service data in config.yml" });
            }
    
            res.setHeader("Content-Type", "application/json");
            res.json(config.services);
        } catch (err) {
            console.error("[SERVER ERROR]", err);
            res.status(500).json({ error: "Internal server error" });
        }
    });

    // Only after API routes, serve static frontend files
    app.use(express.static(path.join(__dirname, "../client/build")));

    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "../client/build/index.html"));
    });

    return new Promise((resolve, reject) => {
      const server = app.listen(config.server.port, config.server.host, () => {
        console.log(
          `[SERVER] Running on ${config.server.host}:${config.server.port}`
        );
        resolve();
      });

      server.on("error", (err) => {
        console.error("[SERVER] Failed to start:", err);
        reject(err);
      });
    }).then(() => {
      // Login to Discord bot after the server starts
      discordBot.login(config.discord.token);
      console.log("[DISCORD] Bot login successful");
    });
  } catch (error) {
    console.error("[SERVER] Error starting server:", error);
    process.exit(1);
  }
}

async function startClient() {
  try {
    console.log("[CLIENT] Building client for production...");
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

    await new Promise((resolve, reject) => {
      const buildClient = spawn(npmCmd, ["run", "build"], {
        cwd: path.join(__dirname, "../client"),
        stdio: "inherit",
        shell: true,
      });

      buildClient.on("close", (code) => {
        if (code === 0) {
          console.log("[CLIENT] Build successful.");
          resolve();
        } else {
          reject(new Error(`[CLIENT] Build failed with exit code ${code}`));
        }
      });

      buildClient.on("error", reject);
    });

    console.log("[CLIENT] Installing serve globally...");
    await new Promise((resolve, reject) => {
      const installServe = spawn(npmCmd, ["install", "-g", "serve"], {
        stdio: "inherit",
        shell: true,
      });

      installServe.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error("[CLIENT] Failed to install serve."));
      });

      installServe.on("error", reject);
    });

    console.log("[CLIENT] Starting production client...");
    spawn("serve", ["-s", "build", "-l", "3000"], {
      cwd: path.join(__dirname, "../client"),
      stdio: "inherit",
      shell: true,
    });

    console.log("[CLIENT] Production client is now running.");
  } catch (error) {
    console.error("[CLIENT] Error starting client:", error);
  }
}

async function startApplication() {
  try {
    // Find and kill process on port 3001 (if it's not this script)
    const list = await findProcess("port", 3001);
    for (const processInfo of list) {
      if (processInfo.pid !== process.pid) {
        console.log(
          `[SERVER] Killing existing process on port 3001 (PID: ${processInfo.pid})`
        );
        process.kill(processInfo.pid);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Start backend server and wait for it to be ready
    await startServer();

    // Start client after server is up
    await startClient();
  } catch (error) {
    console.error("[APPLICATION] Fatal error:", error);
  }
}

startApplication();
