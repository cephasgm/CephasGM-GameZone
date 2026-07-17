/**
 * JWT Utility - JSON Web Token Management
 * CephasGM GameZone
 * 
 * This module provides comprehensive JWT functionality including:
 * - Access token generation and verification
 * - Refresh token generation and verification
 * - Email verification tokens
 * - Password reset tokens
 * - Token blacklisting
 * - Token rotation and revocation
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const logger = require('./logger');
const { cache } = require('../config/redis');
const authConfig = require('../config/auth');

// Get configuration
const config = authConfig.config;
const env = process.env.NODE_ENV || 'development';

/**
 * Token types
 */
const TOKEN_TYPES = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  EMAIL_VERIFICATION: 'email_verification',
  PASSWORD_RESET: 'password_reset',
  API_KEY: 'api_key',
  SESSION: 'session',
};

/**
 * Generate a JWT token
 * @param {Object} payload - Token payload
 * @param {string} secret - Secret key
 * @param {Object} options - Token options
 * @returns {string} - JWT token
 */
const signToken = (payload, secret, options = {}) => {
  try {
    const defaultOptions = {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      algorithm: 'HS256',
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
    };

    return jwt.sign(payload, secret, mergedOptions);
  } catch (error) {
    logger.error('JWT signing failed:', error);
    throw new Error('Failed to generate token');
  }
};

/**
 * Verify a JWT token
 * @param {string} token - JWT token
 * @param {string} secret - Secret key
 * @param {Object} options - Verification options
 * @returns {Object} - Decoded token payload
 */
const verifyToken = (token, secret, options = {}) => {
  try {
    const defaultOptions = {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      ignoreExpiration: false,
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
    };

    return jwt.verify(token, secret, mergedOptions);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    logger.error('JWT verification failed:', error);
    throw new Error('Failed to verify token');
  }
};

/**
 * Decode a JWT token without verification
 * @param {string} token - JWT token
 * @returns {Object} - Decoded token payload (header and payload)
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token, { complete: true });
  } catch (error) {
    logger.error('JWT decoding failed:', error);
    return null;
  }
};

/**
 * Generate an access token
 * @param {Object} user - User object
 * @param {Object} options - Additional options
 * @returns {Object} - { token, expiresIn, expiresAt }
 */
const generateAccessToken = (user, options = {}) => {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role || 'user',
    name: `${user.first_name} ${user.last_name}`,
    jti: crypto.randomBytes(16).toString('hex'),
    type: TOKEN_TYPES.ACCESS,
    ...options,
  };

  const expiresIn = options.expiresIn || config.jwt.accessTokenExpiry;
  const token = signToken(payload, config.jwt.secret, { expiresIn });

  // Calculate expiration timestamp
  const expiresAt = new Date();
  const expiryMs = parseExpiryToMs(expiresIn);
  expiresAt.setTime(expiresAt.getTime() + expiryMs);

  return {
    token,
    expiresIn,
    expiresAt: expiresAt.toISOString(),
    payload,
  };
};

/**
 * Generate a refresh token
 * @param {Object} user - User object
 * @param {Object} options - Additional options
 * @returns {Object} - { token, expiresIn, expiresAt }
 */
const generateRefreshToken = (user, options = {}) => {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role || 'user',
    jti: crypto.randomBytes(16).toString('hex'),
    type: TOKEN_TYPES.REFRESH,
    ...options,
  };

  const expiresIn = options.expiresIn || config.jwt.refreshTokenExpiry;
  const token = signToken(payload, config.jwt.refreshSecret, { expiresIn });

  // Calculate expiration timestamp
  const expiresAt = new Date();
  const expiryMs = parseExpiryToMs(expiresIn);
  expiresAt.setTime(expiresAt.getTime() + expiryMs);

  return {
    token,
    expiresIn,
    expiresAt: expiresAt.toISOString(),
    payload,
  };
};

