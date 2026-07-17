/**
 * Wallet Model - User Wallet Management
 * CephasGM GameZone
 * 
 * This model manages user wallet accounts including balances,
 * multi-currency support, transaction tracking, and wallet status.
 * Each user has one primary wallet with support for multiple currencies.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Wallet Model Definition
 */
const Wallet = sequelize.define(
  'Wallet',
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
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
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

    // Balances
    balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    bonus_balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    locked_balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    pending_balance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
      validate: {
        min: 0,
      },
    },

    // Total deposited/withdrawn (for reporting)
    total_deposited: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    total_withdrawn: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    total_won: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    total_lost: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },

    // Wallet Status
    status: {
      type: DataTypes.ENUM('active', 'frozen', 'suspended', 'closed'),
      defaultValue: 'active',
      allowNull: false,
    },

    // Limits
    daily_limit: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    weekly_limit: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    monthly_limit: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
      },
    },

    // Daily tracking (for limits)
    today_deposited: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    today_withdrawn: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    today_bets: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    today_reset_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Weekly tracking
    week_deposited: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    week_withdrawn: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    week_bets: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    week_reset_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Monthly tracking
    month_deposited: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    month_withdrawn: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    month_bets: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    month_reset_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Last activity timestamps
    last_deposit_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_withdrawal_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_bet_at: {
      type: DataTypes.DATE,
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
  },
  {
    // Model options
    tableName: 'wallets',
    timestamps: true,
    paranoid: false, // Wallets are not soft-deleted
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
        unique: true,
      },
      {
        fields: ['currency'],
      },
      {
        fields: ['status'],
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a wallet, ensure default values
       */
      beforeCreate: (wallet) => {
        // Set today's reset time if not set
        if (!wallet.today_reset_at) {
          wallet.today_reset_at = new Date();
          wallet.today_reset_at.setHours(0, 0, 0, 0);
        }
        if (!wallet.week_reset_at) {
          wallet.week_reset_at = new Date();
          wallet.week_reset_at.setHours(0, 0, 0, 0);
          // Set to start of week (Monday)
          const day = wallet.week_reset_at.getDay();
          const diff = wallet.week_reset_at.getDate() - day + (day === 0 ? -6 : 1);
          wallet.week_reset_at.setDate(diff);
        }
        if (!wallet.month_reset_at) {
          wallet.month_reset_at = new Date();
          wallet.month_reset_at.setHours(0, 0, 0, 0);
          wallet.month_reset_at.setDate(1);
        }
      },

      /**
       * Before updating a wallet, reset daily/weekly/monthly counters if needed
       */
      beforeUpdate: async (wallet) => {
        const now = new Date();

        // Reset daily counters
        if (wallet.today_reset_at) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const resetDate = new Date(wallet.today_reset_at);
          resetDate.setHours(0, 0, 0, 0);

          if (today > resetDate) {
            wallet.today_deposited = 0;
            wallet.today_withdrawn = 0;
            wallet.today_bets = 0;
            wallet.today_reset_at = today;
          }
        }

        // Reset weekly counters
        if (wallet.week_reset_at) {
          const now = new Date();
          const resetDate = new Date(wallet.week_reset_at);
          // Check if a week has passed
          const diffDays = Math.floor((now - resetDate) / (1000 * 60 * 60 * 24));
          if (diffDays >= 7) {
            wallet.week_deposited = 0;
            wallet.week_withdrawn = 0;
            wallet.week_bets = 0;
            wallet.week_reset_at = new Date();
            wallet.week_reset_at.setHours(0, 0, 0, 0);
            const day = wallet.week_reset_at.getDay();
            const diff = wallet.week_reset_at.getDate() - day + (day === 0 ? -6 : 1);
            wallet.week_reset_at.setDate(diff);
          }
        }

        // Reset monthly counters
        if (wallet.month_reset_at) {
          const now = new Date();
          const resetDate = new Date(wallet.month_reset_at);
          // Check if a month has passed
          if (now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
            wallet.month_deposited = 0;
            wallet.month_withdrawn = 0;
            wallet.month_bets = 0;
            wallet.month_reset_at = new Date();
            wallet.month_reset_at.setHours(0, 0, 0, 0);
            wallet.month_reset_at.setDate(1);
          }
        }
      },
    },
  }
);

/**
 * Instance methods
 */
