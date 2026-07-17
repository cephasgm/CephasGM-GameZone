/**
 * Bet Model - Betting Management
 * CephasGM GameZone
 * 
 * This model manages all betting activity including single bets,
 * accumulators, system bets, and live betting. It tracks bet placement,
 * settlement, cash out, and provides comprehensive betting analytics.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Bet Model Definition
 */
const Bet = sequelize.define(
  'Bet',
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

    // Bet Type
    bet_type: {
      type: DataTypes.ENUM('single', 'accumulator', 'system'),
      defaultValue: 'single',
      allowNull: false,
    },

    // Bet Status
    status: {
      type: DataTypes.ENUM(
        'pending',
        'active',
        'settled',
        'cancelled',
        'cashed_out',
        'void',
        'refunded'
      ),
      defaultValue: 'pending',
      allowNull: false,
    },

    // Selections (JSON array of selections)
    selections: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidSelections(value) {
          if (!Array.isArray(value) || value.length === 0) {
            throw new Error('At least one selection is required');
          }
          for (const selection of value) {
            if (!selection.match_id || !selection.selection || !selection.odds) {
              throw new Error('Invalid selection format: missing match_id, selection, or odds');
            }
            if (isNaN(selection.odds) || selection.odds <= 0) {
              throw new Error('Invalid odds value');
            }
          }
        },
      },
    },

    // Stake
    stake: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },

    // Odds
    odds: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        min: 1.01,
      },
    },

    // Potential win (calculated)
    potential_win: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0,
      },
    },

    // Actual win/loss
    actual_win: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    actual_loss: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },

    // Cash out
    cash_out_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    cash_out_time: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Settlement details
    settled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    settlement_status: {
      type: DataTypes.ENUM('pending', 'won', 'lost', 'void', 'pending_review'),
      allowNull: true,
    },

    // Live betting
    is_live: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },

    // System bet details (for system bets)
    system_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 2,
        max: 10,
      },
    },
    system_combinations: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    // Free bet indicator
    is_free_bet: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    bonus_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'bonuses',
        key: 'id',
      },
    },

    // Reference
    reference: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },

    // Device/User tracking
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // Admin
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    void_reason: {
      type: DataTypes.STRING(255),
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
    placed_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    // Model options
    tableName: 'bets',
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
        fields: ['status'],
      },
      {
        fields: ['bet_type'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['placed_at'],
      },
      {
        fields: ['is_live'],
      },
      {
        fields: ['reference'],
        unique: true,
        where: {
          reference: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        // For performance on status + user queries
        fields: ['user_id', 'status'],
      },
      {
        // For live betting queries
        fields: ['is_live', 'status'],
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a bet, calculate potential win and generate reference
       */
      beforeCreate: async (bet) => {
        // Generate reference if not provided
        if (!bet.reference) {
          bet.reference = generateBetReference();
        }

        // Calculate potential win
        const stake = parseFloat(bet.stake);
        const odds = parseFloat(bet.odds);
        bet.potential_win = stake * odds;

        // Set placed_at if not set
        if (!bet.placed_at) {
          bet.placed_at = new Date();
        }

        // Validate selections
        if (bet.selections && bet.selections.length > 0) {
          // Ensure all selections have valid data
          const validSelections = bet.selections.filter(
            (sel) => sel.match_id && sel.selection && sel.odds > 0
          );
          if (validSelections.length !== bet.selections.length) {
            logger.warn(`Bet ${bet.reference} has invalid selections`);
          }
        }
      },

      /**
       * Before updating a bet, handle status changes
       */
      beforeUpdate: async (bet) => {
        // If status changed to 'settled', set settled_at
        if (bet.changed('status') && bet.status === 'settled' && !bet.settled_at) {
          bet.settled_at = new Date();
        }

        // If status changed to 'cashed_out', set cash_out_time
        if (bet.changed('status') && bet.status === 'cashed_out' && !bet.cash_out_time) {
          bet.cash_out_time = new Date();
        }

        // If actual_win is set, update status to settled if not already
        if (bet.changed('actual_win') && bet.actual_win !== null && bet.status !== 'settled') {
          bet.status = 'settled';
          bet.settled_at = new Date();
          bet.settlement_status = parseFloat(bet.actual_win) > 0 ? 'won' : 'lost';
        }

        // If actual_loss is set, update status
        if (bet.changed('actual_loss') && bet.actual_loss !== null && bet.status !== 'settled') {
          bet.status = 'settled';
          bet.settled_at = new Date();
          bet.settlement_status = 'lost';
        }
      },

      /**
       * After creating a bet, update user transaction
       */
      afterCreate: async (bet) => {
        try {
          const Transaction = sequelize.models.Transaction;
          if (Transaction) {
            await Transaction.create({
              user_id: bet.user_id,
              wallet_id: bet.wallet_id,
              type: 'bet_placement',
              category: 'betting',
              amount: parseFloat(bet.stake),
              balance_before: 0, // Will be updated by the service
              balance_after: 0,
              bet_id: bet.id,
              reference: bet.reference,
              status: 'completed',
              description: `Bet placed on ${bet.selections.length} selection(s)`,
              ip_address: bet.ip_address,
              user_agent: bet.user_agent,
            });
          }
        } catch (error) {
          logger.error('Error creating transaction for bet:', error);
        }
      },
    },
  }
);

/**
 * Generate a unique bet reference
 * @returns {string} - Unique reference
 */