/**
 * Generate an email verification token
 * @param {Object} user - User object
 * @param {Object} options - Additional options
 * @returns {Object} - { token, expiresIn, expiresAt }
 */
const generateEmailVerificationToken = (user, options = {}) => {
  const payload = {
    sub: user.id,
    email: user.email,
    type: TOKEN_TYPES.EMAIL_VERIFICATION,
    jti: crypto.randomBytes(16).toString('hex'),
    ...options,
  };

  const expiresIn = options.expiresIn || config.jwt.emailVerificationExpiry;
  const token = signToken(payload, config.jwt.secret, { expiresIn });

  const expiresAt = new Date();
  const expiryMs = parseExpiryToMs(expiresIn);
  expiresAt.setTime(expiresAt.getTime() + expiryMs);

  return {
    token,
    expiresIn,
    expiresAt: expiresAt.toISOString(),
    payload,
  };
};

/**
 * Generate a password reset token
 * @param {Object} user - User object
 * @param {Object} options - Additional options
 * @returns {Object} - { token, expiresIn, expiresAt }
 */
const generatePasswordResetToken = (user, options = {}) => {
  const payload = {
    sub: user.id,
    email: user.email,
    type: TOKEN_TYPES.PASSWORD_RESET,
    jti: crypto.randomBytes(16).toString('hex'),
    ...options,
  };

  const expiresIn = options.expiresIn || config.jwt.passwordResetExpiry;
  const token = signToken(payload, config.jwt.secret, { expiresIn });

  const expiresAt = new Date();
  const expiryMs = parseExpiryToMs(expiresIn);
  expiresAt.setTime(expiresAt.getTime() + expiryMs);

  return {
    token,
    expiresIn,
    expiresAt: expiresAt.toISOString(),
    payload,
  };
};

/**
 * Generate a complete token pair (access + refresh)
 * @param {Object} user - User object
 * @param {Object} options - Additional options
 * @returns {Object} - { access, refresh }
 */
const generateTokenPair = (user, options = {}) => {
  const access = generateAccessToken(user, options);
  const refresh = generateRefreshToken(user, options);

  return {
    access,
    refresh,
  };
};

/**
 * Verify an access token
 * @param {string} token - Access token
 * @param {Object} options - Verification options
 * @returns {Object} - Decoded token payload
 */
const verifyAccessToken = (token, options = {}) => {
  return verifyToken(token, config.jwt.secret, options);
};

/**
 * Verify a refresh token
 * @param {string} token - Refresh token
 * @param {Object} options - Verification options
 * @returns {Object} - Decoded token payload
 */
const verifyRefreshToken = (token, options = {}) => {
  return verifyToken(token, config.jwt.refreshSecret, options);
};

/**
 * Refresh an access token using a refresh token
 * @param {string} refreshToken - Refresh token
 * @param {Object} user - User object (optional, will be fetched if not provided)
 * @param {Function} getUserFn - Function to fetch user by ID
 * @returns {Promise<Object>} - New access token
 */
const refreshAccessToken = async (refreshToken, user = null, getUserFn = null) => {
  try {
    // Verify the refresh token
    const payload = verifyRefreshToken(refreshToken);

    // Check if token is blacklisted
    const isBlacklisted = await cache.get(`jwt:blacklist:${payload.jti}`);
    if (isBlacklisted) {
      throw new Error('Refresh token has been revoked');
    }

    // Get user if not provided
    let userData = user;
    if (!userData && getUserFn) {
      userData = await getUserFn(payload.sub);
    }

    if (!userData) {
      throw new Error('User not found');
    }

    // Generate new access token
    const access = generateAccessToken(userData);

    // Rotate the refresh token (optional - enables refresh token rotation)
    // Optionally blacklist the old refresh token
    await cache.set(`jwt:blacklist:${payload.jti}`, 'true', 7 * 24 * 60 * 60); // 7 days

    return {
      access,
      refresh: generateRefreshToken(userData), // New refresh token
    };
  } catch (error) {
    logger.error('Refresh token failed:', error.message);
    throw error;
  }
};

