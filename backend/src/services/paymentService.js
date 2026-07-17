/**
 * Payment Service - Payment Processing Business Logic
 * CephasGM GameZone
 * 
 * This service handles all payment-related business logic including:
 * - Payment gateway integrations (Stripe, PayPal, M-Pesa, etc.)
 * - Deposit and withdrawal processing
 * - Payment method management
 * - Transaction verification and reconciliation
 * - Webhook handling
 * - Payment status tracking
 * - Refund processing
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const { Payment, User, Wallet, Transaction, AuditLog } = require('../models');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const { logAudit } = require('../utils/logger');
const walletService = require('./walletService');

// Payment gateway integrations (to be implemented)
const paymentGateways = {
  stripe: require('../integrations/payment/stripe'),
  paypal: require('../integrations/payment/paypal'),
  mpesa: require('../integrations/payment/mpesa'),
  airtel: require('../integrations/payment/airtel'),
  bank: require('../integrations/payment/bank'),
  crypto: require('../integrations/payment/crypto'),
};

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const CACHE_TTL = {
  PAYMENT_METHODS: 300, // 5 minutes
  PAYMENT_STATUS: 60, // 1 minute
  TRANSACTION_HISTORY: 300, // 5 minutes
};

const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  CHARGEBACK: 'chargeback',
};

const PAYMENT_TYPES = {
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  REFUND: 'refund',
  CHARGEBACK: 'chargeback',
};

const PAYMENT_METHODS = {
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  MOBILE_MONEY: 'mobile_money',
  CRYPTO: 'crypto',
  PAYPAL: 'paypal',
  STRIPE: 'stripe',
  MPESA: 'mpesa',
  AIRTEL_MONEY: 'airtel_money',
  MTN_MONEY: 'mtn_money',
  VOUCHER: 'voucher',
};

// ============================================
// PAYMENT GATEWAY MANAGEMENT
// ============================================

/**
 * Initialize a payment
 * @param {string} userId - User ID
 * @param {Object} paymentData - Payment data
 * @param {string} paymentData.type - Payment type (deposit, withdrawal)
 * @param {string} paymentData.method - Payment method
 * @param {number} paymentData.amount - Payment amount
 * @param {string} paymentData.currency - Currency
 * @param {Object} paymentData.metadata - Additional metadata
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Payment initialization result
 */
const initializePayment = async (userId, paymentData, req = null) => {
  const { type, method, amount, currency = 'USD', metadata = {} } = paymentData;

  // Validate payment type
  if (!Object.values(PAYMENT_TYPES).includes(type)) {
    throw new Error(`Invalid payment type: ${type}`);
  }

  // Validate payment method
  if (!Object.values(PAYMENT_METHODS).includes(method)) {
    throw new Error(`Invalid payment method: ${method}`);
  }

  // Validate amount
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  // Get user
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Get wallet
  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  // Generate payment reference
  const reference = generatePaymentReference();

  // Create payment record
  const payment = await Payment.create({
    user_id: userId,
    wallet_id: wallet.id,
    type: type,
    method: method,
    provider: getProviderFromMethod(method),
    amount: amount,
    fee: calculatePaymentFee(amount, method, type),
    currency: currency,
    status: PAYMENT_STATUS.PENDING,
    reference: reference,
    ip_address: req?.ip || null,
    user_agent: req?.headers?.['user-agent'] || null,
    requested_at: new Date(),
    metadata: metadata,
  });

  // Process based on payment type
  let result;
  if (type === PAYMENT_TYPES.DEPOSIT) {
    result = await initializeDeposit(payment, req);
  } else if (type === PAYMENT_TYPES.WITHDRAWAL) {
    result = await initializeWithdrawal(payment, req);
  } else {
    throw new Error(`Unsupported payment type: ${type}`);
  }

  // Log audit
  await logAudit('PAYMENT_INITIALIZED', userId, {
    paymentId: payment.id,
    reference: payment.reference,
    type,
    method,
    amount,
  }, req);

  logger.info(`Payment initialized: ${reference} - ${type} - ${amount} ${currency} for user ${userId}`);

  return {
    payment: payment.toJSON(),
    gatewayResponse: result,
  };
};

/**
 * Get provider from payment method
 * @param {string} method - Payment method
 * @returns {string} - Provider name
 */
const getProviderFromMethod = (method) => {
  const providerMap = {
    card: 'stripe',
    bank_transfer: 'bank',
    mobile_money: 'mpesa',
    crypto: 'crypto',
    paypal: 'paypal',
    stripe: 'stripe',
    mpesa: 'mpesa',
    airtel_money: 'airtel',
    mtn_money: 'mtn',
    voucher: 'voucher',
  };
  return providerMap[method] || method;
};

