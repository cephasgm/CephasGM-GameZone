/**
 * Sanitize Middleware - Input Sanitization & XSS Prevention
 * CephasGM GameZone
 * 
 * This middleware provides comprehensive input sanitization to prevent
 * XSS attacks, SQL injection, and other injection attacks. It sanitizes
 * request bodies, query parameters, and URL parameters using various
 * sanitization techniques including HTML escaping, stripping tags, and
 * validation against expected data types.
 */

const sanitizeHtml = require('sanitize-html');
const validator = require('validator');
const logger = require('../utils/logger');

/**
 * HTML sanitization options
 */
const HTML_SANITIZE_OPTIONS = {
  allowedTags: [
    'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
    'blockquote', 'code', 'pre', 'span', 'div', 'h1', 'h2', 'h3',
    'h4', 'h5', 'h6', 'img', 'table', 'thead', 'tbody', 'tr', 'td',
    'th', 'hr', 'sub', 'sup', 'u', 'strike', 'del', 'ins',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    '*': ['class', 'id', 'style'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  allowedProtocolRelative: false,
  allowedIframeHostnames: [],
  selfClosing: ['img', 'br', 'hr'],
  allowedClasses: {
    '*': ['text-*', 'font-*', 'bg-*', 'border-*', 'flex-*', 'grid-*'],
  },
};

/**
 * Configuration for different sanitization strategies
 */
const SANITIZE_CONFIG = {
  // Strict sanitization (default) - removes all HTML tags
  strict: {
    allowedTags: [],
    allowedAttributes: {},
    allowedSchemes: [],
    textFilter: true,
  },
  
  // Basic sanitization - allows basic formatting
  basic: {
    allowedTags: ['b', 'i', 'em', 'strong', 'u', 'p', 'br'],
    allowedAttributes: {},
    allowedSchemes: ['http', 'https'],
  },
  
  // Rich sanitization - allows rich text formatting
  rich: HTML_SANITIZE_OPTIONS,
  
  // No sanitization - only for trusted internal data
  none: {
    allowedTags: true,
    allowedAttributes: true,
    allowedSchemes: true,
  },
};

/**
 * Sanitize a string by escaping HTML entities
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
const escapeHtml = (str) => {
  if (!str || typeof str !== 'string') return str;
  return validator.escape(str);
};

/**
 * Sanitize a string by removing HTML tags
 * @param {string} str - String to sanitize
 * @returns {string} - Sanitized string
 */
const stripHtml = (str) => {
  if (!str || typeof str !== 'string') return str;
  return validator.stripTags(str);
};

/**
 * Sanitize a string with HTML sanitization
 * @param {string} str - String to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} - Sanitized string
 */
const sanitizeHtmlString = (str, options = {}) => {
  if (!str || typeof str !== 'string') return str;
  const config = { ...HTML_SANITIZE_OPTIONS, ...options };
  return sanitizeHtml(str, config);
};

/**
 * Normalize a string (trim, remove extra spaces)
 * @param {string} str - String to normalize
 * @returns {string} - Normalized string
 */
const normalizeString = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str.trim().replace(/\s+/g, ' ');
};

/**
 * Sanitize an email address
 * @param {string} email - Email to sanitize
 * @returns {string} - Sanitized email
 */
const sanitizeEmail = (email) => {
  if (!email || typeof email !== 'string') return email;
  return email.toLowerCase().trim();
};

/**
 * Sanitize a phone number
 * @param {string} phone - Phone number to sanitize
 * @returns {string} - Sanitized phone number
 */
const sanitizePhone = (phone) => {
  if (!phone || typeof phone !== 'string') return phone;
  // Remove non-digit characters except plus
  return phone.replace(/[^\d+]/g, '');
};

/**
 * Sanitize a URL
 * @param {string} url - URL to sanitize
 * @returns {string} - Sanitized URL
 */
const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  return validator.trim(url);
};

/**
 * Sanitize a username
 * @param {string} username - Username to sanitize
 * @returns {string} - Sanitized username
 */
const sanitizeUsername = (username) => {
  if (!username || typeof username !== 'string') return username;
  return username.toLowerCase().replace(/[^a-z0-9_]/g, '');
};

/**
 * Sanitize a name (remove special characters)
 * @param {string} name - Name to sanitize
 * @returns {string} - Sanitized name
 */
