/**
 * Transaction Model - Financial Transaction Management
 * CephasGM GameZone
 * 
 * This model records all financial transactions in the system including
 * deposits, withdrawals, bets, bonuses, and transfers. It provides
 * comprehensive audit trail and reconciliation capabilities.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Transaction Model Definition
 */
const Transaction = sequelize.define(
  'Transaction',
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

    // Transaction Type
    type: {
      type: DataTypes.ENUM(
        'deposit',
        'withdrawal',
        'bet_placement',
        'bet_win',
        'bet_loss',
        'bet_cashout',
        'bonus_credited',
        'bonus_claimed',
        'bonus_forfeited',
        'referral_bonus',
        'transfer_in',
        'transfer_out',
        'fee',
        'tax',
        'adjustment',
        'refund',
        'payment_fee'
      ),
      allowNull: false,
    },

    // Transaction Category
    category: {
      type: DataTypes.ENUM(
        'deposit',
        'withdrawal',
        'betting',
        'bonus',
        'transfer',
        'fee',
        'adjustment'
      ),
      allowNull: false,
    },

    // Amounts
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    balance_before: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    balance_after: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    bonus_before: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    bonus_after: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },

    // Currency
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
      allowNull: false,
      validate: {
        len: [3, 3],
        isUppercase: true,
      },
    },

    // Exchange rate (for multi-currency transactions)
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

    // Transaction Status
    status: {
      type: DataTypes.ENUM(
        'pending',
        'processing',
        'completed',
        'failed',
        'cancelled',
        'reversed',
        'refunded'
      ),
      defaultValue: 'pending',
      allowNull: false,
    },

    // Payment Method (for deposits/withdrawals)
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    payment_provider: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    payment_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    payment_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Raw payment provider data',
    },

    // Bet Association (for betting transactions)
    bet_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'bets',
        key: 'id',
      },
    },

    // Bonus Association
    bonus_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'bonuses',
        key: 'id',
      },
    },

    // Related Transaction (for transfers)
    related_transaction_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'transactions',
        key: 'id',
      },
    },

    // Metadata
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    reference: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // Admin fields
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
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Failed transaction details
    failure_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    failure_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
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
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    // Model options
    tableName: 'transactions',
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
        fields: ['created_at'],
      },
      {
        fields: ['payment_reference'],
        unique: true,
        where: {
          payment_reference: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        fields: ['bet_id'],
        where: {
          bet_id: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        fields: ['bonus_id'],
        where: {
          bonus_id: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        fields: ['related_transaction_id'],
        where: {
          related_transaction_id: {
            [sequelize.Op.ne]: null,
          },
        },
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a transaction, generate a reference if not provided
       */
      beforeCreate: (transaction) => {
        if (!transaction.reference) {
          transaction.reference = generateTransactionReference();
        }

        // Validate balance_before/after consistency for non-adjustment transactions
        if (transaction.type !== 'adjustment') {
          // Ensure after = before + amount (for credits) or before - amount (for debits)
          const amount = parseFloat(transaction.amount);
          const before = parseFloat(transaction.balance_before);
          const after = parseFloat(transaction.balance_after);

          const isCredit = transaction.category === 'deposit' ||
                          transaction.category === 'bonus' ||
                          transaction.category === 'transfer_in';

          const expectedAfter = isCredit ? before + amount : before - amount;
          if (Math.abs(after - expectedAfter) > 0.01) {
            logger.warn(
              `Transaction ${transaction.reference} balance mismatch: ` +
              `before=${before}, after=${after}, amount=${amount}, expected=${expectedAfter}`
            );
          }
        }
      },

      /**
       * After creating a transaction, update related record statuses
       */
      afterCreate: async (transaction) => {
        // If transaction is linked to a bet, update bet status if completed
        if (transaction.bet_id && transaction.status === 'completed') {
          try {
            const Bet = sequelize.models.Bet;
            if (Bet) {
              await Bet.update(
                { status: 'settled' },
                { where: { id: transaction.bet_id } }
              );
            }
          } catch (error) {
            logger.error('Error updating bet status from transaction:', error);
          }
        }

        // If transaction is linked to a bonus, update bonus status if completed
        if (transaction.bonus_id && transaction.status === 'completed') {
          try {
            const Bonus = sequelize.models.Bonus;
            if (Bonus) {
              await Bonus.update(
                { status: 'claimed' },
                { where: { id: transaction.bonus_id } }
              );
            }
          } catch (error) {
            logger.error('Error updating bonus status from transaction:', error);
          }
        }
      },
    },
  }
);

/**
 * Generate a unique transaction reference
 * @returns {string} - Unique reference
 */
const generateTransactionReference = () => {
  const prefix = 'TXN';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

/**
 * Instance methods
 */
Transaction.prototype = {
  ...Transaction.prototype,

  /**
   * Check if transaction is a credit (incoming)
   * @returns {boolean} - Whether transaction is a credit
   */
  isCredit() {
    const creditTypes = [
      'deposit',
      'bet_win',
      'bonus_credited',
      'bonus_claimed',
      'referral_bonus',
      'transfer_in',
      'refund',
    ];
    return creditTypes.includes(this.type);
  },

  /**
   * Check if transaction is a debit (outgoing)
   * @returns {boolean} - Whether transaction is a debit
   */
  isDebit() {
    const debitTypes = [
      'withdrawal',
      'bet_placement',
      'bet_loss',
      'bet_cashout',
      'bonus_forfeited',
      'transfer_out',
      'fee',
      'tax',
      'payment_fee',
    ];
    return debitTypes.includes(this.type);
  },

  /**
   * Get the net effect of the transaction on balance
   * @returns {number} - Positive for credit, negative for debit
   */
  getNetEffect() {
    const amount = parseFloat(this.amount);
    return this.isCredit() ? amount : -amount;
  },

  /**
   * Format transaction for display
   * @param {string} currency - Currency symbol
   * @returns {Object} - Formatted transaction
   */
  formatForDisplay(currency = '$') {
    const netEffect = this.getNetEffect();
    const sign = netEffect >= 0 ? '+' : '-';
    const absAmount = Math.abs(parseFloat(this.amount));

    return {
      id: this.id,
      type: this.type,
      category: this.category,
      amount: `${sign}${currency}${absAmount.toFixed(2)}`,
      rawAmount: parseFloat(this.amount),
      netEffect: netEffect,
      status: this.status,
      description: this.description || this.type.replace(/_/g, ' ').toUpperCase(),
      reference: this.reference,
      createdAt: this.created_at,
      completedAt: this.completed_at,
    };
  },

  /**
   * Get transaction summary for reporting
   * @returns {Object} - Transaction summary
   */
  getSummary() {
    return {
      id: this.id,
      reference: this.reference,
      type: this.type,
      category: this.category,
      amount: parseFloat(this.amount),
      netEffect: this.getNetEffect(),
      status: this.status,
      balanceBefore: parseFloat(this.balance_before),
      balanceAfter: parseFloat(this.balance_after),
      createdAt: this.created_at,
      paymentMethod: this.payment_method,
      paymentProvider: this.payment_provider,
    };
  },

  /**
   * Check if transaction can be reversed
   * @returns {boolean} - Whether transaction can be reversed
   */
  canBeReversed() {
    const reversibleStatuses = ['completed', 'processing'];
    const reversibleTypes = ['deposit', 'withdrawal', 'bet_placement'];
    return reversibleStatuses.includes(this.status) && reversibleTypes.includes(this.type);
  },
};

/**
 * Static methods
 */
Transaction.findByUser = async function(userId, options = {}) {
  const { limit = 50, offset = 0, type = null, status = null, startDate = null, endDate = null } = options;

  const where = { user_id: userId };
  if (type) where.type = type;
  if (status) where.status = status;
  if (startDate) where.created_at = { [sequelize.Op.gte]: startDate };
  if (endDate) where.created_at = { [sequelize.Op.lte]: endDate };

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });
};

