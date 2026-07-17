/**
 * Auth Controller - Authentication HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all authentication-related HTTP requests including:
 * - User registration
 * - User login (email/password & OAuth)
 * - Two-factor authentication
 * - Token refresh
 * - Logout
 * - Email verification
 * - Password reset
 * - OAuth callbacks
 * - 2FA setup and management
 */

const authService = require('../services/authService');
const userService = require('../services/userService');
const { catchAsync, createAuthError, createValidationError } = require('../middleware/errorHandler');
const { validateRegistration, validateLogin } = require('../utils/validators');
const logger = require('../utils/logger');

/**
 * Register a new user
 * POST /api/v1/auth/register
 */
const register = catchAsync(async (req, res) => {
  const { email, password, firstName, lastName, phone, dateOfBirth, country, currency, referralCode } = req.body;

  // Validate registration data
  const validation = validateRegistration(req.body);
  if (!validation.valid) {
    throw createValidationError('Registration validation failed', validation.errors);
  }

  const result = await authService.registerUser(
    {
      email,
      password,
      firstName,
      lastName,
      phone,
      dateOfBirth,
      country,
      currency,
      referralCode,
    },
    req
  );

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: result.user,
      tokens: result.tokens,
      requiresEmailVerification: result.requiresEmailVerification,
    },
  });
});

/**
 * Login user
 * POST /api/v1/auth/login
 */
const login = catchAsync(async (req, res) => {
  const { email, password, twoFactorCode } = req.body;

  // Validate login data
  const validation = validateLogin(req.body);
  if (!validation.valid) {
    throw createValidationError('Login validation failed', validation.errors);
  }

  // If 2FA code is provided, verify 2FA
  if (twoFactorCode) {
    // First, find the user to get userId
    const user = await userService.getUserByEmail(email);
    if (!user) {
      throw createAuthError('Invalid credentials');
    }

    const result = await authService.verifyTwoFactorLogin(user.id, twoFactorCode, req);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: result.user,
        tokens: result.tokens,
        twoFactorVerified: true,
      },
    });
  }

  // Regular login
  const result = await authService.loginUser(email, password, req);

  // Check if 2FA is required
  if (result.requiresTwoFactor) {
    return res.status(200).json({
      success: true,
      message: 'Two-factor authentication required',
      data: {
        requiresTwoFactor: true,
        userId: result.user.id,
        email: result.user.email,
        twoFactorMethod: result.twoFactorMethod,
      },
    });
  }

  // Check if email verification is required
  if (result.requiresEmailVerification) {
    return res.status(200).json({
      success: true,
      message: 'Email verification required',
      data: {
        requiresEmailVerification: true,
        email: result.user.email,
        userId: result.user.id,
      },
    });
  }

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: result.user,
      tokens: result.tokens,
    },
  });
});

/**
 * Verify two-factor authentication during login
 * POST /api/v1/auth/verify-2fa
 */
const verifyTwoFactor = catchAsync(async (req, res) => {
  const { userId, code } = req.body;

  if (!userId || !code) {
    throw createValidationError('User ID and 2FA code are required');
  }

  const result = await authService.verifyTwoFactorLogin(userId, code, req);

  res.status(200).json({
    success: true,
    message: '2FA verification successful',
    data: {
      user: result.user,
      tokens: result.tokens,
    },
  });
});

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
const refreshToken = catchAsync(async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    throw createValidationError('Refresh token is required');
  }

  const result = await authService.refreshAccessToken(refresh_token, req);

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: {
      tokens: result.tokens,
      user: result.user,
    },
  });
});

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
const logout = catchAsync(async (req, res) => {
  const accessToken = req.token || req.headers.authorization?.replace('Bearer ', '');
  const { refresh_token } = req.body;

  await authService.logoutUser(accessToken, refresh_token, req);

  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
});

/**
 * Verify email
 * POST /api/v1/auth/verify-email
 */
const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw createValidationError('Verification token is required');
  }

  const result = await authService.verifyEmail(token, req);

  res.status(200).json({
    success: true,
    message: result.alreadyVerified ? 'Email already verified' : 'Email verified successfully',
    data: {
      user: result.user,
      alreadyVerified: result.alreadyVerified,
    },
  });
});

/**
 * Resend verification email
 * POST /api/v1/auth/resend-verification
 */
const resendVerification = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw createValidationError('Email is required');
  }

  await authService.resendVerificationEmail(email, req);

  res.status(200).json({
    success: true,
    message: 'Verification email sent successfully',
  });
});

/**
 * Request password reset
 * POST /api/v1/auth/forgot-password
 */
const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw createValidationError('Email is required');
  }

  await authService.requestPasswordReset(email, req);

  // Always return success even if user doesn't exist for security
  res.status(200).json({
    success: true,
    message: 'Password reset email sent if the account exists',
  });
});

