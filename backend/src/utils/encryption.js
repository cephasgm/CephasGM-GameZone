/**
 * Encryption Utility - Security & Cryptography
 * CephasGM GameZone
 * 
 * This module provides encryption, hashing, and cryptographic utilities
 * for securing sensitive data including:
 * - Argon2 password hashing
 * - AES-256-GCM encryption for sensitive data
 * - HMAC for message authentication
 * - Secure random token generation
 * - Data masking and sanitization
 */

const crypto = require('crypto');
const argon2 = require('argon2');
const logger = require('./logger');

// Environment variables
const env = process.env.NODE_ENV || 'development';

/**
 * Encryption configuration
 */
const encryptionConfig = {
  // Argon2 password hashing settings
  argon2: {
    type: argon2.argon2id,
    memoryCost: 19 * 1024, // 19 MB
    timeCost: 2,
    parallelism: 1,
    hashLength: 32,
    saltLength: 16,
  },

  // AES-256-GCM encryption settings
  aes: {
    algorithm: 'aes-256-gcm',
    keyLength: 32, // 256 bits
    ivLength: 16, // 128 bits
    authTagLength: 16, // 128 bits
  },

  // HMAC settings
  hmac: {
    algorithm: 'sha256',
    keyLength: 32,
  },

  // Token generation
  token: {
    length: 32,
    encoding: 'hex',
    characters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  },

  // Data masking
  masking: {
    emailVisibleChars: 3,
    phoneVisibleChars: 4,
    cardVisibleChars: 4,
    nameVisibleChars: 2,
  },
};

/**
 * Generate a secure random salt
 * @param {number} length - Salt length in bytes
 * @returns {string} - Hex encoded salt
 */
const generateSalt = (length = 16) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Hash a password using Argon2
 * @param {string} password - Plain text password
 * @param {string} salt - Optional salt (generated if not provided)
 * @returns {Promise<Object>} - { hash, salt }
 */
const hashPassword = async (password, salt = null) => {
  try {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(16);
    const saltHex = salt || saltBuffer.toString('hex');

    const hash = await argon2.hash(password, {
      ...encryptionConfig.argon2,
      salt: saltBuffer,
    });

    return {
      hash,
      salt: saltHex,
    };
  } catch (error) {
    logger.error('Password hashing failed:', error);
    throw new Error('Failed to hash password');
  }
};

/**
 * Verify a password against a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Argon2 hash
 * @param {string} salt - Salt used for hashing
 * @returns {Promise<boolean>} - Whether the password matches
 */
const verifyPassword = async (password, hash, salt) => {
  try {
    return await argon2.verify(hash, password, {
      salt: Buffer.from(salt, 'hex'),
    });
  } catch (error) {
    logger.error('Password verification failed:', error);
    return false;
  }
};

/**
 * Encrypt sensitive data using AES-256-GCM
 * @param {string|Buffer} data - Data to encrypt
 * @param {string} key - Encryption key (hex)
 * @param {string} iv - Optional IV (generated if not provided)
 * @returns {Object} - { encrypted, iv, authTag }
 */
const encrypt = (data, key, iv = null) => {
  try {
    const keyBuffer = Buffer.from(key, 'hex');
    const ivBuffer = iv ? Buffer.from(iv, 'hex') : crypto.randomBytes(16);
    const plaintext = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, ivBuffer);
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      encrypted: encrypted.toString('hex'),
      iv: ivBuffer.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
};

/**
 * Decrypt data encrypted with AES-256-GCM
 * @param {string} encrypted - Encrypted data (hex)
 * @param {string} key - Encryption key (hex)
 * @param {string} iv - IV (hex)
 * @param {string} authTag - Authentication tag (hex)
 * @param {string} encoding - Output encoding ('utf8' or 'hex')
 * @returns {string|Buffer} - Decrypted data
 */
