/**
 * Payment Model - Payment Transaction Management
 * CephasGM GameZone
 * 
 * This model manages all payment transactions including deposits,
 * withdrawals, and payment method management. It supports multiple
 * payment providers, currencies, and transaction status tracking.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Payment Model Definition
 */
const Payment = sequelize.define(
  'Payment',
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    // User Association
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },

    // Wallet Association
    wallet_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'wallets',
        key: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },

    // Transaction Association
    transaction_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'transactions',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },

    // Payment Type
    type: {
      type: DataTypes.ENUM('deposit', 'withdrawal', 'refund', 'chargeback'),
      allowNull: false,
    },

    // Payment Method
    method: {
      type: DataTypes.ENUM(
        'card',
        'bank_transfer',
        'mobile_money',
        'crypto',
        'paypal',
        'stripe',
        'mpesa',
        'airtel_money',
        'mtn_money',
        'voucher'
      ),
      allowNull: false,
    },

    // Payment Provider
    provider: {
      type: DataTypes.ENUM(
        'stripe',
        'paypal',
        'mpesa',
        'airtel',
        'mtn',
        'crypto',
        'bank',
        'voucher'
      ),
      allowNull: false,
    },

    // Amounts
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },
    fee: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
      allowNull: false,
    },

    // Exchange rate (for multi-currency)
    exchange_rate: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
    },
    base_currency: {
      type: DataTypes.STRING(3),
      allowNull: true,
    },
    base_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },

    // Payment Status
    status: {
      type: DataTypes.ENUM(
        'pending',
        'processing',
        'completed',
        'failed',
        'cancelled',
        'refunded',
        'chargeback'
      ),
      defaultValue: 'pending',
      allowNull: false,
    },

    // Payment Reference
    reference: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    provider_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    provider_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    // Card Details (masked)
    card_last4: {
      type: DataTypes.STRING(4),
      allowNull: true,
      validate: {
        len: [4, 4],
      },
    },
    card_brand: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    card_expiry: {
      type: DataTypes.STRING(5),
      allowNull: true,
      validate: {
        len: [5, 5],
      },
    },
    card_holder_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // Bank Transfer Details
    bank_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    bank_account_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    bank_account_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    bank_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    bank_reference: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Mobile Money Details
    mobile_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    mobile_provider: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    mobile_reference: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Crypto Details
    crypto_address: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    crypto_network: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    crypto_tx_hash: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    crypto_confirmations: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },

    // Payment Method Details (stored as JSON)
    payment_method_details: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    // IP and Device Info
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    device_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // Timestamps
    requested_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    refunded_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Failure details
    failure_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    failure_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Admin
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    approved_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },

    // Timestamps
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    // Model options
    tableName: 'payments',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['wallet_id'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['provider'],
      },
      {
        fields: ['reference'],
        unique: true,
      },
      {
        fields: ['provider_reference'],
        where: {
          provider_reference: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        fields: ['created_at'],
      },
      {
        // For user payment history
        fields: ['user_id', 'type', 'status'],
      },
      {
        // For provider lookups
        fields: ['provider', 'provider_reference'],
        where: {
          provider_reference: {
            [sequelize.Op.ne]: null,
          },
        },
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a payment, generate reference
       */
      beforeCreate: (payment) => {
        if (!payment.reference) {
          payment.reference = generatePaymentReference();
        }
        if (!payment.requested_at) {
          payment.requested_at = new Date();
        }
      },

      /**
       * Before updating a payment, handle status changes
       */
      beforeUpdate: (payment) => {
        if (payment.changed('status')) {
          const newStatus = payment.status;

          if (newStatus === 'processing' && !payment.processed_at) {
            payment.processed_at = new Date();
          }
          if (newStatus === 'completed' && !payment.completed_at) {
            payment.completed_at = new Date();
          }
          if (newStatus === 'failed' && !payment.failed_at) {
            payment.failed_at = new Date();
          }
          if (newStatus === 'refunded' && !payment.refunded_at) {
            payment.refunded_at = new Date();
          }
        }
      },

      /**
       * After creating a payment, log the event
       */
      afterCreate: async (payment) => {
        logger.info(
          `Payment created: ${payment.reference} - ${payment.type} - ` +
          `${payment.amount} ${payment.currency} - ${payment.status}`
        );
      },

      /**
       * After updating a payment, log status changes
       */
      afterUpdate: async (payment) => {
        if (payment.changed('status')) {
          logger.info(
            `Payment status updated: ${payment.reference} - ` +
            `${payment.previous('status')} → ${payment.status}`
          );
        }
      },
    },
  }
);