const sanitizeName = (name) => {
  if (!name || typeof name !== 'string') return name;
  return name.replace(/[^a-zA-Z\s\-']/g, '').trim();
};

/**
 * Sanitize a credit card number
 * @param {string} cardNumber - Credit card number
 * @returns {string} - Sanitized card number
 */
const sanitizeCardNumber = (cardNumber) => {
  if (!cardNumber || typeof cardNumber !== 'string') return cardNumber;
  return cardNumber.replace(/\s/g, '');
};

/**
 * Sanitize a boolean value
 * @param {*} value - Value to sanitize
 * @returns {boolean} - Sanitized boolean
 */
const sanitizeBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const truthy = ['true', '1', 'yes', 'y', 'on'];
    return truthy.includes(value.toLowerCase());
  }
  return Boolean(value);
};

/**
 * Sanitize a number
 * @param {*} value - Value to sanitize
 * @param {Object} options - Sanitization options
 * @returns {number} - Sanitized number
 */
const sanitizeNumber = (value, options = {}) => {
  const { min = null, max = null, default: defaultValue = null } = options;
  let num = parseFloat(value);
  
  if (isNaN(num)) {
    return defaultValue !== null ? defaultValue : 0;
  }
  
  if (min !== null && num < min) num = min;
  if (max !== null && num > max) num = max;
  
  return num;
};

/**
 * Sanitize an object recursively
 * @param {Object} obj - Object to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Object} - Sanitized object
 */
