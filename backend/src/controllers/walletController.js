/**
 * Wallet Controller - Wallet & Transaction HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all wallet-related HTTP requests including:
 * - Wallet balance retrieval
 * - Transaction history and filtering
 * - Deposits (initiate, verify, complete)
 * - Withdrawals (initiate, verify, complete, reject)
 * - Transaction details
 * - Wallet summary and statistics
 * - Deposit and withdrawal methods
 */

const walletService = require('../services/walletService');
const { catchAsync, createValidationError, createNotFoundError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// WALLET BALANCE
// ============================================

/**
 * Get user wallet balance
 * GET /api/v1/wallet/balance
 */
const getBalance = catchAsync(async (req, res) => {
  const { currency } = req.query;

  const balance = await walletService.getWalletBalance(req.user.id, currency);

  res.status(200).json({
    success: true,
    data: {
      balance,
    },
  });
});

/**
 * Get user wallet details (full wallet data)
 * GET /api/v1/wallet/details
 */
const getWalletDetails = catchAsync(async (req, res) => {
  const { currency } = req.query;

  const wallet = await walletService.getWallet(req.user.id, currency);

  res.status(200).json({
    success: true,
    data: {
      wallet,
    },
  });
});

// ============================================
// TRANSACTION HISTORY
// ============================================

/**
 * Get transaction history
 * GET /api/v1/wallet/transactions
 */
const getTransactions = catchAsync(async (req, res) => {
  const {
    limit = 50,
    offset = 0,
    type = null,
    category = null,
    status = null,
    startDate = null,
    endDate = null,
    minAmount = null,
    maxAmount = null,
  } = req.query;

  const result = await walletService.getTransactionHistory(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    type,
    category,
    status,
    startDate,
    endDate,
    minAmount: minAmount ? parseFloat(minAmount) : null,
    maxAmount: maxAmount ? parseFloat(maxAmount) : null,
  });

  res.status(200).json({
    success: true,
    data: {
      transactions: result.transactions,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get transaction by ID
 * GET /api/v1/wallet/transactions/:transactionId
 */
const getTransactionById = catchAsync(async (req, res) => {
  const { transactionId } = req.params;

  const transaction = await walletService.getTransactionById(transactionId, req.user.id);

  res.status(200).json({
    success: true,
    data: {
      transaction,
    },
  });
});

/**
 * Get transaction by reference
 * GET /api/v1/wallet/transactions/reference/:reference
 */
const getTransactionByReference = catchAsync(async (req, res) => {
  const { reference } = req.params;

  const transaction = await walletService.getTransactionByReference(reference, req.user.id);

  res.status(200).json({
    success: true,
    data: {
      transaction,
    },
  });
});

/**
 * Get transaction summary
 * GET /api/v1/wallet/summary
 */
const getTransactionSummary = catchAsync(async (req, res) => {
  const { period = 'all' } = req.query;

  const summary = await walletService.getTransactionSummary(req.user.id, { period });

  res.status(200).json({
    success: true,
    data: {
      summary,
    },
  });
});

// ============================================
// DEPOSITS
// ============================================

/**
 * Initiate a deposit
 * POST /api/v1/wallet/deposit
 */
const initiateDeposit = catchAsync(async (req, res) => {
  const { amount, method, currency = 'USD', metadata = {} } = req.body;

  if (!amount || amount <= 0) {
    throw createValidationError('Valid deposit amount is required');
  }

  if (!method) {
    throw createValidationError('Payment method is required');
  }

  const result = await walletService.processDeposit(
    req.user.id,
    parseFloat(amount),
    method,
    `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    metadata,
    req
  );

  res.status(200).json({
    success: true,
    message: 'Deposit processed successfully',
    data: {
      transaction: result.transaction,
      wallet: result.wallet,
      amount: result.amount,
    },
  });
});

/**
 * Initiate a pending deposit (for async payment methods)
 * POST /api/v1/wallet/deposit/pending
 */
const initiatePendingDeposit = catchAsync(async (req, res) => {
  const { amount, method, currency = 'USD', metadata = {} } = req.body;

  if (!amount || amount <= 0) {
    throw createValidationError('Valid deposit amount is required');
  }

  if (!method) {
    throw createValidationError('Payment method is required');
  }

  const reference = `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const result = await walletService.processPendingDeposit(
    req.user.id,
    parseFloat(amount),
    method,
    reference,
    metadata,
    req
  );

  res.status(200).json({
    success: true,
    message: 'Deposit initiated successfully. Please complete the payment.',
    data: {
      transaction: result.transaction,
      reference,
      pendingAmount: result.pendingAmount,
    },
  });
});

/**
 * Complete a pending deposit (webhook or admin)
 * POST /api/v1/wallet/deposit/complete/:transactionId
 */
const completePendingDeposit = catchAsync(async (req, res) => {
  const { transactionId } = req.params;

  // Admin or internal service only
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can complete pending deposits');
  }

  const result = await walletService.completePendingDeposit(transactionId, req);

  res.status(200).json({
    success: true,
    message: 'Deposit completed successfully',
    data: {
      transaction: result.transaction,
      wallet: result.wallet,
    },
  });
});

// ============================================
// WITHDRAWALS
// ============================================

/**
 * Initiate a withdrawal
 * POST /api/v1/wallet/withdraw
 */
const initiateWithdrawal = catchAsync(async (req, res) => {
  const { amount, method, accountDetails, metadata = {} } = req.body;

  if (!amount || amount <= 0) {
    throw createValidationError('Valid withdrawal amount is required');
  }

  if (!method) {
    throw createValidationError('Withdrawal method is required');
  }

  if (!accountDetails || Object.keys(accountDetails).length === 0) {
    throw createValidationError('Account details are required for withdrawal');
  }

  const result = await walletService.processWithdrawal(
    req.user.id,
    parseFloat(amount),
    method,
    { ...accountDetails, ...metadata },
    req
  );

  res.status(200).json({
    success: true,
    message: 'Withdrawal request submitted successfully. Please wait for processing.',
    data: {
      transaction: result.transaction,
      reference: result.reference,
      amount: result.amount,
    },
  });
});

/**
 * Get withdrawal methods
 * GET /api/v1/wallet/withdrawal-methods
 */
const getWithdrawalMethods = catchAsync(async (req, res) => {
  // This would fetch available withdrawal methods for the user
  // For now, return a static list
  const methods = [
    { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', processingTime: '1-3 business days' },
    { id: 'mobile_money', name: 'Mobile Money', icon: '📱', processingTime: '1-24 hours' },
    { id: 'crypto', name: 'Cryptocurrency', icon: '₿', processingTime: '10-60 minutes' },
    { id: 'card', name: 'Credit/Debit Card', icon: '💳', processingTime: '2-5 business days' },
    { id: 'paypal', name: 'PayPal', icon: '💸', processingTime: '1-2 business days' },
  ];

  res.status(200).json({
    success: true,
    data: {
      methods,
    },
  });
});

/**
 * Get withdrawal history
 * GET /api/v1/wallet/withdrawals
 */
const getWithdrawalHistory = catchAsync(async (req, res) => {
  const { limit = 50, offset = 0, status = null } = req.query;

  const result = await walletService.getTransactionHistory(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    type: 'withdrawal',
    status,
  });

  res.status(200).json({
    success: true,
    data: {
      withdrawals: result.transactions,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get deposit history
 * GET /api/v1/wallet/deposits
 */
const getDepositHistory = catchAsync(async (req, res) => {
  const { limit = 50, offset = 0, status = null } = req.query;

  const result = await walletService.getTransactionHistory(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    type: 'deposit',
    status,
  });

  res.status(200).json({
    success: true,
    data: {
      deposits: result.transactions,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

// ============================================
// ADMIN WITHDRAWAL OPERATIONS
// ============================================

/**
 * Approve a withdrawal (admin only)
 * POST /api/v1/wallet/withdraw/approve/:transactionId
 */
const approveWithdrawal = catchAsync(async (req, res) => {
  const { transactionId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can approve withdrawals');
  }

  const result = await walletService.approveWithdrawal(transactionId, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Withdrawal approved successfully',
    data: {
      transaction: result.transaction,
    },
  });
});

/**
 * Complete a withdrawal (admin only)
 * POST /api/v1/wallet/withdraw/complete/:transactionId
 */
const completeWithdrawal = catchAsync(async (req, res) => {
  const { transactionId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can complete withdrawals');
  }

  const result = await walletService.completeWithdrawal(transactionId, req);

  res.status(200).json({
    success: true,
    message: 'Withdrawal completed successfully',
    data: {
      transaction: result.transaction,
    },
  });
});

/**
 * Reject a withdrawal (admin only)
 * POST /api/v1/wallet/withdraw/reject/:transactionId
 */
const rejectWithdrawal = catchAsync(async (req, res) => {
  const { transactionId } = req.params;
  const { reason } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can reject withdrawals');
  }

  if (!reason) {
    throw createValidationError('Rejection reason is required');
  }

  const result = await walletService.rejectWithdrawal(transactionId, reason, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Withdrawal rejected successfully',
    data: {
      transaction: result.transaction,
    },
  });
});

// ============================================
// ADMIN DEPOSIT OPERATIONS
// ============================================

/**
 * Adjust wallet balance (admin only)
 * POST /api/v1/wallet/adjust
 */
const adjustBalance = catchAsync(async (req, res) => {
  const { userId, amount, reason } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can adjust wallet balances');
  }

  if (!userId) {
    throw createValidationError('User ID is required');
  }

  if (amount === undefined || amount === null) {
    throw createValidationError('Amount is required');
  }

  if (!reason) {
    throw createValidationError('Adjustment reason is required');
  }

  const result = await walletService.adjustWalletBalance(
    userId,
    parseFloat(amount),
    reason,
    req.user.id,
    req
  );

  res.status(200).json({
    success: true,
    message: 'Wallet balance adjusted successfully',
    data: {
      transaction: result.transaction,
      newBalance: result.newBalance,
      adjustmentAmount: result.adjustmentAmount,
    },
  });
});

// Export all controller methods
module.exports = {
  // Balance
  getBalance,
  getWalletDetails,

  // Transactions
  getTransactions,
  getTransactionById,
  getTransactionByReference,
  getTransactionSummary,

  // Deposits
  initiateDeposit,
  initiatePendingDeposit,
  completePendingDeposit,
  getDepositHistory,

  // Withdrawals
  initiateWithdrawal,
  getWithdrawalMethods,
  getWithdrawalHistory,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,

  // Admin
  adjustBalance,
};