Wallet.prototype = {
  ...Wallet.prototype,

  /**
   * Get total balance (main + bonus)
   * @returns {number} - Total balance
   */
  getTotalBalance() {
    return parseFloat(this.balance) + parseFloat(this.bonus_balance);
  },

  /**
   * Get available balance (total - locked)
   * @returns {number} - Available balance
   */
  getAvailableBalance() {
    return this.getTotalBalance() - parseFloat(this.locked_balance);
  },

  /**
   * Check if wallet has sufficient funds
   * @param {number} amount - Amount to check
   * @param {boolean} useBonus - Whether to include bonus balance
   * @returns {boolean} - Whether sufficient funds exist
   */
  hasSufficientFunds(amount, useBonus = true) {
    const available = useBonus
      ? this.getAvailableBalance()
      : parseFloat(this.balance) - parseFloat(this.locked_balance);
    return available >= amount;
  },

  /**
   * Add funds to wallet
   * @param {number} amount - Amount to add
   * @param {string} type - 'main' or 'bonus'
   * @returns {Promise<Wallet>} - Updated wallet
   */
  async addFunds(amount, type = 'main') {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (type === 'bonus') {
      this.bonus_balance = parseFloat(this.bonus_balance) + amount;
    } else {
      this.balance = parseFloat(this.balance) + amount;
    }

    await this.save();
    logger.info(`Added ${amount} to wallet ${this.id} (${type})`);
    return this;
  },

  /**
   * Deduct funds from wallet
   * @param {number} amount - Amount to deduct
   * @param {string} type - 'main' or 'bonus' (priority order)
   * @param {boolean} useBonusFirst - Whether to use bonus balance first
   * @returns {Promise<Object>} - { mainUsed, bonusUsed }
   */
  async deductFunds(amount, type = 'main', useBonusFirst = true) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    let remaining = amount;
    let mainUsed = 0;
    let bonusUsed = 0;

    if (useBonusFirst) {
      // Use bonus balance first
      const bonusAvailable = parseFloat(this.bonus_balance);
      if (bonusAvailable > 0) {
        bonusUsed = Math.min(remaining, bonusAvailable);
        this.bonus_balance = bonusAvailable - bonusUsed;
        remaining -= bonusUsed;
      }
    }

    // Use main balance
    if (remaining > 0) {
      const mainAvailable = parseFloat(this.balance) - parseFloat(this.locked_balance);
      if (mainAvailable < remaining) {
        throw new Error('Insufficient funds');
      }
      mainUsed = remaining;
      this.balance = parseFloat(this.balance) - remaining;
      remaining = 0;
    }

    await this.save();

    if (mainUsed > 0 || bonusUsed > 0) {
      logger.info(
        `Deducted ${amount} from wallet ${this.id} (main: ${mainUsed}, bonus: ${bonusUsed})`
      );
    }

    return { mainUsed, bonusUsed };
  },

  /**
   * Lock funds in wallet
   * @param {number} amount - Amount to lock
   * @returns {Promise<Wallet>} - Updated wallet
   */
  async lockFunds(amount) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const available = this.getAvailableBalance();
    if (available < amount) {
      throw new Error('Insufficient available funds to lock');
    }

    this.locked_balance = parseFloat(this.locked_balance) + amount;
    await this.save();
    logger.info(`Locked ${amount} from wallet ${this.id}`);
    return this;
  },

  /**
   * Unlock funds in wallet
   * @param {number} amount - Amount to unlock
   * @returns {Promise<Wallet>} - Updated wallet
   */
  async unlockFunds(amount) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const locked = parseFloat(this.locked_balance);
    if (locked < amount) {
      throw new Error('Insufficient locked funds');
    }

    this.locked_balance = locked - amount;
    await this.save();
    logger.info(`Unlocked ${amount} from wallet ${this.id}`);
    return this;
  },

  /**
   * Check if daily limit has been reached
   * @param {number} amount - Amount to check
   * @param {string} type - 'deposit', 'withdrawal', 'bet'
   * @returns {Promise<boolean>} - Whether limit is reached
   */
  async checkDailyLimit(amount, type = 'deposit') {
    const limit = parseFloat(this.daily_limit);
    if (limit <= 0) return false;

    let current = 0;
    switch (type) {
      case 'deposit':
        current = parseFloat(this.today_deposited);
        break;
      case 'withdrawal':
        current = parseFloat(this.today_withdrawn);
        break;
      case 'bet':
        current = parseFloat(this.today_bets);
        break;
      default:
        return false;
    }

    return (current + amount) > limit;
  },

  /**
   * Check if weekly limit has been reached
   * @param {number} amount - Amount to check
   * @param {string} type - 'deposit', 'withdrawal', 'bet'
   * @returns {Promise<boolean>} - Whether limit is reached
   */
  async checkWeeklyLimit(amount, type = 'deposit') {
    const limit = parseFloat(this.weekly_limit);
    if (limit <= 0) return false;

    let current = 0;
    switch (type) {
      case 'deposit':
        current = parseFloat(this.week_deposited);
        break;
      case 'withdrawal':
        current = parseFloat(this.week_withdrawn);
        break;
      case 'bet':
        current = parseFloat(this.week_bets);
        break;
      default:
        return false;
    }

    return (current + amount) > limit;
  },

  /**
   * Check if monthly limit has been reached
   * @param {number} amount - Amount to check
   * @param {string} type - 'deposit', 'withdrawal', 'bet'
   * @returns {Promise<boolean>} - Whether limit is reached
   */
  async checkMonthlyLimit(amount, type = 'deposit') {
    const limit = parseFloat(this.monthly_limit);
    if (limit <= 0) return false;

    let current = 0;
    switch (type) {
      case 'deposit':
        current = parseFloat(this.month_deposited);
        break;
      case 'withdrawal':
        current = parseFloat(this.month_withdrawn);
        break;
      case 'bet':
        current = parseFloat(this.month_bets);
        break;
      default:
        return false;
    }

    return (current + amount) > limit;
  },

  /**
   * Track a deposit
   * @param {number} amount - Deposit amount
   * @returns {Promise<Wallet>} - Updated wallet
   */
  async trackDeposit(amount) {
    this.total_deposited = parseFloat(this.total_deposited) + amount;
    this.today_deposited = parseFloat(this.today_deposited) + amount;
    this.week_deposited = parseFloat(this.week_deposited) + amount;
    this.month_deposited = parseFloat(this.month_deposited) + amount;
    this.last_deposit_at = new Date();
    await this.save();
    return this;
  },

  /**
   * Track a withdrawal
   * @param {number} amount - Withdrawal amount
   * @returns {Promise<Wallet>} - Updated wallet
   */
  async trackWithdrawal(amount) {
    this.total_withdrawn = parseFloat(this.total_withdrawn) + amount;
    this.today_withdrawn = parseFloat(this.today_withdrawn) + amount;
    this.week_withdrawn = parseFloat(this.week_withdrawn) + amount;
    this.month_withdrawn = parseFloat(this.month_withdrawn) + amount;
    this.last_withdrawal_at = new Date();
    await this.save();
    return this;
  },

  /**
   * Track a bet
   * @param {number} amount - Bet amount
   * @returns {Promise<Wallet>} - Updated wallet
   */
  async trackBet(amount) {
    this.today_bets = parseFloat(this.today_bets) + amount;
    this.week_bets = parseFloat(this.week_bets) + amount;
    this.month_bets = parseFloat(this.month_bets) + amount;
    this.last_bet_at = new Date();
    await this.save();
    return this;
  },

  /**
   * Track a win
   * @param {number} amount - Win amount
   * @returns {Promise<Wallet>} - Updated wallet
   */
  async trackWin(amount) {
    this.total_won = parseFloat(this.total_won) + amount;
    await this.save();
    return this;
  },

  /**
   * Track a loss
   * @param {number} amount - Loss amount
   * @returns {Promise<Wallet>} - Updated wallet
   */
  async trackLoss(amount) {
    this.total_lost = parseFloat(this.total_lost) + amount;
    await this.save();
    return this;
  },

  /**
   * Reset wallet limits
   * @param {string} period - 'daily', 'weekly', 'monthly'
   * @returns {Promise<Wallet>} - Updated wallet
   */
  async resetLimits(period = 'all') {
    if (period === 'daily' || period === 'all') {
      this.today_deposited = 0;
      this.today_withdrawn = 0;
      this.today_bets = 0;
      this.today_reset_at = new Date();
      this.today_reset_at.setHours(0, 0, 0, 0);
    }

    if (period === 'weekly' || period === 'all') {
      this.week_deposited = 0;
      this.week_withdrawn = 0;
      this.week_bets = 0;
      this.week_reset_at = new Date();
      this.week_reset_at.setHours(0, 0, 0, 0);
      const day = this.week_reset_at.getDay();
      const diff = this.week_reset_at.getDate() - day + (day === 0 ? -6 : 1);
      this.week_reset_at.setDate(diff);
    }

    if (period === 'monthly' || period === 'all') {
      this.month_deposited = 0;
      this.month_withdrawn = 0;
      this.month_bets = 0;
      this.month_reset_at = new Date();
      this.month_reset_at.setHours(0, 0, 0, 0);
      this.month_reset_at.setDate(1);
    }

    await this.save();
    return this;
  },
};

