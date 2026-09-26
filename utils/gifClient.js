'use strict';

const base = (process.env.GIF_API_BASE || '').replace(/\/$/, '');
const size = process.env.GIF_SIZE || '128x128';

let manifest = null;
const lastPickByCategory = new Map();
let refreshTimer = null;

async function fetchManifest() {
    const res = await fetch(`${base}/manifest`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.categories || typeof data.categories !== 'object') {
        throw new Error('Invalid manifest: missing categories');
    }
    return data;
}

async function refresh() {
    try {
        manifest = await fetchManifest();
    } catch (err) {
        console.warn(`[gifClient] manifest refresh failed: ${err.message}`);
    }
}

async function init() {
    if (!base) {
        console.warn('[gifClient] GIF_API_BASE is not set — GIF commands will use fallback text');
        return;
    }
    try {
        manifest = await fetchManifest();
        const cats = Object.keys(manifest.categories);
        const total = cats.reduce((n, c) => n + manifest.categories[c].length, 0);
        console.log(`[gifClient] manifest loaded: ${cats.length} categories, ${total} gifs`);
    } catch (err) {
        console.warn(`[gifClient] initial manifest load failed: ${err.message}`);
    }
    refreshTimer = setInterval(refresh, 10 * 60 * 1000);
    refreshTimer.unref();
}

function getRandomGifUrl(category) {
    if (!manifest) return null;
    const entries = manifest.categories[category];
    if (!entries || entries.length === 0) return null;

    const eligible = entries.filter(e => e.sizes && e.sizes[size]);
    if (eligible.length === 0) return null;

    let pick;
    if (eligible.length >= 2) {
        const lastId = lastPickByCategory.get(category);
        const pool = eligible.filter(e => e.id !== lastId);
        pick = pool[Math.floor(Math.random() * pool.length)];
    } else {
        pick = eligible[0];
    }

    lastPickByCategory.set(category, pick.id);
    const key = pick.sizes[size].split('/').map(encodeURIComponent).join('/');
    return `${base}/g/${key}`;
}

async function getRandomGifUrlRemote(category) {
    if (!base) return null;
    try {
        const res = await fetch(
            `${base}/random/${encodeURIComponent(category)}?size=${encodeURIComponent(size)}`,
            { signal: AbortSignal.timeout(1500) }
        );
        if (!res.ok) return null;
        const json = await res.json();
        return json.url || null;
    } catch {
        return null;
    }
}

function isReady() {
    return manifest !== null;
}

module.exports = { init, getRandomGifUrl, getRandomGifUrlRemote, isReady };
