/**
 * CORS Configuration - Cross-Origin Resource Sharing
 * CephasGM GameZone
 * 
 * This module configures CORS policies for the API, allowing secure
 * cross-origin requests from trusted domains including web apps,
 * mobile apps, and admin panels.
 */

const logger = require('../utils/logger');

// Environment variables
const env = process.env.NODE_ENV || 'development';

/**
 * Allowed origins for different environments
 */
const allowedOrigins = {
  development: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8080',
    'http://localhost:8081',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8080',
    'https://localhost:3000',
    'https://localhost:8080',
    'https://gamezone.cephasgm.com',
    'https://api.gamezone.cephasgm.com',
    'https://admin.gamezone.cephasgm.com',
  ],
  test: [
    'http://localhost:3000',
    'http://localhost:8080',
    'https://test.cephasgm.com',
  ],
  production: [
    'https://gamezone.cephasgm.com',
    'https://api.gamezone.cephasgm.com',
    'https://admin.gamezone.cephasgm.com',
    'https://www.gamezone.cephasgm.com',
    'https://*.cephasgm.com',
  ],
};

/**
 * CORS Configuration
 */
const corsConfig = {
  // Get allowed origins for current environment
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    // Get origins for current environment
    const origins = allowedOrigins[env] || allowedOrigins.development;

    // Check if origin is allowed
    const isAllowed = origins.some((allowed) => {
      // Handle wildcard subdomains (e.g., *.cephasgm.com)
      if (allowed.includes('*.')) {
        const domain = allowed.replace('*.', '');
        return origin.endsWith(domain);
      }
      return allowed === origin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },

  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],

  // Allowed headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Requested-With',
    'Accept',
    'Origin',
    'User-Agent',
    'DNT',
    'Cache-Control',
    'X-Mx-ReqToken',
    'Keep-Alive',
    'If-Match',
    'If-Modified-Since',
    'If-None-Match',
    'If-Unmodified-Since',
    'Range',
    'X-API-Key',
    'X-Client-ID',
    'X-Client-Version',
    'X-Platform',
    'Accept-Encoding',
    'Accept-Language',
    'Connection',
    'Referer',
  ],

  // Headers exposed to the client
  exposedHeaders: [
    'X-Total-Count',
    'X-Page',
    'X-Per-Page',
    'X-Total-Pages',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'ETag',
    'Cache-Control',
    'Content-Disposition',
  ],

  // Allow credentials (cookies, authorization headers)
  credentials: true,

  // Max age of preflight request (24 hours)
  maxAge: 86400,

  // Preflight options
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

/**
 * Create CORS middleware with custom options
 * @param {Object} options - Custom CORS options
 * @returns {Function} - CORS middleware
 */
const createCorsMiddleware = (options = {}) => {
  const mergedOptions = {
    ...corsConfig,
    ...options,
  };

  // If a specific origin is provided, use it
  if (options.origin && typeof options.origin === 'string') {
    mergedOptions.origin = options.origin;
  }

  return require('cors')(mergedOptions);
};

/**
 * CORS middleware for development with more permissive settings
 */
const devCors = createCorsMiddleware({
  origin: '*',
  credentials: false,
});

/**
 * CORS middleware for production with strict settings
 */
const prodCors = createCorsMiddleware();

/**
 * Get CORS middleware based on environment
 */
const corsMiddleware = env === 'production' ? prodCors : devCors;

/**
 * WebSocket CORS configuration
 * Socket.IO uses its own CORS handling
 */
const socketCorsConfig = {
  origin: (origin, callback) => {
    const origins = allowedOrigins[env] || allowedOrigins.development;
    const isAllowed = origins.some((allowed) => {
      if (allowed.includes('*.')) {
        const domain = allowed.replace('*.', '');
        return origin ? origin.endsWith(domain) : true;
      }
      return allowed === origin;
    });

    callback(null, isAllowed || !origin);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

/**
 * Check if a domain is allowed
 * @param {string} origin - Origin to check
 * @returns {boolean} - Whether the origin is allowed
 */
const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const origins = allowedOrigins[env] || allowedOrigins.development;
  return origins.some((allowed) => {
    if (allowed.includes('*.')) {
      const domain = allowed.replace('*.', '');
      return origin.endsWith(domain);
    }
    return allowed === origin;
  });
};

/**
 * Get allowed origins list
 * @returns {string[]} - List of allowed origins
 */
const getAllowedOrigins = () => {
  return allowedOrigins[env] || allowedOrigins.development;
};

// Export CORS configuration
module.exports = {
  corsConfig,
  corsMiddleware,
  createCorsMiddleware,
  socketCorsConfig,
  isOriginAllowed,
  getAllowedOrigins,
  allowedOrigins,
  env,
};

// Default export
module.exports.default = corsMiddleware;
