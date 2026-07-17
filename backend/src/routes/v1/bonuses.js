/**
 * Bonus Routes - Bonus & Reward API Routes
 * CephasGM GameZone
 * 
 * This module defines all bonus-related API routes including:
 * - Bonus listing (available, active, claimed, expired)
 * - Bonus claiming
 * - Wagering progress tracking
 * - Bonus statistics
 * - Bonus history
 * - Admin bonus management (create, forfeit, expire)
 * - Bonus validation and eligibility checks
 * 
 * All routes are mounted under /api/v1/bonuses
 */

const express = require('express');
const router = express.Router();

// Import controllers
const bonusController = require('../../controllers/bonusController');

// Import middleware
const { authenticate } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../../middleware/admin');
const { bonusRateLimit } = require('../../middleware/rateLimit');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// BONUS RETRIEVAL ROUTES
// ============================================

/**
 * @route   GET /api/v1/bonuses/available
 * @desc    Get available bonuses for current user
 * @access  Private
 */
router.get(
  '/available',
  authenticate,
  bonusController.getAvailableBonuses
);

/**
 * @route   GET /api/v1/bonuses/history
 * @desc    Get user bonuses history
 * @access  Private
 */
router.get(
  '/history',
  authenticate,
  bonusController.getUserBonuses
);

/**
 * @route   GET /api/v1/bonuses/active
 * @desc    Get active bonuses for current user
 * @access  Private
 */
router.get(
  '/active',
  authenticate,
  bonusController.getActiveBonuses
);

/**
 * @route   GET /api/v1/bonuses/summary
 * @desc    Get bonus summary for current user
 * @access  Private
 */
router.get(
  '/summary',
  authenticate,
  bonusController.getBonusSummary
);

/**
 * @route   GET /api/v1/bonuses/stats
 * @desc    Get bonus statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  bonusController.getBonusStats
);

/**
 * @route   GET /api/v1/bonuses/:bonusId
 * @desc    Get bonus by ID
 * @access  Private
 */
router.get(
  '/:bonusId',
  authenticate,
  validateParams(validationSchemas.idParam),
  bonusController.getBonusById
);

// ============================================
// BONUS WAGERING PROGRESS ROUTES
// ============================================

/**
 * @route   GET /api/v1/bonuses/:bonusId/wagering
 * @desc    Get wagering progress for a bonus
 * @access  Private
 */
router.get(
  '/:bonusId/wagering',
  authenticate,
  validateParams(validationSchemas.idParam),
  bonusController.getWageringProgress
);

// ============================================
// BONUS CLAIMING ROUTES
// ============================================

/**
 * @route   POST /api/v1/bonuses/claim/:bonusId
 * @desc    Claim a bonus
 * @access  Private
 */
router.post(
  '/claim/:bonusId',
  authenticate,
  bonusRateLimit('claim'),
  validateParams(validationSchemas.idParam),
  bonusController.claimBonus
);

/**
 * @route   GET /api/v1/bonuses/:bonusId/check
 * @desc    Check bonus availability before claiming
 * @access  Private
 */
router.get(
  '/:bonusId/check',
  authenticate,
  validateParams(validationSchemas.idParam),
  bonusController.checkBonusAvailability
);

/**
 * @route   GET /api/v1/bonuses/validate/:type
 * @desc    Validate bonus eligibility for a type
 * @access  Private
 */
router.get(
  '/validate/:type',
  authenticate,
  bonusController.validateBonusEligibility
);

// ============================================
// ADMIN BONUS CREATION ROUTES
// ============================================

/**
 * @route   POST /api/v1/bonuses/admin/create
 * @desc    Create a bonus (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/create',
  authenticate,
  requireAdmin,
  sanitize({ strategy: 'strict' }),
  bonusController.createBonus
);

/**
 * @route   POST /api/v1/bonuses/admin/welcome/:userId
 * @desc    Create welcome bonus for a user (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/welcome/:userId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  bonusController.createWelcomeBonus
);

/**
 * @route   POST /api/v1/bonuses/admin/deposit/:userId
 * @desc    Create deposit bonus for a user (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/deposit/:userId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  sanitize({ strategy: 'strict' }),
  bonusController.createDepositBonus
);

/**
 * @route   POST /api/v1/bonuses/admin/vip/:userId
 * @desc    Create VIP bonus for a user (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/vip/:userId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  sanitize({ strategy: 'strict' }),
  bonusController.createVipBonus
);

/**
 * @route   POST /api/v1/bonuses/admin/referral
 * @desc    Create referral bonus (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/referral',
  authenticate,
  requireAdmin,
  sanitize({ strategy: 'strict' }),
  bonusController.createReferralBonus
);

/**
 * @route   POST /api/v1/bonuses/admin/birthday/:userId
 * @desc    Create birthday bonus for a user (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/birthday/:userId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  bonusController.createBirthdayBonus
);

// ============================================
// ADMIN BONUS MANAGEMENT ROUTES
// ============================================

/**
 * @route   GET /api/v1/bonuses/admin/all
 * @desc    Get all bonuses (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/all',
  authenticate,
  requireAdmin,
  bonusController.getAllBonuses
);

/**
 * @route   GET /api/v1/bonuses/admin/stats
 * @desc    Get bonus statistics (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/stats',
  authenticate,
  requireAdmin,
  bonusController.getAdminBonusStats
);

/**
 * @route   POST /api/v1/bonuses/admin/forfeit/:bonusId
 * @desc    Forfeit a bonus (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/forfeit/:bonusId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  bonusController.forfeitBonus
);

/**
 * @route   POST /api/v1/bonuses/admin/expire
 * @desc    Expire bonuses (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/expire',
  authenticate,
  requireAdmin,
  bonusController.expireBonuses
);

// ============================================
// INTERNAL SERVICE ROUTES (API Key required)
// ============================================

/**
 * @route   GET /api/v1/bonuses/internal/:userId
 * @desc    Internal bonus lookup (for microservices)
 * @access  Internal (API Key)
 */
router.get(
  '/internal/:userId',
  authenticate,
  validateParams(validationSchemas.userIdParam),
  bonusController.getActiveBonuses
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
