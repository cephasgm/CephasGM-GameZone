/**
 * Auth Routes - Authentication API Routes
 * CephasGM GameZone
 * 
 * This module defines all authentication-related API routes including:
 * - User registration and login
 * - Email verification
 * - Password reset
 * - Two-factor authentication
 * - OAuth authentication
 * - Token management
 * - User session management
 * 
 * All routes are mounted under /api/v1/auth
 */

const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../../controllers/authController');
const userController = require('../../controllers/userController');

// Import middleware
const { authenticate, validateRefreshToken, userRateLimit } = require('../../middleware/auth');
const { authRateLimit } = require('../../middleware/rateLimit');
const { validateBody, validateQuery } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// Import validation schemas
const { schemas } = require('../../utils/validators');

// ============================================
// AUTHENTICATION ROUTES
// ============================================

// --------------------------------------------
// Public Routes (No Authentication Required)
// --------------------------------------------

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
  '/register',
  authRateLimit('register'),
  sanitize({ strategy: 'strict' }),
  authController.register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  authRateLimit('login'),
  sanitize({ strategy: 'strict' }),
  authController.login
);

/**
 * @route   POST /api/v1/auth/verify-2fa
 * @desc    Verify two-factor authentication during login
 * @access  Public
 */
router.post(
  '/verify-2fa',
  authRateLimit('twoFactor'),
  sanitize({ strategy: 'strict' }),
  authController.verifyTwoFactor
);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public (requires refresh token)
 */
router.post(
  '/refresh',
  authRateLimit('refresh'),
  sanitize({ strategy: 'strict' }),
  validateRefreshToken,
  authController.refreshToken
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (blacklist tokens)
 * @access  Public (requires access token)
 */
router.post(
  '/logout',
  authenticate,
  authController.logout
);

/**
 * @route   POST /api/v1/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post(
  '/verify-email',
  authRateLimit('verify'),
  sanitize({ strategy: 'strict' }),
  authController.verifyEmail
);

/**
 * @route   POST /api/v1/auth/resend-verification
 * @desc    Resend email verification
 * @access  Public
 */
router.post(
  '/resend-verification',
  authRateLimit('verify'),
  sanitize({ strategy: 'strict' }),
  authController.resendVerification
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  '/forgot-password',
  authRateLimit('reset'),
  sanitize({ strategy: 'strict' }),
  authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 */
router.post(
  '/reset-password',
  authRateLimit('reset'),
  sanitize({ strategy: 'strict' }),
  authController.resetPassword
);

/**
 * @route   GET /api/v1/auth/check-email
 * @desc    Check if email is available
 * @access  Public
 */
router.get(
  '/check-email',
  authRateLimit('register'),
  validateQuery(schemas.emailCheck),
  authController.checkEmailAvailability
);

// --------------------------------------------
// OAuth Routes (Public)
// --------------------------------------------

/**
 * @route   GET /api/v1/auth/oauth/:provider
 * @desc    Redirect to OAuth provider
 * @access  Public
 */
router.get(
  '/oauth/:provider',
  authController.oauthRedirect
);

/**
 * @route   GET /api/v1/auth/oauth/:provider/callback
 * @desc    OAuth callback from provider
 * @access  Public
 */
router.get(
  '/oauth/:provider/callback',
  authController.oauthCallback
);

// --------------------------------------------
// Protected Routes (Authentication Required)
// --------------------------------------------

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  authController.getMe
);

/**
 * @route   PUT /api/v1/auth/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put(
  '/me',
  authenticate,
  sanitize({ strategy: 'strict' }),
  userController.updateProfile
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  userRateLimit('update'),
  sanitize({ strategy: 'strict' }),
  authController.changePassword
);

// --------------------------------------------
// Two-Factor Authentication Routes (Protected)
// --------------------------------------------

/**
 * @route   POST /api/v1/auth/enable-2fa
 * @desc    Enable two-factor authentication (initiate setup)
 * @access  Private
 */
router.post(
  '/enable-2fa',
  authenticate,
  userRateLimit('update'),
  authController.enableTwoFactor
);

/**
 * @route   POST /api/v1/auth/verify-2fa-setup
 * @desc    Verify and enable two-factor authentication
 * @access  Private
 */
router.post(
  '/verify-2fa-setup',
  authenticate,
  userRateLimit('update'),
  sanitize({ strategy: 'strict' }),
  authController.verifyAndEnableTwoFactor
);

/**
 * @route   POST /api/v1/auth/disable-2fa
 * @desc    Disable two-factor authentication
 * @access  Private
 */
router.post(
  '/disable-2fa',
  authenticate,
  userRateLimit('update'),
  sanitize({ strategy: 'strict' }),
  authController.disableTwoFactor
);

/**
 * @route   POST /api/v1/auth/generate-backup-codes
 * @desc    Generate new 2FA backup codes
 * @access  Private
 */
router.post(
  '/generate-backup-codes',
  authenticate,
  userRateLimit('update'),
  authController.generateBackupCodes
);

// --------------------------------------------
// Session Management Routes (Protected)
// --------------------------------------------

/**
 * @route   GET /api/v1/auth/sessions
 * @desc    Get all active sessions for current user
 * @access  Private
 */
router.get(
  '/sessions',
  authenticate,
  userController.getSessions
);

/**
 * @route   DELETE /api/v1/auth/sessions/:sessionId
 * @desc    Terminate a specific session
 * @access  Private
 */
router.delete(
  '/sessions/:sessionId',
  authenticate,
  userController.terminateSession
);

/**
 * @route   DELETE /api/v1/auth/sessions
 * @desc    Terminate all sessions (except current)
 * @access  Private
 */
router.delete(
  '/sessions',
  authenticate,
  userController.terminateAllSessions
);

// --------------------------------------------
// Account Management Routes (Protected)
// --------------------------------------------

/**
 * @route   DELETE /api/v1/auth/account
 * @desc    Delete user account (soft delete)
 * @access  Private
 */
router.delete(
  '/account',
  authenticate,
  userRateLimit('update'),
  sanitize({ strategy: 'strict' }),
  userController.deleteAccount
);

/**
 * @route   POST /api/v1/auth/account/reactivate
 * @desc    Reactivate deleted account (within grace period)
 * @access  Private
 */
router.post(
  '/account/reactivate',
  userRateLimit('update'),
  userController.reactivateAccount
);

// ============================================
// ADMIN AUTH ROUTES (Protected)
// ============================================

// These routes are defined in admin.js to keep auth routes clean
// Admin-related auth routes are in admin.js

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