/**
 * Generate a unique payment reference
 * @returns {string} - Unique reference
 */
const generatePaymentReference = () => {
  const prefix = 'PAY';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

/**
 * Instance methods
 */
Payment.prototype = {
  ...Payment.prototype,

  /**
   * Check if payment is completed
   * @returns {boolean} - Whether payment is completed
   */
  isCompleted() {
    return this.status === 'completed';
  },

  /**
   * Check if payment is pending
   * @returns {boolean} - Whether payment is pending
   */
  isPending() {
    return this.status === 'pending' || this.status === 'processing';
  },

  /**
   * Check if payment is a deposit
   * @returns {boolean} - Whether payment is a deposit
   */
  isDeposit() {
    return this.type === 'deposit';
  },

  /**
   * Check if payment is a withdrawal
   * @returns {boolean} - Whether payment is a withdrawal
   */
  isWithdrawal() {
    return this.type === 'withdrawal';
  },

  /**
   * Get payment amount with fee
   * @returns {number} - Total amount including fee
   */
  getTotalAmount() {
    return parseFloat(this.amount) + parseFloat(this.fee);
  },

  /**
   * Get payment status display name
   * @returns {string} - Display name
   */
  getStatusDisplay() {
    const statusMap = {
      pending: '⏳ Pending',
      processing: '🔄 Processing',
      completed: '✅ Completed',
      failed: '❌ Failed',
      cancelled: '⛔ Cancelled',
      refunded: '↩️ Refunded',
      chargeback: '🔙 Chargeback',
    };
    return statusMap[this.status] || this.status;
  },

  /**
   * Get payment method display name
   * @returns {string} - Display name
   */
  getMethodDisplay() {
    const methodMap = {
      card: '💳 Credit Card',
      bank_transfer: '🏦 Bank Transfer',
      mobile_money: '📱 Mobile Money',
      crypto: '₿ Cryptocurrency',
      paypal: '💸 PayPal',
      stripe: '💳 Stripe',
      mpesa: '📱 M-Pesa',
      airtel_money: '📱 Airtel Money',
      mtn_money: '📱 MTN Mobile Money',
      voucher: '🎫 Voucher',
    };
    return methodMap[this.method] || this.method;
  },

  /**
   * Get payment summary for display
   * @param {string} currencySymbol - Currency symbol
   * @returns {Object} - Payment summary
   */
  getSummary(currencySymbol = '$') {
    return {
      id: this.id,
      reference: this.reference,
      type: this.type,
      method: this.method,
      methodDisplay: this.getMethodDisplay(),
      provider: this.provider,
      amount: `${currencySymbol}${parseFloat(this.amount).toFixed(2)}`,
      fee: `${currencySymbol}${parseFloat(this.fee).toFixed(2)}`,
      total: `${currencySymbol}${this.getTotalAmount().toFixed(2)}`,
      status: this.status,
      statusDisplay: this.getStatusDisplay(),
      requestedAt: this.requested_at,
      completedAt: this.completed_at,
      providerReference: this.provider_reference,
    };
  },

  /**
   * Get masked payment details
   * @returns {Object} - Masked payment details
   */
  getMaskedDetails() {
    const details = {
      method: this.method,
      provider: this.provider,
      last4: this.card_last4 || null,
      brand: this.card_brand || null,
      mobileNumber: this.mobile_number ? maskPhone(this.mobile_number) : null,
      bankName: this.bank_name || null,
      cryptoAddress: this.crypto_address ? maskCryptoAddress(this.crypto_address) : null,
    };
    return details;
  },
};

/**
 * Utility functions for masking
 */
const maskPhone = (phone) => {
  if (!phone) return null;
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.length <= 4) return cleaned;
  return cleaned.slice(0, 2) + '****' + cleaned.slice(-2);
};

const maskCryptoAddress = (address) => {
  if (!address) return null;
  if (address.length <= 10) return address;
  return address.slice(0, 6) + '...' + address.slice(-4);
};

/**
 * Static methods
 */
Payment.findByUser = async function(userId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    type = null,
    status = null,
    startDate = null,
    endDate = null,
  } = options;

  const where = { user_id: userId };
  if (type) where.type = type;
  if (status) where.status = status;
  if (startDate) where.requested_at = { [sequelize.Op.gte]: startDate };
  if (endDate) where.requested_at = { ...where.requested_at, [sequelize.Op.lte]: endDate };

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['requested_at', 'DESC']],
  });
};

