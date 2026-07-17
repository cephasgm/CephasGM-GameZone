/**
 * Validators Utility - Input Validation & Sanitization
 * CephasGM GameZone
 * 
 * This module provides comprehensive validation and sanitization utilities
 * for all application inputs including:
 * - User registration and profile data
 * - Authentication credentials
 * - Betting data
 * - Payment information
 * - Admin actions
 * - Custom validation rules
 */

const Joi = require('joi');
const validator = require('validator');
const logger = require('./logger');

// ============================================
// CUSTOM VALIDATION RULES
// ============================================

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
const isValidEmail = (email) => {
  return validator.isEmail(email, {
    allow_display_name: false,
    require_tld: true,
    allow_utf8_local_part: true,
  });
};

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @param {string} country - Country code (optional)
 * @returns {boolean} - Whether phone number is valid
 */
const isValidPhone = (phone, country = null) => {
  if (!phone) return false;
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (country) {
    return validator.isMobilePhone(cleaned, country);
  }
  return validator.isMobilePhone(cleaned) || cleaned.length >= 10;
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @param {Object} options - Validation options
 * @returns {Object} - { valid, errors }
 */
const validatePasswordStrength = (password, options = {}) => {
  const defaultOptions = {
    minLength: 8,
    maxLength: 72,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    disallowCommon: true,
  };

  const opts = { ...defaultOptions, ...options };
  const errors = [];

  if (password.length < opts.minLength) {
    errors.push(`Password must be at least ${opts.minLength} characters`);
  }
  if (password.length > opts.maxLength) {
    errors.push(`Password must be less than ${opts.maxLength} characters`);
  }
  if (opts.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (opts.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (opts.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (opts.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  if (opts.disallowCommon) {
    const commonPasswords = [
      'password', '123456', 'password123', 'admin', 'admin123',
      'qwerty', 'abc123', 'letmein', 'welcome', 'monkey',
      'dragon', 'master', 'hello', 'freedom', 'whatever',
      'qazwsx', 'trustno1', '123456789', '12345678', '12345',
    ];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a more secure password');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    score: calculatePasswordScore(password),
  };
};

/**
 * Calculate password strength score
 * @param {string} password - Password to score
 * @returns {number} - Score from 0-4
 */
const calculatePasswordScore = (password) => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
};

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @param {Object} options - Validation options
 * @returns {boolean} - Whether URL is valid
 */
const isValidUrl = (url, options = {}) => {
  const defaultOptions = {
    require_protocol: true,
    protocols: ['http', 'https'],
  };
  const opts = { ...defaultOptions, ...options };
  return validator.isURL(url, opts);
};

/**
 * Validate date
 * @param {string} date - Date string to validate
 * @param {string} format - Date format (optional)
 * @returns {boolean} - Whether date is valid
 */
const isValidDate = (date, format = null) => {
  if (format) {
    return validator.isDate(date, { format });
  }
  return !isNaN(Date.parse(date));
};

/**
 * Validate ISO 8601 date
 * @param {string} date - ISO date string
 * @returns {boolean} - Whether date is valid ISO 8601
 */
const isValidISODate = (date) => {
  return validator.isISO8601(date);
};

/**
 * Validate UUID
 * @param {string} uuid - UUID to validate
 * @param {string} version - UUID version (optional)
 * @returns {boolean} - Whether UUID is valid
 */
const isValidUUID = (uuid, version = null) => {
  if (version) {
    return validator.isUUID(uuid, version);
  }
  return validator.isUUID(uuid);
};

/**
 * Validate credit card number
 * @param {string} cardNumber - Credit card number
 * @returns {Object} - { valid, type }
 */
const validateCreditCard = (cardNumber) => {
  const cleaned = cardNumber.replace(/[\s\-]/g, '');
  const valid = validator.isCreditCard(cleaned);
  let type = null;

  if (valid) {
    // Detect card type
    const patterns = {
      visa: /^4[0-9]{12}(?:[0-9]{3})?$/,
      mastercard: /^5[1-5][0-9]{14}$|^2[2-7][0-9]{14}$/,
      amex: /^3[47][0-9]{13}$/,
      discover: /^6(?:011|5[0-9]{2})[0-9]{12}$/,
      diners: /^3(?:0[0-5]|[68][0-9])[0-9]{11}$/,
      jcb: /^(?:2131|1800|35[0-9]{3})[0-9]{11}$/,
    };

    for (const [cardType, pattern] of Object.entries(patterns)) {
      if (pattern.test(cleaned)) {
        type = cardType;
        break;
      }
    }
  }

  return { valid, type };
};

/**
 * Validate IBAN
 * @param {string} iban - IBAN to validate
 * @returns {boolean} - Whether IBAN is valid
 */
const isValidIBAN = (iban) => {
  return validator.isIBAN(iban);
};

/**
 * Validate BIC/SWIFT
 * @param {string} bic - BIC to validate
 * @returns {boolean} - Whether BIC is valid
 */
const isValidBIC = (bic) => {
  return validator.isBIC(bic);
};

/**
 * Validate hexadecimal string
 * @param {string} hex - Hex string
 * @param {number} length - Expected length (optional)
 * @returns {boolean} - Whether hex is valid
 */
const isValidHex = (hex, length = null) => {
  if (length) {
    return validator.isHexColor(hex) || /^[0-9a-fA-F]+$/.test(hex) && hex.length === length;
  }
  return validator.isHexadecimal(hex);
};

/**
 * Validate JWT token format
 * @param {string} token - JWT token
 * @returns {boolean} - Whether token format is valid
 */
const isValidJWT = (token) => {
  return validator.isJWT(token);
};

// ============================================
// SCHEMA DEFINITIONS
// ============================================

/**
 * Base schemas using Joi
 */
const schemas = {
  // User Registration
  userRegistration: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: true } })
      .min(5)
      .max(100)
      .required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'string.empty': 'Email is required',
        'string.min': 'Email must be at least 5 characters',
        'string.max': 'Email must be less than 100 characters',
      }),
    password: Joi.string()
      .min(8)
      .max(72)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password must be less than 72 characters',
        'string.empty': 'Password is required',
      }),
    firstName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s\-']+$/)
      .required()
      .messages({
        'string.pattern.base': 'First name can only contain letters, spaces, hyphens, and apostrophes',
        'string.min': 'First name must be at least 2 characters',
        'string.max': 'First name must be less than 50 characters',
        'string.empty': 'First name is required',
      }),
    lastName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s\-']+$/)
      .required()
      .messages({
        'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes',
        'string.min': 'Last name must be at least 2 characters',
        'string.max': 'Last name must be less than 50 characters',
        'string.empty': 'Last name is required',
      }),
    phone: Joi.string()
      .pattern(/^[\+\d\s\-()]{7,20}$/)
      .allow('', null)
      .messages({
        'string.pattern.base': 'Please enter a valid phone number',
      }),
    dateOfBirth: Joi.date()
      .max(new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000))
      .required()
      .messages({
        'date.max': 'You must be at least 18 years old',
        'date.base': 'Please enter a valid date of birth',
      }),
    country: Joi.string()
      .length(2)
      .pattern(/^[A-Z]{2}$/)
      .required()
      .messages({
        'string.length': 'Please select a valid country',
        'string.pattern.base': 'Please select a valid country',
      }),
    currency: Joi.string()
      .valid('USD', 'EUR', 'GBP', 'KES', 'ZAR', 'NGN')
      .default('USD'),
    termsAccepted: Joi.boolean()
      .valid(true)
      .required()
      .messages({
        'any.only': 'You must accept the terms and conditions',
      }),
  }),

  // User Login
  userLogin: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: true } })
      .required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'string.empty': 'Email is required',
      }),
    password: Joi.string()
      .required()
      .messages({
        'string.empty': 'Password is required',
      }),
    rememberMe: Joi.boolean().default(false),
  }),

  // Password Reset
  passwordResetRequest: Joi.object({
    email: Joi.string()
      .email({ tlds: { allow: true } })
      .required()
      .messages({
        'string.email': 'Please enter a valid email address',
        'string.empty': 'Email is required',
      }),
  }),

  passwordResetConfirm: Joi.object({
    token: Joi.string()
      .required()
      .messages({
        'string.empty': 'Token is required',
      }),
    password: Joi.string()
      .min(8)
      .max(72)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required()
      .messages({
        'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password must be less than 72 characters',
        'string.empty': 'Password is required',
      }),
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.only': 'Passwords do not match',
        'string.empty': 'Please confirm your password',
      }),
  }),

  // Bet Placement
  placeBet: Joi.object({
    matchId: Joi.string()
      .required()
      .messages({
        'string.empty': 'Match ID is required',
      }),
    selection: Joi.string()
      .valid('home', 'away', 'draw', 'over', 'under')
      .required()
      .messages({
        'any.only': 'Invalid selection',
        'string.empty': 'Selection is required',
      }),
    odds: Joi.number()
      .min(1.01)
      .max(1000)
      .required()
      .messages({
        'number.min': 'Odds must be at least 1.01',
        'number.max': 'Odds must be less than 1000',
        'number.base': 'Please enter valid odds',
      }),
    stake: Joi.number()
      .min(0.10)
      .max(100000)
      .required()
      .messages({
        'number.min': 'Stake must be at least 0.10',
        'number.max': 'Stake must be less than 100000',
        'number.base': 'Please enter a valid stake amount',
      }),
    betType: Joi.string()
      .valid('single', 'accumulator', 'system')
      .default('single'),
  }),

  // Cash Out
  cashOut: Joi.object({
    betId: Joi.string()
      .required()
      .messages({
        'string.empty': 'Bet ID is required',
      }),
  }),

  // Deposit
  deposit: Joi.object({
    amount: Joi.number()
      .min(1)
      .max(100000)
      .required()
      .messages({
        'number.min': 'Minimum deposit is 1.00',
        'number.max': 'Maximum deposit is 100000',
        'number.base': 'Please enter a valid amount',
      }),
    method: Joi.string()
      .valid('card', 'bank', 'mobile', 'crypto', 'paypal')
      .required()
      .messages({
        'any.only': 'Invalid payment method',
        'string.empty': 'Payment method is required',
      }),
    currency: Joi.string()
      .valid('USD', 'EUR', 'GBP', 'KES', 'ZAR', 'NGN')
      .default('USD'),
  }),

  // Withdrawal
  withdrawal: Joi.object({
    amount: Joi.number()
      .min(10)
      .max(50000)
      .required()
      .messages({
        'number.min': 'Minimum withdrawal is 10.00',
        'number.max': 'Maximum withdrawal is 50000',
        'number.base': 'Please enter a valid amount',
      }),
    method: Joi.string()
      .valid('card', 'bank', 'mobile', 'crypto', 'paypal')
      .required()
      .messages({
        'any.only': 'Invalid payment method',
        'string.empty': 'Payment method is required',
      }),
    accountDetails: Joi.object({
      accountNumber: Joi.string().when('method', {
        is: 'bank',
        then: Joi.required(),
      }),
      bankCode: Joi.string().when('method', {
        is: 'bank',
        then: Joi.required(),
      }),
      phoneNumber: Joi.string().when('method', {
        is: 'mobile',
        then: Joi.required(),
      }),
      walletAddress: Joi.string().when('method', {
        is: 'crypto',
        then: Joi.required(),
      }),
      cardLast4: Joi.string().when('method', {
        is: 'card',
        then: Joi.required(),
      }),
    }).required(),
  }),

  // KYC Document Upload
  kycDocument: Joi.object({
    type: Joi.string()
      .valid('id', 'passport', 'drivers_license', 'national_id', 'proof_of_address')
      .required()
      .messages({
        'any.only': 'Invalid document type',
        'string.empty': 'Document type is required',
      }),
    documentNumber: Joi.string()
      .min(5)
      .max(50)
      .required()
      .messages({
        'string.min': 'Document number must be at least 5 characters',
        'string.max': 'Document number must be less than 50 characters',
        'string.empty': 'Document number is required',
      }),
    expiryDate: Joi.date()
      .greater('now')
      .required()
      .messages({
        'date.greater': 'Document has expired',
        'date.base': 'Please enter a valid expiry date',
      }),
  }),

  // Admin User Management
  adminUserUpdate: Joi.object({
    firstName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s\-']+$/),
    lastName: Joi.string()
      .min(2)
      .max(50)
      .pattern(/^[a-zA-Z\s\-']+$/),
    email: Joi.string()
      .email({ tlds: { allow: true } }),
    phone: Joi.string()
      .pattern(/^[\+\d\s\-()]{7,20}$/),
    status: Joi.string()
      .valid('active', 'suspended', 'inactive', 'verified'),
    role: Joi.string()
      .valid('user', 'agent', 'admin', 'super_admin'),
    vipTier: Joi.string()
      .valid('silver', 'gold', 'platinum', 'diamond', 'elite'),
    depositLimits: Joi.object({
      daily: Joi.number().min(0),
      weekly: Joi.number().min(0),
      monthly: Joi.number().min(0),
    }),
  }),

  // Bonus Claim
  claimBonus: Joi.object({
    bonusId: Joi.string()
      .required()
      .messages({
        'string.empty': 'Bonus ID is required',
      }),
  }),

  // Promotion Creation (Admin)
  createPromotion: Joi.object({
    title: Joi.string()
      .min(3)
      .max(100)
      .required()
      .messages({
        'string.min': 'Title must be at least 3 characters',
        'string.max': 'Title must be less than 100 characters',
        'string.empty': 'Title is required',
      }),
    description: Joi.string()
      .min(10)
      .max(1000)
      .required()
      .messages({
        'string.min': 'Description must be at least 10 characters',
        'string.max': 'Description must be less than 1000 characters',
        'string.empty': 'Description is required',
      }),
    type: Joi.string()
      .valid('welcome', 'reload', 'cashback', 'freebet', 'vip')
      .required(),
    value: Joi.number()
      .min(0)
      .required(),
    startDate: Joi.date()
      .greater('now')
      .required()
      .messages({
        'date.greater': 'Start date must be in the future',
      }),
    endDate: Joi.date()
      .greater(Joi.ref('startDate'))
      .required()
      .messages({
        'date.greater': 'End date must be after start date',
      }),
    eligibility: Joi.object({
      minDeposit: Joi.number().min(0).default(0),
      maxUsers: Joi.number().min(0).default(0),
      userTiers: Joi.array().items(Joi.string()),
      countries: Joi.array().items(Joi.string().length(2)),
    }),
  }),
};

// ============================================
// VALIDATION FUNCTIONS
// ============================================

/**
 * Validate data against a schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Joi schema
 * @param {Object} options - Validation options
 * @returns {Object} - { valid, value, error }
 */
const validate = (data, schema, options = {}) => {
  const defaultOptions = {
    abortEarly: false,
    stripUnknown: true,
    allowUnknown: false,
  };

  const opts = { ...defaultOptions, ...options };
  const result = schema.validate(data, opts);

  if (result.error) {
    const errors = result.error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
      type: detail.type,
    }));

    return {
      valid: false,
      errors,
      value: result.value,
    };
  }

  return {
    valid: true,
    value: result.value,
    errors: [],
  };
};

