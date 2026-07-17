/**
 * Error Handler Middleware - Global Error Handling
 * CephasGM GameZone
 * 
 * This middleware provides comprehensive error handling for the application.
 * It catches all errors, logs them appropriately, and returns consistent
 * error responses to clients. It handles different error types including
 * validation, authentication, database, and custom application errors.
 */

const logger = require('../utils/logger');
const { sequelize } = require('../config/database');

/**
 * Base application error class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'ERR_001', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error types and their default HTTP status codes
 */
const ErrorTypes = {
  VALIDATION: { status: 400, code: 'ERR_VAL_001' },
  AUTHENTICATION: { status: 401, code: 'ERR_AUTH_001' },
  AUTHORIZATION: { status: 403, code: 'ERR_AUTH_002' },
  NOT_FOUND: { status: 404, code: 'ERR_NOTFOUND_001' },
  CONFLICT: { status: 409, code: 'ERR_CONFLICT_001' },
  RATE_LIMIT: { status: 429, code: 'ERR_RATE_001' },
  DATABASE: { status: 500, code: 'ERR_DB_001' },
  EXTERNAL: { status: 502, code: 'ERR_EXT_001' },
  TIMEOUT: { status: 504, code: 'ERR_TIMEOUT_001' },
  INTERNAL: { status: 500, code: 'ERR_INT_001' },
};

/**
 * Create a validation error
 * @param {string} message - Error message
 * @param {Array} details - Validation error details
 * @returns {AppError} - AppError instance
 */
const createValidationError = (message, details = null) => {
  return new AppError(
    message || 'Validation failed',
    ErrorTypes.VALIDATION.status,
    ErrorTypes.VALIDATION.code,
    details
  );
};

/**
 * Create an authentication error
 * @param {string} message - Error message
 * @returns {AppError} - AppError instance
 */
const createAuthError = (message = 'Authentication required') => {
  return new AppError(
    message,
    ErrorTypes.AUTHENTICATION.status,
    ErrorTypes.AUTHENTICATION.code
  );
};

/**
 * Create an authorization error
 * @param {string} message - Error message
 * @returns {AppError} - AppError instance
 */
const createForbiddenError = (message = 'Access denied') => {
  return new AppError(
    message,
    ErrorTypes.AUTHORIZATION.status,
    ErrorTypes.AUTHORIZATION.code
  );
};

/**
 * Create a not found error
 * @param {string} resource - Resource type
 * @param {string} identifier - Resource identifier
 * @returns {AppError} - AppError instance
 */
const createNotFoundError = (resource = 'Resource', identifier = '') => {
  const message = identifier ? `${resource} with ID ${identifier} not found` : `${resource} not found`;
  return new AppError(
    message,
    ErrorTypes.NOT_FOUND.status,
    ErrorTypes.NOT_FOUND.code,
    { resource, identifier }
  );
};

/**
 * Create a conflict error
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @returns {AppError} - AppError instance
 */
const createConflictError = (message = 'Resource already exists', details = null) => {
  return new AppError(
    message,
    ErrorTypes.CONFLICT.status,
    ErrorTypes.CONFLICT.code,
    details
  );
};

/**
 * Create a rate limit error
 * @param {string} message - Error message
 * @param {Object} details - Rate limit details
 * @returns {AppError} - AppError instance
 */
const createRateLimitError = (message = 'Too many requests', details = null) => {
  return new AppError(
    message,
    ErrorTypes.RATE_LIMIT.status,
    ErrorTypes.RATE_LIMIT.code,
    details
  );
};

/**
 * Create a database error
 * @param {string} message - Error message
 * @param {Object} details - Database error details
 * @returns {AppError} - AppError instance
 */
const createDatabaseError = (message = 'Database error occurred', details = null) => {
  return new AppError(
    message,
    ErrorTypes.DATABASE.status,
    ErrorTypes.DATABASE.code,
    details
  );
};

/**
 * Create an internal server error
 * @param {string} message - Error message
 * @param {Object} details - Additional details
 * @returns {AppError} - AppError instance
 */
const createInternalError = (message = 'Internal server error', details = null) => {
  return new AppError(
    message,
    ErrorTypes.INTERNAL.status,
    ErrorTypes.INTERNAL.code,
    details
  );
};

/**
 * Format error response for development environment
 * @param {Error} error - Error object
 * @param {Object} req - Express request object
 * @returns {Object} - Formatted error response
 */