/**
 * Calculate payment fee
 * @param {number} amount - Payment amount
 * @param {string} method - Payment method
 * @param {string} type - Payment type
 * @returns {number} - Fee amount
 */
const calculatePaymentFee = (amount, method, type) => {
  const feeConfigs = {
    card: { deposit: 0.025, withdrawal: 0.025 },
    bank_transfer: { deposit: 0, withdrawal: 0.005 },
    mobile_money: { deposit: 0.01, withdrawal: 0.02 },
    crypto: { deposit: 0.001, withdrawal: 0.001 },
    paypal: { deposit: 0.03, withdrawal: 0.03 },
    mpesa: { deposit: 0.01, withdrawal: 0.02 },
    airtel_money: { deposit: 0.01, withdrawal: 0.02 },
    mtn_money: { deposit: 0.01, withdrawal: 0.02 },
    voucher: { deposit: 0, withdrawal: 0 },
  };

  const config = feeConfigs[method];
  if (!config) return 0;

  const feeRate = config[type] || 0;
  return amount * feeRate;
};

/**
 * Generate a payment reference
 * @returns {string} - Payment reference
 */
const generatePaymentReference = () => {
  const prefix = 'PAY';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

// ============================================
// DEPOSIT PROCESSING
// ============================================

/**
 * Initialize a deposit
 * @param {Object} payment - Payment record
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Deposit result
 */
const initializeDeposit = async (payment, req = null) => {
  const gateway = paymentGateways[payment.provider];
  if (!gateway) {
    throw new Error(`Payment gateway not found: ${payment.provider}`);
  }

  // Get gateway-specific initialization
  const result = await gateway.initializeDeposit({
    paymentId: payment.id,
    reference: payment.reference,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    metadata: payment.metadata,
    user: {
      id: payment.user_id,
      email: req?.user?.email,
      name: req?.user?.getFullName(),
    },
    callbackUrls: {
      success: `${process.env.APP_URL}/payment/success?ref=${payment.reference}`,
      cancel: `${process.env.APP_URL}/payment/cancel?ref=${payment.reference}`,
      webhook: `${process.env.API_URL}/api/v1/payments/webhook/${payment.provider}`,
    },
  });

  // Update payment with provider reference
  if (result.providerReference) {
    await payment.update({
      provider_reference: result.providerReference,
      status: PAYMENT_STATUS.PROCESSING,
    });
  }

  // If this is a mobile money or bank transfer, update payment details
  if (payment.method === PAYMENT_METHODS.MOBILE_MONEY || 
      payment.method === PAYMENT_METHODS.MPESA || 
      payment.method === PAYMENT_METHODS.AIRTEL_MONEY ||
      payment.method === PAYMENT_METHODS.MTN_MONEY) {
    await payment.update({
      mobile_number: payment.metadata?.phoneNumber || payment.metadata?.mobileNumber,
      mobile_provider: payment.method,
      mobile_reference: result.providerReference || result.reference,
    });
  }

  if (payment.method === PAYMENT_METHODS.BANK_TRANSFER) {
    await payment.update({
      bank_name: payment.metadata?.bankName,
      bank_account_number: payment.metadata?.accountNumber,
      bank_account_name: payment.metadata?.accountName,
      bank_code: payment.metadata?.bankCode,
      bank_reference: result.providerReference || result.reference,
    });
  }

  if (payment.method === PAYMENT_METHODS.CRYPTO) {
    await payment.update({
      crypto_address: result.cryptoAddress || payment.metadata?.cryptoAddress,
      crypto_network: result.cryptoNetwork || payment.metadata?.cryptoNetwork,
      crypto_tx_hash: result.txHash || null,
    });
  }

  await payment.save();

  return result;
};

/**
 * Verify a deposit
 * @param {string} paymentId - Payment ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Verification result
 */
const verifyDeposit = async (paymentId, req = null) => {
  const payment = await Payment.findByPk(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.type !== PAYMENT_TYPES.DEPOSIT) {
    throw new Error('Payment is not a deposit');
  }

  if (payment.status === PAYMENT_STATUS.COMPLETED) {
    return { payment: payment.toJSON(), alreadyCompleted: true };
  }

  const gateway = paymentGateways[payment.provider];
  if (!gateway) {
    throw new Error(`Payment gateway not found: ${payment.provider}`);
  }

  // Verify with gateway
  const result = await gateway.verifyDeposit({
    paymentId: payment.id,
    reference: payment.reference,
    providerReference: payment.provider_reference,
  });

  if (result.status === 'completed') {
    // Complete the deposit
    return await completeDeposit(payment.id, result.gatewayData, req);
  }

  // Update payment status
  if (result.status === 'failed') {
    await payment.update({
      status: PAYMENT_STATUS.FAILED,
      failure_reason: result.failureReason || 'Verification failed',
      failure_code: result.failureCode,
    });
  }

  return {
    payment: payment.toJSON(),
    verificationStatus: result.status,
  };
};

/**
 * Complete a deposit
 * @param {string} paymentId - Payment ID
 * @param {Object} gatewayData - Gateway response data
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Completed payment
 */
const completeDeposit = async (paymentId, gatewayData = {}, req = null) => {
  const payment = await Payment.findByPk(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.status === PAYMENT_STATUS.COMPLETED) {
    return { payment: payment.toJSON(), alreadyCompleted: true };
  }

  if (payment.type !== PAYMENT_TYPES.DEPOSIT) {
    throw new Error('Payment is not a deposit');
  }

  // Process the deposit
  const result = await walletService.processDeposit(
    payment.user_id,
    payment.amount,
    payment.method,
    payment.reference,
    {
      paymentId: payment.id,
      providerReference: payment.provider_reference,
      gatewayData,
    },
    req
  );

  // Update payment
  await payment.update({
    status: PAYMENT_STATUS.COMPLETED,
    provider_data: gatewayData,
    completed_at: new Date(),
    transaction_id: result.transaction.id,
  });

  // Update wallet transaction
  if (result.transaction) {
    await result.transaction.update({
      payment_method: payment.method,
      payment_provider: payment.provider,
      payment_reference: payment.reference,
    });
  }

  // Clear cache
  await cache.del(`payment:${paymentId}`);

  // Log audit
  await logAudit('DEPOSIT_COMPLETED', payment.user_id, {
    paymentId: payment.id,
    reference: payment.reference,
    amount: payment.amount,
  }, req);

  logger.info(`Deposit completed: ${payment.reference} - ${payment.amount} for user ${payment.user_id}`);

  return {
    payment: payment.toJSON(),
    transaction: result.transaction,
    wallet: result.wallet,
  };
};

// ============================================
// WITHDRAWAL PROCESSING
// ============================================

/**
 * Initialize a withdrawal
 * @param {Object} payment - Payment record
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Withdrawal result
 */
const initializeWithdrawal = async (payment, req = null) => {
  const gateway = paymentGateways[payment.provider];
  if (!gateway) {
    throw new Error(`Payment gateway not found: ${payment.provider}`);
  }

  // Process withdrawal in wallet
  const walletResult = await walletService.processWithdrawal(
    payment.user_id,
    payment.amount,
    payment.method,
    payment.metadata?.accountDetails || {},
    req
  );

  // Update payment with transaction reference
  await payment.update({
    provider_reference: walletResult.reference,
    status: PAYMENT_STATUS.PROCESSING,
    transaction_id: walletResult.transaction.id,
  });

  // Get gateway-specific initialization
  const result = await gateway.initializeWithdrawal({
    paymentId: payment.id,
    reference: payment.reference,
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    metadata: payment.metadata,
    user: {
      id: payment.user_id,
      email: req?.user?.email,
      name: req?.user?.getFullName(),
    },
    accountDetails: payment.metadata?.accountDetails || {},
    callbackUrls: {
      success: `${process.env.APP_URL}/payment/withdrawal-success?ref=${payment.reference}`,
      webhook: `${process.env.API_URL}/api/v1/payments/webhook/${payment.provider}`,
    },
  });

  // Update payment with provider reference
  if (result.providerReference) {
    await payment.update({
      provider_reference: result.providerReference,
    });
  }

  // Update payment details based on method
  if (payment.method === PAYMENT_METHODS.CARD) {
    await payment.update({
      card_last4: payment.metadata?.cardLast4 || null,
      card_brand: payment.metadata?.cardBrand || null,
      card_expiry: payment.metadata?.cardExpiry || null,
      card_holder_name: payment.metadata?.cardHolderName || null,
    });
  }

  if (payment.method === PAYMENT_METHODS.BANK_TRANSFER) {
    await payment.update({
      bank_name: payment.metadata?.bankName || null,
      bank_account_number: payment.metadata?.accountNumber || null,
      bank_account_name: payment.metadata?.accountName || null,
      bank_code: payment.metadata?.bankCode || null,
    });
  }

  if (payment.method === PAYMENT_METHODS.MOBILE_MONEY || 
      payment.method === PAYMENT_METHODS.MPESA || 
      payment.method === PAYMENT_METHODS.AIRTEL_MONEY ||
      payment.method === PAYMENT_METHODS.MTN_MONEY) {
    await payment.update({
      mobile_number: payment.metadata?.phoneNumber || payment.metadata?.mobileNumber,
      mobile_provider: payment.method,
    });
  }

  if (payment.method === PAYMENT_METHODS.CRYPTO) {
    await payment.update({
      crypto_address: payment.metadata?.cryptoAddress || null,
      crypto_network: payment.metadata?.cryptoNetwork || null,
    });
  }

  await payment.save();

  return result;
};

/**
 * Verify a withdrawal
 * @param {string} paymentId - Payment ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Verification result
 */
const verifyWithdrawal = async (paymentId, req = null) => {
  const payment = await Payment.findByPk(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.type !== PAYMENT_TYPES.WITHDRAWAL) {
    throw new Error('Payment is not a withdrawal');
  }

  if (payment.status === PAYMENT_STATUS.COMPLETED) {
    return { payment: payment.toJSON(), alreadyCompleted: true };
  }

  const gateway = paymentGateways[payment.provider];
  if (!gateway) {
    throw new Error(`Payment gateway not found: ${payment.provider}`);
  }

  // Verify with gateway
  const result = await gateway.verifyWithdrawal({
    paymentId: payment.id,
    reference: payment.reference,
    providerReference: payment.provider_reference,
  });

  if (result.status === 'completed') {
    // Complete the withdrawal
    return await completeWithdrawal(payment.id, result.gatewayData, req);
  }

  if (result.status === 'failed') {
    await payment.update({
      status: PAYMENT_STATUS.FAILED,
      failure_reason: result.failureReason || 'Verification failed',
      failure_code: result.failureCode,
    });

    // Reverse wallet transaction if needed
    // This would be handled by the wallet service
  }

  return {
    payment: payment.toJSON(),
    verificationStatus: result.status,
  };
};

/**
 * Complete a withdrawal
 * @param {string} paymentId - Payment ID
 * @param {Object} gatewayData - Gateway response data
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Completed payment
 */
const completeWithdrawal = async (paymentId, gatewayData = {}, req = null) => {
  const payment = await Payment.findByPk(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.status === PAYMENT_STATUS.COMPLETED) {
    return { payment: payment.toJSON(), alreadyCompleted: true };
  }

  if (payment.type !== PAYMENT_TYPES.WITHDRAWAL) {
    throw new Error('Payment is not a withdrawal');
  }

  // Complete the withdrawal in wallet
  const walletResult = await walletService.completeWithdrawal(
    payment.transaction_id,
    req
  );

  // Update payment
  await payment.update({
    status: PAYMENT_STATUS.COMPLETED,
    provider_data: gatewayData,
    completed_at: new Date(),
  });

  // Clear cache
  await cache.del(`payment:${paymentId}`);

  // Log audit
  await logAudit('WITHDRAWAL_COMPLETED', payment.user_id, {
    paymentId: payment.id,
    reference: payment.reference,
    amount: payment.amount,
  }, req);

  logger.info(`Withdrawal completed: ${payment.reference} - ${payment.amount} for user ${payment.user_id}`);

  return {
    payment: payment.toJSON(),
    wallet: walletResult.wallet,
    transaction: walletResult.transaction,
  };
};

/**
 * Reject a withdrawal (admin)
 * @param {string} paymentId - Payment ID
 * @param {string} reason - Rejection reason
 * @param {string} adminId - Admin user ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Rejected payment
 */
const rejectWithdrawal = async (paymentId, reason, adminId, req = null) => {
  const payment = await Payment.findByPk(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.type !== PAYMENT_TYPES.WITHDRAWAL) {
    throw new Error('Payment is not a withdrawal');
  }

  if (payment.status === PAYMENT_STATUS.COMPLETED) {
    throw new Error('Cannot reject a completed withdrawal');
  }

  // Reject in wallet
  const walletResult = await walletService.rejectWithdrawal(
    payment.transaction_id,
    reason,
    adminId,
    req
  );

  // Update payment
  await payment.update({
    status: PAYMENT_STATUS.FAILED,
    failure_reason: reason,
    failure_code: 'WITHDRAWAL_REJECTED',
    completed_at: new Date(),
  });

  await logAudit('WITHDRAWAL_REJECTED', payment.user_id, {
    paymentId: payment.id,
    reference: payment.reference,
    reason,
    adminId,
  }, req);

  logger.info(`Withdrawal rejected: ${payment.reference} by admin ${adminId}`);

  return {
    payment: payment.toJSON(),
    wallet: walletResult.wallet,
    transaction: walletResult.transaction,
  };
};

// ============================================
// REFUND PROCESSING
// ============================================

/**
 * Process a refund
 * @param {string} paymentId - Original payment ID
 * @param {string} reason - Refund reason
 * @param {string} adminId - Admin user ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Refund result
 */
const processRefund = async (paymentId, reason, adminId, req = null) => {
  const originalPayment = await Payment.findByPk(paymentId);
  if (!originalPayment) {
    throw new Error('Payment not found');
  }

  if (originalPayment.status !== PAYMENT_STATUS.COMPLETED) {
    throw new Error('Only completed payments can be refunded');
  }

  if (originalPayment.type === PAYMENT_TYPES.REFUND) {
    throw new Error('Cannot refund a refund');
  }

  // Check if already refunded
  const existingRefund = await Payment.findOne({
    where: {
      type: PAYMENT_TYPES.REFUND,
      status: PAYMENT_STATUS.COMPLETED,
      metadata: {
        [Op.contains]: { original_payment_id: originalPayment.id },
      },
    },
  });

  if (existingRefund) {
    throw new Error('This payment has already been refunded');
  }

  // Create refund payment record
  const refund = await Payment.create({
    user_id: originalPayment.user_id,
    wallet_id: originalPayment.wallet_id,
    type: PAYMENT_TYPES.REFUND,
    method: originalPayment.method,
    provider: originalPayment.provider,
    amount: originalPayment.amount,
    fee: 0,
    currency: originalPayment.currency,
    status: PAYMENT_STATUS.PENDING,
    reference: `REF-${originalPayment.reference}`,
    provider_reference: originalPayment.provider_reference,
    metadata: {
      original_payment_id: originalPayment.id,
      original_reference: originalPayment.reference,
      reason: reason,
      refunded_by: adminId,
    },
    admin_notes: reason,
    ip_address: req?.ip || null,
    user_agent: req?.headers?.['user-agent'] || null,
    requested_at: new Date(),
  });

  // Process refund through gateway
  const gateway = paymentGateways[originalPayment.provider];
  if (gateway) {
    try {
      const result = await gateway.processRefund({
        paymentId: originalPayment.id,
        reference: originalPayment.reference,
        providerReference: originalPayment.provider_reference,
        amount: originalPayment.amount,
        currency: originalPayment.currency,
        reason: reason,
      });

      if (result.status === 'completed') {
        await refund.update({
          status: PAYMENT_STATUS.COMPLETED,
          provider_data: result.gatewayData,
          completed_at: new Date(),
        });

        // Add funds back to wallet
        await walletService.processDeposit(
          originalPayment.user_id,
          originalPayment.amount,
          originalPayment.method,
          refund.reference,
          { refundId: refund.id, originalPaymentId: originalPayment.id },
          req
        );

        // Update original payment
        await originalPayment.update({
          status: PAYMENT_STATUS.REFUNDED,
          refunded_at: new Date(),
        });
      }
    } catch (error) {
      await refund.update({
        status: PAYMENT_STATUS.FAILED,
        failure_reason: error.message,
        failure_code: 'REFUND_FAILED',
      });
      throw error;
    }
  } else {
    // Manual refund (no gateway)
    await refund.update({
      status: PAYMENT_STATUS.COMPLETED,
      completed_at: new Date(),
    });

    // Add funds back to wallet
    await walletService.processDeposit(
      originalPayment.user_id,
      originalPayment.amount,
      originalPayment.method,
      refund.reference,
      { refundId: refund.id, originalPaymentId: originalPayment.id },
      req
    );

    await originalPayment.update({
      status: PAYMENT_STATUS.REFUNDED,
      refunded_at: new Date(),
    });
  }

  await logAudit('REFUND_PROCESSED', originalPayment.user_id, {
    originalPaymentId: originalPayment.id,
    refundId: refund.id,
    reason,
    adminId,
  }, req);

  logger.info(`Refund processed: ${originalPayment.reference} by admin ${adminId}`);

  return {
    refund: refund.toJSON(),
    originalPayment: originalPayment.toJSON(),
  };
};

// ============================================
// WEBHOOK HANDLING
// ============================================

/**
 * Handle payment webhook
 * @param {string} provider - Payment provider
 * @param {Object} payload - Webhook payload
 * @param {Object} headers - Request headers
 * @returns {Promise<Object>} - Webhook result
 */
const handleWebhook = async (provider, payload, headers = {}) => {
  // Get gateway
  const gateway = paymentGateways[provider];
  if (!gateway) {
    throw new Error(`Payment gateway not found: ${provider}`);
  }

  // Verify webhook signature
  if (gateway.verifyWebhook) {
    const isValid = await gateway.verifyWebhook(payload, headers);
    if (!isValid) {
      throw new Error('Webhook signature verification failed');
    }
  }

  // Process webhook
  const result = await gateway.handleWebhook(payload);

  // Process based on event type
  switch (result.event) {
    case 'deposit.completed':
      await handleDepositCompleted(result.data);
      break;
    case 'deposit.failed':
      await handleDepositFailed(result.data);
      break;
    case 'withdrawal.completed':
      await handleWithdrawalCompleted(result.data);
      break;
    case 'withdrawal.failed':
      await handleWithdrawalFailed(result.data);
      break;
    default:
      logger.info(`Unhandled webhook event: ${result.event}`);
  }

  return result;
};

/**
 * Handle deposit completed webhook
 * @param {Object} data - Webhook data
 * @returns {Promise<void>}
 */
const handleDepositCompleted = async (data) => {
  const { providerReference, amount, currency, gatewayData } = data;

  // Find payment by provider reference
  const payment = await Payment.findOne({
    where: {
      provider_reference: providerReference,
      type: PAYMENT_TYPES.DEPOSIT,
      status: {
        [Op.in]: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PROCESSING],
      },
    },
  });

  if (!payment) {
    logger.warn(`Deposit completed but payment not found: ${providerReference}`);
    return;
  }

  // Complete the deposit
  await completeDeposit(payment.id, gatewayData);
};

