const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const config = require('../config.json');

function getRandomGif(gifsFolder = './gifs', width = config.gif?.width || 100, height = config.gif?.height || 100) {
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
        if (!config?.gif?.enabled) {
            return originalPath;
        }

        // For GIFs, check cache first (should exist after pre-deploy)
        if (fileName.toLowerCase().endsWith('.gif')) {
            // Build a cache path: e.g. ./gifs/resized/100x100/<category>/<filename>
            // gifsFolder is like './gifs/pet', so we need the gifs root (parent)
            const gifsRoot = path.resolve(gifsFolder, '..');
            const category = path.basename(gifsFolder); // e.g. pet
            const cacheDir = path.join(gifsRoot, 'resized', `${width}x${height}`, category);
            const cachedPath = path.join(cacheDir, fileName);

            console.log(`[gifUtils] Checking cache for ${fileName}: ${cachedPath}`);

            // Return cached version if it exists (should be pre-generated from deploy-commands.js)
            if (fs.existsSync(cachedPath)) {
                console.log(`[gifUtils] ✓ Cache hit: ${cachedPath}`);
                return cachedPath;
            }

            console.log(`[gifUtils] Cache miss for ${fileName}, generating resized version synchronously`);

            // Create cache directory
            try {
                fs.mkdirSync(cacheDir, { recursive: true });
            } catch (e) {
                console.error(`[gifUtils] Failed to create cache dir: ${e.message}`);
                return originalPath;
            }

            // Resize synchronously using sharp
            try {
                sharp(originalPath, { animated: true })
                    .resize(width, height, { fit: 'inside' })
                    .toFile(cachedPath);

                console.log(`[gifUtils] ✓ Resized ${fileName} to ${width}x${height}`);
                return cachedPath;
            } catch (err) {
                console.error(`[gifUtils] Failed to resize ${fileName}: ${err.message}`);
                return originalPath;
            }
        }

        // Safety fallback: return original for non-handled cases
        return originalPath;
    } catch (error) {
        console.error('Error reading gifs folder:', error);
        return null;
    }
}

module.exports = {
    getRandomGif
};