Transaction.findByWallet = async function(walletId, options = {}) {
  const { limit = 50, offset = 0, type = null, status = null } = options;

  const where = { wallet_id: walletId };
  if (type) where.type = type;
  if (status) where.status = status;

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });
};

Transaction.findByReference = async function(reference) {
  return this.findOne({
    where: { reference: reference },
  });
};

Transaction.findByPaymentReference = async function(paymentReference) {
  return this.findOne({
    where: { payment_reference: paymentReference },
  });
};

Transaction.findByBet = async function(betId) {
  return this.findAll({
    where: { bet_id: betId },
    order: [['created_at', 'ASC']],
  });
};

Transaction.findByBonus = async function(bonusId) {
  return this.findAll({
    where: { bonus_id: bonusId },
    order: [['created_at', 'ASC']],
  });
};

Transaction.getUserBalanceHistory = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return this.findAll({
    where: {
      user_id: userId,
      created_at: {
        [sequelize.Op.gte]: startDate,
      },
      status: 'completed',
    },
    attributes: [
      'created_at',
      'balance_after',
      [sequelize.literal('SUM(amount) OVER (ORDER BY created_at)'), 'running_balance'],
    ],
    order: [['created_at', 'ASC']],
  });
};

Transaction.getDailySummary = async function(userId, date = null) {
  const targetDate = date || new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  return this.findAll({
    where: {
      user_id: userId,
      created_at: {
        [sequelize.Op.between]: [startOfDay, endOfDay],
      },
      status: 'completed',
    },
    attributes: [
      'type',
      [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    group: ['type'],
    raw: true,
  });
};

Transaction.getTotalsByType = async function(userId, startDate = null, endDate = null) {
  const where = { user_id: userId, status: 'completed' };
  if (startDate) where.created_at = { [sequelize.Op.gte]: startDate };
  if (endDate) where.created_at = { ...where.created_at, [sequelize.Op.lte]: endDate };

  return this.findAll({
    where,
    attributes: [
      'type',
      [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    group: ['type'],
    raw: true,
  });
};

Transaction.getTotalDepositsAndWithdrawals = async function(userId) {
  const result = await this.findOne({
    where: {
      user_id: userId,
      status: 'completed',
    },
    attributes: [
      [
        sequelize.fn(
          'SUM',
          sequelize.literal(
            `CASE WHEN type IN ('deposit', 'transfer_in') THEN amount ELSE 0 END`
          )
        ),
        'total_deposits',
      ],
      [
        sequelize.fn(
          'SUM',
          sequelize.literal(
            `CASE WHEN type IN ('withdrawal', 'transfer_out') THEN amount ELSE 0 END`
          )
        ),
        'total_withdrawals',
      ],
      [
        sequelize.fn(
          'SUM',
          sequelize.literal(
            `CASE WHEN type IN ('bet_win') THEN amount ELSE 0 END`
          )
        ),
        'total_wins',
      ],
      [
        sequelize.fn(
          'SUM',
          sequelize.literal(
            `CASE WHEN type IN ('bet_placement', 'bet_loss') THEN amount ELSE 0 END`
          )
        ),
        'total_bets',
      ],
    ],
    raw: true,
  });

  return {
    total_deposits: parseFloat(result.total_deposits) || 0,
    total_withdrawals: parseFloat(result.total_withdrawals) || 0,
    total_wins: parseFloat(result.total_wins) || 0,
    total_bets: parseFloat(result.total_bets) || 0,
    net_balance: (parseFloat(result.total_deposits) || 0) +
                 (parseFloat(result.total_wins) || 0) -
                 (parseFloat(result.total_withdrawals) || 0) -
                 (parseFloat(result.total_bets) || 0),
  };
};

// Export the model
module.exports = Transaction;