/**
 * Blacklist a token (add to blacklist)
 * @param {string} token - Token to blacklist
 * @param {number} ttl - Time to live in seconds
 * @returns {Promise<void>}
 */
const blacklistToken = async (token, ttl = 7 * 24 * 60 * 60) => {
  try {
    const decoded = decodeToken(token);
    if (decoded && decoded.payload && decoded.payload.jti) {
      await cache.set(`jwt:blacklist:${decoded.payload.jti}`, 'true', ttl);
      logger.debug(`Token blacklisted: ${decoded.payload.jti}`);
    }
  } catch (error) {
    logger.error('Failed to blacklist token:', error);
  }
};

/**
 * Check if a token is blacklisted
 * @param {string} token - Token to check
 * @returns {Promise<boolean>} - Whether the token is blacklisted
 */
const isTokenBlacklisted = async (token) => {
  try {
    const decoded = decodeToken(token);
    if (decoded && decoded.payload && decoded.payload.jti) {
      const isBlacklisted = await cache.get(`jwt:blacklist:${decoded.payload.jti}`);
      return !!isBlacklisted;
    }
    return false;
  } catch (error) {
    logger.error('Failed to check token blacklist:', error);
    return false;
  }
};

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header
 * @returns {string|null} - Token or null
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  return null;
};

/**
 * Extract token from request
 * @param {Object} req - Express request object
 * @returns {string|null} - Token or null
 */
const extractTokenFromRequest = (req) => {
  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = extractTokenFromHeader(authHeader);
    if (token) return token;
  }

  // Check query parameter
  if (req.query && req.query.token) {
    return req.query.token;
  }

  // Check cookies
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
};

/**
 * Parse expiry string to milliseconds
 * @param {string} expiry - Expiry string (e.g., '15m', '7d')
 * @returns {number} - Milliseconds
 */
const parseExpiryToMs = (expiry) => {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return parseInt(expiry) || 900000; // Default 15 minutes
  return parseInt(match[1]) * units[match[2]];
};

/**
 * Get token expiration time in seconds from now
 * @param {string} expiry - Expiry string
 * @returns {number} - Seconds from now
 */
const getExpirySeconds = (expiry) => {
  const ms = parseExpiryToMs(expiry);
  return Math.floor(ms / 1000);
};

/**
 * Get token payload without verification
 * @param {string} token - JWT token
 * @returns {Object|null} - Token payload or null
 */
const getTokenPayload = (token) => {
  const decoded = decodeToken(token);
  return decoded ? decoded.payload : null;
};

/**
 * Validate token structure
 * @param {string} token - JWT token
 * @param {string} expectedType - Expected token type
 * @returns {boolean} - Whether the token is valid
 */
const validateTokenStructure = (token, expectedType = null) => {
  const decoded = decodeToken(token);
  if (!decoded) return false;

  const payload = decoded.payload;
  if (!payload || typeof payload !== 'object') return false;

  // Check required fields
  if (!payload.sub || !payload.jti || !payload.type) return false;

  // Check type if specified
  if (expectedType && payload.type !== expectedType) return false;

  return true;
};

// Export JWT utilities
module.exports = {
  // Token types
  TOKEN_TYPES,

  // Token generation
  signToken,
  generateAccessToken,
  generateRefreshToken,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  generateTokenPair,

  // Token verification
  verifyToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshAccessToken,

  // Token utilities
  decodeToken,
  getTokenPayload,
  validateTokenStructure,

  // Blacklist
  blacklistToken,
  isTokenBlacklisted,

  // Extraction
  extractTokenFromHeader,
  extractTokenFromRequest,

  // Utilities
  parseExpiryToMs,
  getExpirySeconds,

  // Configuration access
  getConfig: () => config.jwt,
};

// Default export
module.exports.default = module.exports;
