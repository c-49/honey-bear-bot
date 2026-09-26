'use strict';

require('dotenv').config();
const gifClient = require('../utils/gifClient');

const CATEGORIES = ['bite', 'bonk', 'fart', 'hug', 'pet', 'uppies', 'welcome'];

async function main() {
    await gifClient.init();

    if (!gifClient.isReady()) {
        console.error('gifClient not ready — is GIF_API_BASE set?');
        process.exit(1);
    }

    let allOk = true;

    for (const cat of CATEGORIES) {
        const url = gifClient.getRandomGifUrl(cat);
        if (!url) {
            console.error(`[${cat}] no URL returned`);
            allOk = false;
            continue;
        }

        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
            const ct = res.headers.get('content-type') || '';
            const ok = res.ok && ct.startsWith('image/');
            console.log(`[${cat}] ${ok ? '✓' : '✗'} ${res.status} ${ct} — ${url}`);
            if (!ok) allOk = false;
        } catch (err) {
            console.error(`[${cat}] ✗ fetch failed: ${err.message} — ${url}`);
            allOk = false;
        }
    }

    process.exit(allOk ? 0 : 1);
}

main();
