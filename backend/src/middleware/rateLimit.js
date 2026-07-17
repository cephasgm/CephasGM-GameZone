/**
 * Rate Limit Middleware - API Rate Limiting & Throttling
 * CephasGM GameZone
 * 
 * This middleware provides comprehensive rate limiting to protect
 * the API from abuse, DDoS attacks, and excessive usage. It supports
 * global, per-endpoint, and per-user rate limiting with Redis storage.
 */

const { cache } = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Rate limit configurations for different endpoints
 */
const RATE_LIMITS = {
  // Global default
  global: {
    limit: 100,
    window: 60, // seconds
    keyPrefix: 'rl:global',
  },
  
  // Authentication endpoints
  auth: {
    login: { limit: 10, window: 300, keyPrefix: 'rl:auth:login' },      // 10 per 5 minutes
    register: { limit: 5, window: 3600, keyPrefix: 'rl:auth:register' }, // 5 per hour
    reset: { limit: 3, window: 3600, keyPrefix: 'rl:auth:reset' },       // 3 per hour
    verify: { limit: 5, window: 3600, keyPrefix: 'rl:auth:verify' },     // 5 per hour
    twoFactor: { limit: 10, window: 300, keyPrefix: 'rl:auth:2fa' },     // 10 per 5 minutes
    refresh: { limit: 20, window: 300, keyPrefix: 'rl:auth:refresh' },   // 20 per 5 minutes
  },
  
  // User endpoints
  user: {
    profile: { limit: 60, window: 60, keyPrefix: 'rl:user:profile' },    // 60 per minute
    update: { limit: 10, window: 60, keyPrefix: 'rl:user:update' },      // 10 per minute
    settings: { limit: 20, window: 60, keyPrefix: 'rl:user:settings' },  // 20 per minute
  },
  
  // Wallet endpoints
  wallet: {
    balance: { limit: 60, window: 60, keyPrefix: 'rl:wallet:balance' },  // 60 per minute
    transactions: { limit: 30, window: 60, keyPrefix: 'rl:wallet:tx' },  // 30 per minute
    deposit: { limit: 10, window: 60, keyPrefix: 'rl:wallet:deposit' },  // 10 per minute
    withdraw: { limit: 5, window: 60, keyPrefix: 'rl:wallet:withdraw' }, // 5 per minute
  },
  
  // Bet endpoints
  bet: {
    place: { limit: 30, window: 60, keyPrefix: 'rl:bet:place' },         // 30 per minute
    history: { limit: 20, window: 60, keyPrefix: 'rl:bet:history' },     // 20 per minute
    cashout: { limit: 10, window: 60, keyPrefix: 'rl:bet:cashout' },     // 10 per minute
  },
  
  // Match endpoints
  match: {
    list: { limit: 60, window: 60, keyPrefix: 'rl:match:list' },         // 60 per minute
    odds: { limit: 120, window: 60, keyPrefix: 'rl:match:odds' },        // 120 per minute
    live: { limit: 120, window: 60, keyPrefix: 'rl:match:live' },        // 120 per minute
  },
  
  // Payment endpoints
  payment: {
    methods: { limit: 20, window: 60, keyPrefix: 'rl:payment:methods' }, // 20 per minute
    process: { limit: 10, window: 60, keyPrefix: 'rl:payment:process' }, // 10 per minute
  },
  
  // Bonus endpoints
  bonus: {
    list: { limit: 20, window: 60, keyPrefix: 'rl:bonus:list' },         // 20 per minute
    claim: { limit: 5, window: 60, keyPrefix: 'rl:bonus:claim' },        // 5 per minute
  },
  
  // Message endpoints
  message: {
    send: { limit: 20, window: 60, keyPrefix: 'rl:message:send' },       // 20 per minute
    list: { limit: 30, window: 60, keyPrefix: 'rl:message:list' },       // 30 per minute
  },
  
  // Admin endpoints
  admin: {
    default: { limit: 200, window: 60, keyPrefix: 'rl:admin:default' },  // 200 per minute
    bulk: { limit: 50, window: 60, keyPrefix: 'rl:admin:bulk' },         // 50 per minute
  },
  
  // Public endpoints
  public: {
    default: { limit: 300, window: 60, keyPrefix: 'rl:public:default' }, // 300 per minute
    sports: { limit: 120, window: 60, keyPrefix: 'rl:public:sports' },   // 120 per minute
    leagues: { limit: 60, window: 60, keyPrefix: 'rl:public:leagues' },  // 60 per minute
  },
};