/**
 * Handle deposit failed webhook
 * @param {Object} data - Webhook data
 * @returns {Promise<void>}
 */
const handleDepositFailed = async (data) => {
  const { providerReference, failureReason, failureCode } = data;

  const payment = await Payment.findOne({
    where: {
      provider_reference: providerReference,
      type: PAYMENT_TYPES.DEPOSIT,
      status: {
        [Op.in]: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PROCESSING],
      },
    },
  });

  if (!payment) {
    logger.warn(`Deposit failed but payment not found: ${providerReference}`);
    return;
  }

  await payment.update({
    status: PAYMENT_STATUS.FAILED,
    failure_reason: failureReason || 'Payment failed',
    failure_code: failureCode || 'PAYMENT_FAILED',
    completed_at: new Date(),
  });

  logger.info(`Deposit failed: ${payment.reference} - ${failureReason}`);
};

/**
 * Handle withdrawal completed webhook
 * @param {Object} data - Webhook data
 * @returns {Promise<void>}
 */
const handleWithdrawalCompleted = async (data) => {
  const { providerReference, gatewayData } = data;

  const payment = await Payment.findOne({
    where: {
      provider_reference: providerReference,
      type: PAYMENT_TYPES.WITHDRAWAL,
      status: {
        [Op.in]: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PROCESSING],
      },
    },
  });

  if (!payment) {
    logger.warn(`Withdrawal completed but payment not found: ${providerReference}`);
    return;
  }

  // Complete the withdrawal
  await completeWithdrawal(payment.id, gatewayData);
};

