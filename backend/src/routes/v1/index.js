/**
 * Routes Index - Main Router Aggregator
 * CephasGM GameZone
 * 
 * This file aggregates all route modules and exports a single router
 * with all API routes mounted under /api/v1.
 * 
 * It provides a clean, organized structure for all API endpoints
 * with proper middleware configuration for each route group.
 */

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const walletRoutes = require('./wallet');
const betRoutes = require('./bets');
const matchRoutes = require('./matches');
const paymentRoutes = require('./payments');
const bonusRoutes = require('./bonuses');
const promotionRoutes = require('./promotions');
const notificationRoutes = require('./notifications');
const messageRoutes = require('./messages');
const supportRoutes = require('./support');
const adminRoutes = require('./admin');
const reportRoutes = require('./reports');
const kycRoutes = require('./kyc');

// Import middleware
const { authenticate } = require('../../middleware/auth');
const { userRateLimit, globalRateLimit } = require('../../middleware/rateLimit');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// MOUNT ROUTES
// ============================================

/**
 * API Version 1 Routes
 * All routes are prefixed with /api/v1
 */

// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Auth routes - Public endpoints (rate limited)
router.use('/auth', globalRateLimit, authRoutes);

// User routes - Protected endpoints
router.use('/users', authenticate, userRoutes);

// Wallet routes - Protected endpoints
router.use('/wallet', authenticate, walletRoutes);

// Bet routes - Protected endpoints
router.use('/bets', authenticate, betRoutes);

// Match routes - Some public, some protected
router.use('/matches', matchRoutes);

// Payment routes - Protected endpoints
router.use('/payments', authenticate, paymentRoutes);

// Bonus routes - Protected endpoints
router.use('/bonuses', authenticate, bonusRoutes);

// Promotion routes - Mixed public/protected
router.use('/promotions', promotionRoutes);

// Notification routes - Protected endpoints
router.use('/notifications', authenticate, notificationRoutes);

// Message routes - Protected endpoints
router.use('/messages', authenticate, messageRoutes);

// Support routes - Protected endpoints
router.use('/support', authenticate, supportRoutes);

// Admin routes - Protected with admin middleware
router.use('/admin', adminRoutes);

// Report routes - Protected with admin middleware
router.use('/reports', reportRoutes);

// KYC routes - Protected endpoints
router.use('/kyc', authenticate, kycRoutes);

// ============================================
// CATCH-ALL ROUTE (404)
// ============================================

/**
 * Catch-all route for undefined API endpoints
 * Returns a 404 response with helpful message
 */
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    code: 'ERR_404',
    path: req.originalUrl,
    method: req.method,
  });
});

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