/**
 * Static methods
 */
Wallet.findByUser = async function(userId) {
  return this.findOne({
    where: { user_id: userId },
  });
};

Wallet.findByUserAndCurrency = async function(userId, currency) {
  return this.findOne({
    where: {
      user_id: userId,
      currency: currency,
    },
  });
};

Wallet.getTopBalances = async function(limit = 10) {
  return this.findAll({
    where: {
      status: 'active',
    },
    attributes: {
      include: [
        [
          sequelize.literal('balance + bonus_balance'),
          'total_balance',
        ],
      ],
    },
    order: [
      [sequelize.literal('total_balance'), 'DESC'],
    ],
    limit,
    include: [
      {
        model: sequelize.models.User,
        attributes: ['id', 'first_name', 'last_name', 'email', 'username'],
        where: { status: 'active' },
      },
    ],
  });
};

Wallet.getTotalBalances = async function() {
  const result = await this.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.col('balance')), 'total_main'],
      [sequelize.fn('SUM', sequelize.col('bonus_balance')), 'total_bonus'],
      [sequelize.fn('SUM', sequelize.col('locked_balance')), 'total_locked'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'total_wallets'],
    ],
    where: {
      status: 'active',
    },
  });
  return result.dataValues;
};

// Export the model
module.exports = Wallet;
