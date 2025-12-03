const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const config = require('../config.json');

async function getRandomGif(gifsFolder = './gifs', width = config.gif.width, height = config.gif.height) {
    try {
        const files = fs.readdirSync(gifsFolder);
        const gifFiles = files.filter(file =>
            file.toLowerCase().endsWith('.gif') ||
            file.toLowerCase().endsWith('.png') ||
            file.toLowerCase().endsWith('.jpg') ||
            file.toLowerCase().endsWith('.jpeg')
        );

        if (gifFiles.length === 0) {
            return null;
        }

        const randomIndex = Math.floor(Math.random() * gifFiles.length);
        const originalPath = path.join(gifsFolder, gifFiles[randomIndex]);
        const fileName = gifFiles[randomIndex];

        // If resizing is disabled, return original path
        if (!config.gif.enabled) {
            return originalPath;
        }

        // For GIFs, resize with ffmpeg to preserve animation
        if (fileName.toLowerCase().endsWith('.gif')) {
            const tempPath = path.join(os.tmpdir(), `resized_${Date.now()}_${fileName}`);

            try {
                await execFileAsync('convert', [
                    originalPath,
                    '-resize', `${width}x${height}>`,
                    tempPath
                ]);
                console.log(`Resized GIF: ${fileName} to ${width}x${height}`);
                return tempPath;
            } catch (err) {
                console.error('Error resizing GIF with ImageMagick, returning original:', err.message);
                return originalPath;
            }
        }

        // For static images, return original
        return originalPath;
    } catch (error) {
        console.error('Error reading gifs folder:', error);
        return null;
    }
}

module.exports = {
    getRandomGif
};