/**
 * Get rate limit configuration for a specific endpoint
 * @param {Object} req - Express request object
 * @returns {Object|null} - Rate limit config or null
 */
const getRateLimitConfig = (req) => {
  const path = req.path;
  const method = req.method;
  const endpoint = getEndpointKey(path, method);
  
  // Try exact match first
  if (RATE_LIMITS[endpoint]) {
    return RATE_LIMITS[endpoint];
  }
  
  // Try pattern matching
  for (const [key, config] of Object.entries(RATE_LIMITS)) {
    if (path.includes(key)) {
      return config;
    }
  }
  
  // Check admin routes
  if (path.includes('/admin')) {
    return RATE_LIMITS.admin.default;
  }
  
  // Check public routes
  if (path.includes('/public') || path.includes('/sports') || path.includes('/leagues')) {
    return RATE_LIMITS.public.default;
  }
  
  // Default global limit
  return RATE_LIMITS.global;
};

/**
 * Generate a unique key for rate limiting
 * @param {Object} req - Express request object
 * @param {Object} config - Rate limit configuration
 * @param {string} identifier - User identifier (IP or user ID)
 * @returns {string} - Rate limit key
 */
const getRateLimitKey = (req, config, identifier) => {
  const prefix = config.keyPrefix || 'rl';
  const endpoint = getEndpointKey(req.path, req.method);
  return `${prefix}:${endpoint}:${identifier}`;
};

/**
 * Get endpoint key from path and method
 * @param {string} path - Request path
 * @param {string} method - HTTP method
 * @returns {string} - Endpoint key
 */
const getEndpointKey = (path, method) => {
  // Remove version prefix
  let endpoint = path.replace(/^\/api\/v\d+\//, '');
  // Remove query parameters
  endpoint = endpoint.split('?')[0];
  // Remove trailing slash
  endpoint = endpoint.replace(/\/$/, '');
  // Replace dynamic segments with placeholder
  endpoint = endpoint.replace(/\/[0-9a-f-]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}/g, '/:id');
  endpoint = endpoint.replace(/\/\d+/g, '/:id');
  return `${method}:${endpoint}`;
};

/**
 * Get client IP address
 * @param {Object} req - Express request object
 * @returns {string} - Client IP
 */
const getClientIP = (req) => {
  return req.ip || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         'unknown';
};

/**
 * Rate limit middleware factory
 * @param {Object} options - Rate limit options
 * @param {number} options.limit - Max requests
 * @param {number} options.window - Time window in seconds
 * @param {string} options.keyPrefix - Key prefix for Redis
 * @param {Function} options.skip - Skip function
 * @param {string} options.identifier - Identifier type ('ip', 'user', 'both')
 * @returns {Function} - Express middleware
 */
