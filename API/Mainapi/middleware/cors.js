/**
 * CORS middleware configuration.
 * Configured for self-hosted Dawger to allow mobile, Android TV, local & tunnel origins.
 */

const cors = require("cors");

const corsMiddleware = cors({
  origin: true, // Autoriser toutes les origines (Capacitor https://dawger.app, Vercel, localhost, tunnels)
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
  ],
  credentials: true,
  optionsSuccessStatus: 204,
});

module.exports = corsMiddleware;
