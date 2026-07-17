/**
 * Bet Routes - Betting API Routes
 * CephasGM GameZone
 * 
 * This module defines all betting-related API routes including:
 * - Place bets (single, accumulator, system)
 * - Validate bets (pre-check odds)
 * - Cash out bets
 * - Bet history and filtering
 * - Active and live bets
 * - Bet statistics and summary
 * - Admin bet operations (void, settle)
 * - Match bet tracking (admin)
 * 
 * All routes are mounted under /api/v1/bets
 */

const express = require('express');
const router = express.Router();

// Import controllers
const betController = require('../../controllers/betController');

// Import middleware
const { authenticate } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../../middleware/admin');
const { betRateLimit } = require('../../middleware/rateLimit');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// BET PLACEMENT ROUTES
// ============================================

/**
 * @route   POST /api/v1/bets/place
 * @desc    Place a bet
 * @access  Private
 */
router.post(
  '/place',
  authenticate,
  betRateLimit('place'),
  sanitize({ strategy: 'strict' }),
  betController.placeBet
);

/**
 * @route   POST /api/v1/bets/place/validate
 * @desc    Validate a bet before placing (check odds)
 * @access  Private
 */
router.post(
  '/place/validate',
  authenticate,
  betRateLimit('place'),
  sanitize({ strategy: 'strict' }),
  betController.validateBet
);

// ============================================
// CASH OUT ROUTES
// ============================================

/**
 * @route   POST /api/v1/bets/cashout/:betId
 * @desc    Cash out a bet
 * @access  Private
 */
router.post(
  '/cashout/:betId',
  authenticate,
  betRateLimit('cashout'),
  validateParams(validationSchemas.betIdParam),
  betController.cashOutBet
);

/**
 * @route   GET /api/v1/bets/:betId/cashout-info
 * @desc    Get cash out availability and amount
 * @access  Private
 */
router.get(
  '/:betId/cashout-info',
  authenticate,
  validateParams(validationSchemas.betIdParam),
  betController.getCashOutInfo
);

// ============================================
// BET RETRIEVAL ROUTES
// ============================================

/**
 * @route   GET /api/v1/bets/history
 * @desc    Get bet history
 * @access  Private
 */
router.get(
  '/history',
  authenticate,
  betController.getBetHistory
);

/**
 * @route   GET /api/v1/bets/active
 * @desc    Get active bets
 * @access  Private
 */
router.get(
  '/active',
  authenticate,
  betController.getActiveBets
);

/**
 * @route   GET /api/v1/bets/live
 * @desc    Get live bets
 * @access  Private
 */
router.get(
  '/live',
  authenticate,
  betController.getLiveBets
);

/**
 * @route   GET /api/v1/bets/settled
 * @desc    Get settled bets
 * @access  Private
 */
router.get(
  '/settled',
  authenticate,
  betController.getSettledBets
);

/**
 * @route   GET /api/v1/bets/:betId
 * @desc    Get bet by ID
 * @access  Private
 */
router.get(
  '/:betId',
  authenticate,
  validateParams(validationSchemas.betIdParam),
  betController.getBetById
);

// ============================================
// BET STATISTICS ROUTES
// ============================================

/**
 * @route   GET /api/v1/bets/stats
 * @desc    Get bet statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  betController.getBetStats
);

/**
 * @route   GET /api/v1/bets/summary
 * @desc    Get bet summary
 * @access  Private
 */
router.get(
  '/summary',
  authenticate,
  betController.getBetSummary
);

// ============================================
// ADMIN BET OPERATIONS
// ============================================

/**
 * @route   POST /api/v1/bets/admin/void/:betId
 * @desc    Void a bet (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/void/:betId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.betIdParam),
  sanitize({ strategy: 'strict' }),
  betController.voidBet
);

/**
 * @route   POST /api/v1/bets/admin/settle/:betId
 * @desc    Settle a bet (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/settle/:betId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.betIdParam),
  sanitize({ strategy: 'strict' }),
  betController.settleBet
);

/**
 * @route   GET /api/v1/bets/admin/match/:matchId
 * @desc    Get bets by match (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/match/:matchId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.matchIdParam),
  betController.getBetsByMatch
);

/**
 * @route   GET /api/v1/bets/admin/match/:matchId/volume
 * @desc    Get bet volume for a match (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/match/:matchId/volume',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.matchIdParam),
  betController.getMatchBetVolume
);

/**
 * @route   GET /api/v1/bets/admin/match/:matchId/selection/:selection
 * @desc    Get bets by match and selection (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/match/:matchId/selection/:selection',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.matchIdParam),
  betController.getBetsByMatchAndSelection
);

// ============================================
// INTERNAL SERVICE ROUTES (API Key required)
// ============================================

/**
 * @route   GET /api/v1/bets/internal/user/:userId
 * @desc    Internal bet lookup for user (for microservices)
 * @access  Internal (API Key)
 */
router.get(
  '/internal/user/:userId',
  authenticate,
  validateParams(validationSchemas.userIdParam),
  betController.getBetHistory
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
