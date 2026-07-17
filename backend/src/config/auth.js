/**
 * Authentication Configuration - JWT, Password, Security
 * CephasGM GameZone
 * 
 * This module configures authentication settings including JWT options,
 * password hashing, security policies, and token management.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');

// Environment variables
const env = process.env.NODE_ENV || 'development';

/**
 * Authentication Configuration
 */
const authConfig = {
  // JWT Configuration
  jwt: {
    // Secret keys (use environment variables in production)
    secret: process.env.JWT_SECRET || 'cephasgm_gamezone_jwt_secret_2025',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'cephasgm_gamezone_refresh_secret_2025',
    
    // Token expiry times
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    emailVerificationExpiry: process.env.JWT_EMAIL_EXPIRY || '24h',
    passwordResetExpiry: process.env.JWT_PASSWORD_RESET_EXPIRY || '1h',
    
    // Issuer and audience
    issuer: process.env.JWT_ISSUER || 'cephasgm-gamezone',
    audience: process.env.JWT_AUDIENCE || 'cephasgm-users',
    
    // Algorithm
    algorithm: 'RS256',
    
    // Key rotation settings
    keyRotationInterval: process.env.JWT_KEY_ROTATION || '30d',
  },

  // Password Configuration
  password: {
    // Argon2 settings
    argon2: {
      type: 2, // argon2id
      memoryCost: 19 * 1024, // 19 MB
      timeCost: 2,
      parallelism: 1,
      hashLength: 32,
      saltLength: 16,
    },
    
    // Password requirements
    requirements: {
      minLength: 8,
      maxLength: 72,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      disallowCommonPasswords: true,
    },
    
    // Password history (prevent reuse)
    historyCount: 5,
    
    // Password expiry (days until forced password change)
    expiryDays: process.env.PASSWORD_EXPIRY_DAYS || 90,
  },

  // Two-Factor Authentication
  twoFactor: {
    enabled: true,
    
    // TOTP settings
    totp: {
      issuer: 'CephasGM GameZone',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      window: 2, // Allow 2 time steps before/after
    },
    
    // Recovery codes
    recoveryCodes: {
      count: 10,
      length: 8,
    },
    
    // Backup methods
    backupMethods: ['sms', 'email', 'authenticator'],
  },

  // Session Configuration
  session: {
    // Session duration
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 7 * 24 * 60 * 60 * 1000, // 7 days
    // Session idle timeout
    idleTimeout: parseInt(process.env.SESSION_IDLE_TIMEOUT) || 30 * 60 * 1000, // 30 minutes
    // Max concurrent sessions per user
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 5,
    // Device tracking
    trackDevice: true,
    trackIP: true,
  },

  // Rate Limiting
  rateLimit: {
    // General API rate limit
    global: {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per minute
    },
    
    // Authentication endpoints
    auth: {
      login: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 login attempts
      },
      register: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5, // 5 registrations per hour
      },
      passwordReset: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 3, // 3 reset requests per hour
      },
      emailVerification: {
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 5, // 5 verification requests per hour
      },
      twoFactor: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10, // 10 2FA attempts
      },
    },
    
    // Betting rate limits
    betting: {
      windowMs: 60 * 1000, // 1 minute
      max: 30, // 30 bets per minute
    },
    
    // Admin rate limits
    admin: {
      windowMs: 60 * 1000, // 1 minute
      max: 200, // 200 requests per minute
    },
  },

  // Security Headers
  security: {
    // Helmet.js options
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.tailwindcss.com"],
          imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://secure.gravatar.com"],
          connectSrc: ["'self'", "wss://api.cephasgm.com", "https://api.cephasgm.com"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
      frameguard: { action: 'deny' },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    },
    
    // CORS options
    cors: {
      allowedOrigins: process.env.CORS_ORIGINS 
        ? process.env.CORS_ORIGINS.split(',') 
        : ['http://localhost:3000', 'http://localhost:8080'],
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page'],
      credentials: true,
      maxAge: 86400, // 24 hours
    },
  },

  // OAuth Providers
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/v1/auth/oauth/google/callback',
      scope: ['profile', 'email'],
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
      callbackURL: process.env.APPLE_CALLBACK_URL || '/api/v1/auth/oauth/apple/callback',
      scope: ['name', 'email'],
    },
    facebook: {
      clientId: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL || '/api/v1/auth/oauth/facebook/callback',
      scope: ['email', 'public_profile'],
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/v1/auth/oauth/github/callback',
      scope: ['user:email'],
    },
  },

  // Email Verification
  emailVerification: {
    enabled: true,
    requireForLogin: true,
    resendCooldown: 60, // seconds
    maxResendAttempts: 5,
    // Template paths
    templates: {
      verification: 'email/verification.html',
      passwordReset: 'email/password-reset.html',
      welcome: 'email/welcome.html',
    },
  },

  // Account Lockout
  accountLockout: {
    enabled: true,
    maxFailedAttempts: 5,
    lockoutDuration: 15 * 60 * 1000, // 15 minutes
    permanentLockoutThreshold: 20, // Permanent lockout after 20 failed attempts
    notifyOnLockout: true,
  },

  // IP and Device Trust
  trust: {
    enabled: true,
    trustedIPs: process.env.TRUSTED_IPS ? process.env.TRUSTED_IPS.split(',') : [],
    trustedDevices: {
      maxDevices: 5,
      rememberDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
    requireDeviceVerification: true,
  },

  // Audit Logging
  audit: {
    enabled: true,
    logAllAuthAttempts: true,
    logAllLoginAttempts: true,
    logAllPasswordChanges: true,
    logAllProfileChanges: true,
    logAllAdminActions: true,
    retentionDays: parseInt(process.env.AUDIT_LOG_RETENTION) || 365,
  },

  // Environment-specific overrides
  development: {
    jwt: {
      accessTokenExpiry: '1h',
      refreshTokenExpiry: '30d',
    },
    rateLimit: {
      global: { windowMs: 60 * 1000, max: 1000 },
    },
    accountLockout: {
      enabled: false,
    },
  },

  test: {
    jwt: {
      accessTokenExpiry: '1h',
      refreshTokenExpiry: '30d',
    },
    rateLimit: {
      global: { windowMs: 60 * 1000, max: 10000 },
    },
    accountLockout: {
      enabled: false,
    },
  },

  production: {
    // Production defaults are above
  },
};

