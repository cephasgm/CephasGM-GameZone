/**
 * Wallet Service - Wallet & Balance Management Business Logic
 * CephasGM GameZone
 * 
 * This service handles all wallet-related business logic including:
 * - Wallet balance management (main, bonus, locked, pending)
 * - Deposits and withdrawals
 * - Internal transfers between balances
 * - Transaction history and filtering
 * - Balance locking/unlocking for bets
 * - Daily/weekly/monthly tracking for limits
 * - Fee calculations
 * - Balance reconciliation
 */

const { Op } = require('sequelize');
const { Wallet, Transaction, User, AuditLog } = require('../models');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const { logAudit } = require('../utils/logger');

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const CACHE_TTL = {
  BALANCE: 60, // 1 minute
  TRANSACTIONS: 300, // 5 minutes
  LIMITS: 300, // 5 minutes
};

const TRANSACTION_TYPES = {
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  BET_PLACEMENT: 'bet_placement',
  BET_WIN: 'bet_win',
  BET_LOSS: 'bet_loss',
  BET_CASHOUT: 'bet_cashout',
  BONUS_CREDITED: 'bonus_credited',
  BONUS_CLAIMED: 'bonus_claimed',
  BONUS_FORFEITED: 'bonus_forfeited',
  REFERRAL_BONUS: 'referral_bonus',
  TRANSFER_IN: 'transfer_in',
  TRANSFER_OUT: 'transfer_out',
  FEE: 'fee',
  TAX: 'tax',
  ADJUSTMENT: 'adjustment',
  REFUND: 'refund',
  PAYMENT_FEE: 'payment_fee',
};

const TRANSACTION_CATEGORIES = {
  DEPOSIT: 'deposit',
  WITHDRAWAL: 'withdrawal',
  BETTING: 'betting',
  BONUS: 'bonus',
  TRANSFER: 'transfer',
  FEE: 'fee',
  ADJUSTMENT: 'adjustment',
};

// ============================================
// WALLET BALANCE MANAGEMENT
// ============================================

/**
 * Get user wallet with balances
 * @param {string} userId - User ID
 * @param {string} currency - Currency (optional)
 * @returns {Promise<Object>} - Wallet data
 */