/**
 * Validate and sanitize a string
 * @param {string} input - String to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} - Sanitized string
 */
const sanitizeString = (input, options = {}) => {
  const defaultOptions = {
    trim: true,
    escape: true,
    stripTags: true,
    lowerCase: false,
    upperCase: false,
  };

  const opts = { ...defaultOptions, ...options };
  let output = input;

  if (typeof output !== 'string') return output;

  if (opts.trim) output = output.trim();
  if (opts.escape) output = validator.escape(output);
  if (opts.stripTags) output = validator.stripTags(output);
  if (opts.lowerCase) output = output.toLowerCase();
  if (opts.upperCase) output = output.toUpperCase();

  return output;
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
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value, options);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'string' ? sanitizeString(item, options) : item
      );
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeObject(value, options);
    } else {
      result[key] = value;
    }
  }
  return result;
};

/**
 * Validate user registration data
 * @param {Object} data - Registration data
 * @returns {Object} - Validation result
 */
const validateRegistration = (data) => {
  return validate(data, schemas.userRegistration);
};

/**
 * Validate login credentials
 * @param {Object} data - Login data
 * @returns {Object} - Validation result
 */
const validateLogin = (data) => {
  return validate(data, schemas.userLogin);
};

/**
 * Validate bet placement
 * @param {Object} data - Bet data
 * @returns {Object} - Validation result
 */
