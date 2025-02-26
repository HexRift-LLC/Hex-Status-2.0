const axios = require('axios');
const { EmbedBuilder, WebhookClient } = require('discord.js');
const colors = require('colors');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

class WebhookManager {
    static #instance;
    #webhook;
    #embedDefaults;

    constructor() {
        const webhookUrl = 'https://discord.com/api/webhooks/1323946852097458196/Rt13PpQ0YFRZhJhTFlZ_7uKeHjiK1Tfgd6R3kMqpdHh86tOGXoBP4wSHqVYMpWUVCiJV';
        this.#webhook = new WebhookClient({ url: webhookUrl });
        this.#embedDefaults = {
            thumbnail: 'https://hexarion.net/Hex-Status.png',
            footer: {
                text: '© 2023 - 2025 Hexarion',
                iconURL: 'https://hexarion.net/Hex-Status.png',
            }
        };
    }

    static getInstance() {
        if (!WebhookManager.#instance) {
            WebhookManager.#instance = new WebhookManager();
        }
        return WebhookManager.#instance;
    }

    async sendLog(status, color, fields, options = {}) {
        try {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setThumbnail(this.#embedDefaults.thumbnail)
                .setFooter(this.#embedDefaults.footer)
                .setTimestamp();

            if (options.title) embed.setTitle(options.title);
            if (options.description) embed.setDescription(options.description);
            if (fields?.length) embed.addFields(fields);

            await this.#webhook.send({ embeds: [embed] });
            return true;
        } catch (error) {
            console.error('[WEBHOOK]'.brightRed, 'Failed to send webhook:', error);
            return false;
        }
    }
}

class LicenseChecker {
    #webhookManager;
    #currentVersion = '1.1.1';
    #baseUrl = 'https://dash.hexarion.net/api';
    #hwid;

    constructor() {
        this.#webhookManager = WebhookManager.getInstance();
        this.#hwid = this.generateHWID();
    }

    generateHWID() {
        const systemInfo = [
            os.hostname(),
            os.platform(),
            os.arch(),
            os.cpus()[0].model,
            os.totalmem()
        ].join('');
        
        return crypto
            .createHash('sha256')
            .update(systemInfo)
            .digest('hex');
    }

    async validateLicense() {
        try {
            const configPath = path.join(__dirname, '../config/config.yml');
            const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
            const key = config.auth.key;
    
            if (!key) {
                console.log('[AUTH]'.brightRed, 'No license key found in config');
                process.exit(1);
            }
    
            const response = await axios.post(`${this.#baseUrl}/verify`, {
                key,
                hwid: this.#hwid,
                product: 'Hex-Status-2.0'
            });
    
            if (response.data?.valid) {
                console.log('[AUTH]'.green, 'License validated successfully');
                await this.#handleSuccessfulAuth('License validated successfully');
                return true;
            } else {
                const errorMessage = response.data?.error || 'License validation failed';
                console.log('[AUTH]'.brightRed, 'Authentication failed:', errorMessage);
                await this.#handleFailedAuth(errorMessage);
                process.exit(1);
            }
        } catch (error) {
            const errorMessage = error.response?.data?.error || 
                                 error.response?.data?.details || 
                                 error.message || 
                                 'Connection error with license server';
            console.log('[AUTH]'.brightRed, 'Authentication error:', errorMessage);
            await this.#handleAuthError(errorMessage);
            process.exit(1);
        }
    }
    
    
    async #handleSuccessfulAuth(details) {
        await this.#webhookManager.sendLog(
            'Authorization Successful',
            '#00FF00',
            [{
                name: 'Status',
                value: 'Successful',
                inline: true
            },
            {
                name: 'Product',
                value: 'Hex Status 2.0',
                inline: true
            },
            {
                name: 'Version',
                value: this.#currentVersion,
                inline: true
            },
            {
                name: 'HWID',
                value: this.#hwid,
                inline: true
            }], {
                title: 'Authentication Success',
                description: 'Hex Status 2.0 successfully authenticated'
            }
        );
    }

    async #handleFailedAuth(reason) {
        await this.#webhookManager.sendLog(
            'Authorization Failed',
            '#FF0000',
            [{
                name: 'Status',
                value: 'Failed',
                inline: true
            },
            {
                name: 'Product',
                value: 'Hex Status 2.0',
                inline: true
            },
            {
                name: 'Version',
                value: this.#currentVersion || 'Unknown',
                inline: true
            },
            {
                name: 'HWID',
                value: this.#hwid || 'Unknown',
                inline: true
            },
            {
                name: 'Reason',
                value: reason || 'Unknown error occurred',
                inline: true
            }], {
                title: 'Authentication Failure',
                description: 'Hex Status 2.0 authentication failed'
            }
        );
    }
    

    async #handleAuthError(error) {
        await this.#webhookManager.sendLog(
            'Authorization Error',
            '#FF0000',
            [{
                name: 'Status',
                value: 'Error',
                inline: true
            },
            {
                name: 'Product',
                value: 'Hex Status 2.0',
                inline: true
            },
            {
                name: 'Version',
                value: this.#currentVersion,
                inline: true
            },
            {
                name: 'HWID',
                value: this.#hwid,
                inline: true
            },
            {
                name: 'Error Details',
                value: error,
                inline: true
            }], {
                title: 'Authentication Error',
                description: 'An error occurred during authentication'
            }
        );
    }
}

async function Auth() {
    const licenseChecker = new LicenseChecker();
    return await licenseChecker.validateLicense();
}

module.exports = { Auth };
