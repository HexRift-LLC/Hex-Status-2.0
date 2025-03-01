const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const sourceDir = __dirname; // The main directory of your app
const buildDir = path.join(__dirname, 'release'); // Output directory for obfuscated files

// Ensure the build directory exists
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}

// Function to obfuscate a JavaScript file
const obfuscateFile = (filePath, outputPath) => {
    const code = fs.readFileSync(filePath, 'utf-8');
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 1,
        stringArray: true,
        stringArrayEncoding: ['rc4'],
        stringArrayThreshold: 1
    }).getObfuscatedCode();

    fs.writeFileSync(outputPath, obfuscatedCode);
};

// Process all JS files (excluding node_modules and dist folders)
const processDirectory = (dir) => {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        const outputPath = path.join(buildDir, path.relative(sourceDir, filePath));

        if (fs.statSync(filePath).isDirectory()) {
            if (!filePath.includes('node_modules') && !filePath.includes('dist')) {
                fs.mkdirSync(outputPath, { recursive: true });
                processDirectory(filePath);
            }
        } else if (file.endsWith('.js')) {
            obfuscateFile(filePath, outputPath);
        } else {
            // Copy non-JS files as they are
            fs.copyFileSync(filePath, outputPath);
        }
    });
};

// Start processing files
processDirectory(sourceDir);

console.log('Build complete. Obfuscated files are in the "release" folder.');