const validateBet = (data) => {
  return validate(data, schemas.placeBet);
};

/**
 * Validate deposit request
 * @param {Object} data - Deposit data
 * @returns {Object} - Validation result
 */
const validateDeposit = (data) => {
  return validate(data, schemas.deposit);
};

/**
 * Validate withdrawal request
 * @param {Object} data - Withdrawal data
 * @returns {Object} - Validation result
 */
const validateWithdrawal = (data) => {
  return validate(data, schemas.withdrawal);
};

/**
 * Validate KYC document
 * @param {Object} data - KYC data
 * @returns {Object} - Validation result
 */
const validateKycDocument = (data) => {
  return validate(data, schemas.kycDocument);
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Core validation functions
  validate,
  validateRegistration,
  validateLogin,
  validateBet,
  validateDeposit,
  validateWithdrawal,
  validateKycDocument,

  // Schema access
  schemas,

  // Individual validators
  isValidEmail,
  isValidPhone,
  validatePasswordStrength,
  isValidUrl,
  isValidDate,
  isValidISODate,
  isValidUUID,
  validateCreditCard,
  isValidIBAN,
  isValidBIC,
  isValidHex,
  isValidJWT,

  // Sanitization
  sanitizeString,
  sanitizeObject,

  // Utilities
  calculatePasswordScore,

  // Password strength levels
  PASSWORD_STRENGTH: {
    WEAK: 0,
    FAIR: 1,
    GOOD: 2,
    STRONG: 3,
    VERY_STRONG: 4,
  },
};

// Default export
module.exports.default = module.exports;
