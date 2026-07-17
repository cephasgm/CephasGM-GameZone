/**
 * Payment Routes - Payment & Transaction API Routes
 * CephasGM GameZone
 * 
 * This module defines all payment-related API routes including:
 * - Payment initialization (deposits, withdrawals)
 * - Payment verification and completion
 * - Payment history and filtering
 * - Payment method management
 * - Payment statistics
 * - Webhook handling
 * - Admin payment management
 * - Refund processing
 * 
 * All routes are mounted under /api/v1/payments
 */

const express = require('express');
const router = express.Router();

// Import controllers
const paymentController = require('../../controllers/paymentController');

// Import middleware
const { authenticate, authenticateApiKey } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../../middleware/admin');
const { paymentRateLimit } = require('../../middleware/rateLimit');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// PAYMENT INITIALIZATION ROUTES
// ============================================

/**
 * @route   POST /api/v1/payments/initiate
 * @desc    Initialize a payment (deposit or withdrawal)
 * @access  Private
 */
router.post(
  '/initiate',
  authenticate,
  paymentRateLimit('process'),
  sanitize({ strategy: 'strict' }),
  paymentController.initiatePayment
);

/**
 * @route   GET /api/v1/payments/verify/:paymentId
 * @desc    Verify payment status
 * @access  Private
 */
router.get(
  '/verify/:paymentId',
  authenticate,
  validateParams(validationSchemas.idParam),
  paymentController.verifyPayment
);

// ============================================
// DEPOSIT ROUTES
// ============================================

/**
 * @route   POST /api/v1/payments/deposit
 * @desc    Initiate a deposit
 * @access  Private
 */
router.post(
  '/deposit',
  authenticate,
  paymentRateLimit('process'),
  sanitize({ strategy: 'strict' }),
  paymentController.initiateDeposit
);

/**
 * @route   POST /api/v1/payments/deposit/complete/:paymentId
 * @desc    Complete a deposit (admin only)
 * @access  Private/Admin
 */
router.post(
  '/deposit/complete/:paymentId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  paymentController.completeDeposit
);

/**
 * @route   GET /api/v1/payments/deposits
 * @desc    Get deposit history
 * @access  Private
 */
router.get(
  '/deposits',
  authenticate,
  paymentController.getDepositHistory
);

// ============================================
// WITHDRAWAL ROUTES
// ============================================

/**
 * @route   POST /api/v1/payments/withdrawal
 * @desc    Initiate a withdrawal
 * @access  Private
 */
router.post(
  '/withdrawal',
  authenticate,
  paymentRateLimit('process'),
  sanitize({ strategy: 'strict' }),
  paymentController.initiateWithdrawal
);

/**
 * @route   GET /api/v1/payments/withdrawals
 * @desc    Get withdrawal history
 * @access  Private
 */
router.get(
  '/withdrawals',
  authenticate,
  paymentController.getWithdrawalHistory
);

// ============================================
// PAYMENT METHOD ROUTES
// ============================================

/**
 * @route   GET /api/v1/payments/methods
 * @desc    Get available payment methods
 * @access  Private
 */
router.get(
  '/methods',
  authenticate,
  paymentController.getPaymentMethods
);

/**
 * @route   GET /api/v1/payments/methods/:methodId
 * @desc    Get payment method details
 * @access  Private
 */
router.get(
  '/methods/:methodId',
  authenticate,
  paymentController.getPaymentMethodDetails
);

/**
 * @route   POST /api/v1/payments/methods/save
 * @desc    Save a payment method
 * @access  Private
 */
router.post(
  '/methods/save',
  authenticate,
  sanitize({ strategy: 'strict' }),
  paymentController.savePaymentMethod
);

/**
 * @route   DELETE /api/v1/payments/methods/:methodId
 * @desc    Remove a saved payment method
 * @access  Private
 */
router.delete(
  '/methods/:methodId',
  authenticate,
  paymentController.removePaymentMethod
);

// ============================================
// PAYMENT HISTORY & STATISTICS ROUTES
// ============================================

/**
 * @route   GET /api/v1/payments/history
 * @desc    Get payment history
 * @access  Private
 */
router.get(
  '/history',
  authenticate,
  paymentController.getPaymentHistory
);

/**
 * @route   GET /api/v1/payments/:paymentId
 * @desc    Get payment by ID
 * @access  Private
 */
router.get(
  '/:paymentId',
  authenticate,
  validateParams(validationSchemas.idParam),
  paymentController.getPaymentById
);

/**
 * @route   GET /api/v1/payments/reference/:reference
 * @desc    Get payment by reference
 * @access  Private
 */
router.get(
  '/reference/:reference',
  authenticate,
  paymentController.getPaymentByReference
);

/**
 * @route   GET /api/v1/payments/stats
 * @desc    Get payment statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  paymentController.getPaymentStats
);

// ============================================
// WEBHOOK ROUTES (Public - No Auth)
// ============================================

/**
 * @route   POST /api/v1/payments/webhook/:provider
 * @desc    Payment webhook handler
 * @access  Public
 */
router.post(
  '/webhook/:provider',
  express.raw({ type: 'application/json' }),
  paymentController.handleWebhook
);

// ============================================
// ADMIN PAYMENT ROUTES
// ============================================

/**
 * @route   GET /api/v1/payments/admin/all
 * @desc    Get all payments (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/all',
  authenticate,
  requireAdmin,
  paymentController.getAllPayments
);

/**
 * @route   GET /api/v1/payments/admin/pending
 * @desc    Get pending payments (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/pending',
  authenticate,
  requireAdmin,
  paymentController.getPendingPayments
);

/**
 * @route   POST /api/v1/payments/admin/withdraw/approve/:paymentId
 * @desc    Approve a withdrawal (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/withdraw/approve/:paymentId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  paymentController.approveWithdrawal
);

/**
 * @route   POST /api/v1/payments/admin/withdraw/complete/:paymentId
 * @desc    Complete a withdrawal (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/withdraw/complete/:paymentId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  paymentController.completeWithdrawal
);

/**
 * @route   POST /api/v1/payments/admin/withdraw/reject/:paymentId
 * @desc    Reject a withdrawal (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/withdraw/reject/:paymentId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  paymentController.rejectWithdrawal
);

/**
 * @route   POST /api/v1/payments/admin/refund/:paymentId
 * @desc    Process a refund (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/refund/:paymentId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  paymentController.processRefund
);

// ============================================
// INTERNAL SERVICE ROUTES (API Key required)
// ============================================

/**
 * @route   GET /api/v1/payments/internal/:userId
 * @desc    Internal payment lookup (for microservices)
 * @access  Internal (API Key)
 */
router.get(
  '/internal/:userId',
  authenticateApiKey,
  validateParams(validationSchemas.userIdParam),
  paymentController.getPaymentHistory
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