const sanitizeObject = (obj, options = {}) => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const result = {};
  const {
    strategy = 'strict',
    fields = null, // If provided, only sanitize these fields
    exclude = [], // Fields to exclude from sanitization
  } = options;

  for (const [key, value] of Object.entries(obj)) {
    // Skip excluded fields
    if (exclude.includes(key)) {
      result[key] = value;
      continue;
    }

    // If fields specified, only sanitize those fields
    if (fields && !fields.includes(key)) {
      result[key] = value;
      continue;
    }

    // Determine sanitization based on key name hints
    const keyLower = key.toLowerCase();
    let sanitizedValue = value;

    if (typeof value === 'string') {
      // Email fields
      if (keyLower.includes('email')) {
        sanitizedValue = sanitizeEmail(value);
      }
      // Phone fields
      else if (keyLower.includes('phone') || keyLower.includes('mobile')) {
        sanitizedValue = sanitizePhone(value);
      }
      // URL fields
      else if (keyLower.includes('url') || keyLower.includes('link')) {
        sanitizedValue = sanitizeUrl(value);
      }
      // Username fields
      else if (keyLower.includes('username')) {
        sanitizedValue = sanitizeUsername(value);
      }
      // Name fields
      else if (keyLower.includes('name') || keyLower.includes('first') || keyLower.includes('last')) {
        sanitizedValue = sanitizeName(value);
      }
      // Card fields
      else if (keyLower.includes('card') || keyLower.includes('credit')) {
        sanitizedValue = sanitizeCardNumber(value);
      }
      // HTML fields (rich text)
      else if (keyLower.includes('html') || keyLower.includes('content') || keyLower.includes('description')) {
        sanitizedValue = sanitizeHtmlString(value, HTML_SANITIZE_OPTIONS);
      }
      // Message fields
      else if (keyLower.includes('message') || keyLower.includes('note') || keyLower.includes('comment')) {
        if (strategy === 'rich') {
          sanitizedValue = sanitizeHtmlString(value, HTML_SANITIZE_OPTIONS);
        } else if (strategy === 'basic') {
          sanitizedValue = sanitizeHtmlString(value, { allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br'] });
        } else {
          sanitizedValue = stripHtml(value);
        }
      }
      // General string fields
      else {
        if (strategy === 'strict') {
          sanitizedValue = stripHtml(normalizeString(value));
        } else if (strategy === 'basic') {
          sanitizedValue = sanitizeHtmlString(value, { allowedTags: ['b', 'i', 'em', 'strong'] });
        } else if (strategy === 'rich') {
          sanitizedValue = sanitizeHtmlString(value, HTML_SANITIZE_OPTIONS);
        } else {
          sanitizedValue = normalizeString(value);
        }
      }
    } else if (typeof value === 'number') {
      // Validate number fields
      if (keyLower.includes('amount') || keyLower.includes('price') || keyLower.includes('balance')) {
        sanitizedValue = Math.max(0, value);
      }
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitizedValue = sanitizeObject(value, options);
    } else if (typeof value === 'boolean') {
      sanitizedValue = sanitizeBoolean(value);
    }

    result[key] = sanitizedValue;
  }

  return result;
};

/**
 * Sanitize an array
 * @param {Array} arr - Array to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Array} - Sanitized array
 */
const sanitizeArray = (arr, options = {}) => {
  if (!Array.isArray(arr)) return arr;
  
  return arr.map(item => {
    if (typeof item === 'string') {
      return stripHtml(normalizeString(item));
    }
    if (typeof item === 'object' && item !== null) {
      return sanitizeObject(item, options);
    }
    return item;
  });
};

/**
 * Main sanitize middleware
 * @param {Object} options - Sanitization options
 * @returns {Function} - Express middleware
 */
const sanitize = (options = {}) => {
  const {
    sources = ['body', 'query', 'params'],
    strategy = 'strict',
    exclude = [],
    fields = null,
  } = options;

  return (req, res, next) => {
    try {
      for (const source of sources) {
        if (req[source]) {
          if (Array.isArray(req[source])) {
            req[source] = sanitizeArray(req[source], { strategy, exclude, fields });
          } else if (typeof req[source] === 'object') {
            req[source] = sanitizeObject(req[source], { strategy, exclude, fields });
          }
        }
      }
      next();
    } catch (error) {
      logger.error('Sanitization middleware error:', error);
      next();
    }
  };
};

/**
 * Middleware to sanitize request body only
 */
const sanitizeBody = (options = {}) => {
  return sanitize({ ...options, sources: ['body'] });
};

/**
 * Middleware to sanitize query parameters only
 */
const sanitizeQuery = (options = {}) => {
  return sanitize({ ...options, sources: ['query'] });
};

/**
 * Middleware to sanitize URL parameters only
 */
const sanitizeParams = (options = {}) => {
  return sanitize({ ...options, sources: ['params'] });
};

/**
 * Middleware to sanitize JSON in request body
 */
const sanitizeJSON = (options = {}) => {
  return (req, res, next) => {
    try {
      if (req.body && req.headers['content-type']?.includes('application/json')) {
        req.body = sanitizeObject(req.body, { strategy: 'strict', ...options });
      }
      next();
    } catch (error) {
      logger.error('JSON sanitization error:', error);
      next();
    }
  };
};

/**
 * Middleware to prevent SQL injection (basic protection)
 * Note: This is a basic protection layer. Full protection is handled by ORM/parameterized queries.
 */
const preventSQLInjection = (options = {}) => {
  const {
    sources = ['body', 'query', 'params'],
    patterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b)/i,
      /(--)/,
      /(\bOR\b.*=)/i,
      /(\bAND\b.*=)/i,
    ],
  } = options;

  return (req, res, next) => {
    try {
      for (const source of sources) {
        if (req[source]) {
          const checkValue = (value) => {
            if (typeof value === 'string') {
              for (const pattern of patterns) {
                if (pattern.test(value)) {
                  logger.warn(`Potential SQL injection detected in ${source}: ${value.substring(0, 100)}`);
                  // If in strict mode, block the request
                  if (options.strict) {
                    return res.status(400).json({
                      success: false,
                      message: 'Invalid input detected.',
                      code: 'SEC_001',
                    });
                  }
                  // Otherwise, sanitize by removing dangerous patterns
                  return value.replace(pattern, '');
                }
              }
              return value;
            }
            if (typeof value === 'object' && value !== null) {
              for (const key of Object.keys(value)) {
                value[key] = checkValue(value[key]);
              }
            }
            return value;
          };

          if (typeof req[source] === 'object') {
            for (const key of Object.keys(req[source])) {
              req[source][key] = checkValue(req[source][key]);
            }
          }
        }
      }
      next();
    } catch (error) {
      logger.error('SQL injection prevention error:', error);
      next();
    }
  };
};

// Export sanitization functions
module.exports = {
  // Main middleware
  sanitize,
  sanitizeBody,
  sanitizeQuery,
  sanitizeParams,
  sanitizeJSON,
  
  // SQL injection prevention
  preventSQLInjection,
  
  // Individual sanitizers
  escapeHtml,
  stripHtml,
  sanitizeHtmlString,
  normalizeString,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUrl,
  sanitizeUsername,
  sanitizeName,
  sanitizeCardNumber,
  sanitizeBoolean,
  sanitizeNumber,
  sanitizeObject,
  sanitizeArray,
  
  // Configuration
  HTML_SANITIZE_OPTIONS,
  SANITIZE_CONFIG,
};