const decrypt = (encrypted, key, iv, authTag, encoding = 'utf8') => {
  try {
    const keyBuffer = Buffer.from(key, 'hex');
    const ivBuffer = Buffer.from(iv, 'hex');
    const encryptedBuffer = Buffer.from(encrypted, 'hex');
    const authTagBuffer = Buffer.from(authTag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
    decipher.setAuthTag(authTagBuffer);

    const decrypted = Buffer.concat([
      decipher.update(encryptedBuffer),
      decipher.final(),
    ]);

    return encoding === 'utf8' ? decrypted.toString('utf8') : decrypted.toString('hex');
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
};

/**
 * Generate a random encryption key
 * @param {number} length - Key length in bytes
 * @returns {string} - Hex encoded key
 */
const generateKey = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a secure random token
 * @param {number} length - Token length in bytes
 * @param {string} encoding - Encoding ('hex', 'base64', 'utf8')
 * @returns {string} - Random token
 */
const generateToken = (length = 32, encoding = 'hex') => {
  return crypto.randomBytes(length).toString(encoding);
};

/**
 * Generate a secure numeric code (e.g., for 2FA)
 * @param {number} length - Code length
 * @returns {string} - Numeric code
 */
const generateNumericCode = (length = 6) => {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += Math.floor(Math.random() * 10).toString();
  }
  return code;
};

/**
 * Generate a secure alphanumeric code
 * @param {number} length - Code length
 * @returns {string} - Alphanumeric code
 */
const generateAlphanumericCode = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Generate HMAC-SHA256 signature
 * @param {string} data - Data to sign
 * @param {string} secret - Secret key
 * @returns {string} - HMAC signature (hex)
 */
const generateHmac = (data, secret) => {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

/**
 * Verify HMAC signature
 * @param {string} data - Original data
 * @param {string} signature - Signature to verify
 * @param {string} secret - Secret key
 * @returns {boolean} - Whether the signature is valid
 */
const verifyHmac = (data, signature, secret) => {
  const expected = generateHmac(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expected, 'hex')
  );
};

/**
 * Mask sensitive data for display
 * @param {string} data - Data to mask
 * @param {number} visibleStart - Number of visible characters at start
 * @param {number} visibleEnd - Number of visible characters at end
 * @param {string} maskChar - Character to use for masking
 * @returns {string} - Masked data
 */
const maskData = (data, visibleStart = 3, visibleEnd = 3, maskChar = '*') => {
  if (!data || data.length <= visibleStart + visibleEnd) {
    return data;
  }

  const start = data.substring(0, visibleStart);
  const end = data.substring(data.length - visibleEnd);
  const middleLength = data.length - visibleStart - visibleEnd;
  const masked = maskChar.repeat(Math.min(middleLength, 8));

  return `${start}${masked}${end}`;
};

/**
 * Mask an email address
 * @param {string} email - Email address
 * @returns {string} - Masked email
 */
const maskEmail = (email) => {
  if (!email) return '';
  const [localPart, domain] = email.split('@');
  if (!domain) return maskData(email, 2, 2);

  const visibleLocal = Math.min(encryptionConfig.masking.emailVisibleChars, localPart.length);
  const maskedLocal = maskData(localPart, visibleLocal, 0);
  return `${maskedLocal}@${domain}`;
};

/**
 * Mask a phone number
 * @param {string} phone - Phone number
 * @returns {string} - Masked phone number
 */
const maskPhone = (phone) => {
  if (!phone) return '';
  const visible = encryptionConfig.masking.phoneVisibleChars;
  return maskData(phone, visible, visible);
};

/**
 * Mask a credit card number
 * @param {string} cardNumber - Credit card number
 * @returns {string} - Masked card number
 */
const maskCardNumber = (cardNumber) => {
  if (!cardNumber) return '';
  const visible = encryptionConfig.masking.cardVisibleChars;
  const cleaned = cardNumber.replace(/\s/g, '');
  if (cleaned.length <= visible * 2) return cleaned;
  return maskData(cleaned, visible, visible);
};

/**
 * Mask a name
 * @param {string} name - Full name
 * @returns {string} - Masked name
 */
const maskName = (name) => {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length === 1) {
    return maskData(name, encryptionConfig.masking.nameVisibleChars, 0);
  }
  const firstName = parts[0];
  const lastName = parts[parts.length - 1];
  const maskedFirst = maskData(firstName, encryptionConfig.masking.nameVisibleChars, 0);
  const maskedLast = maskData(lastName, encryptionConfig.masking.nameVisibleChars, 0);
  return `${maskedFirst} ${maskedLast}`;
};

/**
 * Generate a CSRF token
 * @param {string} sessionId - Session ID
 * @param {string} secret - Secret key
 * @returns {string} - CSRF token
 */
const generateCsrfToken = (sessionId, secret) => {
  const timestamp = Date.now().toString();
  const data = `${sessionId}:${timestamp}`;
  const signature = generateHmac(data, secret);
  return Buffer.from(`${data}:${signature}`).toString('base64');
};

/**
 * Verify a CSRF token
 * @param {string} token - CSRF token
 * @param {string} sessionId - Session ID
 * @param {string} secret - Secret key
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {boolean} - Whether the token is valid
 */
const verifyCsrfToken = (token, sessionId, secret, maxAge = 3600000) => {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [tokenSessionId, timestamp, signature] = decoded.split(':');

    if (tokenSessionId !== sessionId) {
      return false;
    }

    const age = Date.now() - parseInt(timestamp);
    if (age > maxAge) {
      return false;
    }

    const expectedSignature = generateHmac(`${tokenSessionId}:${timestamp}`, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
};

/**
 * Generate a secure API key
 * @param {string} prefix - Optional prefix
 * @returns {string} - API key
 */
const generateApiKey = (prefix = '') => {
  const key = generateToken(32, 'base64')
    .replace(/\+/g, '')
    .replace(/\//g, '')
    .replace(/=/g, '');
  return prefix ? `${prefix}_${key}` : key;
};

/**
 * Get the encryption configuration
 * @returns {Object} - Encryption configuration
 */
const getConfig = () => {
  return encryptionConfig;
};

// Export all utilities
module.exports = {
  // Password hashing
  hashPassword,
  verifyPassword,
  generateSalt,

  // Encryption/Decryption
  encrypt,
  decrypt,
  generateKey,

  // Token generation
  generateToken,
  generateNumericCode,
  generateAlphanumericCode,
  generateApiKey,

  // HMAC
  generateHmac,
  verifyHmac,

  // Data masking
  maskData,
  maskEmail,
  maskPhone,
  maskCardNumber,
  maskName,

  // CSRF
  generateCsrfToken,
  verifyCsrfToken,

  // Configuration
  getConfig,

  // Raw crypto utilities
  randomBytes: crypto.randomBytes.bind(crypto),
  randomInt: crypto.randomInt.bind(crypto),
};

// Default export
module.exports.default = module.exports;