const formatDevError = (error, req) => {
  const response = {
    success: false,
    message: error.message || 'An error occurred',
    code: error.code || 'ERR_UNKNOWN',
    statusCode: error.statusCode || 500,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  if (error.details) {
    response.details = error.details;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
    if (error.name) {
      response.name = error.name;
    }
  }

  return response;
};

/**
 * Format error response for production environment
 * @param {Error} error - Error object
 * @returns {Object} - Formatted error response
 */
const formatProdError = (error) => {
  const response = {
    success: false,
    message: error.message || 'An error occurred',
    code: error.code || 'ERR_UNKNOWN',
  };

  if (error.details && error.isOperational) {
    response.details = error.details;
  }

  return response;
};

/**
 * Determine if error is operational (safe to expose to client)
 * @param {Error} error - Error object
 * @returns {boolean} - Whether error is operational
 */
const isOperationalError = (error) => {
  return error.isOperational === true || 
         error instanceof AppError ||
         error.statusCode < 500;
};

/**
 * Main error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  // Ensure err is an Error object
  let error = err;
  if (typeof err === 'string') {
    error = new Error(err);
  }

  // Set default values
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  const code = error.code || 'ERR_UNKNOWN';

  // Log the error
  const logLevel = statusCode >= 500 ? 'error' : 'warn';
  const logMeta = {
    code,
    statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip || req.connection?.remoteAddress,
    userId: req.user?.id || 'unauthenticated',
    userAgent: req.get('user-agent'),
  };

  // Log full error details
  if (statusCode >= 500) {
    logger.error(`[${code}] ${message}`, {
      ...logMeta,
      stack: error.stack,
      details: error.details,
    });
  } else {
    logger.warn(`[${code}] ${message}`, logMeta);
  }

  // Determine response format based on environment
  const isDev = process.env.NODE_ENV === 'development';
  const isProd = process.env.NODE_ENV === 'production';

  let response;
  if (isDev) {
    response = formatDevError(error, req);
  } else {
    response = formatProdError(error);
  }

  // Add operational flag
  response.isOperational = isOperationalError(error);

  // Send response
  res.status(statusCode).json(response);
};

/**
 * Async handler wrapper to catch errors in async route handlers
 * @param {Function} fn - Async function to wrap
 * @returns {Function} - Express middleware
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Handle Sequelize validation errors
 * @param {Error} error - Sequelize error
 * @returns {AppError} - AppError instance
 */
const handleSequelizeValidationError = (error) => {
  const errors = error.errors.map((err) => ({
    field: err.path,
    message: err.message,
    type: err.type,
    value: err.value,
  }));

  return createValidationError('Database validation failed', errors);
};

/**
 * Handle Sequelize unique constraint errors
 * @param {Error} error - Sequelize error
 * @returns {AppError} - AppError instance
 */
const handleSequelizeUniqueError = (error) => {
  const field = error.fields ? Object.keys(error.fields)[0] : 'unknown';
  const value = error.fields ? error.fields[field] : 'unknown';
  return createConflictError(`${field} "${value}" already exists`, {
    field,
    value,
  });
};

/**
 * Handle Sequelize foreign key errors
 * @param {Error} error - Sequelize error
 * @returns {AppError} - AppError instance
 */
const handleSequelizeForeignKeyError = (error) => {
  return createValidationError('Referenced resource does not exist', {
    constraint: error.constraint,
    table: error.table,
  });
};

/**
 * Handle Sequelize connection errors
 * @param {Error} error - Sequelize error
 * @returns {AppError} - AppError instance
 */
const handleSequelizeConnectionError = (error) => {
  return createDatabaseError('Database connection error', {
    message: error.message,
  });
};

/**
 * Map Sequelize errors to AppError
 * @param {Error} error - Sequelize error
 * @returns {AppError} - AppError instance
 */
const mapSequelizeError = (error) => {
  if (error.name === 'SequelizeValidationError') {
    return handleSequelizeValidationError(error);
  }
  if (error.name === 'SequelizeUniqueConstraintError') {
    return handleSequelizeUniqueError(error);
  }
  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return handleSequelizeForeignKeyError(error);
  }
  if (error.name === 'SequelizeConnectionError' || 
      error.name === 'SequelizeConnectionRefusedError' ||
      error.name === 'SequelizeConnectionTimedOutError') {
    return handleSequelizeConnectionError(error);
  }
  if (error.name === 'SequelizeDatabaseError') {
    return createDatabaseError('Database error occurred', {
      message: error.message,
      sql: error.sql,
    });
  }
  return createDatabaseError(error.message);
};

/**
 * Handle Joi validation errors
 * @param {Error} error - Joi validation error
 * @returns {AppError} - AppError instance
 */
const handleJoiError = (error) => {
  const errors = error.details.map((detail) => ({
    field: detail.path.join('.'),
    message: detail.message,
    type: detail.type,
  }));
  return createValidationError('Validation failed', errors);
};

/**
 * Handle JWT errors
 * @param {Error} error - JWT error
 * @returns {AppError} - AppError instance
 */
const handleJwtError = (error) => {
  if (error.name === 'TokenExpiredError') {
    return createAuthError('Token has expired. Please refresh your token.');
  }
  if (error.name === 'JsonWebTokenError') {
    return createAuthError('Invalid token. Please login again.');
  }
  return createAuthError('Authentication failed');
};

/**
 * Handle multer file upload errors
 * @param {Error} error - Multer error
 * @returns {AppError} - AppError instance
 */
const handleMulterError = (error) => {
  if (error.code === 'FILE_TOO_LARGE') {
    return createValidationError('File too large. Max size is 5MB', {
      maxSize: '5MB',
    });
  }
  if (error.code === 'LIMIT_FILE_COUNT') {
    return createValidationError('Too many files uploaded');
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return createValidationError('Unexpected file field');
  }
  return createValidationError(error.message);
};

/**
 * Global error handler for unhandled rejections
 */
const handleUnhandledRejection = (error) => {
  logger.error('Unhandled Rejection:', error);
  // In production, we might want to exit gracefully
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
};

/**
 * Global error handler for uncaught exceptions
 */
const handleUncaughtException = (error) => {
  logger.error('Uncaught Exception:', error);
  // In production, we want to exit and let the process manager restart
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
};

// Export error handler and utilities
module.exports = {
  // Main middleware
  errorHandler,
  catchAsync,

  // Error creators
  AppError,
  createValidationError,
  createAuthError,
  createForbiddenError,
  createNotFoundError,
  createConflictError,
  createRateLimitError,
  createDatabaseError,
  createInternalError,

  // Error type constants
  ErrorTypes,

  // Error mappers
  mapSequelizeError,
  handleJoiError,
  handleJwtError,
  handleMulterError,
  handleSequelizeValidationError,
  handleSequelizeUniqueError,
  handleSequelizeForeignKeyError,
  handleSequelizeConnectionError,

  // Utility functions
  isOperationalError,

  // Global handlers
  handleUnhandledRejection,
  handleUncaughtException,

  // Error formatting
  formatDevError,
  formatProdError,
};