const getWallet = async (userId, currency = null) => {
  const where = { user_id: userId };
  if (currency) {
    where.currency = currency.toUpperCase();
  }

  // Check cache
  const cacheKey = `wallet:${userId}:${currency || 'default'}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Invalid cache, continue
    }
  }

  const wallet = await Wallet.findOne({ where });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const walletData = {
    id: wallet.id,
    userId: wallet.user_id,
    currency: wallet.currency,
    balance: parseFloat(wallet.balance),
    bonusBalance: parseFloat(wallet.bonus_balance),
    lockedBalance: parseFloat(wallet.locked_balance),
    pendingBalance: parseFloat(wallet.pending_balance),
    totalBalance: parseFloat(wallet.balance) + parseFloat(wallet.bonus_balance),
    availableBalance: parseFloat(wallet.balance) + parseFloat(wallet.bonus_balance) - parseFloat(wallet.locked_balance),
    totalDeposited: parseFloat(wallet.total_deposited),
    totalWithdrawn: parseFloat(wallet.total_withdrawn),
    totalWon: parseFloat(wallet.total_won),
    totalLost: parseFloat(wallet.total_lost),
    status: wallet.status,
    limits: {
      daily: parseFloat(wallet.daily_limit),
      weekly: parseFloat(wallet.weekly_limit),
      monthly: parseFloat(wallet.monthly_limit),
    },
    daily: {
      deposited: parseFloat(wallet.today_deposited),
      withdrawn: parseFloat(wallet.today_withdrawn),
      bets: parseFloat(wallet.today_bets),
    },
    weekly: {
      deposited: parseFloat(wallet.week_deposited),
      withdrawn: parseFloat(wallet.week_withdrawn),
      bets: parseFloat(wallet.week_bets),
    },
    monthly: {
      deposited: parseFloat(wallet.month_deposited),
      withdrawn: parseFloat(wallet.month_withdrawn),
      bets: parseFloat(wallet.month_bets),
    },
    lastDepositAt: wallet.last_deposit_at,
    lastWithdrawalAt: wallet.last_withdrawal_at,
    lastBetAt: wallet.last_bet_at,
    createdAt: wallet.created_at,
    updatedAt: wallet.updated_at,
  };

  // Cache wallet data
  await cache.set(cacheKey, JSON.stringify(walletData), CACHE_TTL.BALANCE);

  return walletData;
};

/**
 * Get wallet balance only
 * @param {string} userId - User ID
 * @param {string} currency - Currency (optional)
 * @returns {Promise<Object>} - Balance data
 */
const getWalletBalance = async (userId, currency = null) => {
  const wallet = await getWallet(userId, currency);
  return {
    balance: wallet.balance,
    bonusBalance: wallet.bonusBalance,
    lockedBalance: wallet.lockedBalance,
    pendingBalance: wallet.pendingBalance,
    totalBalance: wallet.totalBalance,
    availableBalance: wallet.availableBalance,
    currency: wallet.currency,
  };
};

/**
 * Get wallet by ID (internal use)
 * @param {string} walletId - Wallet ID
 * @returns {Promise<Object>} - Wallet instance
 */
const getWalletById = async (walletId) => {
  const wallet = await Wallet.findByPk(walletId);
  if (!wallet) {
    throw new Error('Wallet not found');
  }
  return wallet;
};

// ============================================
// DEPOSIT OPERATIONS
// ============================================

/**
 * Process a deposit
 * @param {string} userId - User ID
 * @param {number} amount - Deposit amount
 * @param {string} method - Payment method
 * @param {string} reference - Payment reference
 * @param {Object} metadata - Additional metadata
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Transaction result
 */
const processDeposit = async (userId, amount, method, reference, metadata = {}, req = null) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  // Get wallet
  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  // Check daily/weekly/monthly limits
  const limits = await checkDepositLimits(wallet, amount);
  if (!limits.allowed) {
    throw new Error(`Deposit limit exceeded: ${limits.reason}`);
  }

  // Check if the wallet is active
  if (wallet.status !== 'active') {
    throw new Error('Wallet is not active');
  }

  // Start transaction
  const transaction = await Wallet.sequelize.transaction();

  try {
    // Get current balances
    const currentBalance = parseFloat(wallet.balance);
    const currentBonusBalance = parseFloat(wallet.bonus_balance);
    const currentLockedBalance = parseFloat(wallet.locked_balance);
    const currentPendingBalance = parseFloat(wallet.pending_balance);

    // Update wallet balances
    const newBalance = currentBalance + amount;
    const newTotalDeposited = parseFloat(wallet.total_deposited) + amount;

    await wallet.update({
      balance: newBalance,
      total_deposited: newTotalDeposited,
      today_deposited: parseFloat(wallet.today_deposited) + amount,
      week_deposited: parseFloat(wallet.week_deposited) + amount,
      month_deposited: parseFloat(wallet.month_deposited) + amount,
      last_deposit_at: new Date(),
    }, { transaction });

    // Create transaction record
    const transactionRecord = await Transaction.create({
      user_id: userId,
      wallet_id: wallet.id,
      type: TRANSACTION_TYPES.DEPOSIT,
      category: TRANSACTION_CATEGORIES.DEPOSIT,
      amount: amount,
      balance_before: currentBalance,
      balance_after: newBalance,
      bonus_before: currentBonusBalance,
      bonus_after: currentBonusBalance,
      currency: wallet.currency,
      status: 'completed',
      payment_method: method,
      payment_reference: reference,
      payment_data: metadata,
      description: `Deposit via ${method}`,
      reference: reference,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
      completed_at: new Date(),
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Clear cache
    await cache.del(`wallet:${userId}:${wallet.currency}`);

    // Log audit
    await logAudit('DEPOSIT_PROCESSED', userId, { amount, method, reference }, req);
    logger.info(`Deposit processed: ${amount} ${wallet.currency} for user ${userId} (${reference})`);

    return {
      success: true,
      transaction: transactionRecord,
      wallet: await getWallet(userId),
      amount,
      newBalance,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Deposit failed for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Process a deposit (pending status)
 * @param {string} userId - User ID
 * @param {number} amount - Deposit amount
 * @param {string} method - Payment method
 * @param {string} reference - Payment reference
 * @param {Object} metadata - Additional metadata
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Pending transaction
 */
const processPendingDeposit = async (userId, amount, method, reference, metadata = {}, req = null) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const transaction = await Wallet.sequelize.transaction();

  try {
    const currentBalance = parseFloat(wallet.balance);
    const currentBonusBalance = parseFloat(wallet.bonus_balance);
    const currentPendingBalance = parseFloat(wallet.pending_balance);

    // Update pending balance
    await wallet.update({
      pending_balance: currentPendingBalance + amount,
    }, { transaction });

    // Create transaction record
    const transactionRecord = await Transaction.create({
      user_id: userId,
      wallet_id: wallet.id,
      type: TRANSACTION_TYPES.DEPOSIT,
      category: TRANSACTION_CATEGORIES.DEPOSIT,
      amount: amount,
      balance_before: currentBalance,
      balance_after: currentBalance,
      bonus_before: currentBonusBalance,
      bonus_after: currentBonusBalance,
      currency: wallet.currency,
      status: 'pending',
      payment_method: method,
      payment_reference: reference,
      payment_data: metadata,
      description: `Pending deposit via ${method}`,
      reference: reference,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
    }, { transaction });

    await transaction.commit();

    logger.info(`Pending deposit created: ${amount} ${wallet.currency} for user ${userId} (${reference})`);

    return {
      success: true,
      transaction: transactionRecord,
      pendingAmount: amount,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Pending deposit failed for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Complete a pending deposit
 * @param {string} transactionId - Transaction ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Completed transaction
 */
const completePendingDeposit = async (transactionId, req = null) => {
  const transactionRecord = await Transaction.findByPk(transactionId);
  if (!transactionRecord) {
    throw new Error('Transaction not found');
  }

  if (transactionRecord.status !== 'pending') {
    throw new Error('Transaction is not pending');
  }

  if (transactionRecord.type !== TRANSACTION_TYPES.DEPOSIT) {
    throw new Error('Transaction is not a deposit');
  }

  const wallet = await Wallet.findByPk(transactionRecord.wallet_id);
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const dbTransaction = await Wallet.sequelize.transaction();

  try {
    const amount = parseFloat(transactionRecord.amount);
    const currentBalance = parseFloat(wallet.balance);
    const currentBonusBalance = parseFloat(wallet.bonus_balance);
    const currentPendingBalance = parseFloat(wallet.pending_balance);

    // Update wallet balances
    await wallet.update({
      balance: currentBalance + amount,
      pending_balance: currentPendingBalance - amount,
      total_deposited: parseFloat(wallet.total_deposited) + amount,
      today_deposited: parseFloat(wallet.today_deposited) + amount,
      week_deposited: parseFloat(wallet.week_deposited) + amount,
      month_deposited: parseFloat(wallet.month_deposited) + amount,
      last_deposit_at: new Date(),
    }, { transaction: dbTransaction });

    // Update transaction
    await transactionRecord.update({
      status: 'completed',
      balance_before: currentBalance,
      balance_after: currentBalance + amount,
      completed_at: new Date(),
    }, { transaction: dbTransaction });

    await dbTransaction.commit();

    // Clear cache
    await cache.del(`wallet:${wallet.user_id}:${wallet.currency}`);

    await logAudit('DEPOSIT_COMPLETED', wallet.user_id, { amount: transactionRecord.amount, transactionId }, req);
    logger.info(`Pending deposit completed: ${transactionId} for user ${wallet.user_id}`);

    return {
      success: true,
      transaction: transactionRecord,
      wallet: await getWallet(wallet.user_id),
    };

  } catch (error) {
    await dbTransaction.rollback();
    logger.error(`Failed to complete pending deposit ${transactionId}:`, error);
    throw error;
  }
};

// ============================================
// WITHDRAWAL OPERATIONS
// ============================================

/**
 * Process a withdrawal
 * @param {string} userId - User ID
 * @param {number} amount - Withdrawal amount
 * @param {string} method - Payment method
 * @param {Object} accountDetails - Account details for withdrawal
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Transaction result
 */
const processWithdrawal = async (userId, amount, method, accountDetails, req = null) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  // Get wallet
  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  // Check if wallet has sufficient funds
  const availableBalance = parseFloat(wallet.balance) + parseFloat(wallet.bonus_balance) - parseFloat(wallet.locked_balance);
  if (availableBalance < amount) {
    throw new Error('Insufficient funds for withdrawal');
  }

  // Check withdrawal limits
  const limits = await checkWithdrawalLimits(wallet, amount);
  if (!limits.allowed) {
    throw new Error(`Withdrawal limit exceeded: ${limits.reason}`);
  }

  // Check if the wallet is active
  if (wallet.status !== 'active') {
    throw new Error('Wallet is not active');
  }

  // Start transaction
  const transaction = await Wallet.sequelize.transaction();

  try {
    // Get current balances
    const currentBalance = parseFloat(wallet.balance);
    const currentBonusBalance = parseFloat(wallet.bonus_balance);
    const currentLockedBalance = parseFloat(wallet.locked_balance);

    // Determine which balance to deduct from (main first, then bonus)
    let mainDeduction = Math.min(amount, currentBalance);
    let bonusDeduction = Math.min(amount - mainDeduction, currentBonusBalance);

    // If still not enough, use locked balance
    if (mainDeduction + bonusDeduction < amount) {
      const remaining = amount - mainDeduction - bonusDeduction;
      if (remaining <= currentLockedBalance) {
        // Use locked balance
        await wallet.update({
          locked_balance: currentLockedBalance - remaining,
        }, { transaction });
      } else {
        throw new Error('Insufficient funds for withdrawal');
      }
    }

    // Update wallet balances
    const newBalance = currentBalance - mainDeduction;
    const newBonusBalance = currentBonusBalance - bonusDeduction;
    const newTotalWithdrawn = parseFloat(wallet.total_withdrawn) + amount;

    await wallet.update({
      balance: newBalance,
      bonus_balance: newBonusBalance,
      total_withdrawn: newTotalWithdrawn,
      today_withdrawn: parseFloat(wallet.today_withdrawn) + amount,
      week_withdrawn: parseFloat(wallet.week_withdrawn) + amount,
      month_withdrawn: parseFloat(wallet.month_withdrawn) + amount,
      last_withdrawal_at: new Date(),
    }, { transaction });

    // Generate withdrawal reference
    const reference = `WTH-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create transaction record
    const transactionRecord = await Transaction.create({
      user_id: userId,
      wallet_id: wallet.id,
      type: TRANSACTION_TYPES.WITHDRAWAL,
      category: TRANSACTION_CATEGORIES.WITHDRAWAL,
      amount: amount,
      balance_before: currentBalance,
      balance_after: newBalance,
      bonus_before: currentBonusBalance,
      bonus_after: newBonusBalance,
      currency: wallet.currency,
      status: 'pending',
      payment_method: method,
      payment_reference: reference,
      payment_data: accountDetails,
      description: `Withdrawal via ${method}`,
      reference: reference,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // Clear cache
    await cache.del(`wallet:${userId}:${wallet.currency}`);

    // Log audit
    await logAudit('WITHDRAWAL_REQUESTED', userId, { amount, method, reference }, req);
    logger.info(`Withdrawal requested: ${amount} ${wallet.currency} for user ${userId} (${reference})`);

    return {
      success: true,
      transaction: transactionRecord,
      wallet: await getWallet(userId),
      amount,
      reference,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Withdrawal failed for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Approve a withdrawal (admin action)
 * @param {string} transactionId - Transaction ID
 * @param {string} adminId - Admin user ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Approved transaction
 */
const approveWithdrawal = async (transactionId, adminId, req = null) => {
  const transactionRecord = await Transaction.findByPk(transactionId);
  if (!transactionRecord) {
    throw new Error('Transaction not found');
  }

  if (transactionRecord.status !== 'pending') {
    throw new Error('Transaction is not pending');
  }

  if (transactionRecord.type !== TRANSACTION_TYPES.WITHDRAWAL) {
    throw new Error('Transaction is not a withdrawal');
  }

  // Update transaction
  await transactionRecord.update({
    status: 'processing',
    approved_by: adminId,
    approved_at: new Date(),
  });

  await logAudit('WITHDRAWAL_APPROVED', transactionRecord.user_id, { transactionId, adminId }, req);
  logger.info(`Withdrawal approved: ${transactionId} by admin ${adminId}`);

  return {
    success: true,
    transaction: transactionRecord,
  };
};

/**
 * Complete a withdrawal (mark as completed)
 * @param {string} transactionId - Transaction ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Completed transaction
 */
const completeWithdrawal = async (transactionId, req = null) => {
  const transactionRecord = await Transaction.findByPk(transactionId);
  if (!transactionRecord) {
    throw new Error('Transaction not found');
  }

  if (transactionRecord.status !== 'processing' && transactionRecord.status !== 'pending') {
    throw new Error('Transaction cannot be completed');
  }

  if (transactionRecord.type !== TRANSACTION_TYPES.WITHDRAWAL) {
    throw new Error('Transaction is not a withdrawal');
  }

  await transactionRecord.update({
    status: 'completed',
    completed_at: new Date(),
  });

  await logAudit('WITHDRAWAL_COMPLETED', transactionRecord.user_id, { transactionId }, req);
  logger.info(`Withdrawal completed: ${transactionId}`);

  return {
    success: true,
    transaction: transactionRecord,
  };
};

/**
 * Reject a withdrawal (admin action)
 * @param {string} transactionId - Transaction ID
 * @param {string} reason - Rejection reason
 * @param {string} adminId - Admin user ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Rejected transaction
 */
const rejectWithdrawal = async (transactionId, reason, adminId, req = null) => {
  const transactionRecord = await Transaction.findByPk(transactionId);
  if (!transactionRecord) {
    throw new Error('Transaction not found');
  }

  if (transactionRecord.status !== 'pending' && transactionRecord.status !== 'processing') {
    throw new Error('Transaction cannot be rejected');
  }

  if (transactionRecord.type !== TRANSACTION_TYPES.WITHDRAWAL) {
    throw new Error('Transaction is not a withdrawal');
  }

  const wallet = await Wallet.findByPk(transactionRecord.wallet_id);
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const dbTransaction = await Wallet.sequelize.transaction();

  try {
    // Refund the amount to the wallet
    const amount = parseFloat(transactionRecord.amount);
    const currentBalance = parseFloat(wallet.balance);
    const currentBonusBalance = parseFloat(wallet.bonus_balance);
    const currentLockedBalance = parseFloat(wallet.locked_balance);
    const currentPendingBalance = parseFloat(wallet.pending_balance);

    await wallet.update({
      balance: currentBalance + amount,
      // Reverse the withdrawal tracking
      today_withdrawn: parseFloat(wallet.today_withdrawn) - amount,
      week_withdrawn: parseFloat(wallet.week_withdrawn) - amount,
      month_withdrawn: parseFloat(wallet.month_withdrawn) - amount,
      total_withdrawn: parseFloat(wallet.total_withdrawn) - amount,
    }, { transaction: dbTransaction });

    // Update transaction
    await transactionRecord.update({
      status: 'failed',
      failure_reason: reason,
      failure_code: 'WITHDRAWAL_REJECTED',
      completed_at: new Date(),
    }, { transaction: dbTransaction });

    // Create refund transaction
    await Transaction.create({
      user_id: transactionRecord.user_id,
      wallet_id: wallet.id,
      type: TRANSACTION_TYPES.REFUND,
      category: TRANSACTION_CATEGORIES.ADJUSTMENT,
      amount: amount,
      balance_before: currentBalance,
      balance_after: currentBalance + amount,
      bonus_before: currentBonusBalance,
      bonus_after: currentBonusBalance,
      currency: wallet.currency,
      status: 'completed',
      payment_method: transactionRecord.payment_method,
      description: `Refund for rejected withdrawal ${transactionRecord.reference}`,
      reference: `REF-${transactionRecord.reference}`,
      completed_at: new Date(),
      admin_notes: reason,
    }, { transaction: dbTransaction });

    await dbTransaction.commit();

    // Clear cache
    await cache.del(`wallet:${wallet.user_id}:${wallet.currency}`);

    await logAudit('WITHDRAWAL_REJECTED', transactionRecord.user_id, { transactionId, reason, adminId }, req);
    logger.info(`Withdrawal rejected: ${transactionId} by admin ${adminId}`);

    return {
      success: true,
      transaction: transactionRecord,
    };

  } catch (error) {
    await dbTransaction.rollback();
    logger.error(`Failed to reject withdrawal ${transactionId}:`, error);
    throw error;
  }
};

// ============================================
// BET OPERATIONS (Wallet Integration)
// ============================================

/**
 * Lock funds for a bet
 * @param {string} userId - User ID
 * @param {number} amount - Bet amount
 * @param {string} betId - Bet ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Lock result
 */
const lockFundsForBet = async (userId, amount, betId, req = null) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  // Check if wallet has sufficient funds
  const availableBalance = parseFloat(wallet.balance) + parseFloat(wallet.bonus_balance) - parseFloat(wallet.locked_balance);
  if (availableBalance < amount) {
    throw new Error('Insufficient funds for bet');
  }

  const transaction = await Wallet.sequelize.transaction();

  try {
    const currentLockedBalance = parseFloat(wallet.locked_balance);
    const currentBalance = parseFloat(wallet.balance);
    const currentBonusBalance = parseFloat(wallet.bonus_balance);

    // Determine which balance to lock from (main first, then bonus)
    let mainLock = Math.min(amount, currentBalance);
    let bonusLock = Math.min(amount - mainLock, currentBonusBalance);

    // Update wallet
    await wallet.update({
      locked_balance: currentLockedBalance + amount,
      today_bets: parseFloat(wallet.today_bets) + amount,
      week_bets: parseFloat(wallet.week_bets) + amount,
      month_bets: parseFloat(wallet.month_bets) + amount,
      last_bet_at: new Date(),
    }, { transaction });

    // Create transaction record
    const transactionRecord = await Transaction.create({
      user_id: userId,
      wallet_id: wallet.id,
      type: TRANSACTION_TYPES.BET_PLACEMENT,
      category: TRANSACTION_CATEGORIES.BETTING,
      amount: amount,
      balance_before: currentBalance,
      balance_after: currentBalance - mainLock,
      bonus_before: currentBonusBalance,
      bonus_after: currentBonusBalance - bonusLock,
      currency: wallet.currency,
      status: 'completed',
      bet_id: betId,
      description: `Bet placed (${betId})`,
      reference: `BET-${betId}`,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
      completed_at: new Date(),
    }, { transaction });

    await transaction.commit();

    // Clear cache
    await cache.del(`wallet:${userId}:${wallet.currency}`);

    await logAudit('BET_FUNDS_LOCKED', userId, { amount, betId }, req);
    logger.info(`Funds locked for bet: ${amount} ${wallet.currency} for user ${userId} (bet: ${betId})`);

    return {
      success: true,
      transaction: transactionRecord,
      lockedAmount: amount,
      mainLocked: mainLock,
      bonusLocked: bonusLock,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Failed to lock funds for bet ${betId}:`, error);
    throw error;
  }
};

/**
 * Unlock funds for a bet (refund)
 * @param {string} userId - User ID
 * @param {number} amount - Amount to unlock
 * @param {string} betId - Bet ID
 * @param {string} reason - Reason for unlock
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Unlock result
 */
const unlockFundsForBet = async (userId, amount, betId, reason = 'Bet cancelled', req = null) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const currentLockedBalance = parseFloat(wallet.locked_balance);
  if (currentLockedBalance < amount) {
    throw new Error('Insufficient locked funds');
  }

  const transaction = await Wallet.sequelize.transaction();

  try {
    const currentBalance = parseFloat(wallet.balance);
    const currentBonusBalance = parseFloat(wallet.bonus_balance);

    // Unlock funds (return to main balance)
    await wallet.update({
      locked_balance: currentLockedBalance - amount,
      balance: currentBalance + amount,
    }, { transaction });

    // Create transaction record
    const transactionRecord = await Transaction.create({
      user_id: userId,
      wallet_id: wallet.id,
      type: TRANSACTION_TYPES.REFUND,
      category: TRANSACTION_CATEGORIES.ADJUSTMENT,
      amount: amount,
      balance_before: currentBalance,
      balance_after: currentBalance + amount,
      bonus_before: currentBonusBalance,
      bonus_after: currentBonusBalance,
      currency: wallet.currency,
      status: 'completed',
      bet_id: betId,
      description: `Funds unlocked for bet ${betId}: ${reason}`,
      reference: `UNLOCK-${betId}`,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
      completed_at: new Date(),
    }, { transaction });

    await transaction.commit();

    // Clear cache
    await cache.del(`wallet:${userId}:${wallet.currency}`);

    await logAudit('BET_FUNDS_UNLOCKED', userId, { amount, betId, reason }, req);
    logger.info(`Funds unlocked for bet: ${amount} ${wallet.currency} for user ${userId} (bet: ${betId})`);

    return {
      success: true,
      transaction: transactionRecord,
      unlockedAmount: amount,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Failed to unlock funds for bet ${betId}:`, error);
    throw error;
  }
};

/**
 * Process bet win
 * @param {string} userId - User ID
 * @param {number} winAmount - Win amount
 * @param {string} betId - Bet ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Win result
 */
const processBetWin = async (userId, winAmount, betId, req = null) => {
  if (winAmount <= 0) {
    throw new Error('Win amount must be greater than 0');
  }

  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const transaction = await Wallet.sequelize.transaction();

  try {
    const currentBalance = parseFloat(wallet.balance);
    const currentBonusBalance = parseFloat(wallet.bonus_balance);
    const currentLockedBalance = parseFloat(wallet.locked_balance);

    // Update wallet
    await wallet.update({
      balance: currentBalance + winAmount,
      total_won: parseFloat(wallet.total_won) + winAmount,
    }, { transaction });

    // Create transaction record
    const transactionRecord = await Transaction.create({
      user_id: userId,
      wallet_id: wallet.id,
      type: TRANSACTION_TYPES.BET_WIN,
      category: TRANSACTION_CATEGORIES.BETTING,
      amount: winAmount,
      balance_before: currentBalance,
      balance_after: currentBalance + winAmount,
      bonus_before: currentBonusBalance,
      bonus_after: currentBonusBalance,
      currency: wallet.currency,
      status: 'completed',
      bet_id: betId,
      description: `Bet win (${betId})`,
      reference: `WIN-${betId}`,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
      completed_at: new Date(),
    }, { transaction });

    await transaction.commit();

    // Clear cache
    await cache.del(`wallet:${userId}:${wallet.currency}`);

    await logAudit('BET_WIN_PROCESSED', userId, { winAmount, betId }, req);
    logger.info(`Bet win processed: ${winAmount} ${wallet.currency} for user ${userId} (bet: ${betId})`);

    return {
      success: true,
      transaction: transactionRecord,
      winAmount,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Failed to process bet win for ${betId}:`, error);
    throw error;
  }
};

/**
 * Process bet loss
 * @param {string} userId - User ID
 * @param {number} amount - Loss amount
 * @param {string} betId - Bet ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Loss result
 */
const processBetLoss = async (userId, amount, betId, req = null) => {
  if (amount <= 0) {
    throw new Error('Loss amount must be greater than 0');
  }

  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const transaction = await Wallet.sequelize.transaction();

  try {
    const currentLockedBalance = parseFloat(wallet.locked_balance);

    // Remove locked funds
    await wallet.update({
      locked_balance: currentLockedBalance - amount,
      total_lost: parseFloat(wallet.total_lost) + amount,
    }, { transaction });

    // Create transaction record
    const transactionRecord = await Transaction.create({
      user_id: userId,
      wallet_id: wallet.id,
      type: TRANSACTION_TYPES.BET_LOSS,
      category: TRANSACTION_CATEGORIES.BETTING,
      amount: amount,
      balance_before: parseFloat(wallet.balance),
      balance_after: parseFloat(wallet.balance),
      bonus_before: parseFloat(wallet.bonus_balance),
      bonus_after: parseFloat(wallet.bonus_balance),
      currency: wallet.currency,
      status: 'completed',
      bet_id: betId,
      description: `Bet loss (${betId})`,
      reference: `LOSS-${betId}`,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
      completed_at: new Date(),
    }, { transaction });

    await transaction.commit();

    // Clear cache
    await cache.del(`wallet:${userId}:${wallet.currency}`);

    await logAudit('BET_LOSS_PROCESSED', userId, { amount, betId }, req);
    logger.info(`Bet loss processed: ${amount} ${wallet.currency} for user ${userId} (bet: ${betId})`);

    return {
      success: true,
      transaction: transactionRecord,
      lossAmount: amount,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Failed to process bet loss for ${betId}:`, error);
    throw error;
  }
};

// ============================================
// BONUS OPERATIONS
// ============================================

/**
 * Credit bonus to wallet
 * @param {string} userId - User ID
 * @param {number} amount - Bonus amount
 * @param {string} bonusId - Bonus ID
 * @param {string} reason - Reason for bonus
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Credit result
 */
const creditBonus = async (userId, amount, bonusId, reason = 'Bonus credited', req = null) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const transaction = await Wallet.sequelize.transaction();

  try {
    const currentBonusBalance = parseFloat(wallet.bonus_balance);

    await wallet.update({
      bonus_balance: currentBonusBalance + amount,
    }, { transaction });

    // Create transaction record
    const transactionRecord = await Transaction.create({
      user_id: userId,
      wallet_id: wallet.id,
      type: TRANSACTION_TYPES.BONUS_CREDITED,
      category: TRANSACTION_CATEGORIES.BONUS,
      amount: amount,
      balance_before: parseFloat(wallet.balance),
      balance_after: parseFloat(wallet.balance),
      bonus_before: currentBonusBalance,
      bonus_after: currentBonusBalance + amount,
      currency: wallet.currency,
      status: 'completed',
      bonus_id: bonusId,
      description: reason,
      reference: `BONUS-${bonusId}`,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
      completed_at: new Date(),
    }, { transaction });

    await transaction.commit();

    // Clear cache
    await cache.del(`wallet:${userId}:${wallet.currency}`);

    await logAudit('BONUS_CREDITED', userId, { amount, bonusId, reason }, req);
    logger.info(`Bonus credited: ${amount} ${wallet.currency} for user ${userId} (bonus: ${bonusId})`);

    return {
      success: true,
      transaction: transactionRecord,
      creditedAmount: amount,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Failed to credit bonus ${bonusId}:`, error);
    throw error;
  }
};

/**
 * Process bonus claim
 * @param {string} userId - User ID
 * @param {number} amount - Bonus amount
 * @param {string} bonusId - Bonus ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Claim result
 */
const processBonusClaim = async (userId, amount, bonusId, req = null) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const transaction = await Wallet.sequelize.transaction();

  try {
    const currentBalance = parseFloat(wallet.balance);
    const currentBonusBalance = parseFloat(wallet.bonus_balance);

    if (currentBonusBalance < amount) {
      throw new Error('Insufficient bonus balance');
    }

    // Transfer from bonus to main balance
    await wallet.update({
      balance: currentBalance + amount,
      bonus_balance: currentBonusBalance - amount,
    }, { transaction });

    // Create transaction record
    const transactionRecord = await Transaction.create({
      user_id: userId,
      wallet_id: wallet.id,
      type: TRANSACTION_TYPES.BONUS_CLAIMED,
      category: TRANSACTION_CATEGORIES.BONUS,
      amount: amount,
      balance_before: currentBalance,
      balance_after: currentBalance + amount,
      bonus_before: currentBonusBalance,
      bonus_after: currentBonusBalance - amount,
      currency: wallet.currency,
      status: 'completed',
      bonus_id: bonusId,
      description: `Bonus claimed (${bonusId})`,
      reference: `BONUS-CLAIM-${bonusId}`,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
      completed_at: new Date(),
    }, { transaction });

    await transaction.commit();

    // Clear cache
    await cache.del(`wallet:${userId}:${wallet.currency}`);

    await logAudit('BONUS_CLAIMED', userId, { amount, bonusId }, req);
    logger.info(`Bonus claimed: ${amount} ${wallet.currency} for user ${userId} (bonus: ${bonusId})`);

    return {
      success: true,
      transaction: transactionRecord,
      claimedAmount: amount,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Failed to claim bonus ${bonusId}:`, error);
    throw error;
  }
};

// ============================================
// TRANSACTION MANAGEMENT
// ============================================

/**
 * Get transaction history
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Transaction history
 */
const getTransactionHistory = async (userId, options = {}) => {
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
  } = options;

  // Check cache for frequent queries
  const cacheKey = `transactions:${userId}:${JSON.stringify(options)}`;
  const cached = await cache.get(cacheKey);
  if (cached && offset === 0) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Invalid cache, continue
    }
  }

  const where = { user_id: userId };
  if (type) where.type = type;
  if (category) where.category = category;
  if (status) where.status = status;
  if (startDate) where.created_at = { [Op.gte]: new Date(startDate) };
  if (endDate) where.created_at = { ...where.created_at, [Op.lte]: new Date(endDate) };
  if (minAmount) where.amount = { [Op.gte]: minAmount };
  if (maxAmount) where.amount = { ...where.amount, [Op.lte]: maxAmount };

  const { count, rows } = await Transaction.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: {
      exclude: ['payment_data'],
    },
  });

  const result = {
    transactions: rows,
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
  };

  // Cache only if no offset (first page)
  if (offset === 0) {
    await cache.set(cacheKey, JSON.stringify(result), CACHE_TTL.TRANSACTIONS);
  }

  return result;
};

