const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const { execSync } = require('child_process');
const chalk = require('chalk');

const sourceDir = __dirname;
const buildDir = path.join(__dirname, 'release');
const reactBuildDir = path.join(__dirname, 'build');

console.log(chalk.blue('[Build]'), 'Starting Hex Status 6.0.0 build process...');

// Ensure the release directory exists
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}

// Build React frontend first
console.log(chalk.blue('[Build]'), 'Building React frontend...');
try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log(chalk.green('[Build]'), 'React build completed successfully');
} catch (error) {
    console.error(chalk.red('[Build]'), 'Failed to build React frontend:', error.message);
    process.exit(1);
}

// Function to obfuscate JavaScript files
const obfuscateFile = (filePath, outputPath) => {
    try {
        const code = fs.readFileSync(filePath, 'utf-8');
        const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.8,
            deadCodeInjection: true,
            deadCodeInjectionThreshold: 0.4,
            stringArray: true,
            stringArrayEncoding: ['rc4'],
            stringArrayThreshold: 0.75,
            identifierNamesGenerator: 'hexadecimal'
        }).getObfuscatedCode();

        fs.writeFileSync(outputPath, obfuscatedCode);
        console.log(chalk.blue('[Build]'), `Obfuscated: ${path.relative(sourceDir, filePath)}`);
    } catch (error) {
        console.error(chalk.red('[Build]'), `Error obfuscating $build.js:`, error.message);
    }
};

// Directories containing JS files to obfuscate
const jsDirs = ['src', 'API'];
// Files in root directory to obfuscate
const rootJsFiles = ['server.js', 'ecosystem.config.js'];
// Directories/files to completely ignore
const ignoreDirs = ['node_modules', 'release', 'build', '.git', 'logs'];

// Function to process directories
const processDirectory = (dir, baseOutputDir) => {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        
        // Skip ignored directories
        if (ignoreDirs.some(ignoreDir => filePath.includes(ignoreDir))) {
            return;
        }

        // Get the relative path for the output
        let relativePath = path.relative(sourceDir, filePath);
        const outputPath = path.join(baseOutputDir, relativePath);

        if (fs.statSync(filePath).isDirectory()) {
            // Create directory in output
            if (!fs.existsSync(outputPath)) {
                fs.mkdirSync(outputPath, { recursive: true });
            }
            // Process its contents
            processDirectory(filePath, baseOutputDir);
        } else if (file.endsWith('.js')) {
            // Check if this JS file should be obfuscated
            if (rootJsFiles.includes(file) || jsDirs.some(d => filePath.includes(d))) {
                obfuscateFile(filePath, outputPath);
            } else {
                // Copy non-obfuscated JS files as they are
                fs.copyFileSync(filePath, outputPath);
            }
        } else {
            // Copy non-JS files as they are
            fs.copyFileSync(filePath, outputPath);
            console.log(chalk.blue('[Build]'), `Copied: ${path.relative(sourceDir, filePath)}`);
        }
    });
};

// Copy React build to release directory
console.log(chalk.blue('[Build]'), 'Copying React build to release directory...');
const releaseBuildDir = path.join(buildDir, 'build');
if (!fs.existsSync(releaseBuildDir)) {
    fs.mkdirSync(releaseBuildDir, { recursive: true });
}

// Function to copy directory contents
const copyDir = (src, dest) => {
    if (!fs.existsSync(src)) {
        console.error(chalk.red('[Build]'), `Source directory ${src} doesn't exist!`);
        return;
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath, { recursive: true });
            }
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
};

// Copy the React build
copyDir(reactBuildDir, releaseBuildDir);
console.log(chalk.green('[Build]'), 'React build copied to release directory');

// Copy package.json and other necessary files
const filesToCopy = ['package.json', 'package-lock.json', 'README.md', 'LICENSE', 'config.json'];
filesToCopy.forEach(file => {
    if (fs.existsSync(path.join(sourceDir, file))) {
        fs.copyFileSync(
            path.join(sourceDir, file), 
            path.join(buildDir, file)
        );
        console.log(chalk.blue('[Build]'), `Copied: ${file}`);
    }
});

// Process server-side code
console.log(chalk.blue('[Build]'), 'Processing server-side code...');
rootJsFiles.forEach(file => {
    const filePath = path.join(sourceDir, file);
    if (fs.existsSync(filePath)) {
        obfuscateFile(filePath, path.join(buildDir, file));
    }
});

// Process directories
jsDirs.forEach(dir => {
    const dirPath = path.join(sourceDir, dir);
    if (fs.existsSync(dirPath)) {
        processDirectory(dirPath, buildDir);
    }
});

// Create empty logs directory
const logsDir = path.join(buildDir, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
    console.log(chalk.blue('[Build]'), 'Created logs directory');
}

console.log(chalk.green('[Build]'), 'Build process completed successfully!');
console.log(chalk.green('[Build]'), 'Obfuscated files and React build are in the "release" folder.');
console.log(chalk.yellow('[Build]'), 'To run the production build:');
console.log(chalk.yellow('[Build]'), '1. cd release');
console.log(chalk.yellow('[Build]'), '2. npm install --production');
console.log(chalk.yellow('[Build]'), '3. npm start   (or use PM2: pm2 start ecosystem.config.js)');
