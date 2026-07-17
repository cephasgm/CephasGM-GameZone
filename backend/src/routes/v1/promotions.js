/**
 * Promotion Routes - Promotional Campaign API Routes
 * CephasGM GameZone
 * 
 * This module defines all promotion-related API routes including:
 * - Promotion listing (active, upcoming, featured)
 * - Promotion details by ID or slug
 * - User-specific promotions
 * - Promotion interaction tracking (click, conversion)
 * - Promotion eligibility checks
 * - Promotion statistics and performance
 * - Admin promotion management (create, update, delete, publish, pause)
 * 
 * All routes are mounted under /api/v1/promotions
 */

const express = require('express');
const router = express.Router();

// Import controllers
const promotionController = require('../../controllers/promotionController');

// Import middleware
const { authenticate, optionalAuthenticate } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../../middleware/admin');
const { promotionRateLimit } = require('../../middleware/rateLimit');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// PUBLIC PROMOTION RETRIEVAL ROUTES
// ============================================

/**
 * @route   GET /api/v1/promotions/active
 * @desc    Get active promotions
 * @access  Public
 */
router.get(
  '/active',
  promotionController.getActivePromotions
);

/**
 * @route   GET /api/v1/promotions/featured
 * @desc    Get featured promotions
 * @access  Public
 */
router.get(
  '/featured',
  promotionController.getFeaturedPromotions
);

/**
 * @route   GET /api/v1/promotions/upcoming
 * @desc    Get upcoming promotions
 * @access  Public
 */
router.get(
  '/upcoming',
  promotionController.getUpcomingPromotions
);

/**
 * @route   GET /api/v1/promotions/type/:type
 * @desc    Get promotions by type
 * @access  Public
 */
router.get(
  '/type/:type',
  promotionController.getPromotionsByType
);

/**
 * @route   GET /api/v1/promotions/:promotionId
 * @desc    Get promotion by ID
 * @access  Public
 */
router.get(
  '/:promotionId',
  optionalAuthenticate,
  validateParams(validationSchemas.idParam),
  promotionController.getPromotionById
);

/**
 * @route   GET /api/v1/promotions/slug/:slug
 * @desc    Get promotion by slug
 * @access  Public
 */
router.get(
  '/slug/:slug',
  optionalAuthenticate,
  promotionController.getPromotionBySlug
);

// ============================================
// USER PROMOTION ROUTES (Protected)
// ============================================

/**
 * @route   GET /api/v1/promotions/user
 * @desc    Get promotions for current user
 * @access  Private
 */
router.get(
  '/user',
  authenticate,
  promotionController.getUserPromotions
);

/**
 * @route   GET /api/v1/promotions/:promotionId/eligible
 * @desc    Check if user is eligible for a promotion
 * @access  Private
 */
router.get(
  '/:promotionId/eligible',
  authenticate,
  validateParams(validationSchemas.idParam),
  promotionController.checkPromotionEligibility
);

// ============================================
// PROMOTION INTERACTION ROUTES
// ============================================

/**
 * @route   POST /api/v1/promotions/:promotionId/click
 * @desc    Record a promotion click
 * @access  Public
 */
router.post(
  '/:promotionId/click',
  optionalAuthenticate,
  validateParams(validationSchemas.idParam),
  promotionController.recordPromotionClick
);

/**
 * @route   POST /api/v1/promotions/:promotionId/convert
 * @desc    Record a promotion conversion
 * @access  Private
 */
router.post(
  '/:promotionId/convert',
  authenticate,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  promotionController.recordPromotionConversion
);

// ============================================
// PROMOTION STATISTICS ROUTES
// ============================================

/**
 * @route   GET /api/v1/promotions/stats
 * @desc    Get promotion statistics overview
 * @access  Private/Admin
 */
router.get(
  '/stats',
  authenticate,
  requireAdmin,
  promotionController.getPromotionStats
);

/**
 * @route   GET /api/v1/promotions/:promotionId/performance
 * @desc    Get promotion performance stats
 * @access  Private/Admin
 */
router.get(
  '/:promotionId/performance',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  promotionController.getPromotionPerformance
);

// ============================================
// ADMIN PROMOTION MANAGEMENT ROUTES
// ============================================

/**
 * @route   POST /api/v1/promotions/admin
 * @desc    Create a promotion (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin',
  authenticate,
  requireAdmin,
  sanitize({ strategy: 'strict' }),
  promotionController.createPromotion
);

/**
 * @route   PUT /api/v1/promotions/admin/:promotionId
 * @desc    Update a promotion (admin only)
 * @access  Private/Admin
 */
router.put(
  '/admin/:promotionId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  promotionController.updatePromotion
);

/**
 * @route   DELETE /api/v1/promotions/admin/:promotionId
 * @desc    Delete a promotion (admin only)
 * @access  Private/Admin
 */
router.delete(
  '/admin/:promotionId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  promotionController.deletePromotion
);

/**
 * @route   POST /api/v1/promotions/admin/:promotionId/publish
 * @desc    Publish a promotion (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/:promotionId/publish',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  promotionController.publishPromotion
);

/**
 * @route   POST /api/v1/promotions/admin/:promotionId/pause
 * @desc    Pause a promotion (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/:promotionId/pause',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  promotionController.pausePromotion
);

/**
 * @route   GET /api/v1/promotions/admin/all
 * @desc    Get all promotions (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/all',
  authenticate,
  requireAdmin,
  promotionController.getAllPromotionsAdmin
);

// ============================================
// INTERNAL SERVICE ROUTES (API Key required)
// ============================================

/**
 * @route   GET /api/v1/promotions/internal/:promotionId
 * @desc    Internal promotion lookup (for microservices)
 * @access  Internal (API Key)
 */
router.get(
  '/internal/:promotionId',
  authenticate,
  validateParams(validationSchemas.idParam),
  promotionController.getPromotionById
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