const generateBetReference = () => {
  const prefix = 'BET';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

/**
 * Instance methods
 */
Bet.prototype = {
  ...Bet.prototype,

  /**
   * Check if bet can be cashed out
   * @returns {boolean} - Whether bet can be cashed out
   */
  canCashOut() {
    const validStatuses = ['active', 'pending'];
    return validStatuses.includes(this.status) && this.is_live;
  },

  /**
   * Check if bet is settled
   * @returns {boolean} - Whether bet is settled
   */
  isSettled() {
    return this.status === 'settled' || this.status === 'cashed_out';
  },

  /**
   * Get total odds for the bet
   * @returns {number} - Total odds
   */
  getTotalOdds() {
    if (this.bet_type === 'single') {
      return parseFloat(this.odds);
    }
    // For accumulators, multiply all selections odds
    if (this.bet_type === 'accumulator' && this.selections) {
      let total = 1;
      for (const sel of this.selections) {
        total *= parseFloat(sel.odds);
      }
      return total;
    }
    return parseFloat(this.odds);
  },

  /**
   * Calculate potential return
   * @returns {number} - Potential return
   */
  getPotentialReturn() {
    return parseFloat(this.potential_win);
  },

  /**
   * Get bet summary for display
   * @param {string} currency - Currency symbol
   * @returns {Object} - Bet summary
   */
  getSummary(currency = '$') {
    return {
      id: this.id,
      reference: this.reference,
      type: this.bet_type,
      status: this.status,
      stake: `${currency}${parseFloat(this.stake).toFixed(2)}`,
      odds: parseFloat(this.odds).toFixed(2),
      potentialWin: `${currency}${parseFloat(this.potential_win).toFixed(2)}`,
      actualWin: this.actual_win ? `${currency}${parseFloat(this.actual_win).toFixed(2)}` : null,
      selections: this.selections.length,
      isLive: this.is_live,
      placedAt: this.placed_at,
      settledAt: this.settled_at,
    };
  },

  /**
   * Get selection details
   * @returns {Array} - Selections with details
   */
  getSelectionDetails() {
    return this.selections.map((sel, index) => ({
      index: index + 1,
      matchId: sel.match_id,
      selection: sel.selection,
      odds: parseFloat(sel.odds),
      market: sel.market || 'match_result',
      status: sel.status || 'pending',
    }));
  },
};

/**
 * Static methods
 */
Bet.findByUser = async function(userId, options = {}) {
  const { limit = 50, offset = 0, status = null, type = null, startDate = null, endDate = null } = options;

  const where = { user_id: userId };
  if (status) where.status = status;
  if (type) where.bet_type = type;
  if (startDate) where.placed_at = { [sequelize.Op.gte]: startDate };
  if (endDate) where.placed_at = { ...where.placed_at, [sequelize.Op.lte]: endDate };

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['placed_at', 'DESC']],
  });
};

Bet.findByReference = async function(reference) {
  return this.findOne({
    where: { reference: reference },
  });
};

Bet.findActiveBets = async function(userId) {
  return this.findAll({
    where: {
      user_id: userId,
      status: ['active', 'pending'],
    },
    order: [['placed_at', 'DESC']],
  });
};

Bet.findLiveBets = async function() {
  return this.findAll({
    where: {
      is_live: true,
      status: ['active', 'pending'],
    },
    order: [['placed_at', 'DESC']],
  });
};

Bet.getUserBetStats = async function(userId) {
  const result = await this.findOne({
    where: {
      user_id: userId,
      status: 'settled',
    },
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'total_bets'],
      [sequelize.fn('SUM', sequelize.col('stake')), 'total_stake'],
      [
        sequelize.fn(
          'SUM',
          sequelize.literal('CASE WHEN settlement_status = \'won\' THEN actual_win ELSE 0 END')
        ),
        'total_wins',
      ],
      [
        sequelize.fn(
          'SUM',
          sequelize.literal('CASE WHEN settlement_status = \'lost\' THEN actual_loss ELSE 0 END')
        ),
        'total_losses',
      ],
      [
        sequelize.fn(
          'COUNT',
          sequelize.literal('CASE WHEN settlement_status = \'won\' THEN 1 END')
        ),
        'win_count',
      ],
      [
        sequelize.fn(
          'COUNT',
          sequelize.literal('CASE WHEN settlement_status = \'lost\' THEN 1 END')
        ),
        'loss_count',
      ],
    ],
    raw: true,
  });

  const totalBets = parseInt(result.total_bets) || 0;
  const wins = parseInt(result.win_count) || 0;
  const losses = parseInt(result.loss_count) || 0;

  return {
    total_bets: totalBets,
    total_stake: parseFloat(result.total_stake) || 0,
    total_wins: parseFloat(result.total_wins) || 0,
    total_losses: parseFloat(result.total_losses) || 0,
    win_count: wins,
    loss_count: losses,
    win_rate: totalBets > 0 ? (wins / totalBets) * 100 : 0,
    net_profit: (parseFloat(result.total_wins) || 0) - (parseFloat(result.total_losses) || 0),
  };
};

Bet.getTodayBets = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.findAll({
    where: {
      placed_at: {
        [sequelize.Op.between]: [today, tomorrow],
      },
    },
    include: [
      {
        model: sequelize.models.User,
        attributes: ['id', 'first_name', 'last_name', 'email', 'username'],
      },
    ],
    order: [['placed_at', 'DESC']],
  });
};

Bet.getBetsByMatch = async function(matchId) {
  // Find bets where matchId is in selections
  // This uses JSONB contains for PostgreSQL
  const bets = await this.findAll({
    where: {
      selections: {
        [sequelize.Op.contains]: [
          { match_id: matchId }
        ],
      },
      status: ['active', 'pending'],
    },
    include: [
      {
        model: sequelize.models.User,
        attributes: ['id', 'first_name', 'last_name', 'email'],
      },
    ],
  });

  return bets;
};

// Export the model
module.exports = Bet;
