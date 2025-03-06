/**
 * Hex Status 2.0 - Authentication Module
 * Provides license validation with improved design and functionality
 */

const axios = require('axios');
const chalk = require('chalk');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { version } = require('../package.json');

/**
 * AuthenticationManager - Handles license validation and verification
 */
class AuthenticationManager {
    // Static configurations
    static LICENSE_CACHE_FILE = path.join(process.cwd(), 'data', 'license_cache.json');
    static API_TIMEOUT = 10000; // 10 seconds timeout
    static GRACE_PERIOD = 72; // 72 hours offline grace period
    
    #apiBaseUrl = 'https://api.hexrift.net/api';
    #currentVersion = version;
    #PRODUCT_ID = "Hex Status 2.0";
    #hwid;
    #licenseInfo = null;
    #lastValidation = null;
    
    /**
     * Initialize the Authentication Manager
     */
    constructor() {
        // Generate unique hardware identifier
        this.#hwid = this.generateHWID();
        
        // Ensure data directory exists
        this.ensureDataDirectory();
    }
    
    /**
     * Create data directory if it doesn't exist
     */
    ensureDataDirectory() {
        const dataDir = path.join(process.cwd(), 'data');
        if (!fs.existsSync(dataDir)) {
            try {
                fs.mkdirSync(dataDir, { recursive: true });
            } catch (error) {
                console.error(chalk.red('[Auth]'), 'Failed to create data directory:', error.message);
            }
        }
    }
    
    /**
     * Generate a unique hardware identifier
     */
    generateHWID() {
        try {
            // Collect system information to create a unique ID
            const systemInfo = [
                os.hostname(),
                os.platform(),
                os.arch(),
                os.cpus()[0].model,
                os.totalmem()
            ].join('|');
            
            // Create a SHA-256 hash of the system information
            return crypto.createHash('sha256').update(systemInfo).digest('hex');
        } catch (error) {
            console.error(chalk.red('[Auth]'), 'Error generating hardware ID:', error.message);
            
            // Fallback to less unique but still workable HWID
            return crypto.createHash('sha256')
                .update(`${os.hostname()}-${os.platform()}-${Date.now()}`)
                .digest('hex');
        }
    }
    
    /**
     * Load cached license information
     */
    loadLicenseCache() {
        try {
            if (fs.existsSync(AuthenticationManager.LICENSE_CACHE_FILE)) {
                const data = fs.readFileSync(AuthenticationManager.LICENSE_CACHE_FILE, 'utf8');
                const cacheData = JSON.parse(data);
                
                this.#licenseInfo = cacheData.licenseInfo;
                this.#lastValidation = new Date(cacheData.lastValidation);
                
                console.log(chalk.blue('[Auth]'), 'License cache loaded');
                return true;
            }
            return false;
        } catch (error) {
            console.log(chalk.yellow('[Auth]'), 'Failed to load license cache:', error.message);
            return false;
        }
    }
    
    /**
     * Save license information to cache
     */
    saveLicenseCache() {
        try {
            const cacheData = {
                licenseInfo: this.#licenseInfo,
                lastValidation: this.#lastValidation.toISOString()
            };
            
            fs.writeFileSync(
                AuthenticationManager.LICENSE_CACHE_FILE,
                JSON.stringify(cacheData, null, 2),
                'utf8'
            );
            
            return true;
        } catch (error) {
            console.log(chalk.yellow('[Auth]'), 'Failed to save license cache:', error.message);
            return false;
        }
    }
    
