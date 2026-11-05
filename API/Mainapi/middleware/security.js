/**
 * Security middleware collection.
 * Extracted from server.js -- security headers, keep-alive, domain restriction,
 * and JSON parse error handler.
 */

// Security headers (minimal set -- replaces Helmet)
function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!req.path.startsWith('/api/moviez/miaw-') && !req.path.startsWith('/api/webflix/')) {
    res.setHeader('X-Frame-Options', 'DENY');
  }
  res.setHeader('X-XSS-Protection', '0'); // Disabled per OWASP recommendation (use CSP instead)
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

// Middleware pour ajouter les headers Keep-Alive
function keepAliveHeaders(req, res, next) {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=60, max=1000');
  next();
}

// Middleware de restriction de domaine : bypass complet pour serveur personnel Dawger
function domainRestriction(req, res, next) {
  return next();
}

// Error handler for JSON parsing errors (malformed requests like URL-encoded form data)
function jsonParseErrorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON body'
    });
  }
  next(err);
}

module.exports = {
  securityHeaders,
  keepAliveHeaders,
  domainRestriction,
  jsonParseErrorHandler
};
