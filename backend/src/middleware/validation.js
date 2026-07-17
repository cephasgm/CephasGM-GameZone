/**
 * Validation Middleware - Request Data Validation & Sanitization
 * CephasGM GameZone
 * 
 * This middleware validates incoming request data against predefined
 * Joi schemas. It supports validation for req.body, req.params, req.query,
 * and req.headers. It provides consistent error responses and integrates
 * with the existing validators utility.
 */

const Joi = require('joi');
const { validate, schemas } = require('../utils/validators');
const logger = require('../utils/logger');

/**
 * Validation result interface
 */
const createValidationError = (errors) => ({
  success: false,
  message: 'Validation failed',
  code: 'VAL_001',
  errors: errors.map(err => ({
    field: err.field || err.path,
    message: err.message,
    type: err.type,
  })),
});

/**
 * Validate request data against a schema
 * @param {Object} schema - Joi schema
 * @param {string} source - Request property to validate ('body', 'params', 'query', 'headers')
 * @param {Object} options - Additional validation options
 * @returns {Function} - Express middleware
 */
const validateRequest = (schema, source = 'body', options = {}) => {
  return (req, res, next) => {
    try {
      const data = req[source];
      const result = validate(data, schema, options);

      if (!result.valid) {
        logger.warn(`Validation failed for ${source}: ${JSON.stringify(result.errors)}`);
        return res.status(400).json(createValidationError(result.errors));
      }

      // Replace request data with validated and sanitized data
      req[source] = result.value;
      next();
    } catch (error) {
      logger.error('Validation middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Validation failed due to server error.',
        code: 'VAL_002',
      });
    }
  };
};

/**
 * Validate multiple sources in one middleware
 * @param {Object} schemas - Object with source keys and Joi schemas
 * @returns {Function} - Express middleware
 */
const validateRequestMulti = (schemas) => {
  return (req, res, next) => {
    try {
      const errors = [];
      const validated = {};

      for (const [source, schema] of Object.entries(schemas)) {
        if (!req[source]) continue;
        const result = validate(req[source], schema);
        if (!result.valid) {
          errors.push(...result.errors.map(err => ({
            ...err,
            source,
          })));
        } else {
          req[source] = result.value;
          validated[source] = result.value;
        }
      }

      if (errors.length > 0) {
        logger.warn(`Multi-source validation failed: ${JSON.stringify(errors)}`);
        return res.status(400).json(createValidationError(errors));
      }

      next();
    } catch (error) {
      logger.error('Multi-source validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Validation failed due to server error.',
        code: 'VAL_003',
      });
    }
  };
};

/**
 * Validate request body using a specific schema
 */
const validateBody = (schema, options = {}) => {
  return validateRequest(schema, 'body', options);
};

/**
 * Validate request query parameters
 */
const validateQuery = (schema, options = {}) => {
  return validateRequest(schema, 'query', options);
};

/**
 * Validate request URL parameters
 */
const validateParams = (schema, options = {}) => {
  return validateRequest(schema, 'params', options);
};

/**
 * Validate request headers
 */
const validateHeaders = (schema, options = {}) => {
  return validateRequest(schema, 'headers', options);
};

/**
 * Predefined validation schemas for common use cases
 */
const validationSchemas = {
  // Pagination query parameters
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().allow(''),
    order: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  // Date range query parameters
  dateRange: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  }),

  // ID parameter (UUID)
  idParam: Joi.object({
    id: Joi.string().uuid().required(),
  }),

  // User ID parameter
  userIdParam: Joi.object({
    userId: Joi.string().uuid().required(),
  }),

  // Search query
  searchQuery: Joi.object({
    q: Joi.string().min(1).max(100).required(),
  }),

  // Bet ID param
  betIdParam: Joi.object({
    betId: Joi.string().uuid().required(),
  }),

  // Match ID param
  matchIdParam: Joi.object({
    matchId: Joi.string().uuid().required(),
  }),

  // Payment ID param
  paymentIdParam: Joi.object({
    paymentId: Joi.string().uuid().required(),
  }),
};

