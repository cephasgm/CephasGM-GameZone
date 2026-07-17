/**
 * Logger Middleware - Request & Response Logging
 * CephasGM GameZone
 * 
 * This middleware provides comprehensive request/response logging using
 * the Winston logger. It captures request details, response status,
 * response time, and performance metrics. It also handles logging of
 * sensitive data masking and health check filtering.
 */

const { logger, logHttp } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * List of sensitive fields to mask in logs
 */
const SENSITIVE_FIELDS = [
  'password',
  'password_hash',
  'salt',
  'token',
  'refresh_token',
  'access_token',
  'api_key',
  'secret',
  'card_number',
  'cvv',
  'cvc',
  'expiry',
  'expiration',
  'pin',
  'private_key',
  'authorization',
  'cookie',
];

/**
 * List of endpoints to exclude from logging
 */
const EXCLUDED_ENDPOINTS = [
  '/health',
  '/healthz',
  '/ping',
  '/metrics',
  '/favicon.ico',
  '/robots.txt',
];

/**
 * Maximum body size to log (in bytes)
 */
const MAX_BODY_LOG_SIZE = 10000;

/**
 * Mask sensitive data in an object
 * @param {Object} data - Data to mask
 * @param {string[]} sensitiveFields - Fields to mask
 * @returns {Object} - Masked data
 */
const maskSensitiveData = (data, sensitiveFields = SENSITIVE_FIELDS) => {
  if (!data || typeof data !== 'object') return data;

  const masked = { ...data };
  for (const key of Object.keys(masked)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()));
    
    if (isSensitive && masked[key] !== undefined && masked[key] !== null) {
      if (typeof masked[key] === 'string' && masked[key].length > 0) {
        const value = masked[key];
        if (value.length > 6) {
          masked[key] = value.slice(0, 2) + '******' + value.slice(-2);
        } else {
          masked[key] = '******';
        }
      }
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key], sensitiveFields);
    }
  }
  return masked;
};

/**
 * Truncate large strings/objects for logging
 * @param {*} value - Value to truncate
 * @param {number} maxSize - Maximum size
 * @returns {*} - Truncated value
 */
const truncateLargeData = (value, maxSize = MAX_BODY_LOG_SIZE) => {
  if (typeof value === 'string' && value.length > maxSize) {
    return value.substring(0, maxSize) + `... [truncated, ${value.length} chars total]`;
  }
  if (typeof value === 'object' && value !== null) {
    const str = JSON.stringify(value);
    if (str.length > maxSize) {
      return {
        ...value,
        _truncated: true,
        _originalSize: str.length,
      };
    }
  }
  return value;
};

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} - Client IP
 */
const getClientIP = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         req.ip || 
         'unknown';
};

/**
 * Get user agent from request
 * @param {Object} req - Express request object
 * @returns {string} - User agent
 */
const getUserAgent = (req) => {
  return req.get('user-agent') || 'unknown';
};

/**
 * Get referrer from request
 * @param {Object} req - Express request object
 * @returns {string} - Referrer
 */
const getReferrer = (req) => {
  return req.get('referer') || req.get('referrer') || 'unknown';
};

/**
 * Check if endpoint should be excluded from logging
 * @param {string} path - Request path
 * @returns {boolean} - Whether to exclude
 */
const shouldExclude = (path) => {
  return EXCLUDED_ENDPOINTS.some(endpoint => path.includes(endpoint));
};

/**
 * Check if request body should be logged
 * @param {Object} req - Express request object
 * @returns {boolean} - Whether to log body
 */
const shouldLogBody = (req) => {
  // Don't log body for GET, HEAD, DELETE requests
  if (['GET', 'HEAD', 'DELETE'].includes(req.method)) {
    return false;
  }
  // Don't log multipart/form-data (file uploads)
  if (req.headers['content-type']?.includes('multipart/form-data')) {
    return false;
  }
  return true;
};

