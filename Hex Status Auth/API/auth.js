
const axios = require('axios');
const { EmbedBuilder, WebhookClient } = require('discord.js');
const colors = require('colors');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

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

class AuthClient {
    #webhookManager;
    #currentVersion = '1.0.0';
    #API_URL = 'https://api.hexarion.net/api/client';
    #API_KEY = '4grS$Ff#Mmr8&A6k1kY&J#hu$Ud316D37WUAFkXTJcC%g';

    constructor() {
        this.#webhookManager = WebhookManager.getInstance();
    }

    async validateLicense() {
        try {
            const configPath = path.join(__dirname, '../config/config.yml');
            const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
            const licenseKey = config.auth.license_key;

            if (!licenseKey) {
                console.log('[AUTH]'.brightRed, 'No license key found in config');
                process.exit(1);
            }

            const response = await axios.post(
                this.#API_URL,
                {
                    license: licenseKey,
                    product: 'Hex-Status-2.0',
                    version: this.#currentVersion
                },
                { 
                    headers: { 
                        Authorization: this.#API_KEY 
                    } 
                }
            );

            if (response.data?.status_overview === 'success' && response.data?.status_code === 200) {
                console.log('[AUTH]'.green, 'License validated successfully');
                await this.#handleSuccessfulAuth('License validated successfully');
                return true;
            } else {
                console.log('[AUTH]'.brightRed, 'Authentication failed:', response.data?.message || 'Invalid response from auth server');
                await this.#handleFailedAuth(response.data?.message || 'Authentication failed');
                process.exit(1);
            }
        } catch (error) {
            console.log('[AUTH]'.brightRed, 'Authentication error:', error.message);
            await this.#handleAuthError(error.message);
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
                value: this.#currentVersion,
                inline: true
            },
            {
                name: 'Reason',
                value: reason,
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
    const authClient = new AuthClient();
    return await authClient.validateLicense();
}

module.exports = { Auth };
