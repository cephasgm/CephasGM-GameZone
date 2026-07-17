/**
 * Wallet Routes - Wallet & Transaction API Routes
 * CephasGM GameZone
 * 
 * This module defines all wallet-related API routes including:
 * - Wallet balance and details
 * - Transaction history and details
 * - Deposits (initiate, complete, history)
 * - Withdrawals (initiate, approve, complete, reject)
 * - Transaction summary and statistics
 * - Payment methods
 * - Admin wallet operations (adjust balance)
 * 
 * All routes are mounted under /api/v1/wallet
 */

const express = require('express');
const router = express.Router();

// Import controllers
const walletController = require('../../controllers/walletController');

// Import middleware
const { authenticate } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../../middleware/admin');
const { walletRateLimit } = require('../../middleware/rateLimit');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// WALLET BALANCE ROUTES
// ============================================

/**
 * @route   GET /api/v1/wallet/balance
 * @desc    Get user wallet balance
 * @access  Private
 */
router.get(
  '/balance',
  authenticate,
  walletController.getBalance
);

/**
 * @route   GET /api/v1/wallet/details
 * @desc    Get user wallet details
 * @access  Private
 */
router.get(
  '/details',
  authenticate,
  walletController.getWalletDetails
);

// ============================================
// TRANSACTION ROUTES
// ============================================

/**
 * @route   GET /api/v1/wallet/transactions
 * @desc    Get transaction history
 * @access  Private
 */
router.get(
  '/transactions',
  authenticate,
  walletController.getTransactions
);

/**
 * @route   GET /api/v1/wallet/transactions/:transactionId
 * @desc    Get transaction by ID
 * @access  Private
 */
router.get(
  '/transactions/:transactionId',
  authenticate,
  validateParams(validationSchemas.idParam),
  walletController.getTransactionById
);

/**
 * @route   GET /api/v1/wallet/transactions/reference/:reference
 * @desc    Get transaction by reference
 * @access  Private
 */
router.get(
  '/transactions/reference/:reference',
  authenticate,
  walletController.getTransactionByReference
);

/**
 * @route   GET /api/v1/wallet/summary
 * @desc    Get transaction summary
 * @access  Private
 */
router.get(
  '/summary',
  authenticate,
  walletController.getTransactionSummary
);

// ============================================
// DEPOSIT ROUTES
// ============================================

/**
 * @route   POST /api/v1/wallet/deposit
 * @desc    Initiate a deposit
 * @access  Private
 */
router.post(
  '/deposit',
  authenticate,
  walletRateLimit('deposit'),
  sanitize({ strategy: 'strict' }),
  walletController.initiateDeposit
);

/**
 * @route   POST /api/v1/wallet/deposit/pending
 * @desc    Initiate a pending deposit
 * @access  Private
 */
router.post(
  '/deposit/pending',
  authenticate,
  walletRateLimit('deposit'),
  sanitize({ strategy: 'strict' }),
  walletController.initiatePendingDeposit
);

/**
 * @route   POST /api/v1/wallet/deposit/complete/:transactionId
 * @desc    Complete a pending deposit (admin only)
 * @access  Private/Admin
 */
router.post(
  '/deposit/complete/:transactionId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  walletController.completePendingDeposit
);

/**
 * @route   GET /api/v1/wallet/deposits
 * @desc    Get deposit history
 * @access  Private
 */
router.get(
  '/deposits',
  authenticate,
  walletController.getDepositHistory
);

// ============================================
// WITHDRAWAL ROUTES
// ============================================

/**
 * @route   POST /api/v1/wallet/withdraw
 * @desc    Initiate a withdrawal
 * @access  Private
 */
router.post(
  '/withdraw',
  authenticate,
  walletRateLimit('withdraw'),
  sanitize({ strategy: 'strict' }),
  walletController.initiateWithdrawal
);

/**
 * @route   GET /api/v1/wallet/withdrawal-methods
 * @desc    Get withdrawal methods
 * @access  Private
 */
router.get(
  '/withdrawal-methods',
  authenticate,
  walletController.getWithdrawalMethods
);

/**
 * @route   GET /api/v1/wallet/withdrawals
 * @desc    Get withdrawal history
 * @access  Private
 */
router.get(
  '/withdrawals',
  authenticate,
  walletController.getWithdrawalHistory
);

/**
 * @route   POST /api/v1/wallet/withdraw/approve/:transactionId
 * @desc    Approve a withdrawal (admin only)
 * @access  Private/Admin
 */
router.post(
  '/withdraw/approve/:transactionId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  walletController.approveWithdrawal
);

/**
 * @route   POST /api/v1/wallet/withdraw/complete/:transactionId
 * @desc    Complete a withdrawal (admin only)
 * @access  Private/Admin
 */
router.post(
  '/withdraw/complete/:transactionId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  walletController.completeWithdrawal
);

/**
 * @route   POST /api/v1/wallet/withdraw/reject/:transactionId
 * @desc    Reject a withdrawal (admin only)
 * @access  Private/Admin
 */
router.post(
  '/withdraw/reject/:transactionId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  walletController.rejectWithdrawal
);

// ============================================
// ADMIN WALLET OPERATIONS
// ============================================

/**
 * @route   POST /api/v1/wallet/admin/adjust
 * @desc    Adjust wallet balance (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/adjust',
  authenticate,
  requireAdmin,
  sanitize({ strategy: 'strict' }),
  walletController.adjustBalance
);

// ============================================
// INTERNAL SERVICE ROUTES (API Key required)
// ============================================

/**
 * @route   GET /api/v1/wallet/internal/:userId
 * @desc    Internal wallet lookup (for microservices)
 * @access  Internal (API Key)
 */
router.get(
  '/internal/:userId',
  authenticate,
  validateParams(validationSchemas.userIdParam),
  walletController.getWalletDetails
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
