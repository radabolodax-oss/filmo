/**
 * CORS middleware configuration.
 * Configured for self-hosted Dawger to allow mobile, Android TV, local & tunnel origins
 * while protecting user credentials against arbitrary third-party websites.
 */

const cors = require("cors");

const ALLOWED_ORIGIN_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/.*\.vercel\.app$/,
  /^https:\/\/.*\.netlify\.app$/,
  /^https:\/\/dawger\.app$/,
  /^https:\/\/appassets\.androidplatform\.net$/,
  /^movix-media:\/\/appassets\.androidplatform\.net$/,
  /^https?:\/\/.*\.trycloudflare\.com$/,
  /^https?:\/\/.*\.loca\.lt$/,
  /^https?:\/\/.*\.ngrok\.io$/,
];

const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Si pas d'origine (ex: requetes natives mobiles, Electron IPC, curl, serveurs) -> autoriser
    if (!origin) {
      return callback(null, true);
    }
    const isAllowed = ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
    if (isAllowed) {
      return callback(null, true);
    }
    // Origine tierce non reconnue -> rejet CORS defensif
    return callback(new Error('Origine cross-origin non autorisee par CORS'));
  },
  methods: ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "X-No-Compression",
    "Access-Control-Request-Headers",
    "baggage",
    "sentry-trace",
    "x-profile-id",
    "x-access-key",
    "x-vip-access",
  ],
  credentials: true,
  optionsSuccessStatus: 204,
});

module.exports = corsMiddleware;
