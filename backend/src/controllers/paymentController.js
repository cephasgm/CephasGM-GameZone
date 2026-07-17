/**
 * Payment Controller - Payment HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all payment-related HTTP requests including:
 * - Payment initialization (deposits, withdrawals)
 * - Payment verification and completion
 * - Payment history and filtering
 * - Payment method management
 * - Payment statistics
 * - Webhook handling
 * - Admin payment management
 * - Refund processing
 */

const paymentService = require('../services/paymentService');
const { catchAsync, createValidationError, createNotFoundError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// PAYMENT INITIALIZATION
// ============================================

/**
 * Initialize a payment (deposit or withdrawal)
 * POST /api/v1/payments/initiate
 */
const initiatePayment = catchAsync(async (req, res) => {
  const { type, method, amount, currency = 'USD', metadata = {} } = req.body;

  if (!type || !['deposit', 'withdrawal'].includes(type)) {
    throw createValidationError('Valid payment type (deposit or withdrawal) is required');
  }

  if (!method) {
    throw createValidationError('Payment method is required');
  }

  if (!amount || amount <= 0) {
    throw createValidationError('Valid payment amount is required');
  }

  const result = await paymentService.initializePayment(
    req.user.id,
    {
      type,
      method,
      amount: parseFloat(amount),
      currency,
      metadata,
    },
    req
  );

  res.status(200).json({
    success: true,
    message: `Payment initialized successfully for ${type}`,
    data: {
      payment: result.payment,
      gatewayResponse: result.gatewayResponse,
    },
  });
});

/**
 * Verify payment status
 * GET /api/v1/payments/verify/:paymentId
 */
const verifyPayment = catchAsync(async (req, res) => {
  const { paymentId } = req.params;

  const payment = await paymentService.getPaymentById(paymentId, req.user.id);

  let result;
  if (payment.type === 'deposit') {
    result = await paymentService.verifyDeposit(paymentId, req);
  } else if (payment.type === 'withdrawal') {
    result = await paymentService.verifyWithdrawal(paymentId, req);
  } else {
    throw createValidationError('Invalid payment type');
  }

  res.status(200).json({
    success: true,
    data: {
      payment: result.payment,
      verificationStatus: result.verificationStatus || 'verified',
      alreadyCompleted: result.alreadyCompleted || false,
    },
  });
});

// ============================================
// DEPOSITS
// ============================================

/**
 * Initiate a deposit
 * POST /api/v1/payments/deposit
 */
const initiateDeposit = catchAsync(async (req, res) => {
  const { method, amount, currency = 'USD', metadata = {} } = req.body;

  if (!method) {
    throw createValidationError('Payment method is required');
  }

  if (!amount || amount <= 0) {
    throw createValidationError('Valid deposit amount is required');
  }

  const result = await paymentService.initializePayment(
    req.user.id,
    {
      type: 'deposit',
      method,
      amount: parseFloat(amount),
      currency,
      metadata,
    },
    req
  );

  res.status(200).json({
    success: true,
    message: 'Deposit initiated successfully',
    data: {
      payment: result.payment,
      gatewayResponse: result.gatewayResponse,
    },
  });
});

/**
 * Complete a deposit (webhook or admin)
 * POST /api/v1/payments/deposit/complete/:paymentId
 */
const completeDeposit = catchAsync(async (req, res) => {
  const { paymentId } = req.params;

  // Admin only
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can complete deposits manually');
  }

  const result = await paymentService.completeDeposit(paymentId, {}, req);

  res.status(200).json({
    success: true,
    message: 'Deposit completed successfully',
    data: {
      payment: result.payment,
      transaction: result.transaction,
      wallet: result.wallet,
    },
  });
});

/**
 * Get deposit history
 * GET /api/v1/payments/deposits
 */
