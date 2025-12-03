const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const os = require('os');
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

        // If resizing is disabled, return original path
        if (!config.gif.enabled) {
            return originalPath;
        }

        // Create a resized version in temp directory
        const tempPath = path.join(os.tmpdir(), `resized_${Date.now()}_${gifFiles[randomIndex]}`);

        try {
            await sharp(originalPath)
                .resize(width, height, { 
                    fit: 'inside', 
                    withoutEnlargement: true 
                })
                .toFile(tempPath);

            return tempPath;
        } catch (resizeError) {
            console.error('Error resizing image, returning original:', resizeError);
            return originalPath;
        }
    } catch (error) {
        console.error('Error reading gifs folder:', error);
        return null;
    }
}

module.exports = {
    getRandomGif
};