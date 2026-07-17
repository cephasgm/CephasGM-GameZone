/**
 * Redis Configuration - Caching & Session Management
 * CephasGM GameZone
 * 
 * This module manages Redis connections for caching, session storage,
 * rate limiting, and real-time data. Supports multiple environments
 * with connection pooling and error handling.
 */

const Redis = require('ioredis');
const logger = require('../utils/logger');

// Environment variables
const env = process.env.NODE_ENV || 'development';

/**
 * Redis configuration for different environments
 */
const redisConfig = {
  development: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryStrategy: (times) => {
      const delay = Math.min(times * 50, 2000);
      logger.warn(`🔄 Redis reconnecting... Attempt ${times}, delay: ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  },
  test: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '1'),
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      return delay;
    },
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    lazyConnect: false,
  },
  production: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    retryStrategy: (times) => {
      const delay = Math.min(times * 100, 3000);
      logger.warn(`🔄 Redis reconnecting... Attempt ${times}, delay: ${delay}ms`);
      return delay;
    },
    maxRetriesPerRequest: 5,
    enableReadyCheck: true,
    lazyConnect: false,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    connectTimeout: 10000,
    keepAlive: 30000,
  },
};

// Get configuration for current environment
const config = redisConfig[env] || redisConfig.development;

/**
 * Create Redis client instance
 */
const redisClient = new Redis({
  host: config.host,
  port: config.port,
  password: config.password,
  db: config.db,
  retryStrategy: config.retryStrategy,
  maxRetriesPerRequest: config.maxRetriesPerRequest,
  enableReadyCheck: config.enableReadyCheck,
  lazyConnect: config.lazyConnect,
  tls: config.tls,
  connectTimeout: config.connectTimeout,
  keepAlive: config.keepAlive,
});

/**
 * Redis event handlers
 */
redisClient.on('connect', () => {
  logger.info(`🔴 Redis connected successfully (${env} environment)`);
});

redisClient.on('ready', () => {
  logger.info('🔴 Redis is ready and available');
});

redisClient.on('error', (error) => {
  logger.error('🔴 Redis connection error:', error.message);
});

redisClient.on('close', () => {
  logger.warn('🔴 Redis connection closed');
});

redisClient.on('reconnecting', () => {
  logger.warn('🔄 Redis reconnecting...');
});

redisClient.on('end', () => {
  logger.warn('🔴 Redis connection ended');
});

/**
 * Test Redis connection
 * @returns {Promise<boolean>}
 */
const testConnection = async () => {
  try {
    await redisClient.ping();
    logger.info('✅ Redis connection test successful.');
    return true;
  } catch (error) {
    logger.error('❌ Redis connection test failed:', error.message);
    return false;
  }
};

/**
 * Set a value in Redis with optional expiration
 * @param {string} key - Cache key
 * @param {*} value - Value to store (will be JSON.stringified)
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<void>}
 */
const setCache = async (key, value, ttl = null) => {
  try {
    const serialized = JSON.stringify(value);
    if (ttl) {
      await redisClient.setex(key, ttl, serialized);
    } else {
      await redisClient.set(key, serialized);
    }
  } catch (error) {
    logger.error(`❌ Failed to set cache for key "${key}":`, error.message);
    throw error;
  }
};

/**
 * Get a value from Redis
 * @param {string} key - Cache key
 * @returns {Promise<*>} - Parsed value or null
 */
const getCache = async (key) => {
  try {
    const value = await redisClient.get(key);
    if (value) {
      return JSON.parse(value);
    }
    return null;
  } catch (error) {
    logger.error(`❌ Failed to get cache for key "${key}":`, error.message);
    return null;
  }
};

/**
 * Delete a key from Redis
 * @param {string} key - Cache key
 * @returns {Promise<number>} - Number of keys deleted
 */
const deleteCache = async (key) => {
  try {
    return await redisClient.del(key);
  } catch (error) {
    logger.error(`❌ Failed to delete cache for key "${key}":`, error.message);
    return 0;
  }
};

/**
 * Delete multiple keys matching a pattern
 * @param {string} pattern - Key pattern (e.g., "user:*")
 * @returns {Promise<number>} - Number of keys deleted
 */
const deleteCachePattern = async (pattern) => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      return await redisClient.del(...keys);
    }
    return 0;
  } catch (error) {
    logger.error(`❌ Failed to delete cache pattern "${pattern}":`, error.message);
    return 0;
  }
};

/**
 * Set a hash field in Redis
 * @param {string} key - Hash key
 * @param {string} field - Field name
 * @param {*} value - Value to store
 * @returns {Promise<void>}
 */
const setHashField = async (key, field, value) => {
  try {
    const serialized = JSON.stringify(value);
    await redisClient.hset(key, field, serialized);
  } catch (error) {
    logger.error(`❌ Failed to set hash field "${field}" for key "${key}":`, error.message);
    throw error;
  }
};

/**
 * Get a hash field from Redis
 * @param {string} key - Hash key
 * @param {string} field - Field name
 * @returns {Promise<*>} - Parsed value or null
 */
const getHashField = async (key, field) => {
  try {
    const value = await redisClient.hget(key, field);
    if (value) {
      return JSON.parse(value);
    }
    return null;
  } catch (error) {
    logger.error(`❌ Failed to get hash field "${field}" for key "${key}":`, error.message);
    return null;
  }
};

/**
 * Get all fields from a Redis hash
 * @param {string} key - Hash key
 * @returns {Promise<Object>} - All fields and values
 */
const getHashAll = async (key) => {
  try {
    const result = await redisClient.hgetall(key);
    if (result) {
      const parsed = {};
      for (const [field, value] of Object.entries(result)) {
        try {
          parsed[field] = JSON.parse(value);
        } catch {
          parsed[field] = value;
        }
      }
      return parsed;
    }
    return {};
  } catch (error) {
    logger.error(`❌ Failed to get all hash fields for key "${key}":`, error.message);
    return {};
  }
};

/**
 * Add to a Redis set
 * @param {string} key - Set key
 * @param {*} value - Value to add
 * @returns {Promise<number>} - Number of elements added
 */
const addToSet = async (key, value) => {
  try {
    const serialized = JSON.stringify(value);
    return await redisClient.sadd(key, serialized);
  } catch (error) {
    logger.error(`❌ Failed to add to set "${key}":`, error.message);
    return 0;
  }
};

/**
 * Get all members of a Redis set
 * @param {string} key - Set key
 * @returns {Promise<Array>} - Parsed values
 */
const getSetMembers = async (key) => {
  try {
    const members = await redisClient.smembers(key);
    return members.map((member) => {
      try {
        return JSON.parse(member);
      } catch {
        return member;
      }
    });
  } catch (error) {
    logger.error(`❌ Failed to get set members for key "${key}":`, error.message);
    return [];
  }
};

/**
 * Increment a Redis counter
 * @param {string} key - Counter key
 * @param {number} by - Amount to increment (default: 1)
 * @returns {Promise<number>} - New counter value
 */
const incrementCounter = async (key, by = 1) => {
  try {
    return await redisClient.incrby(key, by);
  } catch (error) {
    logger.error(`❌ Failed to increment counter "${key}":`, error.message);
    return 0;
  }
};

/**
 * Set expiration on a key
 * @param {string} key - Key to expire
 * @param {number} seconds - TTL in seconds
 * @returns {Promise<number>} - 1 if set, 0 if key doesn't exist
 */
const expireKey = async (key, seconds) => {
  try {
    return await redisClient.expire(key, seconds);
  } catch (error) {
    logger.error(`❌ Failed to set expiration for key "${key}":`, error.message);
    return 0;
  }
};

/**
 * Get remaining TTL of a key
 * @param {string} key - Key to check
 * @returns {Promise<number>} - TTL in seconds (-2 if not exists, -1 if no expiry)
 */
const getTTL = async (key) => {
  try {
    return await redisClient.ttl(key);
  } catch (error) {
    logger.error(`❌ Failed to get TTL for key "${key}":`, error.message);
    return -2;
  }
};

/**
 * Flush the current Redis database
 * @returns {Promise<void>}
 */
const flushDatabase = async () => {
  try {
    await redisClient.flushdb();
    logger.info('✅ Redis database flushed.');
  } catch (error) {
    logger.error('❌ Failed to flush Redis database:', error.message);
    throw error;
  }
};

/**
 * Close Redis connection
 */
const closeConnection = async () => {
  try {
    await redisClient.quit();
    logger.info('✅ Redis connection closed.');
  } catch (error) {
    logger.error('❌ Error closing Redis connection:', error.message);
    throw error;
  }
};

// Export Redis client and utility functions
module.exports = {
  redisClient,
  config,
  testConnection,
  setCache,
  getCache,
  deleteCache,
  deleteCachePattern,
  setHashField,
  getHashField,
  getHashAll,
  addToSet,
  getSetMembers,
  incrementCounter,
  expireKey,
  getTTL,
  flushDatabase,
  closeConnection,
};

// Default export for convenience
module.exports.default = redisClient;
