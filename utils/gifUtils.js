const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
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

            console.log(`[gifUtils] Cache miss for ${fileName}, triggering background generation`);

            // Fallback: if cache doesn't exist, return original (shouldn't happen after pre-deploy)
            // but still trigger background generation in case new GIFs were added manually
            try {
                fs.mkdirSync(cacheDir, { recursive: true });
            } catch (e) {
                // ignore mkdir errors
            }

            try {
                const gifsicleAvailable = (() => {
                    try {
                        const res = spawnSync('which', ['gifsicle']);
                        return res && res.status === 0;
                    } catch (e) {
                        return false;
                    }
                })();

                if (gifsicleAvailable) {
                    const child = spawn('gifsicle', ['--resize-fit', `${width}x${height}`, originalPath, '-o', cachedPath], {
                        detached: true,
                        stdio: 'ignore'
                    });
                    child.unref();
                    console.log(`Background caching (gifsicle) started for ${fileName}`);
                } else {
                    const args = [originalPath, '-coalesce', '-resize', `${width}x${height}`, '-layers', 'Optimize', cachedPath];
                    const child = spawn('convert', args, {
                        detached: true,
                        stdio: 'ignore'
                    });
                    child.unref();
                    console.log(`Background caching (convert) started for ${fileName}`);
                }
            } catch (err) {
                console.error('Could not start background caching process:', err && err.message ? err.message : err);
            }

            // Return original as fallback while background cache generation runs
            return originalPath;
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