/**
 * Handle withdrawal failed webhook
 * @param {Object} data - Webhook data
 * @returns {Promise<void>}
 */
const handleWithdrawalFailed = async (data) => {
  const { providerReference, failureReason, failureCode } = data;

  const payment = await Payment.findOne({
    where: {
      provider_reference: providerReference,
      type: PAYMENT_TYPES.WITHDRAWAL,
      status: {
        [Op.in]: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PROCESSING],
      },
    },
  });

  if (!payment) {
    logger.warn(`Withdrawal failed but payment not found: ${providerReference}`);
    return;
  }

  // Reverse wallet transaction
  try {
    await walletService.rejectWithdrawal(
      payment.transaction_id,
      failureReason || 'Withdrawal failed',
      null, // No admin
      null // No req
    );
  } catch (error) {
    logger.error(`Failed to reverse withdrawal wallet transaction: ${error.message}`);
  }

  await payment.update({
    status: PAYMENT_STATUS.FAILED,
    failure_reason: failureReason || 'Withdrawal failed',
    failure_code: failureCode || 'WITHDRAWAL_FAILED',
    completed_at: new Date(),
  });

  logger.info(`Withdrawal failed: ${payment.reference} - ${failureReason}`);
};

// ============================================
// PAYMENT RETRIEVAL
// ============================================