/**
 * Get transaction by ID
 * @param {string} transactionId - Transaction ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} - Transaction
 */
const getTransactionById = async (transactionId, userId) => {
  const transaction = await Transaction.findOne({
    where: {
      id: transactionId,
      user_id: userId,
    },
  });

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  return transaction;
};

/**
 * Get transaction by reference
 * @param {string} reference - Transaction reference
 * @param {string} userId - User ID (optional)
 * @returns {Promise<Object>} - Transaction
 */
const getTransactionByReference = async (reference, userId = null) => {
  const where = { reference };
  if (userId) where.user_id = userId;

  const transaction = await Transaction.findOne({ where });
  if (!transaction) {
    throw new Error('Transaction not found');
  }

  return transaction;
};

/**
 * Get transaction summary
 * @param {string} userId - User ID
 * @param {Object} options - Options (period)
 * @returns {Promise<Object>} - Transaction summary
 */
const getTransactionSummary = async (userId, options = {}) => {
  const { period = 'all' } = options;

  let dateFilter = {};
  if (period !== 'all') {
    const now = new Date();
    if (period === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      dateFilter = { created_at: { [Op.gte]: start } };
    } else if (period === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      dateFilter = { created_at: { [Op.gte]: start } };
    } else if (period === 'month') {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      dateFilter = { created_at: { [Op.gte]: start } };
    } else if (period === 'year') {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      dateFilter = { created_at: { [Op.gte]: start } };
    }
  }

  const where = { user_id: userId, status: 'completed', ...dateFilter };

  const summary = await Transaction.findOne({
    where,
    attributes: [
      [Transaction.sequelize.fn('SUM', Transaction.sequelize.literal('CASE WHEN type IN (\'deposit\', \'transfer_in\', \'bet_win\', \'bonus_credited\', \'refund\') THEN amount ELSE 0 END')), 'total_credits'],
      [Transaction.sequelize.fn('SUM', Transaction.sequelize.literal('CASE WHEN type IN (\'withdrawal\', \'transfer_out\', \'bet_placement\', \'bet_loss\', \'fee\') THEN amount ELSE 0 END')), 'total_debits'],
      [Transaction.sequelize.fn('COUNT', Transaction.sequelize.literal('CASE WHEN type IN (\'deposit\') THEN 1 END')), 'deposit_count'],
      [Transaction.sequelize.fn('COUNT', Transaction.sequelize.literal('CASE WHEN type IN (\'withdrawal\') THEN 1 END')), 'withdrawal_count'],
      [Transaction.sequelize.fn('COUNT', Transaction.sequelize.literal('CASE WHEN type IN (\'bet_placement\') THEN 1 END')), 'bet_count'],
      [Transaction.sequelize.fn('COUNT', Transaction.sequelize.literal('CASE WHEN type IN (\'bet_win\') THEN 1 END')), 'win_count'],
    ],
    raw: true,
  });

  return {
    totalCredits: parseFloat(summary?.total_credits || 0),
    totalDebits: parseFloat(summary?.total_debits || 0),
    netAmount: parseFloat(summary?.total_credits || 0) - parseFloat(summary?.total_debits || 0),
    depositCount: parseInt(summary?.deposit_count || 0),
    withdrawalCount: parseInt(summary?.withdrawal_count || 0),
    betCount: parseInt(summary?.bet_count || 0),
    winCount: parseInt(summary?.win_count || 0),
  };
};

