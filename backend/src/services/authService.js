/**
 * Auth Service - Authentication Business Logic
 * CephasGM GameZone
 * 
 * This service handles all authentication-related business logic including:
 * - User registration and account creation
 * - Login with email/password and OAuth
 * - JWT token generation and management
 * - Password reset and email verification
 * - Two-factor authentication (2FA)
 * - Session management
 * - Account lockout and security
 */

const crypto = require('crypto');
const argon2 = require('argon2');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const { User, Wallet, Session, AuditLog } = require('../models');
const { generateTokenPair, blacklistToken, getTokenPayload } = require('../utils/jwt');
const { hashPassword, verifyPassword, generateSalt, generateToken } = require('../utils/encryption');
const { validatePasswordStrength, isValidEmail } = require('../utils/validators');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const { sendEmail } = require('./emailService');
const { logAudit } = require('../utils/logger');

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60; // 15 minutes in seconds
const PASSWORD_RESET_EXPIRY = 3600; // 1 hour in seconds
const EMAIL_VERIFICATION_EXPIRY = 86400; // 24 hours in seconds

// ============================================
// USER REGISTRATION
// ============================================

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @param {string} userData.email - User email
 * @param {string} userData.password - User password
 * @param {string} userData.firstName - User first name
 * @param {string} userData.lastName - User last name
 * @param {string} userData.phone - User phone number (optional)
 * @param {string} userData.dateOfBirth - User date of birth
 * @param {string} userData.country - User country code
 * @param {string} userData.currency - User currency
 * @param {string} userData.referralCode - Referral code (optional)
 * @param {Object} req - Express request object (for IP tracking)
 * @returns {Promise<Object>} - Created user and tokens
 */
const registerUser = async (userData, req = null) => {
  const { email, password, firstName, lastName, phone, dateOfBirth, country, currency = 'USD', referralCode } = userData;

  // Validate email
  if (!isValidEmail(email)) {
    throw new Error('Invalid email address');
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors[0]);
  }

  // Check if user already exists
  const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
  if (existingUser) {
    throw new Error('User already exists with this email');
  }

  // Check referral code if provided
  let referredBy = null;
  if (referralCode) {
    const referrer = await User.findOne({ where: { referral_code: referralCode } });
    if (referrer) {
      referredBy = referrer.id;
    }
  }

  // Generate salt and hash password
  const salt = generateSalt(16);
  const { hash } = await hashPassword(password, salt);

  // Create user
  const user = await User.create({
    email: email.toLowerCase(),
    first_name: firstName,
    last_name: lastName,
    phone: phone || null,
    date_of_birth: dateOfBirth,
    country: country,
    currency: currency,
    password_hash: hash,
    salt: salt,
    referred_by: referredBy,
    status: 'active',
    email_verified: false,
  });

  // Create wallet for user
  await Wallet.create({
    user_id: user.id,
    currency: currency,
  });

  // Generate referral code if not set (should be set by model hook)
  if (!user.referral_code) {
    const referralCode = generateReferralCode();
    await user.update({ referral_code: referralCode });
  }

  // Generate tokens
  const tokens = generateTokenPair(user);

  // Create session
  await createSession(user.id, tokens.refresh.token, req);

  // Send welcome email
  try {
    await sendWelcomeEmail(user);
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
  }

  // Send verification email
  try {
    await sendVerificationEmail(user);
  } catch (error) {
    logger.error('Failed to send verification email:', error);
  }

  // Log audit
  await logAudit('USER_REGISTER', user.id, { email: user.email }, req);

  logger.info(`New user registered: ${user.email} (${user.id})`);

  return {
    user: user.toJSON(),
    tokens,
    requiresEmailVerification: true,
  };
};

/**
 * Generate a referral code
 * @returns {string} - Referral code
 */
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// ============================================
// USER LOGIN
// ============================================

/**
 * Login user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - User and tokens
 */
