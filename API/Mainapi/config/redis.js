/**
 * Redis connection and memory cache wrapper.
 * Extracted from server.js — centralizes Redis configuration.
 */

// --- Mobile/offline backend switch -----------------------------------------
// Set REDIS_BACKEND=memory (see server-mobile.js) to swap the whole module
// for config/redisMemory.js (in-process Map, no Redis/Memurai server needed
// -- for running on a phone). Default (unset) path below is 100% unchanged
// from before -- normal desktop `npm run dev` / `node server.js` is unaffected.
if (process.env.REDIS_BACKEND === 'memory') {
  module.exports = require('./redisMemory');
  return;
}

const Redis = require('ioredis');

// === REDIS CACHE POUR OPTIMISER LES PERFORMANCES ===
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT),
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

redis.on('connect', () => console.log('[Redis] Connecté'));
redis.on('error', (err) => console.error('[Redis] Erreur:', err.message));

// Wrapper autour de Redis pour garder l'interface memoryCache (get/set avec JSON auto)
const memoryCache = {
  async get(key) {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : undefined;
    } catch { return undefined; }
  },
  async set(key, value, ttl = 300) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch { /* ignore */ }
  }
};

module.exports = { redis, memoryCache };