// ============================================
// LIMIT CHECKS
// ============================================

/**
 * Check deposit limits
 * @param {Object} wallet - Wallet instance
 * @param {number} amount - Deposit amount
 * @returns {Promise<Object>} - Limit check result
 */
const checkDepositLimits = async (wallet, amount) => {
  const dailyLimit = parseFloat(wallet.daily_limit);
  const weeklyLimit = parseFloat(wallet.weekly_limit);
  const monthlyLimit = parseFloat(wallet.monthly_limit);

  const todayDeposited = parseFloat(wallet.today_deposited);
  const weekDeposited = parseFloat(wallet.week_deposited);
  const monthDeposited = parseFloat(wallet.month_deposited);

  if (dailyLimit > 0 && todayDeposited + amount > dailyLimit) {
    return { allowed: false, reason: `Daily deposit limit exceeded (${dailyLimit})` };
  }

  if (weeklyLimit > 0 && weekDeposited + amount > weeklyLimit) {
    return { allowed: false, reason: `Weekly deposit limit exceeded (${weeklyLimit})` };
  }

  if (monthlyLimit > 0 && monthDeposited + amount > monthlyLimit) {
    return { allowed: false, reason: `Monthly deposit limit exceeded (${monthlyLimit})` };
  }

  return { allowed: true };
};