const loginUser = async (email, password, req = null) => {
  // Find user
  const user = await User.findOne({
    where: { email: email.toLowerCase() },
    attributes: {
      include: ['password_hash', 'salt'],
    },
  });

  if (!user) {
    // Log failed attempt
    await logAudit('LOGIN_FAILED', null, { email }, req);
    throw new Error('Invalid email or password');
  }

  // Check if account is locked
  if (user.locked_until && user.locked_until > new Date()) {
    const remainingMinutes = Math.ceil((user.locked_until - new Date()) / (60 * 1000));
    throw new Error(`Account locked. Try again in ${remainingMinutes} minutes`);
  }

  // Verify password
  const isValid = await verifyPassword(password, user.password_hash, user.salt);
  if (!isValid) {
    // Increment failed attempts
    const attempts = (user.failed_login_attempts || 0) + 1;
    await user.update({ failed_login_attempts: attempts });

    // Lock account if max attempts exceeded
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      const lockUntil = new Date(Date.now() + LOCKOUT_DURATION * 1000);
      await user.update({
        locked_until: lockUntil,
        failed_login_attempts: attempts,
      });
      await logAudit('ACCOUNT_LOCKED', user.id, { attempts }, req);
      throw new Error(`Account locked due to ${attempts} failed attempts. Try again later.`);
    }

    await logAudit('LOGIN_FAILED', user.id, { attempts }, req);
    throw new Error('Invalid email or password');
  }

  // Reset failed attempts on successful login
  await user.update({
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: new Date(),
    last_login_ip: req?.ip || null,
  });

  // Check if email is verified
  if (!user.email_verified) {
    await logAudit('LOGIN_EMAIL_UNVERIFIED', user.id, {}, req);
    return {
      user: user.toJSON(),
      requiresEmailVerification: true,
    };
  }

  // Check if 2FA is enabled
  if (user.two_factor_enabled) {
    await logAudit('LOGIN_2FA_REQUIRED', user.id, {}, req);
    return {
      user: user.toJSON(),
      requiresTwoFactor: true,
      twoFactorMethod: 'totp',
    };
  }

  // Generate tokens
  const tokens = generateTokenPair(user);

  // Create session
  await createSession(user.id, tokens.refresh.token, req);

  // Log successful login
  await logAudit('LOGIN_SUCCESS', user.id, { email: user.email }, req);
  logger.info(`User logged in: ${user.email} (${user.id})`);

  return {
    user: user.toJSON(),
    tokens,
  };
};

/**
 * Verify 2FA code and complete login
 * @param {string} userId - User ID
 * @param {string} code - 2FA code
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - User and tokens
 */
