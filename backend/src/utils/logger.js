/**
 * Logger Utility - Winston Logging Configuration
 * CephasGM GameZone
 * 
 * This module provides a centralized logging system using Winston.
 * Supports multiple log levels, file rotation, JSON formatting,
 * and environment-specific logging configurations.
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Environment variables
const env = process.env.NODE_ENV || 'development';
const logLevel = process.env.LOG_LEVEL || (env === 'production' ? 'info' : 'debug');

// Ensure log directory exists
const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

/**
 * Custom log format with colors
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level.toUpperCase()} [${service || 'app'}]: ${message}${metaStr}`;
  })
);

/**
 * Console format with colors for development
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS',
  }),
  winston.format.colorize({
    all: true,
    colors: {
      error: 'red',
      warn: 'yellow',
      info: 'cyan',
      debug: 'green',
      verbose: 'magenta',
    },
  }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level} [${service || 'app'}]: ${message}${metaStr}`;
  })
);

/**
 * Create Winston logger instance
 */
const logger = winston.createLogger({
  level: logLevel,
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
  },
  defaultMeta: {
    service: 'cephasgm-gamezone',
    environment: env,
  },
  transports: [],
});

/**
 * Configure transports based on environment
 */

// Console transport (always enabled)
logger.add(
  new winston.transports.Console({
    format: env === 'production' ? logFormat : consoleFormat,
    handleExceptions: true,
  })
);

// File transports (only in non-test environments)
if (env !== 'test') {
  // Error log file
  logger.add(
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '30d',
      handleExceptions: true,
    })
  );

  // Combined log file
  logger.add(
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '30d',
    })
  );

  // Access log file (HTTP requests)
  logger.add(
    new DailyRotateFile({
      filename: path.join(logDir, 'access-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'http',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '7d',
    })
  );

  // Audit log file (for sensitive operations)
  logger.add(
    new DailyRotateFile({
      filename: path.join(logDir, 'audit-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'info',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '90d',
    })
  );

  // Performance log file
  logger.add(
    new DailyRotateFile({
      filename: path.join(logDir, 'performance-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'verbose',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '7d',
    })
  );
}

/**
 * Stream for Morgan HTTP logging
 */
const stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

/**
 * Log an error with stack trace
 * @param {string} message - Error message
 * @param {Error} error - Error object
 * @param {Object} meta - Additional metadata
 */
const logError = (message, error, meta = {}) => {
  logger.error(message, {
    ...meta,
    error: {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
    },
  });
};

/**
 * Log an info message with structured metadata
 * @param {string} message - Info message
 * @param {Object} meta - Additional metadata
 */
const logInfo = (message, meta = {}) => {
  logger.info(message, meta);
};

/**
 * Log a warning message
 * @param {string} message - Warning message
 * @param {Object} meta - Additional metadata
 */
const logWarn = (message, meta = {}) => {
  logger.warn(message, meta);
};

/**
 * Log a debug message
 * @param {string} message - Debug message
 * @param {Object} meta - Additional metadata
 */
const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

/**
 * Log HTTP request details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} responseTime - Response time in ms
 */
const logHttp = (req, res, responseTime) => {
  logger.http(`${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    userId: req.user?.id,
    referer: req.get('referer'),
  });
};

/**
 * Log audit trail for sensitive operations
 * @param {string} action - Action performed
 * @param {string} userId - User ID
 * @param {Object} details - Action details
 * @param {Object} req - Express request object
 */
const logAudit = (action, userId, details = {}, req = null) => {
  logger.info(`AUDIT: ${action}`, {
    action,
    userId,
    details,
    ip: req?.ip || req?.connection?.remoteAddress,
    userAgent: req?.get('user-agent'),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Log performance metrics
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in ms
 * @param {Object} meta - Additional metadata
 */
const logPerformance = (operation, duration, meta = {}) => {
  logger.verbose(`PERFORMANCE: ${operation}`, {
    operation,
    duration: `${duration}ms`,
    ...meta,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Create a child logger with default metadata
 * @param {Object} defaultMeta - Default metadata
 * @returns {Object} - Child logger instance
 */
const child = (defaultMeta) => {
  return logger.child(defaultMeta);
};

/**
 * Get the log directory path
 * @returns {string} - Log directory path
 */
const getLogDir = () => logDir;

/**
 * Get the current log level
 * @returns {string} - Current log level
 */
const getLogLevel = () => logLevel;

// Export logger and utilities
module.exports = {
  logger,
  stream,
  logError,
  logInfo,
  logWarn,
  logDebug,
  logHttp,
  logAudit,
  logPerformance,
  child,
  getLogDir,
  getLogLevel,
  // Direct winston methods
  error: logger.error.bind(logger),
  warn: logger.warn.bind(logger),
  info: logger.info.bind(logger),
  http: logger.http.bind(logger),
  verbose: logger.verbose.bind(logger),
  debug: logger.debug.bind(logger),
  silly: logger.silly.bind(logger),
};

// Default export
module.exports.default = logger;
