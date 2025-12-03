#!/usr/bin/env node

/**
 * Pre-resize all GIFs to cache directory.
 * Reads config.json for target width/height, then batch-processes all GIFs
 * in gifs/<category>/ folders using gifsicle (preferred) or ImageMagick convert (fallback).
 * 
 * Usage: node scripts/preresize-gifs.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const config = require('../config.json');

const WIDTH = config.gif?.width || 100;
const HEIGHT = config.gif?.height || 100;
const GIFS_ROOT = path.join(__dirname, '..', 'gifs');
const CACHE_ROOT = path.join(GIFS_ROOT, 'resized', `${WIDTH}x${HEIGHT}`);

console.log(`📦 GIF Pre-resize Script`);
console.log(`Target size: ${WIDTH}x${HEIGHT}`);
console.log(`GIFs root: ${GIFS_ROOT}`);
console.log(`Cache root: ${CACHE_ROOT}`);
console.log(`✓ Using tool: sharp`);
console.log('');

// Ensure cache root exists
try {
    fs.mkdirSync(CACHE_ROOT, { recursive: true });
} catch (e) {
    console.error(`❌ Failed to create cache directory: ${CACHE_ROOT}`);
    process.exit(1);
}

// Walk gifs root and find all GIFs
function walkGifs() {
    const result = [];
    if (!fs.existsSync(GIFS_ROOT)) {
        console.warn(`⚠️  GIFs root not found: ${GIFS_ROOT}`);
        return result;
    }

    const items = fs.readdirSync(GIFS_ROOT);
    for (const item of items) {
        const itemPath = path.join(GIFS_ROOT, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
            // Subdirectory like gifs/pet, gifs/bonk, etc.
            const files = fs.readdirSync(itemPath);
            for (const file of files) {
                if (file.toLowerCase().endsWith('.gif')) {
                    result.push({ category: item, filename: file, srcPath: path.join(itemPath, file) });
                }
            }
        } else if (item.toLowerCase().endsWith('.gif')) {
            // Top-level GIF file
            result.push({ category: 'root', filename: item, srcPath: itemPath });
        }
    }
    return result;
}

async function resizeGif(srcPath, dstPath) {
    try {
        await sharp(srcPath, { animated: true })
            .resize(WIDTH, HEIGHT, { fit: 'inside' })
            .toFile(dstPath);
        return true;
    } catch (err) {
        console.error(`Error: ${err.message}`);
        return false;
    }
}

// Main logic
(async () => {
    const gifs = walkGifs();
    if (gifs.length === 0) {
        console.warn('⚠️  No GIFs found.');
        process.exit(0);
    }

    console.log(`Found ${gifs.length} GIF(s). Processing...`);
    console.log('');

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const gif of gifs) {
        const categoryCache = path.join(CACHE_ROOT, gif.category);
        try {
            fs.mkdirSync(categoryCache, { recursive: true });
        } catch (e) {
            console.error(`❌ Failed to create category cache dir: ${categoryCache}`);
            failed++;
            continue;
        }

        const dstPath = path.join(categoryCache, gif.filename);

        // Skip if already cached
        if (fs.existsSync(dstPath)) {
            console.log(`⊘ ${gif.category}/${gif.filename} (already cached)`);
            skipped++;
            continue;
        }

        // Resize
        if (await resizeGif(gif.srcPath, dstPath)) {
            console.log(`✓ ${gif.category}/${gif.filename} → ${WIDTH}x${HEIGHT}`);
            processed++;
        } else {
            console.error(`❌ ${gif.category}/${gif.filename} (resize failed)`);
            failed++;
        }
    }

    console.log('');
    console.log(`Summary: ${processed} processed, ${skipped} skipped, ${failed} failed.`);
    if (failed === 0) {
        console.log('✓ Pre-resize complete!');
        process.exit(0);
    } else {
        console.warn('⚠️  Some GIFs failed to resize.');
        process.exit(1);
    }
})();