/**
 * Check withdrawal limits
 * @param {Object} wallet - Wallet instance
 * @param {number} amount - Withdrawal amount
 * @returns {Promise<Object>} - Limit check result
 */
const checkWithdrawalLimits = async (wallet, amount) => {
  const dailyLimit = parseFloat(wallet.daily_limit);
  const weeklyLimit = parseFloat(wallet.weekly_limit);
  const monthlyLimit = parseFloat(wallet.monthly_limit);

  const todayWithdrawn = parseFloat(wallet.today_withdrawn);
  const weekWithdrawn = parseFloat(wallet.week_withdrawn);
  const monthWithdrawn = parseFloat(wallet.month_withdrawn);

  if (dailyLimit > 0 && todayWithdrawn + amount > dailyLimit) {
    return { allowed: false, reason: `Daily withdrawal limit exceeded (${dailyLimit})` };
  }

  if (weeklyLimit > 0 && weekWithdrawn + amount > weeklyLimit) {
    return { allowed: false, reason: `Weekly withdrawal limit exceeded (${weeklyLimit})` };
  }

  if (monthlyLimit > 0 && monthWithdrawn + amount > monthlyLimit) {
    return { allowed: false, reason: `Monthly withdrawal limit exceeded (${monthlyLimit})` };
  }

  return { allowed: true };
};

