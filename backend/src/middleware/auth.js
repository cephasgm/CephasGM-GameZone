/**
 * Authentication Middleware - JWT & API Key Authentication
 * CephasGM GameZone
 * 
 * This middleware handles authentication for API endpoints using JWT tokens
 * and API keys. It validates tokens, checks blacklists, and attaches user
 * information to the request object.
 */

const { verifyAccessToken, extractTokenFromRequest, isTokenBlacklisted } = require('../utils/jwt');
const { User } = require('../models');
const logger = require('../utils/logger');
const { cache } = require('../config/redis');

/**
 * Authenticate using JWT Bearer token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(req);
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please provide a valid token.',
        code: 'AUTH_010',
      });
    }

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been revoked. Please login again.',
        code: 'AUTH_011',
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      if (error.message === 'Token expired') {
        return res.status(401).json({
          success: false,
          message: 'Token has expired. Please refresh your token.',
          code: 'AUTH_012',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
        code: 'AUTH_013',
      });
    }

    // Find user from token payload
    const user = await User.findByPk(decoded.sub, {
      attributes: {
        exclude: ['password_hash', 'salt', 'two_factor_secret', 'two_factor_backup_codes'],
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please login again.',
        code: 'AUTH_014',
      });
    }

    // Check if user account is active
    if (user.status !== 'active' && user.status !== 'verified') {
      return res.status(403).json({
        success: false,
        message: `Your account is ${user.status}. Please contact support.`,
        code: 'AUTH_015',
      });
    }

    // Check if user is locked
    if (user.isLocked()) {
      return res.status(403).json({
        success: false,
        message: 'Your account is temporarily locked. Please try again later.',
        code: 'AUTH_016',
        lockUntil: user.locked_until,
      });
    }

    // Check if user is self-excluded
    if (user.isSelfExcluded()) {
      return res.status(403).json({
        success: false,
        message: 'Your account is self-excluded. Please contact support for assistance.',
        code: 'AUTH_017',
      });
    }

    // Check if token was issued before password change
    if (user.last_password_change) {
      const tokenIssuedAt = new Date(decoded.iat * 1000);
      if (tokenIssuedAt < user.last_password_change) {
        return res.status(401).json({
          success: false,
          message: 'Password has been changed. Please login again.',
          code: 'AUTH_018',
        });
      }
    }

    // Check if email is verified (if required)
    if (!user.email_verified && req.path !== '/verify-email') {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before continuing.',
        code: 'AUTH_019',
        email: user.email,
      });
    }

    // Attach user and token info to request
    req.user = user;
    req.token = token;
    req.tokenPayload = decoded;

    // Log successful authentication (debug level)
    logger.debug(`User ${user.id} authenticated via token`);

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed due to server error.',
      code: 'AUTH_020',
    });
  }
};

/**
 * Optional authentication - does not fail if no token is provided
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = extractTokenFromRequest(req);
    
    if (!token) {
      return next();
    }

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      return next();
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      return next();
    }

    // Find user
    const user = await User.findByPk(decoded.sub, {
      attributes: {
        exclude: ['password_hash', 'salt', 'two_factor_secret', 'two_factor_backup_codes'],
      },
    });

    if (user && user.status === 'active') {
      req.user = user;
      req.token = token;
      req.tokenPayload = decoded;
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    logger.debug('Optional authentication error:', error.message);
    next();
  }
};

/**
 * Authenticate using API Key (for internal services)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key required.',
        code: 'AUTH_021',
      });
    }

    // Check API key in cache or database
    const keyData = await cache.get(`api_key:${apiKey}`);
    if (!keyData) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key.',
        code: 'AUTH_022',
      });
    }

    const parsedData = JSON.parse(keyData);
    
    // Check if key is expired
    if (parsedData.expires_at && new Date(parsedData.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'API key has expired.',
        code: 'AUTH_023',
      });
    }

    // Attach API key info to request
    req.apiKey = parsedData;
    req.userId = parsedData.user_id;

    // If user_id is provided, fetch user
    if (parsedData.user_id) {
      const user = await User.findByPk(parsedData.user_id, {
        attributes: {
          exclude: ['password_hash', 'salt', 'two_factor_secret', 'two_factor_backup_codes'],
        },
      });
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    logger.error('API key authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed due to server error.',
      code: 'AUTH_024',
    });
  }
};

/**
 * Refresh token middleware - validates refresh token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const validateRefreshToken = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token required.',
        code: 'AUTH_025',
      });
    }

    // Verify refresh token
    let decoded;
    try {
      const { verifyRefreshToken } = require('../utils/jwt');
      decoded = verifyRefreshToken(refresh_token);
    } catch (error) {
      if (error.message === 'Token expired') {
        return res.status(401).json({
          success: false,
          message: 'Refresh token has expired. Please login again.',
          code: 'AUTH_026',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token.',
        code: 'AUTH_027',
      });
    }

    // Check if refresh token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(refresh_token);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token has been revoked.',
        code: 'AUTH_028',
      });
    }

    // Find user
    const user = await User.findByPk(decoded.sub, {
      attributes: {
        exclude: ['password_hash', 'salt', 'two_factor_secret', 'two_factor_backup_codes'],
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.',
        code: 'AUTH_029',
      });
    }

    // Check if user is active
    if (user.status !== 'active' && user.status !== 'verified') {
      return res.status(403).json({
        success: false,
        message: `Your account is ${user.status}.`,
        code: 'AUTH_030',
      });
    }

    req.refreshToken = refresh_token;
    req.user = user;
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    logger.error('Refresh token validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Token validation failed due to server error.',
      code: 'AUTH_031',
    });
  }
};

/**
 * WebSocket authentication middleware
 * @param {Object} socket - Socket.IO socket
 * @param {Function} next - Socket.IO next function
 */
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || 
                  socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      return next(new Error('Token has been revoked'));
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      return next(new Error('Invalid token'));
    }

    // Find user
    const user = await User.findByPk(decoded.sub, {
      attributes: {
        exclude: ['password_hash', 'salt', 'two_factor_secret', 'two_factor_backup_codes'],
      },
    });

    if (!user || user.status !== 'active') {
      return next(new Error('User not found or inactive'));
    }

    // Attach user to socket
    socket.user = user;
    socket.userId = user.id;

    next();
  } catch (error) {
    logger.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

/**
 * Rate limiting by user ID (for authenticated requests)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const userRateLimit = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const endpoint = req.path;
    const key = `rate_limit:user:${userId}:${endpoint}`;
    
    // Check if rate limit is configured for this endpoint
    const rateLimitConfig = getRateLimitConfig(req);
    if (!rateLimitConfig) {
      return next();
    }

    const { limit, window } = rateLimitConfig;
    const currentCount = await cache.incrementCounter(key);

    if (currentCount === 1) {
      await cache.expireKey(key, window);
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - currentCount));

    if (currentCount > limit) {
      const ttl = await cache.getTTL(key);
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + ttl);
      
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please slow down.',
        code: 'RATE_001',
        retryAfter: ttl,
      });
    }

    next();
  } catch (error) {
    // Don't fail on rate limit errors
    logger.error('Rate limit error:', error);
    next();
  }
};

/**
 * Get rate limit configuration for endpoint
 * @param {Object} req - Express request object
 * @returns {Object|null} - Rate limit config or null
 */
const getRateLimitConfig = (req) => {
  const endpoint = req.path;
  const method = req.method;

  // Default rate limits by endpoint pattern
  const limits = {
    '/bets': { limit: 30, window: 60 }, // 30 bets per minute
    '/wallet/deposit': { limit: 10, window: 60 }, // 10 deposits per minute
    '/wallet/withdraw': { limit: 5, window: 60 }, // 5 withdrawals per minute
    '/messages': { limit: 20, window: 60 }, // 20 messages per minute
    '/auth/login': { limit: 10, window: 300 }, // 10 logins per 5 minutes
    '/auth/register': { limit: 5, window: 3600 }, // 5 registrations per hour
  };

  for (const [pattern, config] of Object.entries(limits)) {
    if (endpoint.includes(pattern)) {
      return config;
    }
  }

  // Default rate limit
  return { limit: 100, window: 60 };
};

// Export middleware functions
module.exports = {
  authenticate,
  optionalAuthenticate,
  authenticateApiKey,
  authenticateSocket,
  validateRefreshToken,
  userRateLimit,
};