const verifyTwoFactorLogin = async (userId, code, req = null) => {
  const user = await User.findByPk(userId, {
    attributes: {
      include: ['two_factor_secret'],
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.two_factor_enabled) {
    throw new Error('2FA is not enabled for this user');
  }

  // Verify TOTP code
  const verified = speakeasy.totp.verify({
    secret: user.two_factor_secret,
    encoding: 'base32',
    token: code,
    window: 2,
  });

  if (!verified) {
    await logAudit('2FA_VERIFY_FAILED', user.id, {}, req);
    throw new Error('Invalid 2FA code');
  }

  // Generate tokens
  const tokens = generateTokenPair(user);

  // Create session
  await createSession(user.id, tokens.refresh.token, req);

  // Update user
  await user.update({
    last_login_at: new Date(),
    last_login_ip: req?.ip || null,
  });

  await logAudit('LOGIN_2FA_SUCCESS', user.id, {}, req);
  logger.info(`User completed 2FA login: ${user.email} (${user.id})`);

  return {
    user: user.toJSON(),
    tokens,
  };
};

// ============================================
// TOKEN MANAGEMENT
// ============================================

/**
 * Refresh access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - New access token
 */
const refreshAccessToken = async (refreshToken, req = null) => {
  // Find session with this refresh token
  const session = await Session.findOne({
    where: { refresh_token: refreshToken },
    include: [
      {
        model: User,
        as: 'user',
        attributes: {
          exclude: ['password_hash', 'salt'],
        },
      },
    ],
  });

  if (!session) {
    throw new Error('Invalid refresh token');
  }

  if (session.status !== 'active') {
    throw new Error('Session is no longer active');
  }

  if (session.expires_at && session.expires_at < new Date()) {
    throw new Error('Session has expired');
  }

  const user = session.user;
  if (!user) {
    throw new Error('User not found');
  }

  // Generate new tokens
  const tokens = generateTokenPair(user);

  // Update session with new refresh token
  await session.update({
    refresh_token: tokens.refresh.token,
    last_token_refresh_at: new Date(),
    token_rotation_count: session.token_rotation_count + 1,
  });

  // Blacklist old refresh token
  await blacklistToken(refreshToken, 7 * 24 * 60 * 60); // 7 days

  await logAudit('TOKEN_REFRESH', user.id, {}, req);
  logger.debug(`Token refreshed for user: ${user.email} (${user.id})`);

  return {
    tokens,
    user: user.toJSON(),
  };
};

/**
 * Logout user by blacklisting tokens
 * @param {string} accessToken - Access token
 * @param {string} refreshToken - Refresh token
 * @param {Object} req - Express request object
 * @returns {Promise<void>}
 */
const logoutUser = async (accessToken, refreshToken, req = null) => {
  // Blacklist access token
  if (accessToken) {
    const payload = getTokenPayload(accessToken);
    if (payload) {
      const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
      if (expiresIn > 0) {
        await blacklistToken(accessToken, expiresIn);
      }
    }
  }

  // Blacklist refresh token and invalidate session
  if (refreshToken) {
    const session = await Session.findOne({
      where: { refresh_token: refreshToken },
    });

    if (session) {
      await blacklistToken(refreshToken, 7 * 24 * 60 * 60);
      await session.update({
        status: 'terminated',
        logout_at: new Date(),
      });
      await logAudit('LOGOUT', session.user_id, {}, req);
    }
  }

  logger.debug(`User logged out`);
};

// ============================================
// PASSWORD MANAGEMENT
// ============================================

/**
 * Request password reset
 * @param {string} email - User email
 * @param {Object} req - Express request object
 * @returns {Promise<void>}
 */
const requestPasswordReset = async (email, req = null) => {
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  if (!user) {
    // Don't reveal if user exists
    return;
  }

  // Generate reset token
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY * 1000);

  // Store token in Redis
  await cache.set(
    `password_reset:${token}`,
    JSON.stringify({
      userId: user.id,
      email: user.email,
      expiresAt: expiresAt.toISOString(),
    }),
    PASSWORD_RESET_EXPIRY
  );

  // Send reset email
  try {
    await sendPasswordResetEmail(user, token);
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
    throw new Error('Failed to send reset email');
  }

  await logAudit('PASSWORD_RESET_REQUESTED', user.id, { email: user.email }, req);
  logger.info(`Password reset requested for: ${user.email}`);
};

/**
 * Reset password using token
 * @param {string} token - Reset token
 * @param {string} newPassword - New password
 * @param {Object} req - Express request object
 * @returns {Promise<void>}
 */
const resetPassword = async (token, newPassword, req = null) => {
  // Validate password strength
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors[0]);
  }

  // Get token data from Redis
  const tokenData = await cache.get(`password_reset:${token}`);
  if (!tokenData) {
    throw new Error('Invalid or expired reset token');
  }

  const data = JSON.parse(tokenData);
  if (new Date(data.expiresAt) < new Date()) {
    await cache.del(`password_reset:${token}`);
    throw new Error('Reset token has expired');
  }

  // Find user
  const user = await User.findByPk(data.userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Hash new password
  const salt = generateSalt(16);
  const { hash } = await hashPassword(newPassword, salt);

  // Update user
  await user.update({
    password_hash: hash,
    salt: salt,
    last_password_change: new Date(),
  });

  // Invalidate all sessions
  await Session.update(
    { status: 'revoked' },
    { where: { user_id: user.id, status: 'active' } }
  );

  // Delete reset token
  await cache.del(`password_reset:${token}`);

  // Log audit
  await logAudit('PASSWORD_RESET_SUCCESS', user.id, { email: user.email }, req);
  logger.info(`Password reset successful for: ${user.email}`);
};

