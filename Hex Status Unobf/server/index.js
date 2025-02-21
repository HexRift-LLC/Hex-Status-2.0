const express = require('express');
const cors = require('cors');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const discordBot = require('./discord/bot');
const { spawn } = require('child_process');
const findProcess = require('find-process');

async function startServer() {
    try {
        const configPath = path.resolve(__dirname, '../config/config.yml');
        const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

        const app = express();
        app.use(cors());
        app.use(express.json());

        const { monitorServices, getServices } = require('./services/monitor');

        // Run the monitor every 30 seconds
        setInterval(monitorServices, 30000);

        app.get('/api/services', (req, res) => {
            res.json(getServices());
        });

        app.listen(config.server.port, config.server.host, () => {
            console.log(`[SERVER] Running on ${config.server.host}:${config.server.port}`);
        });

        // Login to Discord bot after the server starts
        discordBot.login(config.discord.token);
        console.log('[DISCORD] Bot login successful');

    } catch (error) {
        console.error('[SERVER] Error starting server:', error);
        process.exit(1); // Exit with failure
    }
}

async function startApplication() {
    try {

        // Find and kill process on port 3001 (if it's not this script)
        const list = await findProcess('port', 3001);
        for (const processInfo of list) {
            if (processInfo.pid !== process.pid) {
                console.log(`[SERVER] Killing existing process on port 3001 (PID: ${processInfo.pid})`);
                process.kill(processInfo.pid);
                await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to free the port
            }
        }

        // Start the backend server
        await startServer();

        // Start the client in production mode
        console.log('[CLIENT] Building client for production...');
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const buildClient = spawn(npmCmd, ['run', 'build'], { 
            cwd: path.join(__dirname, '../client'),
            stdio: 'inherit',
            shell: true
        });

        buildClient.on('close', (code) => {
            if (code === 0) {
                console.log('[CLIENT] Build successful. Starting production server...');

                // Serve the built client
                spawn(npmCmd, ['install', '-g', 'serve'], { stdio: 'inherit', shell: true })
                    .on('close', () => {
                        spawn('serve', ['-s', 'build', '-l', '3000'], { 
                            cwd: path.join(__dirname, '../client'),
                            stdio: 'inherit',
                            shell: true
                        });
                        console.log('[CLIENT] Production client is now running.');
                    });

            } else {
                console.error(`[CLIENT] Build failed with exit code ${code}`);
            }
        });

        buildClient.on('error', (err) => {
            console.error(`[CLIENT] Build process failed: ${err.message}`);
        });

    } catch (error) {
        console.error('[APPLICATION] Fatal error:', error);
    }
}

startApplication();
