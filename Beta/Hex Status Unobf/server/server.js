const express = require("express");
const cors = require("cors");
const yaml = require("js-yaml");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io"); // Import WebSocket server
const { createServer } = require("http"); // Use HTTP server for WebSockets
const discordBot = require("./discord/bot");
const findProcess = require("find-process");
const {
  updateServicesState,
  getServicesState,
} = require("../server/shared/services");

async function startServer() {
  try {
    const configPath = path.resolve(__dirname, "../config/config.yml");
    const config = yaml.load(fs.readFileSync(configPath, "utf8"));

    const app = express();
    app.use(cors());
    app.use(express.json());

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    const { monitorServices, getServices } = require("./services/monitor");
    // Monitor services every 30 seconds
    setInterval(monitorServices, 30000);
    monitorServices().then(() => {
      console.log("[SERVER] Initial services state updated");
    });

    io.on("connection", (socket) => {
      // Send services immediately when a client connects
      const services = getServices();
      socket.emit("servicesUpdate", services);

      // Send updates every 30 seconds
      const updateInterval = setInterval(() => {
        const updatedServices = getServices();
        socket.emit("servicesUpdate", updatedServices);
      }, 30000);

      socket.on("disconnect", () => {
        clearInterval(updateInterval);
      });
    });

    // Start the server
    server.listen(config.server.port, "0.0.0.0", () => {
      console.log(
        `[SERVER] Running on ${config.server.host}:${config.server.port}`
      );
    });

    // Login to Discord bot
    discordBot.login(config.discord.token);
    console.log("[DISCORD] Bot login successful");
  } catch (error) {
    console.error("[SERVER] Error starting server:", error);
    process.exit(1);
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
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay to free the port
      }
    }

    // Start the backend server
    await startServer();

    console.log("[CLIENT] Building client for production...");
    const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
    const buildClient = require("child_process").spawn(
      npmCmd,
      ["run", "build"],
      {
        cwd: path.join(__dirname, "../client"),
        stdio: "inherit",
        shell: true,
      }
    );

    buildClient.on("close", (code) => {
      if (code === 0) {
        console.log("[CLIENT] Build successful. Starting production server...");
        require("child_process")
          .spawn(npmCmd, ["install", "-g", "serve"], {
            stdio: "inherit",
            shell: true,
          })
          .on("close", () => {
            require("child_process").spawn(
              "serve",
              ["-s", "build", "-l", "3000"],
              {
                cwd: path.join(__dirname, "../client"),
                stdio: "inherit",
                shell: true,
              }
            );
            console.log("[CLIENT] Production client is now running.");
          });
      } else {
        console.error(`[CLIENT] Build failed with exit code ${code}`);
      }
    });
  } catch (error) {
    console.error("[APPLICATION] Fatal error:", error);
  }
}

startApplication();