/**
 * Main request logger middleware
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || uuidv4();
  
  // Attach request ID to the request object for correlation
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Skip logging for excluded endpoints
  if (shouldExclude(req.path)) {
    return next();
  }

  // Collect request data
  const requestData = {
    requestId,
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    ip: getClientIP(req),
    userAgent: getUserAgent(req),
    referer: getReferrer(req),
    userId: req.user?.id || 'unauthenticated',
    email: req.user?.email || 'unauthenticated',
  };

  // Log request body (with masking and truncation)
  if (shouldLogBody(req) && req.body && Object.keys(req.body).length > 0) {
    try {
      const maskedBody = maskSensitiveData(req.body);
      requestData.body = truncateLargeData(maskedBody);
    } catch (error) {
      requestData.body = '[Unable to parse body]';
    }
  }

  // Log request headers (safely)
  const safeHeaders = { ...req.headers };
  delete safeHeaders.authorization;
  delete safeHeaders.cookie;
  delete safeHeaders['x-api-key'];
  requestData.headers = maskSensitiveData(safeHeaders);

  // Log the request
  logger.debug(`➡️ ${req.method} ${req.path}`, requestData);

  // Capture original send to log response
  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody = null;

  // Override res.send to capture response body
  res.send = function(data) {
    if (data) {
      try {
        // Only capture if it's a string or buffer that looks like JSON
        if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
          responseBody = data;
        } else if (typeof data === 'object') {
          responseBody = JSON.stringify(data);
        }
      } catch (error) {
        // Ignore parsing errors
      }
    }
    return originalSend.call(this, data);
  };

  // Override res.json to capture response body
  res.json = function(data) {
    if (data) {
      try {
        responseBody = JSON.stringify(data);
      } catch (error) {
        // Ignore
      }
    }
    return originalJson.call(this, data);
  };

  // Add response logging when the request completes
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Determine log level based on status code
    const logLevel = statusCode >= 500 ? 'error' : 
                     statusCode >= 400 ? 'warn' : 
                     statusCode >= 300 ? 'info' : 
                     'debug';

    // Collect response data
    const responseData = {
      requestId,
      method: req.method,
      path: req.path,
      statusCode,
      statusMessage: res.statusMessage || '',
      responseTime: `${responseTime}ms`,
      userId: req.user?.id || 'unauthenticated',
    };

    // Parse and mask response body if available
    if (responseBody) {
      try {
        const parsed = JSON.parse(responseBody);
        const masked = maskSensitiveData(parsed);
        responseData.body = truncateLargeData(masked);
      } catch (error) {
        // If it's not valid JSON, just store a preview
        responseData.body = responseBody.length > 500 ? 
          responseBody.substring(0, 500) + '...' : 
          responseBody;
      }
    }

    // Log the response
    const logMessage = `⬅️ ${req.method} ${req.path} ${statusCode} ${responseTime}ms`;

    if (logLevel === 'error') {
      logger.error(logMessage, responseData);
    } else if (logLevel === 'warn') {
      logger.warn(logMessage, responseData);
    } else {
      logger.debug(logMessage, responseData);
    }

    // Log slow requests (> 1 second)
    if (responseTime > 1000) {
      logger.warn(`⚠️ Slow request: ${req.method} ${req.path} took ${responseTime}ms`, {
        requestId,
        method: req.method,
        path: req.path,
        statusCode,
        responseTime,
      });
    }

    // Log to HTTP logger for access logs
    logHttp(req, res, responseTime);
  });

  // Handle errors during request processing
  res.on('error', (error) => {
    logger.error(`❌ Response error for ${req.method} ${req.path}:`, {
      requestId,
      error: error.message,
      stack: error.stack,
    });
  });

  next();
};

/**
 * Performance logger middleware
 * Logs performance metrics for critical operations
 */
const performanceLogger = (req, res, next) => {
  const startTime = process.hrtime();

  // Track when the response finishes
  res.on('finish', () => {
    const diff = process.hrtime(startTime);
    const responseTime = diff[0] * 1000 + diff[1] / 1000000;

    // Log performance metrics for API endpoints
    if (!shouldExclude(req.path)) {
      const metrics = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        responseTime: Math.round(responseTime),
        userId: req.user?.id || 'unauthenticated',
        contentLength: res.get('content-length') || 'unknown',
        timestamp: new Date().toISOString(),
      };

      // Track response time categories
      if (responseTime > 2000) {
        logger.warn(`⏱️ Very slow response: ${req.method} ${req.path} (${Math.round(responseTime)}ms)`, metrics);
      } else if (responseTime > 1000) {
        logger.info(`⏱️ Slow response: ${req.method} ${req.path} (${Math.round(responseTime)}ms)`, metrics);
      } else if (responseTime > 500) {
        logger.debug(`⏱️ Medium response: ${req.method} ${req.path} (${Math.round(responseTime)}ms)`, metrics);
      }

      // Log to performance logger
      logger.verbose(`PERF: ${req.method} ${req.path} - ${Math.round(responseTime)}ms`, metrics);
    }
  });

  next();
};

/**
 * Request ID generator middleware
 */
const requestIdGenerator = (req, res, next) => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

/**
 * GraphQL operation logger
 * @param {Object} context - GraphQL context
 * @param {Object} info - GraphQL info
 */
const graphQLLogger = (context, info) => {
  const operation = info.operation.name?.value || 'anonymous';
  const operationType = info.operation.operation;

  logger.debug(`GraphQL ${operationType} "${operation}"`, {
    operation,
    operationType,
    userId: context.user?.id || 'unauthenticated',
    ip: context.ip || 'unknown',
  });
};

// Export middleware
module.exports = {
  requestLogger,
  performanceLogger,
  requestIdGenerator,
  graphQLLogger,
  maskSensitiveData,
  shouldExclude,
  EXCLUDED_ENDPOINTS,
  SENSITIVE_FIELDS,
};