/**
 * Get payment by ID
 * @param {string} paymentId - Payment ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} - Payment
 */
const getPaymentById = async (paymentId, userId) => {
  const payment = await Payment.findOne({
    where: {
      id: paymentId,
      user_id: userId,
    },
  });

  if (!payment) {
    throw new Error('Payment not found');
  }

  return payment;
};

/**
 * Get payment by reference
 * @param {string} reference - Payment reference
 * @param {string} userId - User ID (optional)
 * @returns {Promise<Object>} - Payment
 */
const getPaymentByReference = async (reference, userId = null) => {
  const where = { reference };
  if (userId) where.user_id = userId;

  const payment = await Payment.findOne({ where });
  if (!payment) {
    throw new Error('Payment not found');
  }

  return payment;
};

/**
 * Get payment history
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Payment history
 */
const getPaymentHistory = async (userId, options = {}) => {
  const {
    limit = 50,
    offset = 0,
    type = null,
    method = null,
    status = null,
    startDate = null,
    endDate = null,
  } = options;

  const where = { user_id: userId };
  if (type) where.type = type;
  if (method) where.method = method;
  if (status) where.status = status;
  if (startDate) where.requested_at = { [Op.gte]: new Date(startDate) };
  if (endDate) where.requested_at = { ...where.requested_at, [Op.lte]: new Date(endDate) };

  const { count, rows } = await Payment.findAndCountAll({
    where,
    limit,
    offset,
    order: [['requested_at', 'DESC']],
    attributes: {
      exclude: ['provider_data', 'metadata'],
    },
  });

  return {
    payments: rows,
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
  };
};

