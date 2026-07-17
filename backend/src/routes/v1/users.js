/**
 * User Routes - User Management API Routes
 * CephasGM GameZone
 * 
 * This module defines all user-related API routes including:
 * - User profile management
 * - User preferences and settings
 * - User statistics and activity
 * - VIP tier management
 * - KYC status
 * - Session management
 * - Admin user management endpoints (admin only)
 * 
 * All routes are mounted under /api/v1/users
 */

const express = require('express');
const router = express.Router();

// Import controllers
const userController = require('../../controllers/userController');

// Import middleware
const { authenticate, authenticateApiKey } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin, requirePermission, PERMISSIONS } = require('../../middleware/admin');
const { userRateLimit } = require('../../middleware/rateLimit');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// Import validation schemas
const { schemas } = require('../../utils/validators');

// ============================================
// USER PROFILE ROUTES
// ============================================

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  userController.getProfile
);

/**
 * @route   PUT /api/v1/users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put(
  '/me',
  authenticate,
  userRateLimit('update'),
  sanitize({ strategy: 'strict' }),
  userController.updateProfile
);

/**
 * @route   PUT /api/v1/users/me/avatar
 * @desc    Update user avatar
 * @access  Private
 */
router.put(
  '/me/avatar',
  authenticate,
  userRateLimit('update'),
  sanitize({ strategy: 'strict' }),
  userController.updateAvatar
);

/**
 * @route   DELETE /api/v1/users/me
 * @desc    Delete user account
 * @access  Private
 */
router.delete(
  '/me',
  authenticate,
  userRateLimit('update'),
  userController.deleteAccount
);

/**
 * @route   POST /api/v1/users/me/reactivate
 * @desc    Reactivate deleted account
 * @access  Private
 */
router.post(
  '/me/reactivate',
  userController.reactivateAccount
);

// ============================================
// USER STATISTICS ROUTES
// ============================================

/**
 * @route   GET /api/v1/users/me/stats
 * @desc    Get user statistics
 * @access  Private
 */
router.get(
  '/me/stats',
  authenticate,
  userController.getUserStats
);

/**
 * @route   GET /api/v1/users/me/activity
 * @desc    Get user activity history
 * @access  Private
 */
router.get(
  '/me/activity',
  authenticate,
  userController.getUserActivity
);

// ============================================
// USER PREFERENCES ROUTES
// ============================================

/**
 * @route   GET /api/v1/users/me/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get(
  '/me/preferences',
  authenticate,
  userController.getPreferences
);

/**
 * @route   PUT /api/v1/users/me/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put(
  '/me/preferences',
  authenticate,
  userRateLimit('update'),
  sanitize({ strategy: 'strict' }),
  userController.updatePreferences
);

/**
 * @route   PUT /api/v1/users/me/preferences/notifications
 * @desc    Update notification preferences
 * @access  Private
 */
router.put(
  '/me/preferences/notifications',
  authenticate,
  userRateLimit('update'),
  sanitize({ strategy: 'strict' }),
  userController.updateNotificationPreferences
);

// ============================================
// VIP TIER ROUTES
// ============================================

/**
 * @route   GET /api/v1/users/me/vip-benefits
 * @desc    Get VIP tier benefits
 * @access  Private
 */
router.get(
  '/me/vip-benefits',
  authenticate,
  userController.getVipBenefits
);

/**
 * @route   POST /api/v1/users/me/vip-check
 * @desc    Check if VIP tier can be upgraded
 * @access  Private
 */
router.post(
  '/me/vip-check',
  authenticate,
  userController.checkVipUpgrade
);

// ============================================
// KYC ROUTES (Basic status)
// ============================================

/**
 * @route   GET /api/v1/users/me/kyc
 * @desc    Get KYC status
 * @access  Private
 */
router.get(
  '/me/kyc',
  authenticate,
  userController.getKycStatus
);

// ============================================
// SESSION MANAGEMENT ROUTES
// ============================================

/**
 * @route   GET /api/v1/users/me/sessions
 * @desc    Get active sessions
 * @access  Private
 */
router.get(
  '/me/sessions',
  authenticate,
  userController.getSessions
);

/**
 * @route   DELETE /api/v1/users/me/sessions/:sessionId
 * @desc    Terminate a session
 * @access  Private
 */
router.delete(
  '/me/sessions/:sessionId',
  authenticate,
  validateParams(validationSchemas.idParam),
  userController.terminateSession
);

/**
 * @route   DELETE /api/v1/users/me/sessions
 * @desc    Terminate all sessions (except current)
 * @access  Private
 */
router.delete(
  '/me/sessions',
  authenticate,
  userController.terminateAllSessions
);

// ============================================
// ADMIN USER MANAGEMENT ROUTES
// ============================================

/**
 * @route   GET /api/v1/users/admin/search
 * @desc    Search users (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/search',
  authenticate,
  requireAdmin,
  userController.searchUsers
);

/**
 * @route   GET /api/v1/users/admin/vip/:tier
 * @desc    Get users by VIP tier (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/vip/:tier',
  authenticate,
  requireAdmin,
  userController.getUsersByVipTier
);

/**
 * @route   GET /api/v1/users/admin/kyc/:status
 * @desc    Get users by KYC status (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/kyc/:status',
  authenticate,
  requireAdmin,
  userController.getUsersByKycStatus
);

// ============================================
// USER LOOKUP ROUTES (With authentication)
// ============================================

/**
 * @route   GET /api/v1/users/:userId
 * @desc    Get user by ID (self or admin)
 * @access  Private
 */
router.get(
  '/:userId',
  authenticate,
  validateParams(validationSchemas.userIdParam),
  userController.getUserById
);

// ============================================
// INTERNAL SERVICE ROUTES (API Key required)
// ============================================

/**
 * @route   GET /api/v1/users/internal/:userId
 * @desc    Internal user lookup (for microservices)
 * @access  Internal (API Key)
 */
router.get(
  '/internal/:userId',
  authenticateApiKey,
  validateParams(validationSchemas.userIdParam),
  userController.getUserById
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
