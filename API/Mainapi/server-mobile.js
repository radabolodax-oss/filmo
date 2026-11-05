
const dns = require('dns');
try {
  dns.setServers(['1.1.1.1', '1.0.0.1', '8.8.8.8', '8.8.4.4']);
  console.log('[DNS] Node DNS servers explicitly set to Cloudflare & Google (1.1.1.1, 8.8.8.8)');
} catch (e) {
  console.warn('[DNS] Failed to set custom DNS servers:', e.message);
}

/**
 * Mobile/offline entry point -- single process, no cluster forking, SQLite
 * (sql.js) instead of MySQL, in-memory Map instead of Redis.
 *
 * This is a NEW file alongside server.js (cluster mode, MySQL, Redis --
 * unchanged, still used for real desktop/server deployments). Run this
 * directly with plain `node` for desktop validation, or drop this
 * Mainapi/ directory into the nodejs-mobile `nodejs-project/` folder as
 * `main.js` for the Android build (see android-app/).
 *
 * Backend selection (DB_BACKEND=sqlite / REDIS_BACKEND=memory) must be set
 * BEFORE anything requires ./app, since mysqlPool.js / config/redis.js pick
 * their implementation at require-time based on these env vars.
 */

// Polyfill Node 18 globals for undici/cheerio compatibility
if (typeof globalThis.File === 'undefined') {
  try {
    const { Blob } = require('buffer');
    class File extends Blob {
      constructor(bits, name, opts = {}) {
        super(bits, opts);
        this.name = String(name);
        this.lastModified = opts.lastModified || Date.now();
      }
      get [Symbol.toStringTag]() {
        return 'File';
      }
    }
    globalThis.File = File;
  } catch (e) {
    console.error('[File Polyfill] Failed:', e);
  }
}

process.env.DB_BACKEND = process.env.DB_BACKEND || 'sqlite';
process.env.REDIS_BACKEND = process.env.REDIS_BACKEND || 'memory';

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught exception in mobile server:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled rejection in mobile server:', reason);
});

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

process.env.JWT_SECRET = process.env.JWT_SECRET || 'dawger_offline_mobile_secret_key_2026';
process.env.TMDB_API_KEY = process.env.TMDB_API_KEY || '15d2ea6d0dc1d476efbca3eba2b9bbfb';
process.env.WIFLIX_BASE_URL = process.env.WIFLIX_BASE_URL || 'https://flemmix.studio';
process.env.CPASMAL_BASE_URL = process.env.CPASMAL_BASE_URL || 'https://www.cpasmal.top';
process.env.FSTREAM_BASE_URL = process.env.FSTREAM_BASE_URL || 'https://french-stream.net';
process.env.FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '4'; // single process, no need for server.js's 8x6

const http = require('http');
const { app, appReady } = require('./app');
const { redis } = require('./config/redis');
const { shutdownCycleTLS, refreshProxyScrapeProxies } = require('./utils/proxyManager');
const { getPool } = require('./mysqlPool');

const PORT = parseInt(process.env.PORT, 10) || 25565;
const HOST = process.env.HOST || '127.0.0.1';

console.log(`
╔═══════════════════════════════════════════════════════╗
║  📱 Movix Mainapi -- mode Mobile/Local (single process) ║
║  DB_BACKEND=${String(process.env.DB_BACKEND).padEnd(43, ' ')}║
║  REDIS_BACKEND=${String(process.env.REDIS_BACKEND).padEnd(40, ' ')}║
╚═══════════════════════════════════════════════════════╝
`);

const startServer = async (retries = 2) => {
  try {
    await appReady;
  } catch (error) {
    if (retries > 0) {
      console.error(`[BOOTSTRAP] Échec avant listen: ${error.message}`);
      console.log(`Redémarrage... (${retries} restantes)`);
      return setTimeout(() => startServer(retries - 1), 3000);
    }
    console.error('Échec du bootstrap applicatif après plusieurs tentatives');
    process.exit(1);
  }

  try {
    await refreshProxyScrapeProxies({ force: false, silent: true });
  } catch (error) {
    console.warn(`[PROXYSCRAPE] Initialisation incomplete avant listen (normal hors-ligne): ${error.message}`);
  }

  const server = http.createServer(app);
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 300000;

  server.listen(PORT, HOST, () => {
    console.log(`✅ Serveur mobile démarré sur http://${HOST}:${PORT} - PID ${process.pid}`);
  });

  server.on('error', (err) => {
    console.error('Erreur de démarrage:', err);
    if (retries > 0) {
      setTimeout(() => startServer(retries - 1), 3000);
    } else {
      process.exit(1);
    }
  });

  return server;
};

let activeServer = null;
startServer()
  .then((server) => {
    activeServer = server;
  })
  .catch((error) => {
    console.error('❌ Échec du démarrage:', error);
    process.exit(1);
  });

const { setShuttingDown } = require('./utils/shutdownFlag');
let isShuttingDown = false;

const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  setShuttingDown();
  console.log('\n🛑 Signal de fermeture reçu (mobile)...');

  if (activeServer) {
    await new Promise((resolve) => {
      activeServer.keepAliveTimeout = 1;
      activeServer.close(resolve);
      setTimeout(resolve, 5000);
    });
  }

  try { await redis.quit(); } catch { /* ignore */ }
  try { await shutdownCycleTLS(); } catch { /* ignore */ }
  try { const pool = getPool(); if (pool) await pool.end(); } catch { /* ignore */ }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('message', (msg) => { if (msg === 'shutdown') shutdown(); });

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