// ============================================
// ADMIN OPERATIONS
// ============================================

/**
 * Adjust wallet balance (admin)
 * @param {string} userId - User ID
 * @param {number} amount - Adjustment amount (positive = credit, negative = debit)
 * @param {string} reason - Adjustment reason
 * @param {string} adminId - Admin user ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Adjustment result
 */
const adjustWalletBalance = async (userId, amount, reason, adminId, req = null) => {
  if (amount === 0) {
    throw new Error('Adjustment amount must not be zero');
  }

  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const transaction = await Wallet.sequelize.transaction();

  try {
    const currentBalance = parseFloat(wallet.balance);
    const newBalance = currentBalance + amount;

    if (newBalance < 0) {
      throw new Error('Adjustment would result in negative balance');
    }

    await wallet.update({
      balance: newBalance,
    }, { transaction });

    const transactionType = amount > 0 ? TRANSACTION_TYPES.ADJUSTMENT : TRANSACTION_TYPES.ADJUSTMENT;
    const category = TRANSACTION_CATEGORIES.ADJUSTMENT;

    const transactionRecord = await Transaction.create({
      user_id: userId,
      wallet_id: wallet.id,
      type: transactionType,
      category: category,
      amount: Math.abs(amount),
      balance_before: currentBalance,
      balance_after: newBalance,
      bonus_before: parseFloat(wallet.bonus_balance),
      bonus_after: parseFloat(wallet.bonus_balance),
      currency: wallet.currency,
      status: 'completed',
      description: `Admin adjustment: ${reason}`,
      reference: `ADJ-${Date.now()}`,
      completed_at: new Date(),
      admin_notes: `Adjusted by admin ${adminId}: ${reason}`,
      approved_by: adminId,
    }, { transaction });

    await transaction.commit();

    // Clear cache
    await cache.del(`wallet:${userId}:${wallet.currency}`);

    await logAudit('WALLET_ADJUSTED', userId, { amount, reason, adminId }, req);
    logger.info(`Wallet adjusted: ${amount} ${wallet.currency} for user ${userId} by admin ${adminId}`);

    return {
      success: true,
      transaction: transactionRecord,
      newBalance,
      adjustmentAmount: amount,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Failed to adjust wallet for user ${userId}:`, error);
    throw error;
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Balance Management
  getWallet,
  getWalletBalance,
  getWalletById,

  // Deposits
  processDeposit,
  processPendingDeposit,
  completePendingDeposit,

  // Withdrawals
  processWithdrawal,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,

  // Bet Operations
  lockFundsForBet,
  unlockFundsForBet,
  processBetWin,
  processBetLoss,

  // Bonus Operations
  creditBonus,
  processBonusClaim,

  // Transaction Management
  getTransactionHistory,
  getTransactionById,
  getTransactionByReference,
  getTransactionSummary,

  // Admin
  adjustWalletBalance,

  // Constants
  TRANSACTION_TYPES,
  TRANSACTION_CATEGORIES,
  CACHE_TTL,
};
