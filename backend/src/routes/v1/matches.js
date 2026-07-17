/**
 * Match Routes - Match & Odds API Routes
 * CephasGM GameZone
 * 
 * This module defines all match-related API routes including:
 * - Match listings (live, upcoming, featured, by date)
 * - Match details and odds
 * - Match search
 * - Match statistics and events
 * - Live match updates
 * - Admin match management (create, update, delete)
 * - Live match status management (start, end, score updates)
 * - Odds management (update, batch update)
 * - Match event management
 * 
 * All routes are mounted under /api/v1/matches
 */

const express = require('express');
const router = express.Router();

// Import controllers
const matchController = require('../../controllers/matchController');

// Import middleware
const { authenticate, optionalAuthenticate } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../../middleware/admin');
const { matchRateLimit } = require('../../middleware/rateLimit');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// PUBLIC MATCH RETRIEVAL ROUTES
// ============================================

/**
 * @route   GET /api/v1/matches/live
 * @desc    Get live matches
 * @access  Public
 */
router.get(
  '/live',
  matchRateLimit('live'),
  matchController.getLiveMatches
);

/**
 * @route   GET /api/v1/matches/upcoming
 * @desc    Get upcoming matches
 * @access  Public
 */
router.get(
  '/upcoming',
  matchController.getUpcomingMatches
);

/**
 * @route   GET /api/v1/matches/date
 * @desc    Get matches by date
 * @access  Public
 */
router.get(
  '/date',
  matchController.getMatchesByDate
);

/**
 * @route   GET /api/v1/matches/featured
 * @desc    Get featured matches
 * @access  Public
 */
router.get(
  '/featured',
  matchController.getFeaturedMatches
);

/**
 * @route   GET /api/v1/matches/search
 * @desc    Search matches
 * @access  Public
 */
router.get(
  '/search',
  matchController.searchMatches
);

/**
 * @route   GET /api/v1/matches/:matchId
 * @desc    Get match by ID
 * @access  Public
 */
router.get(
  '/:matchId',
  matchRateLimit('list'),
  validateParams(validationSchemas.matchIdParam),
  matchController.getMatchById
);

/**
 * @route   GET /api/v1/matches/:matchId/odds
 * @desc    Get match odds
 * @access  Public
 */
router.get(
  '/:matchId/odds',
  matchRateLimit('odds'),
  validateParams(validationSchemas.matchIdParam),
  matchController.getMatchOdds
);

/**
 * @route   GET /api/v1/matches/:matchId/statistics
 * @desc    Get match statistics
 * @access  Public
 */
router.get(
  '/:matchId/statistics',
  validateParams(validationSchemas.matchIdParam),
  matchController.getMatchStatistics
);

/**
 * @route   GET /api/v1/matches/:matchId/events
 * @desc    Get match events
 * @access  Public
 */
router.get(
  '/:matchId/events',
  validateParams(validationSchemas.matchIdParam),
  matchController.getMatchEvents
);

// ============================================
// LIVE MATCH UPDATES (Public)
// ============================================

/**
 * @route   GET /api/v1/matches/live/updates
 * @desc    Get live match updates (polling)
 * @access  Public
 */
router.get(
  '/live/updates',
  matchRateLimit('live'),
  matchController.getLiveUpdates
);

// ============================================
// ADMIN MATCH MANAGEMENT ROUTES
// ============================================

/**
 * @route   POST /api/v1/matches/admin
 * @desc    Create a match (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin',
  authenticate,
  requireAdmin,
  sanitize({ strategy: 'strict' }),
  matchController.createMatch
);

/**
 * @route   PUT /api/v1/matches/admin/:matchId
 * @desc    Update a match (admin only)
 * @access  Private/Admin
 */
router.put(
  '/admin/:matchId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.matchIdParam),
  sanitize({ strategy: 'strict' }),
  matchController.updateMatch
);

/**
 * @route   DELETE /api/v1/matches/admin/:matchId
 * @desc    Delete a match (admin only)
 * @access  Private/Admin
 */
router.delete(
  '/admin/:matchId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.matchIdParam),
  matchController.deleteMatch
);

// ============================================
// ADMIN ODDS MANAGEMENT ROUTES
// ============================================

/**
 * @route   PUT /api/v1/matches/admin/:matchId/odds
 * @desc    Update match odds (admin only)
 * @access  Private/Admin
 */
router.put(
  '/admin/:matchId/odds',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.matchIdParam),
  sanitize({ strategy: 'strict' }),
  matchController.updateMatchOdds
);

/**
 * @route   POST /api/v1/matches/admin/odds/batch
 * @desc    Batch update odds (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/odds/batch',
  authenticate,
  requireAdmin,
  sanitize({ strategy: 'strict' }),
  matchController.batchUpdateOdds
);

// ============================================
// ADMIN LIVE MATCH MANAGEMENT ROUTES
// ============================================

/**
 * @route   POST /api/v1/matches/admin/:matchId/start
 * @desc    Start a match (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/:matchId/start',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.matchIdParam),
  matchController.startMatch
);

/**
 * @route   POST /api/v1/matches/admin/:matchId/end
 * @desc    End a match (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/:matchId/end',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.matchIdParam),
  matchController.endMatch
);

/**
 * @route   PUT /api/v1/matches/admin/:matchId/score
 * @desc    Update live score (admin only)
 * @access  Private/Admin
 */
router.put(
  '/admin/:matchId/score',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.matchIdParam),
  sanitize({ strategy: 'strict' }),
  matchController.updateLiveScore
);

/**
 * @route   POST /api/v1/matches/admin/:matchId/events
 * @desc    Add match event (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/:matchId/events',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.matchIdParam),
  sanitize({ strategy: 'strict' }),
  matchController.addMatchEvent
);

/**
 * @route   PUT /api/v1/matches/admin/:matchId/statistics
 * @desc    Update match statistics (admin only)
 * @access  Private/Admin
 */
router.put(
  '/admin/:matchId/statistics',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.matchIdParam),
  sanitize({ strategy: 'strict' }),
  matchController.updateMatchStatistics
);

// ============================================
// INTERNAL SERVICE ROUTES (API Key required)
// ============================================

/**
 * @route   GET /api/v1/matches/internal/:matchId
 * @desc    Internal match lookup (for microservices)
 * @access  Internal (API Key)
 */
router.get(
  '/internal/:matchId',
  authenticate,
  validateParams(validationSchemas.matchIdParam),
  matchController.getMatchById
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