/**
 * Change password (authenticated user)
 * @param {string} userId - User ID
 * @param {string} currentPassword - Current password
 * @param {string} newPassword - New password
 * @param {Object} req - Express request object
 * @returns {Promise<void>}
 */
const changePassword = async (userId, currentPassword, newPassword, req = null) => {
  // Validate new password strength
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    throw new Error(passwordValidation.errors[0]);
  }

  // Find user with password hash
  const user = await User.findByPk(userId, {
    attributes: {
      include: ['password_hash', 'salt'],
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.password_hash, user.salt);
  if (!isValid) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password
  const salt = generateSalt(16);
  const { hash } = await hashPassword(newPassword, salt);

  // Update user
  await user.update({
    password_hash: hash,
    salt: salt,
    last_password_change: new Date(),
  });

  // Log audit
  await logAudit('PASSWORD_CHANGED', user.id, {}, req);
  logger.info(`Password changed for user: ${user.email} (${user.id})`);
};

// ============================================
// EMAIL VERIFICATION
// ============================================

/**
 * Send email verification
 * @param {Object} user - User object
 * @param {Object} req - Express request object
 * @returns {Promise<void>}
 */
const sendVerificationEmail = async (user, req = null) => {
  if (user.email_verified) {
    return;
  }

  // Generate verification token
  const token = crypto.randomBytes(32).toString('hex');

  // Store token in Redis
  await cache.set(
    `email_verify:${token}`,
    JSON.stringify({
      userId: user.id,
      email: user.email,
    }),
    EMAIL_VERIFICATION_EXPIRY
  );

  // Send email
  await sendEmail({
    to: user.email,
    subject: 'Verify Your Email - CephasGM GameZone',
    template: 'email-verification',
    data: {
      name: `${user.first_name} ${user.last_name}`,
      token: token,
      email: user.email,
    },
  });

  await logAudit('EMAIL_VERIFICATION_SENT', user.id, { email: user.email }, req);
  logger.debug(`Verification email sent to: ${user.email}`);
};

/**
 * Verify email using token
 * @param {string} token - Verification token
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Verified user
 */
const verifyEmail = async (token, req = null) => {
  // Get token data from Redis
  const tokenData = await cache.get(`email_verify:${token}`);
  if (!tokenData) {
    throw new Error('Invalid or expired verification token');
  }

  const data = JSON.parse(tokenData);

  // Find user
  const user = await User.findByPk(data.userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.email_verified) {
    await cache.del(`email_verify:${token}`);
    return { user: user.toJSON(), alreadyVerified: true };
  }

  // Update user
  await user.update({
    email_verified: true,
  });

  // Delete token
  await cache.del(`email_verify:${token}`);

  await logAudit('EMAIL_VERIFIED', user.id, { email: user.email }, req);
  logger.info(`Email verified for: ${user.email} (${user.id})`);

  return {
    user: user.toJSON(),
    alreadyVerified: false,
  };
};

/**
 * Resend verification email
 * @param {string} email - User email
 * @param {Object} req - Express request object
 * @returns {Promise<void>}
 */
const resendVerificationEmail = async (email, req = null) => {
  const user = await User.findOne({ where: { email: email.toLowerCase() } });
  if (!user || user.email_verified) {
    return;
  }

  await sendVerificationEmail(user, req);
};

// ============================================
// TWO-FACTOR AUTHENTICATION (2FA)
// ============================================

/**
 * Enable 2FA for a user
 * @param {string} userId - User ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - { secret, qrCode, backupCodes }
 */
const enableTwoFactor = async (userId, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (user.two_factor_enabled) {
    throw new Error('2FA is already enabled');
  }

  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `CephasGM GameZone (${user.email})`,
    length: 20,
  });

  // Generate QR code
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  // Generate backup codes
  const backupCodes = [];
  for (let i = 0; i < 10; i++) {
    backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }

  // Store 2FA secret temporarily (will be enabled after verification)
  const hashedBackupCodes = backupCodes.map(code =>
    crypto.createHash('sha256').update(code).digest('hex')
  );

  await cache.set(
    `2fa_setup:${userId}`,
    JSON.stringify({
      secret: secret.base32,
      backupCodes: hashedBackupCodes,
    }),
    600 // 10 minutes
  );

  await logAudit('2FA_SETUP_INITIATED', user.id, {}, req);
  logger.info(`2FA setup initiated for user: ${user.email}`);

  return {
    secret: secret.base32,
    qrCode,
    backupCodes,
  };
};