/**
 * Get configuration for current environment
 */
const getConfig = () => {
  const envConfig = authConfig[env] || {};
  return deepMerge(authConfig, envConfig);
};

/**
 * Deep merge utility
 */
const deepMerge = (target, source) => {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
};

/**
 * Generate a secure random token
 * @param {number} length - Token length
 * @returns {string} - Random token
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a recovery code
 * @param {number} length - Code length
 * @returns {string} - Recovery code
 */
const generateRecoveryCode = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Format JWT expiry to milliseconds
 * @param {string} expiry - Expiry string (e.g., '15m', '7d')
 * @returns {number} - Milliseconds
 */
const parseExpiry = (expiry) => {
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
 * Check if password meets requirements
 * @param {string} password - Password to check
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
const validatePassword = (password) => {
  const requirements = authConfig.password.requirements;
  const errors = [];

  if (password.length < requirements.minLength) {
    errors.push(`Password must be at least ${requirements.minLength} characters`);
  }
  if (password.length > requirements.maxLength) {
    errors.push(`Password must be less than ${requirements.maxLength} characters`);
  }
  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (requirements.requireNumbers && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (requirements.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Common passwords check
  const commonPasswords = [
    'password', '123456', 'password123', 'admin', 'admin123',
    'qwerty', 'abc123', 'letmein', 'welcome', 'monkey',
    'dragon', 'master', 'hello', 'freedom', 'whatever',
    'qazwsx', 'trustno1', '123456789', '12345678', '12345',
  ];
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a more secure password');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Export configuration and utilities
module.exports = {
  config: getConfig(),
  rawConfig: authConfig,
  getConfig,
  generateSecureToken,
  generateRecoveryCode,
  parseExpiry,
  validatePassword,
  env,
};

// Export useful constants
module.exports.constants = {
  TOKEN_TYPES: {
    ACCESS: 'access',
    REFRESH: 'refresh',
    EMAIL_VERIFICATION: 'email_verification',
    PASSWORD_RESET: 'password_reset',
    API_KEY: 'api_key',
  },
  ROLES: {
    USER: 'user',
    AGENT: 'agent',
    ADMIN: 'admin',
    SUPER_ADMIN: 'super_admin',
  },
  PERMISSIONS: {
    VIEW_USERS: 'view_users',
    MANAGE_USERS: 'manage_users',
    VIEW_BETS: 'view_bets',
    MANAGE_BETS: 'manage_bets',
    VIEW_PAYMENTS: 'view_payments',
    MANAGE_PAYMENTS: 'manage_payments',
    VIEW_REPORTS: 'view_reports',
    GENERATE_REPORTS: 'generate_reports',
    MANAGE_SETTINGS: 'manage_settings',
    MANAGE_BONUSES: 'manage_bonuses',
    MANAGE_PROMOTIONS: 'manage_promotions',
    VIEW_AUDIT_LOGS: 'view_audit_logs',
    MANAGE_ADMINS: 'manage_admins',
    FULL_ACCESS: 'full_access',
  },
};