    /**
     * Check if cached license is valid and within grace period
     */
    canUseCachedLicense() {
        if (!this.#licenseInfo || !this.#lastValidation) {
            return false;
        }
        
        const now = new Date();
        const gracePeriodMs = AuthenticationManager.GRACE_PERIOD * 60 * 60 * 1000;
        const validUntil = new Date(this.#lastValidation.getTime() + gracePeriodMs);
        
        return (
            this.#licenseInfo.valid &&
            now < validUntil &&
            (!this.#licenseInfo.expires || new Date(this.#licenseInfo.expires) > now)
        );
    }
    
    /**
     * Get license key from config
     */
    getLicenseKey() {
        try {
            const configPath = path.join(process.cwd(), 'config', 'config.yml');
            const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
            return config.auth?.key;
        } catch (error) {
            console.error(chalk.red('[Auth]'), 'Failed to read license key from config:', error.message);
            return null;
        }
    }
    
    /**
     * Validate license with the API
     */
    async validateLicenseWithAPI(key) {
        try {
            console.log(chalk.blue('[Auth]'), 'Contacting license server...');
            
            const response = await axios.post(
                `${this.#apiBaseUrl}/verify`,
                {
                    key,
                    hwid: this.#hwid,
                    product: 'Hex-Status-2.0',
                    version: this.#currentVersion
                },
                {
                    timeout: AuthenticationManager.API_TIMEOUT,
                    headers: {
                        'User-Agent': `HexStatus/${this.#currentVersion}`,
                        'Accept': 'application/json'
                    }
                }
            );
            
            return response.data;
        } catch (error) {
            let errorMessage;
            
            if (error.response) {
                // Server responded with error
                errorMessage = error.response.data?.error || 
                            error.response.data?.details ||
                            `Server error: ${error.response.status}`;
            } else if (error.request) {
                // No response received
                errorMessage = "Connection error: No response from license server";
            } else {
                // Other error
                errorMessage = error.message;
            }
            
            throw new Error(errorMessage);
        }
    }
    
    /**
     * Display license information in console
     */
    displayLicenseInfo() {
        if (!this.#licenseInfo) return;
        
        console.log(chalk.green('━'.repeat(50)));
        console.log(chalk.green.bold(' LICENSE INFORMATION'));
        console.log(chalk.green('━'.repeat(50)));
        
        if (this.#licenseInfo.valid) {
            console.log(chalk.green(' ✓ License Valid'));
            console.log(chalk.white(` ⦿ License Type: ${this.#licenseInfo.type || 'Standard'}`));
            console.log(chalk.white(` ⦿ Customer: ${this.#licenseInfo.customer || 'Yes'}`));
            
            if (this.#licenseInfo.expires) {
                const expiry = new Date(this.#licenseInfo.expires);
                const now = new Date();
                const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
                
                if (daysLeft <= 30) {
                    console.log(chalk.yellow(` ⦿ Expires: ${expiry.toLocaleDateString()} (${daysLeft} days left)`));
                } else {
                    console.log(chalk.white(` ⦿ Expires: ${expiry.toLocaleDateString()}`));
                }
            } else {
                console.log(chalk.white(' ⦿ Expires: Never'));
            }
        } else {
            console.log(chalk.red(' ✗ License Invalid'));
            console.log(chalk.red(` ⦿ Reason: ${this.#licenseInfo.error || 'Unknown'}`));
        }
        
        console.log(chalk.green('━'.repeat(50)));
    }
    
    /**
     * Check for product updates
     */

    async checkForUpdates() {
        try {
            console.log(chalk.blue('[Updater]'), 'Checking for updates...');
            
            const response = await axios.get(
                `https://hexrift.net/api/version/${this.#PRODUCT_ID}?current=${this.#currentVersion}`,
                {
                    timeout: 5000,
                    headers: {
                        "x-api-key": "8IOLaAYzGJNwcYb@bm1&WOcr%aK5!O",
                        'User-Agent': `HexStatus/${this.#currentVersion}`
                    }
                }
            );
            
            if (!response.data?.version) {
                console.log(chalk.yellow('[Updater]'), 'Version information not available');
                return;
            }
            
            if (response.data.same) {
                console.log(chalk.green('[Updater]'), `Hex Status (v${this.#currentVersion}) is up to date!`);
            } else {
                console.log(chalk.red('[Updater]'), 
                    `Hex Status (v${this.#currentVersion}) is outdated. New version v${response.data.version} is available.`);
                
                if (response.data.critical) {
                    console.log(chalk.red.bold('[Updater]'), 'This is a critical update that contains important security fixes!');
                }
            }
        } catch (error) {
            console.log(chalk.yellow('[Updater]'), 'Update check failed:', 
                error.response?.data?.error || error.message);
        }
    }
    
    /**
     * Validate license (main method)
     */
    async validateLicense() {
        try {
            // Get license key
            const key = this.getLicenseKey();
            
            if (!key) {
                console.log(chalk.red('[Auth]'), 'No license key found in config.yml');
                return false;
            }
            
            // Try to load cached license
            this.loadLicenseCache();
            
            // Check if cached license is valid
            if (this.canUseCachedLicense()) {
                console.log(chalk.green('[Auth]'), 'Using cached license (offline mode)');
                this.displayLicenseInfo();
                
                // Try to check for updates but don't fail if it doesn't work
                this.checkForUpdates().catch(() => {});
                return true;
            }
            
            // Validate with API
            const response = await this.validateLicenseWithAPI(key);
            
            // Update license information
            this.#licenseInfo = response;
            this.#lastValidation = new Date();
            
            // Save to cache
            this.saveLicenseCache();
            
            // Display license information
            this.displayLicenseInfo();
            
            // Check for updates
            await this.checkForUpdates();
            
            if (response.valid) {
                return true;
            } else {
                const errorMessage = response.error || 'License validation failed';
                console.log(chalk.red('[Auth]'), 'Authentication failed:', errorMessage);
                return false;
            }
        } catch (error) {
            // If API validation fails but we have a valid cached license within grace period
            if (this.canUseCachedLicense()) {
                console.log(chalk.yellow('[Auth]'), 'API validation failed, using cached license (offline mode)');
                console.log(chalk.yellow('[Auth]'), `Offline grace period: ${AuthenticationManager.GRACE_PERIOD} hours`);
                
                this.displayLicenseInfo();
                return true;
            }
            
            // No valid cached license and API validation failed
            console.log(chalk.red('[Auth]'), 'Authentication error:', error.message);
            console.log(chalk.red('[Auth]'), 'No valid cached license available for offline mode');
            
            return false;
        }
    }
}

// Create singleton instance
const authManager = new AuthenticationManager();

/**
 * Authenticate the application
 * @returns {Promise<boolean>} True if authentication succeeds
 */
async function Auth() {
    const result = await authManager.validateLicense();
    
    if (!result) {
        console.log(chalk.red('[Auth]'), 'License validation failed. Exiting...');
        // Allow time for logging before exit
        setTimeout(() => process.exit(1), 500);
        return false;
    }
    
    return true;
}

// Export the auth function
module.exports = { Auth };