/**
 * Verify and enable 2FA
 * @param {string} userId - User ID
 * @param {string} code - TOTP code
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - { success, backupCodes }
 */
const verifyAndEnableTwoFactor = async (userId, code, req = null) => {
  // Get setup data
  const setupData = await cache.get(`2fa_setup:${userId}`);
  if (!setupData) {
    throw new Error('2FA setup session expired. Please try again.');
  }

  const data = JSON.parse(setupData);

  // Verify TOTP code
  const verified = speakeasy.totp.verify({
    secret: data.secret,
    encoding: 'base32',
    token: code,
    window: 2,
  });

  if (!verified) {
    throw new Error('Invalid verification code');
  }

  // Find user
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Enable 2FA
  await user.update({
    two_factor_enabled: true,
    two_factor_secret: data.secret,
    two_factor_backup_codes: data.backupCodes,
  });

  // Clean up
  await cache.del(`2fa_setup:${userId}`);

  // Generate backup codes for display
  const backupCodes = data.backupCodes.map(code =>
    crypto.createHash('sha256').update(code).digest('hex')
  );

  await logAudit('2FA_ENABLED', user.id, {}, req);
  logger.info(`2FA enabled for user: ${user.email} (${user.id})`);

  return {
    success: true,
    backupCodes,
  };
};

/**
 * Disable 2FA for a user
 * @param {string} userId - User ID
 * @param {string} code - TOTP code
 * @param {Object} req - Express request object
 * @returns {Promise<void>}
 */