/**
 * Convenience middleware for validating pagination
 */
const validatePagination = (req, res, next) => {
  const result = validate(req.query, validationSchemas.pagination);
  if (!result.valid) {
    return res.status(400).json(createValidationError(result.errors));
  }
  req.query = result.value;
  next();
};

/**
 * Convenience middleware for validating ID param
 */
const validateIdParam = (req, res, next) => {
  const result = validate(req.params, validationSchemas.idParam);
  if (!result.valid) {
    return res.status(400).json(createValidationError(result.errors));
  }
  req.params = result.value;
  next();
};

/**
 * Convenience middleware for validating date range
 */
const validateDateRange = (req, res, next) => {
  const result = validate(req.query, validationSchemas.dateRange);
  if (!result.valid) {
    return res.status(400).json(createValidationError(result.errors));
  }
  req.query = result.value;
  next();
};

/**
 * Validate that a specific field exists and is not empty
 * @param {string} field - Field name
 * @param {string} source - Request source ('body', 'params', 'query')
 * @param {Object} options - Additional options
 * @returns {Function} - Express middleware
 */
const validateRequired = (field, source = 'body', options = {}) => {
  return (req, res, next) => {
    const value = req[source]?.[field];
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      return res.status(400).json({
        success: false,
        message: `Missing required field: ${field}`,
        code: 'VAL_004',
        field,
      });
    }
    next();
  };
};

/**
 * Validate array of fields are present
 * @param {string[]} fields - Array of field names
 * @param {string} source - Request source
 * @returns {Function} - Express middleware
 */
const validateRequiredFields = (fields, source = 'body') => {
  return (req, res, next) => {
    const missing = [];
    for (const field of fields) {
      const value = req[source]?.[field];
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}`,
        code: 'VAL_005',
        fields: missing,
      });
    }
    next();
  };
};

/**
 * Validate against one of multiple schemas (try each until one passes)
 * @param {Object[]} schemaList - Array of Joi schemas
 * @param {string} source - Request source
 * @param {Object} options - Additional options
 * @returns {Function} - Express middleware
 */
const validateAny = (schemaList, source = 'body', options = {}) => {
  return (req, res, next) => {
    try {
      const data = req[source];
      let lastError = null;

      for (const schema of schemaList) {
        const result = validate(data, schema, options);
        if (result.valid) {
          req[source] = result.value;
          return next();
        }
        lastError = result.errors;
      }

      // None of the schemas matched
      return res.status(400).json({
        success: false,
        message: 'Request validation failed against all allowed schemas',
        code: 'VAL_006',
        errors: lastError,
      });
    } catch (error) {
      logger.error('ValidateAny middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Validation failed due to server error.',
        code: 'VAL_007',
      });
    }
  };
};

/**
 * Conditional validation based on a condition function
 * @param {Function} condition - Function that receives req and returns boolean
 * @param {Object} schema - Joi schema to apply if condition is true
 * @param {string} source - Request source
 * @param {Object} options - Additional options
 * @returns {Function} - Express middleware
 */
const validateIf = (condition, schema, source = 'body', options = {}) => {
  return (req, res, next) => {
    try {
      if (condition(req)) {
        const data = req[source];
        const result = validate(data, schema, options);
        if (!result.valid) {
          return res.status(400).json(createValidationError(result.errors));
        }
        req[source] = result.value;
      }
      next();
    } catch (error) {
      logger.error('ValidateIf middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Validation failed due to server error.',
        code: 'VAL_008',
      });
    }
  };
};

/**
 * Export all validation middleware
 */
module.exports = {
  // Main validation functions
  validateRequest,
  validateRequestMulti,
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,

  // Convenience validators
  validatePagination,
  validateIdParam,
  validateDateRange,
  validateRequired,
  validateRequiredFields,
  validateAny,
  validateIf,

  // Predefined schemas
  validationSchemas,

  // Error formatter
  createValidationError,
};