Payment.findByReference = async function(reference) {
  return this.findOne({
    where: { reference: reference },
  });
};

Payment.findByProviderReference = async function(provider, providerReference) {
  return this.findOne({
    where: {
      provider: provider,
      provider_reference: providerReference,
    },
  });
};

Payment.findPendingPayments = async function(limit = 100) {
  return this.findAll({
    where: {
      status: ['pending', 'processing'],
    },
    order: [['requested_at', 'ASC']],
    limit,
  });
};

Payment.findCompletedPaymentsByUser = async function(userId, startDate = null, endDate = null) {
  const where = {
    user_id: userId,
    status: 'completed',
  };
  if (startDate) where.completed_at = { [sequelize.Op.gte]: startDate };
  if (endDate) where.completed_at = { ...where.completed_at, [sequelize.Op.lte]: endDate };

  return this.findAll({
    where,
    order: [['completed_at', 'DESC']],
  });
};

Payment.getUserPaymentStats = async function(userId) {
  const result = await this.findOne({
    where: {
      user_id: userId,
      status: 'completed',
    },
    attributes: [
      [
        sequelize.fn(
          'SUM',
          sequelize.literal(`CASE WHEN type = 'deposit' THEN amount ELSE 0 END`)
        ),
        'total_deposits',
      ],
      [
        sequelize.fn(
          'SUM',
          sequelize.literal(`CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END`)
        ),
        'total_withdrawals',
      ],
      [
        sequelize.fn(
          'COUNT',
          sequelize.literal(`CASE WHEN type = 'deposit' THEN 1 END`)
        ),
        'deposit_count',
      ],
      [
        sequelize.fn(
          'COUNT',
          sequelize.literal(`CASE WHEN type = 'withdrawal' THEN 1 END`)
        ),
        'withdrawal_count',
      ],
    ],
    raw: true,
  });

  return {
    total_deposits: parseFloat(result.total_deposits) || 0,
    total_withdrawals: parseFloat(result.total_withdrawals) || 0,
    deposit_count: parseInt(result.deposit_count) || 0,
    withdrawal_count: parseInt(result.withdrawal_count) || 0,
    net_deposits: (parseFloat(result.total_deposits) || 0) - (parseFloat(result.total_withdrawals) || 0),
  };
};

Payment.getDailyPaymentVolume = async function(date = null) {
  const targetDate = date || new Date();
  const startDate = new Date(targetDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(targetDate);
  endDate.setHours(23, 59, 59, 999);

  const result = await this.findAll({
    where: {
      status: 'completed',
      completed_at: {
        [sequelize.Op.between]: [startDate, endDate],
      },
    },
    attributes: [
      'type',
      [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('fee')), 'total_fees'],
    ],
    group: ['type'],
    raw: true,
  });

  const stats = {
    date: startDate,
    total_deposits: 0,
    total_withdrawals: 0,
    deposit_count: 0,
    withdrawal_count: 0,
    total_fees: 0,
    net_volume: 0,
  };

  for (const row of result) {
    if (row.type === 'deposit') {
      stats.total_deposits = parseFloat(row.total_amount) || 0;
      stats.deposit_count = parseInt(row.count) || 0;
    } else if (row.type === 'withdrawal') {
      stats.total_withdrawals = parseFloat(row.total_amount) || 0;
      stats.withdrawal_count = parseInt(row.count) || 0;
    }
    stats.total_fees += parseFloat(row.total_fees) || 0;
  }

  stats.net_volume = stats.total_deposits - stats.total_withdrawals;
  return stats;
};

Payment.getPaymentMethodStats = async function() {
  const result = await this.findAll({
    where: {
      status: 'completed',
    },
    attributes: [
      'method',
      [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    group: ['method'],
    raw: true,
  });

  const stats = {};
  let total = 0;
  let count = 0;

  for (const row of result) {
    stats[row.method] = {
      total: parseFloat(row.total_amount) || 0,
      count: parseInt(row.count) || 0,
    };
    total += parseFloat(row.total_amount) || 0;
    count += parseInt(row.count) || 0;
  }

  return {
    methods: stats,
    total_volume: total,
    total_transactions: count,
  };
};

Payment.getPendingWithdrawals = async function() {
  return this.findAll({
    where: {
      type: 'withdrawal',
      status: ['pending', 'processing'],
    },
    order: [['requested_at', 'ASC']],
    include: [
      {
        model: sequelize.models.User,
        attributes: ['id', 'first_name', 'last_name', 'email', 'username'],
      },
    ],
  });
};

// Export the model
module.exports = Payment;