const getDepositHistory = catchAsync(async (req, res) => {
  const { limit = 50, offset = 0, status = null, startDate = null, endDate = null } = req.query;

  const result = await paymentService.getPaymentHistory(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    type: 'deposit',
    status,
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: {
      payments: result.payments,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

// ============================================
// WITHDRAWALS
// ============================================

/**
 * Initiate a withdrawal
 * POST /api/v1/payments/withdrawal
 */
const initiateWithdrawal = catchAsync(async (req, res) => {
  const { method, amount, currency = 'USD', accountDetails, metadata = {} } = req.body;

  if (!method) {
    throw createValidationError('Withdrawal method is required');
  }

  if (!amount || amount <= 0) {
    throw createValidationError('Valid withdrawal amount is required');
  }

  if (!accountDetails || Object.keys(accountDetails).length === 0) {
    throw createValidationError('Account details are required for withdrawal');
  }

  const result = await paymentService.initializePayment(
    req.user.id,
    {
      type: 'withdrawal',
      method,
      amount: parseFloat(amount),
      currency,
      metadata: { ...metadata, accountDetails },
    },
    req
  );

  res.status(200).json({
    success: true,
    message: 'Withdrawal initiated successfully. Please wait for processing.',
    data: {
      payment: result.payment,
      gatewayResponse: result.gatewayResponse,
    },
  });
});

/**
 * Get withdrawal history
 * GET /api/v1/payments/withdrawals
 */
const getWithdrawalHistory = catchAsync(async (req, res) => {
  const { limit = 50, offset = 0, status = null, startDate = null, endDate = null } = req.query;

  const result = await paymentService.getPaymentHistory(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    type: 'withdrawal',
    status,
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: {
      payments: result.payments,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

// ============================================
// PAYMENT METHODS
// ============================================

/**
 * Get available payment methods
 * GET /api/v1/payments/methods
 */
const getPaymentMethods = catchAsync(async (req, res) => {
  const methods = await paymentService.getPaymentMethods(req.user.id);

  // Add static methods that are always available
  const allMethods = [
    { id: 'card', name: 'Credit/Debit Card', icon: '💳', type: 'card', isAvailable: true },
    { id: 'bank_transfer', name: 'Bank Transfer', icon: '🏦', type: 'bank', isAvailable: true },
    { id: 'mobile_money', name: 'Mobile Money', icon: '📱', type: 'mobile', isAvailable: true },
    { id: 'crypto', name: 'Cryptocurrency', icon: '₿', type: 'crypto', isAvailable: true },
    { id: 'paypal', name: 'PayPal', icon: '💸', type: 'paypal', isAvailable: true },
    { id: 'mpesa', name: 'M-Pesa', icon: '📱', type: 'mobile', isAvailable: true },
    { id: 'airtel_money', name: 'Airtel Money', icon: '📱', type: 'mobile', isAvailable: true },
  ];

  // Merge with user's saved methods
  const savedMethods = methods.map(m => ({
    ...m,
    isSaved: true,
  }));

  const mergedMethods = allMethods.map(m => {
    const saved = savedMethods.find(s => s.method === m.id);
    return saved || m;
  });

  res.status(200).json({
    success: true,
    data: {
      methods: mergedMethods,
      savedMethods: savedMethods,
    },
  });
});

/**
 * Get payment method details
 * GET /api/v1/payments/methods/:methodId
 */
const getPaymentMethodDetails = catchAsync(async (req, res) => {
  const { methodId } = req.params;

  const methods = await paymentService.getPaymentMethods(req.user.id);
  const method = methods.find(m => m.method === methodId);

  if (!method) {
    throw createNotFoundError('Payment method', methodId);
  }

  res.status(200).json({
    success: true,
    data: {
      method,
    },
  });
});

/**
 * Save a payment method
 * POST /api/v1/payments/methods/save
 */
const savePaymentMethod = catchAsync(async (req, res) => {
  const { method, details } = req.body;

  if (!method) {
    throw createValidationError('Payment method is required');
  }

  if (!details || typeof details !== 'object') {
    throw createValidationError('Payment method details are required');
  }

  // This would save the payment method for future use
  // For now, just return success
  res.status(200).json({
    success: true,
    message: 'Payment method saved successfully',
    data: {
      method,
      details: {
        ...details,
        // Mask sensitive data
        cardNumber: details.cardNumber ? `•••• ${details.cardNumber.slice(-4)}` : undefined,
      },
    },
  });
});

/**
 * Remove a saved payment method
 * DELETE /api/v1/payments/methods/:methodId
 */
const removePaymentMethod = catchAsync(async (req, res) => {
  const { methodId } = req.params;

  // This would remove the saved payment method
  // For now, just return success
  res.status(200).json({
    success: true,
    message: 'Payment method removed successfully',
  });
});

// ============================================
// PAYMENT HISTORY & STATISTICS
// ============================================

/**
 * Get payment history
 * GET /api/v1/payments/history
 */
const getPaymentHistory = catchAsync(async (req, res) => {
  const { limit = 50, offset = 0, type = null, method = null, status = null, startDate = null, endDate = null } = req.query;

  const result = await paymentService.getPaymentHistory(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    type,
    method,
    status,
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: {
      payments: result.payments,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get payment by ID
 * GET /api/v1/payments/:paymentId
 */
const getPaymentById = catchAsync(async (req, res) => {
  const { paymentId } = req.params;

  const payment = await paymentService.getPaymentById(paymentId, req.user.id);

  res.status(200).json({
    success: true,
    data: {
      payment,
    },
  });
});

/**
 * Get payment by reference
 * GET /api/v1/payments/reference/:reference
 */
const getPaymentByReference = catchAsync(async (req, res) => {
  const { reference } = req.params;

  const payment = await paymentService.getPaymentByReference(reference, req.user.id);

  res.status(200).json({
    success: true,
    data: {
      payment,
    },
  });
});

/**
 * Get payment statistics
 * GET /api/v1/payments/stats
 */
const getPaymentStats = catchAsync(async (req, res) => {
  const { period = 'all' } = req.query;

  const stats = await paymentService.getPaymentStats(req.user.id, { period });

  res.status(200).json({
    success: true,
    data: {
      stats,
    },
  });
});

// ============================================
// WEBHOOK HANDLING (Public - No Auth)
// ============================================

/**
 * Payment webhook handler
 * POST /api/v1/payments/webhook/:provider
 */
const handleWebhook = catchAsync(async (req, res) => {
  const { provider } = req.params;

  // Get raw body for signature verification
  const rawBody = req.rawBody || JSON.stringify(req.body);

  const result = await paymentService.handleWebhook(
    provider,
    req.body,
    {
      signature: req.headers['x-signature'] || req.headers['x-webhook-signature'],
      'user-agent': req.headers['user-agent'],
      'x-request-id': req.headers['x-request-id'],
    }
  );

  // Always return 200 for webhooks to acknowledge receipt
  res.status(200).json({
    success: true,
    message: 'Webhook processed successfully',
    data: result,
  });
});

// ============================================
// ADMIN PAYMENT OPERATIONS
// ============================================

/**
 * Get all payments (admin only)
 * GET /api/v1/payments/admin/all
 */
const getAllPayments = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view all payments');
  }

  const { type, method, status, userId, minAmount, maxAmount, startDate, endDate, limit = 50, offset = 0 } = req.query;

  const result = await paymentService.getAllPayments(
    {
      type,
      method,
      status,
      userId,
      minAmount: minAmount ? parseFloat(minAmount) : null,
      maxAmount: maxAmount ? parseFloat(maxAmount) : null,
      startDate,
      endDate,
    },
    {
      limit: parseInt(limit),
      offset: parseInt(offset),
    }
  );

  res.status(200).json({
    success: true,
    data: {
      payments: result.payments,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get pending payments (admin only)
 * GET /api/v1/payments/admin/pending
 */
const getPendingPayments = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view pending payments');
  }

  const { type = null, limit = 100 } = req.query;

  const payments = await paymentService.getPendingPayments({
    type,
    limit: parseInt(limit),
  });

  res.status(200).json({
    success: true,
    data: {
      payments,
      count: payments.length,
    },
  });
});

/**
 * Approve a withdrawal (admin only)
 * POST /api/v1/payments/admin/withdraw/approve/:paymentId
 */
const approveWithdrawal = catchAsync(async (req, res) => {
  const { paymentId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can approve withdrawals');
  }

  const result = await paymentService.approveWithdrawal(paymentId, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Withdrawal approved successfully',
    data: {
      payment: result.payment,
    },
  });
});

/**
 * Complete a withdrawal (admin only)
 * POST /api/v1/payments/admin/withdraw/complete/:paymentId
 */
const completeWithdrawal = catchAsync(async (req, res) => {
  const { paymentId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can complete withdrawals');
  }

  const result = await paymentService.completeWithdrawal(paymentId, req);

  res.status(200).json({
    success: true,
    message: 'Withdrawal completed successfully',
    data: {
      payment: result.payment,
    },
  });
});

/**
 * Reject a withdrawal (admin only)
 * POST /api/v1/payments/admin/withdraw/reject/:paymentId
 */
const rejectWithdrawal = catchAsync(async (req, res) => {
  const { paymentId } = req.params;
  const { reason } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can reject withdrawals');
  }

  if (!reason) {
    throw createValidationError('Rejection reason is required');
  }

  const result = await paymentService.rejectWithdrawal(paymentId, reason, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Withdrawal rejected successfully',
    data: {
      payment: result.payment,
    },
  });
});

/**
 * Process a refund (admin only)
 * POST /api/v1/payments/admin/refund/:paymentId
 */
const processRefund = catchAsync(async (req, res) => {
  const { paymentId } = req.params;
  const { reason } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can process refunds');
  }

  if (!reason) {
    throw createValidationError('Refund reason is required');
  }

  const result = await paymentService.processRefund(paymentId, reason, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Refund processed successfully',
    data: {
      refund: result.refund,
      originalPayment: result.originalPayment,
    },
  });
});

// Export all controller methods
module.exports = {
  // Payment Initialization
  initiatePayment,
  verifyPayment,

  // Deposits
  initiateDeposit,
  completeDeposit,
  getDepositHistory,

  // Withdrawals
  initiateWithdrawal,
  getWithdrawalHistory,

  // Payment Methods
  getPaymentMethods,
  getPaymentMethodDetails,
  savePaymentMethod,
  removePaymentMethod,

  // Payment History & Statistics
  getPaymentHistory,
  getPaymentById,
  getPaymentByReference,
  getPaymentStats,

  // Webhook
  handleWebhook,

  // Admin
  getAllPayments,
  getPendingPayments,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,
  processRefund,
};