const disableTwoFactor = async (userId, code, req = null) => {
  const user = await User.findByPk(userId, {
    attributes: {
      include: ['two_factor_secret'],
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.two_factor_enabled) {
    throw new Error('2FA is not enabled');
  }

  // Verify TOTP code
  const verified = speakeasy.totp.verify({
    secret: user.two_factor_secret,
    encoding: 'base32',
    token: code,
    window: 2,
  });

  if (!verified) {
    throw new Error('Invalid verification code');
  }

  // Disable 2FA
  await user.update({
    two_factor_enabled: false,
    two_factor_secret: null,
    two_factor_backup_codes: null,
  });

  await logAudit('2FA_DISABLED', user.id, {}, req);
  logger.info(`2FA disabled for user: ${user.email} (${user.id})`);
};

/**
 * Verify backup code for 2FA
 * @param {string} userId - User ID
 * @param {string} backupCode - Backup code
 * @param {Object} req - Express request object
 * @returns {Promise<boolean>} - Whether backup code is valid
 */
const verifyBackupCode = async (userId, backupCode, req = null) => {
  const user = await User.findByPk(userId, {
    attributes: {
      include: ['two_factor_backup_codes'],
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (!user.two_factor_enabled) {
    throw new Error('2FA is not enabled');
  }

  const hashedCode = crypto.createHash('sha256').update(backupCode).digest('hex');
  const backupCodes = user.two_factor_backup_codes || [];

  const index = backupCodes.indexOf(hashedCode);
  if (index === -1) {
    throw new Error('Invalid backup code');
  }

  // Remove used backup code
  backupCodes.splice(index, 1);
  await user.update({
    two_factor_backup_codes: backupCodes,
  });

  await logAudit('2FA_BACKUP_CODE_USED', user.id, {}, req);
  logger.info(`Backup code used for user: ${user.email} (${user.id})`);

  return true;
};

/**
 * Generate new backup codes
 * @param {string} userId - User ID
 * @param {Object} req - Express request object
 * @returns {Promise<Array>} - New backup codes
 */
const generateBackupCodes = async (userId, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (!user.two_factor_enabled) {
    throw new Error('2FA is not enabled');
  }

  // Generate new backup codes
  const backupCodes = [];
  for (let i = 0; i < 10; i++) {
    backupCodes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }

  const hashedCodes = backupCodes.map(code =>
    crypto.createHash('sha256').update(code).digest('hex')
  );

  await user.update({
    two_factor_backup_codes: hashedCodes,
  });

  await logAudit('2FA_BACKUP_CODES_REGENERATED', user.id, {}, req);
  logger.info(`Backup codes regenerated for user: ${user.email} (${user.id})`);

  return backupCodes;
};

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Create a new session
 * @param {string} userId - User ID
 * @param {string} refreshToken - Refresh token
 * @param {Object} req - Express request object
 * @returns {Promise<Session>} - Created session
 */
const createSession = async (userId, refreshToken, req = null) => {
  const sessionData = {
    user_id: userId,
    refresh_token: refreshToken,
    session_token: generateToken(16, 'hex'),
    ip_address: req?.ip || null,
    user_agent: req?.headers?.['user-agent'] || null,
    device_type: req?.device?.type || null,
    session_name: req?.device?.name || 'Web Session',
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    login_at: new Date(),
    last_activity_at: new Date(),
    status: 'active',
  };

  // Extract device info from user agent
  if (req?.headers?.['user-agent']) {
    const ua = req.headers['user-agent'];
    if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) {
      sessionData.device_type = 'mobile';
    } else if (ua.includes('Tablet')) {
      sessionData.device_type = 'tablet';
    } else {
      sessionData.device_type = 'desktop';
    }

    // Extract browser and OS
    // This could be enhanced with a proper user-agent parser library
  }

  const session = await Session.create(sessionData);
  return session;
};

/**
 * Get all active sessions for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Active sessions
 */
const getUserSessions = async (userId) => {
  const sessions = await Session.findAll({
    where: {
      user_id: userId,
      status: 'active',
      expires_at: {
        [Session.sequelize.Op.gt]: new Date(),
      },
    },
    order: [['last_activity_at', 'DESC']],
  });

  return sessions.map(session => session.getSummary());
};

/**
 * Terminate a session
 * @param {string} sessionId - Session ID
 * @param {string} userId - User ID (for authorization)
 * @param {Object} req - Express request object
 * @returns {Promise<void>}
 */
const terminateSession = async (sessionId, userId, req = null) => {
  const session = await Session.findOne({
    where: {
      id: sessionId,
      user_id: userId,
    },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  if (session.refresh_token) {
    await blacklistToken(session.refresh_token, 7 * 24 * 60 * 60);
  }

  await session.update({
    status: 'terminated',
    logout_at: new Date(),
  });

  await logAudit('SESSION_TERMINATED', userId, { sessionId }, req);
  logger.info(`Session terminated: ${sessionId} for user ${userId}`);
};

/**
 * Terminate all sessions for a user (except current)
 * @param {string} userId - User ID
 * @param {string} currentSessionId - Current session ID to exclude
 * @param {Object} req - Express request object
 * @returns {Promise<number>} - Number of sessions terminated
 */
const terminateAllSessions = async (userId, currentSessionId = null, req = null) => {
  const where = {
    user_id: userId,
    status: 'active',
  };

  if (currentSessionId) {
    where.id = { [Session.sequelize.Op.ne]: currentSessionId };
  }

  const sessions = await Session.findAll({ where });

  for (const session of sessions) {
    if (session.refresh_token) {
      await blacklistToken(session.refresh_token, 7 * 24 * 60 * 60);
    }
    await session.update({
      status: 'terminated',
      logout_at: new Date(),
    });
  }

  await logAudit('ALL_SESSIONS_TERMINATED', userId, { count: sessions.length }, req);
  logger.info(`All sessions terminated for user ${userId}: ${sessions.length} sessions`);

  return sessions.length;
};

// ============================================
// OAUTH LOGIN
// ============================================

/**
 * Handle OAuth login or registration
 * @param {Object} profile - OAuth profile
 * @param {string} provider - OAuth provider (google, facebook, github, apple)
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - User and tokens
 */
const oauthLogin = async (profile, provider, req = null) => {
  const email = profile.email;
  if (!email) {
    throw new Error('No email provided by OAuth provider');
  }

  let user = await User.findOne({ where: { email: email.toLowerCase() } });

  if (!user) {
    // Create new user
    const firstName = profile.firstName || profile.displayName?.split(' ')[0] || 'OAuth';
    const lastName = profile.lastName || profile.displayName?.split(' ').slice(1).join(' ') || 'User';

    user = await User.create({
      email: email.toLowerCase(),
      first_name: firstName,
      last_name: lastName,
      email_verified: true,
      status: 'active',
      avatar_url: profile.avatar || null,
    });

    // Create wallet
    await Wallet.create({
      user_id: user.id,
      currency: 'USD',
    });

    // Generate referral code
    if (!user.referral_code) {
      const referralCode = generateReferralCode();
      await user.update({ referral_code: referralCode });
    }

    // Log audit
    await logAudit('OAUTH_REGISTER', user.id, { provider, email: user.email }, req);
    logger.info(`New user registered via ${provider} OAuth: ${user.email} (${user.id})`);
  }

  // Update OAuth ID if not linked
  const updateData = {};
  if (provider === 'google' && !user.google_id) {
    updateData.google_id = profile.id;
  } else if (provider === 'facebook' && !user.facebook_id) {
    updateData.facebook_id = profile.id;
  } else if (provider === 'github' && !user.github_id) {
    updateData.github_id = profile.id;
  } else if (provider === 'apple' && !user.apple_id) {
    updateData.apple_id = profile.id;
  }

  if (profile.avatar && !user.avatar_url) {
    updateData.avatar_url = profile.avatar;
  }

  if (Object.keys(updateData).length > 0) {
    await user.update(updateData);
  }

  // Check if user is active
  if (user.status !== 'active' && user.status !== 'verified') {
    throw new Error(`Account is ${user.status}`);
  }

  // Check if user is locked
  if (user.locked_until && user.locked_until > new Date()) {
    throw new Error('Account is locked');
  }

  // Generate tokens
  const tokens = generateTokenPair(user);

  // Create session
  await createSession(user.id, tokens.refresh.token, req);

  // Update last login
  await user.update({
    last_login_at: new Date(),
    last_login_ip: req?.ip || null,
  });

  await logAudit('OAUTH_LOGIN', user.id, { provider, email: user.email }, req);
  logger.info(`User logged in via ${provider} OAuth: ${user.email} (${user.id})`);

  return {
    user: user.toJSON(),
    tokens,
  };
};

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * Send welcome email
 * @param {Object} user - User object
 * @returns {Promise<void>}
 */
const sendWelcomeEmail = async (user) => {
  // Implementation in emailService
  // This is a placeholder
  logger.info(`Welcome email would be sent to: ${user.email}`);
};

/**
 * Send verification email
 * @param {Object} user - User object
 * @returns {Promise<void>}
 */
const sendVerificationEmailInternal = async (user) => {
  // Implementation in emailService
  // This is a placeholder
  logger.info(`Verification email would be sent to: ${user.email}`);
};

/**
 * Send password reset email
 * @param {Object} user - User object
 * @param {string} token - Reset token
 * @returns {Promise<void>}
 */
const sendPasswordResetEmail = async (user, token) => {
  // Implementation in emailService
  // This is a placeholder
  logger.info(`Password reset email would be sent to: ${user.email}`);
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Registration
  registerUser,
  
  // Login
  loginUser,
  verifyTwoFactorLogin,
  
  // Token Management
  refreshAccessToken,
  logoutUser,
  
  // Password Management
  requestPasswordReset,
  resetPassword,
  changePassword,
  
  // Email Verification
  sendVerificationEmail,
  verifyEmail,
  resendVerificationEmail,
  
  // Two-Factor Authentication
  enableTwoFactor,
  verifyAndEnableTwoFactor,
  disableTwoFactor,
  verifyBackupCode,
  generateBackupCodes,
  
  // Session Management
  createSession,
  getUserSessions,
  terminateSession,
  terminateAllSessions,
  
  // OAuth
  oauthLogin,
  
  // Email
  sendWelcomeEmail,
  sendPasswordResetEmail,
};