/**
 * Reset password
 * POST /api/v1/auth/reset-password
 */
const resetPassword = catchAsync(async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password) {
    throw createValidationError('Token and password are required');
  }

  if (password !== confirmPassword) {
    throw createValidationError('Passwords do not match');
  }

  await authService.resetPassword(token, password, req);

  res.status(200).json({
    success: true,
    message: 'Password reset successfully',
  });
});

/**
 * Change password (authenticated)
 * POST /api/v1/auth/change-password
 */
const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw createValidationError('Current password and new password are required');
  }

  if (newPassword !== confirmPassword) {
    throw createValidationError('New passwords do not match');
  }

  await authService.changePassword(req.user.id, currentPassword, newPassword, req);

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

/**
 * Enable 2FA for user
 * POST /api/v1/auth/enable-2fa
 */
const enableTwoFactor = catchAsync(async (req, res) => {
  const result = await authService.enableTwoFactor(req.user.id, req);

  res.status(200).json({
    success: true,
    message: '2FA setup initiated',
    data: {
      secret: result.secret,
      qrCode: result.qrCode,
      backupCodes: result.backupCodes,
      note: 'Please scan the QR code with your authenticator app and verify with the verification endpoint.',
    },
  });
});

/**
 * Verify and enable 2FA
 * POST /api/v1/auth/verify-2fa-setup
 */
const verifyAndEnableTwoFactor = catchAsync(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    throw createValidationError('Verification code is required');
  }

  const result = await authService.verifyAndEnableTwoFactor(req.user.id, code, req);

  res.status(200).json({
    success: true,
    message: '2FA enabled successfully',
    data: {
      backupCodes: result.backupCodes,
      note: 'Please store your backup codes in a safe place. They will not be shown again.',
    },
  });
});

/**
 * Disable 2FA for user
 * POST /api/v1/auth/disable-2fa
 */
const disableTwoFactor = catchAsync(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    throw createValidationError('Verification code is required');
  }

  await authService.disableTwoFactor(req.user.id, code, req);

  res.status(200).json({
    success: true,
    message: '2FA disabled successfully',
  });
});

/**
 * Generate new backup codes
 * POST /api/v1/auth/generate-backup-codes
 */
const generateBackupCodes = catchAsync(async (req, res) => {
  const backupCodes = await authService.generateBackupCodes(req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Backup codes generated successfully',
    data: {
      backupCodes: backupCodes,
      note: 'Please store your backup codes in a safe place. They will not be shown again.',
    },
  });
});

/**
 * OAuth - Redirect to provider
 * GET /api/v1/auth/oauth/:provider
 */
const oauthRedirect = catchAsync(async (req, res) => {
  const { provider } = req.params;

  // This endpoint will be handled by Passport.js
  // The actual redirect is configured in passport.js
  res.status(400).json({
    success: false,
    message: 'Please use the OAuth endpoint with Passport.js',
  });
});

/**
 * OAuth - Callback from provider
 * GET /api/v1/auth/oauth/:provider/callback
 */
const oauthCallback = catchAsync(async (req, res) => {
  // This is handled by Passport.js
  // The user is attached to req.user by Passport
  // We need to generate tokens and redirect

  if (!req.user) {
    return res.redirect(`${process.env.APP_URL}/signin?error=oauth_failed`);
  }

  const tokens = authService.generateTokenPair(req.user);

  // Create session
  await authService.createSession(req.user.id, tokens.refresh.token, req);

  // Redirect to frontend with tokens
  const redirectUrl = `${process.env.APP_URL}/oauth-callback?access_token=${tokens.access.token}&refresh_token=${tokens.refresh.token}&user_id=${req.user.id}`;

  res.redirect(redirectUrl);
});

/**
 * Get current user profile
 * GET /api/v1/auth/me
 */
const getMe = catchAsync(async (req, res) => {
  const user = await userService.getUserProfile(req.user.id, {
    includeWallet: true,
    includeStats: true,
  });

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
});

/**
 * Check if email is available
 * GET /api/v1/auth/check-email
 */
const checkEmailAvailability = catchAsync(async (req, res) => {
  const { email } = req.query;

  if (!email) {
    throw createValidationError('Email is required');
  }

  const user = await userService.getUserByEmail(email);
  const available = !user;

  res.status(200).json({
    success: true,
    data: {
      email,
      available,
    },
  });
});

// Export all controller methods
module.exports = {
  register,
  login,
  verifyTwoFactor,
  refreshToken,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  changePassword,
  enableTwoFactor,
  verifyAndEnableTwoFactor,
  disableTwoFactor,
  generateBackupCodes,
  oauthRedirect,
  oauthCallback,
  getMe,
  checkEmailAvailability,
};