const rateLimit = (options = {}) => {
  const defaultOptions = {
    limit: 100,
    window: 60,
    keyPrefix: 'rl:custom',
    skip: null,
    identifier: 'both',
  };
  
  const config = { ...defaultOptions, ...options };
  
  return async (req, res, next) => {
    try {
      // Skip rate limiting if skip function returns true
      if (config.skip && typeof config.skip === 'function' && config.skip(req)) {
        return next();
      }
      
      // Get identifiers
      const ip = getClientIP(req);
      const userId = req.user?.id || 'anonymous';
      
      // Build identifier based on config
      let identifier;
      if (config.identifier === 'user' && req.user) {
        identifier = `user:${userId}`;
      } else if (config.identifier === 'ip') {
        identifier = `ip:${ip}`;
      } else {
        identifier = `ip:${ip}:user:${userId}`;
      }
      
      // Get rate limit config
      const rateConfig = getRateLimitConfig(req);
      const limit = rateConfig?.limit || config.limit;
      const window = rateConfig?.window || config.window;
      const keyPrefix = rateConfig?.keyPrefix || config.keyPrefix;
      
      // Build Redis key
      const key = getRateLimitKey(req, { keyPrefix }, identifier);
      
      // Increment counter
      const current = await cache.incrementCounter(key);
      
      // Set expiry on first request
      if (current === 1) {
        await cache.expireKey(key, window);
      }
      
      // Get TTL
      const ttl = await cache.getTTL(key);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - current));
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + Math.max(0, ttl));
      
      // Check if rate limit exceeded
      if (current > limit) {
        logger.warn(`Rate limit exceeded for ${identifier} on ${req.path} (${current}/${limit})`);
        
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please wait and try again.',
          code: 'RATE_001',
          retryAfter: Math.max(0, ttl),
          limit: limit,
          current: current,
        });
      }
      
      next();
    } catch (error) {
      // Don't fail on rate limit errors
      logger.error('Rate limit middleware error:', error);
      next();
    }
  };
};

/**
 * Global rate limit middleware
 */
const globalRateLimit = rateLimit({
  limit: 100,
  window: 60,
  keyPrefix: 'rl:global',
  identifier: 'both',
});

/**
 * Auth rate limit middleware
 */
const authRateLimit = (type = 'login') => {
  const config = RATE_LIMITS.auth[type];
  if (!config) {
    throw new Error(`Unknown auth rate limit type: ${type}`);
  }
  return rateLimit({
    ...config,
    identifier: 'both',
  });
};

/**
 * User rate limit middleware
 */
const userRateLimit = (type = 'profile') => {
  const config = RATE_LIMITS.user[type];
  if (!config) {
    throw new Error(`Unknown user rate limit type: ${type}`);
  }
  return rateLimit({
    ...config,
    identifier: 'user',
  });
};

/**
 * Bet rate limit middleware
 */
const betRateLimit = (type = 'place') => {
  const config = RATE_LIMITS.bet[type];
  if (!config) {
    throw new Error(`Unknown bet rate limit type: ${type}`);
  }
  return rateLimit({
    ...config,
    identifier: 'user',
  });
};

/**
 * Wallet rate limit middleware
 */
const walletRateLimit = (type = 'balance') => {
  const config = RATE_LIMITS.wallet[type];
  if (!config) {
    throw new Error(`Unknown wallet rate limit type: ${type}`);
  }
  return rateLimit({
    ...config,
    identifier: 'user',
  });
};

/**
 * Admin rate limit middleware
 */
const adminRateLimit = (type = 'default') => {
  const config = RATE_LIMITS.admin[type];
  if (!config) {
    throw new Error(`Unknown admin rate limit type: ${type}`);
  }
  return rateLimit({
    ...config,
    identifier: 'user',
  });
};

/**
 * Public rate limit middleware
 */
const publicRateLimit = (type = 'default') => {
  const config = RATE_LIMITS.public[type];
  if (!config) {
    throw new Error(`Unknown public rate limit type: ${type}`);
  }
  return rateLimit({
    ...config,
    identifier: 'ip',
  });
};

/**
 * Custom rate limit middleware with dynamic configuration
 */
const dynamicRateLimit = (config) => {
  return rateLimit(config);
};

/**
 * Rate limit bypass for internal services (set in environment)
 */
const isInternalService = (req) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  const internalApiKeys = process.env.INTERNAL_API_KEYS?.split(',') || [];
  return apiKey && internalApiKeys.includes(apiKey);
};

/**
 * Skip rate limiting for internal services
 */
const skipForInternal = (req) => {
  return isInternalService(req);
};

// Export middleware
module.exports = {
  rateLimit,
  globalRateLimit,
  authRateLimit,
  userRateLimit,
  betRateLimit,
  walletRateLimit,
  adminRateLimit,
  publicRateLimit,
  dynamicRateLimit,
  getRateLimitConfig,
  getClientIP,
  isInternalService,
  skipForInternal,
  RATE_LIMITS,
};