/**
 * Get payment methods for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Payment methods
 */
const getPaymentMethods = async (userId) => {
  // Check cache
  const cacheKey = `payment_methods:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Invalid cache, continue
    }
  }

  // Get user's saved payment methods from recent successful payments
  const payments = await Payment.findAll({
    where: {
      user_id: userId,
      status: PAYMENT_STATUS.COMPLETED,
      [Op.or]: [
        { type: PAYMENT_TYPES.DEPOSIT },
        { type: PAYMENT_TYPES.WITHDRAWAL },
      ],
    },
    attributes: ['method', 'provider', 'card_last4', 'card_brand', 'bank_name', 'mobile_number'],
    group: ['method', 'provider', 'card_last4', 'card_brand', 'bank_name', 'mobile_number'],
    order: [[Payment.sequelize.fn('MAX', Payment.sequelize.col('created_at')), 'DESC']],
    limit: 10,
  });

  // Format methods
  const methods = payments.map(payment => {
    const method = {
      method: payment.method,
      provider: payment.provider,
      display: getMethodDisplay(payment),
    };

    if (payment.card_last4) {
      method.cardLast4 = payment.card_last4;
      method.cardBrand = payment.card_brand;
    }

    if (payment.bank_name) {
      method.bankName = payment.bank_name;
    }

    if (payment.mobile_number) {
      method.mobileNumber = payment.mobile_number;
    }

    return method;
  });

  // Remove duplicates
  const uniqueMethods = methods.filter((method, index, self) => {
    return self.findIndex(m => m.method === method.method && m.provider === method.provider) === index;
  });

  await cache.set(cacheKey, JSON.stringify(uniqueMethods), CACHE_TTL.PAYMENT_METHODS);

  return uniqueMethods;
};

/**
 * Get method display name
 * @param {Object} payment - Payment record
 * @returns {string} - Display name
 */
const getMethodDisplay = (payment) => {
  if (payment.card_brand && payment.card_last4) {
    return `${payment.card_brand} •••• ${payment.card_last4}`;
  }
  if (payment.bank_name) {
    return `${payment.bank_name}`;
  }
  if (payment.mobile_number) {
    const phone = payment.mobile_number;
    if (phone.length > 4) {
      return `••••${phone.slice(-4)}`;
    }
    return phone;
  }
  return payment.method.replace('_', ' ').toUpperCase();
};

// ============================================
// PAYMENT STATISTICS
// ============================================

/**
 * Get payment statistics
 * @param {string} userId - User ID
 * @param {Object} options - Options (period)
 * @returns {Promise<Object>} - Statistics
 */
const getPaymentStats = async (userId, options = {}) => {
  const { period = 'all' } = options;

  let dateFilter = {};
  if (period !== 'all') {
    const now = new Date();
    if (period === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      dateFilter = { requested_at: { [Op.gte]: start } };
    } else if (period === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      dateFilter = { requested_at: { [Op.gte]: start } };
    } else if (period === 'month') {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      dateFilter = { requested_at: { [Op.gte]: start } };
    } else if (period === 'year') {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      dateFilter = { requested_at: { [Op.gte]: start } };
    }
  }

  const where = { user_id: userId, ...dateFilter };

  const stats = await Payment.findOne({
    where,
    attributes: [
      [Payment.sequelize.fn('SUM', Payment.sequelize.literal('CASE WHEN type = \'deposit\' AND status = \'completed\' THEN amount ELSE 0 END')), 'total_deposits'],
      [Payment.sequelize.fn('SUM', Payment.sequelize.literal('CASE WHEN type = \'withdrawal\' AND status = \'completed\' THEN amount ELSE 0 END')), 'total_withdrawals'],
      [Payment.sequelize.fn('COUNT', Payment.sequelize.literal('CASE WHEN type = \'deposit\' AND status = \'completed\' THEN 1 END')), 'deposit_count'],
      [Payment.sequelize.fn('COUNT', Payment.sequelize.literal('CASE WHEN type = \'withdrawal\' AND status = \'completed\' THEN 1 END')), 'withdrawal_count'],
      [Payment.sequelize.fn('COUNT', Payment.sequelize.literal('CASE WHEN type = \'deposit\' AND status = \'pending\' THEN 1 END')), 'pending_deposits'],
      [Payment.sequelize.fn('COUNT', Payment.sequelize.literal('CASE WHEN type = \'withdrawal\' AND status = \'pending\' THEN 1 END')), 'pending_withdrawals'],
    ],
    raw: true,
  });

  return {
    totalDeposits: parseFloat(stats?.total_deposits || 0),
    totalWithdrawals: parseFloat(stats?.total_withdrawals || 0),
    depositCount: parseInt(stats?.deposit_count || 0),
    withdrawalCount: parseInt(stats?.withdrawal_count || 0),
    pendingDeposits: parseInt(stats?.pending_deposits || 0),
    pendingWithdrawals: parseInt(stats?.pending_withdrawals || 0),
    netDeposits: parseFloat(stats?.total_deposits || 0) - parseFloat(stats?.total_withdrawals || 0),
  };
};

// ============================================
// ADMIN OPERATIONS
// ============================================

/**
 * Get all payments (admin)
 * @param {Object} filters - Filters
 * @param {Object} pagination - Pagination options
 * @returns {Promise<Object>} - Payments
 */
const getAllPayments = async (filters = {}, pagination = {}) => {
  const { limit = 50, offset = 0, sortBy = 'requested_at', sortOrder = 'DESC' } = pagination;

  const where = {};

  if (filters.type) where.type = filters.type;
  if (filters.method) where.method = filters.method;
  if (filters.status) where.status = filters.status;
  if (filters.provider) where.provider = filters.provider;
  if (filters.userId) where.user_id = filters.userId;
  if (filters.minAmount) where.amount = { [Op.gte]: filters.minAmount };
  if (filters.maxAmount) where.amount = { ...where.amount, [Op.lte]: filters.maxAmount };
  if (filters.startDate) where.requested_at = { [Op.gte]: new Date(filters.startDate) };
  if (filters.endDate) where.requested_at = { ...where.requested_at, [Op.lte]: new Date(filters.endDate) };

  const { count, rows } = await Payment.findAndCountAll({
    where,
    limit,
    offset,
    order: [[sortBy, sortOrder]],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email', 'username'],
      },
      {
        model: Transaction,
        as: 'transaction',
        attributes: ['id', 'reference', 'description'],
      },
    ],
  });

  return {
    payments: rows,
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
  };
};

/**
 * Get pending payments (admin)
 * @param {Object} options - Options
 * @returns {Promise<Array>} - Pending payments
 */
const getPendingPayments = async (options = {}) => {
  const { limit = 100, type = null } = options;

  const where = {
    status: {
      [Op.in]: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PROCESSING],
    },
  };
  if (type) where.type = type;

  return Payment.findAll({
    where,
    limit,
    order: [['requested_at', 'ASC']],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email', 'username'],
      },
    ],
  });
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Payment Gateway Management
  initializePayment,
  
  // Deposit Processing
  initializeDeposit,
  verifyDeposit,
  completeDeposit,

  // Withdrawal Processing
  initializeWithdrawal,
  verifyWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,

  // Refund Processing
  processRefund,

  // Webhook Handling
  handleWebhook,
  handleDepositCompleted,
  handleDepositFailed,
  handleWithdrawalCompleted,
  handleWithdrawalFailed,

  // Payment Retrieval
  getPaymentById,
  getPaymentByReference,
  getPaymentHistory,
  getPaymentMethods,

  // Payment Statistics
  getPaymentStats,

  // Admin Operations
  getAllPayments,
  getPendingPayments,

  // Constants
  PAYMENT_STATUS,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
  CACHE_TTL,
};
