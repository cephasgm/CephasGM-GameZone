/**
 * Bonus Model - Bonus & Reward Management
 * CephasGM GameZone
 * 
 * This model manages all bonuses and rewards available to users,
 * including welcome bonuses, deposit bonuses, cashback, free bets,
 * and VIP rewards. It tracks bonus allocation, claiming, wagering
 * requirements, and expiration.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Bonus Model Definition
 */
const Bonus = sequelize.define(
  'Bonus',
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

    // Bonus Type
    type: {
      type: DataTypes.ENUM(
        'welcome',
        'deposit',
        'reload',
        'cashback',
        'freebet',
        'vip',
        'referral',
        'birthday',
        'promotional',
        'loyalty',
        'win_bonus',
        'other'
      ),
      allowNull: false,
    },

    // Bonus Code/Reference
    code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },
    reference: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },

    // Bonus Amounts
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      validate: {
        min: 0.01,
      },
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
      allowNull: false,
    },
    bonus_type_value: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'e.g., percentage, fixed, free_spins',
    },
    bonus_value: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      comment: 'e.g., 100 for percentage, 50 for fixed amount',
    },

    // Wagering Requirements
    wagering_requirement: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1.00,
      validate: {
        min: 0,
      },
    },
    wagering_progress: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    wagering_met: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },

    // Bonus Status
    status: {
      type: DataTypes.ENUM(
        'pending',
        'active',
        'claimed',
        'expired',
        'forfeited',
        'used',
        'cancelled'
      ),
      defaultValue: 'pending',
      allowNull: false,
    },

    // Eligibility
    min_deposit: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    max_win: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
      comment: 'Maximum win limit from bonus',
    },
    eligible_tiers: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
      comment: 'List of VIP tiers eligible for this bonus',
    },
    eligible_countries: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },
    excluded_countries: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },
    max_claims_per_user: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
    max_claims_total: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: '0 = unlimited',
    },
    claims_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    total_claimed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },

    // Time period
    valid_from: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    valid_until: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isAfter: {
          args: 'valid_from',
          msg: 'Valid until must be after valid from',
        },
      },
    },
    claimed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expired_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    used_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Usage tracking
    used_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    remaining_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },
    winnings_from_bonus: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.00,
      allowNull: false,
    },

    // Related entities
    promotion_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'promotions',
        key: 'id',
      },
    },
    transaction_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'transactions',
        key: 'id',
      },
    },
    claimed_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },

    // Metadata
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500],
      },
    },
    terms: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },

    // Admin
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
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
    tableName: 'bonuses',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['code'],
        unique: true,
        where: {
          code: {
            [sequelize.Op.ne]: null,
          },
        },
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
        fields: ['valid_from', 'valid_until'],
      },
      {
        fields: ['promotion_id'],
        where: {
          promotion_id: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        // For user bonus overview
        fields: ['user_id', 'status', 'valid_until'],
      },
      {
        // For expired bonus cleanup
        fields: ['status', 'valid_until'],
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a bonus, generate reference and validate
       */
      beforeCreate: (bonus) => {
        if (!bonus.reference) {
          bonus.reference = generateBonusReference();
        }

        // Set remaining amount to full amount if not set
        if (!bonus.remaining_amount || bonus.remaining_amount === 0) {
          bonus.remaining_amount = parseFloat(bonus.amount);
        }

        // Ensure valid_from and valid_until are set
        if (!bonus.valid_from) {
          bonus.valid_from = new Date();
        }
        if (!bonus.valid_until) {
          const defaultDuration = 30; // days
          bonus.valid_until = new Date(bonus.valid_from);
          bonus.valid_until.setDate(bonus.valid_until.getDate() + defaultDuration);
        }

        // Set status to active if not specified and within validity
        if (bonus.status === 'pending' && bonus.valid_from <= new Date() && bonus.valid_until >= new Date()) {
          bonus.status = 'active';
        }
      },

      /**
       * Before updating a bonus, handle status and expiry
       */
      beforeUpdate: (bonus) => {
        // Auto-expire if past validity
        if (bonus.valid_until && bonus.valid_until < new Date() && bonus.status !== 'expired') {
          bonus.status = 'expired';
          bonus.expired_at = new Date();
        }

        // Handle claim
        if (bonus.changed('status') && bonus.status === 'claimed' && !bonus.claimed_at) {
          bonus.claimed_at = new Date();
        }

        // Handle wagering requirement met
        if (
          bonus.wagering_progress >= bonus.wagering_requirement * parseFloat(bonus.amount) &&
          !bonus.wagering_met
        ) {
          bonus.wagering_met = true;
        }
      },
    },
  }
);

/**
 * Generate a unique bonus reference
 * @returns {string} - Unique reference
 */
const generateBonusReference = () => {
  const prefix = 'BON';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

/**
 * Instance methods
 */
Bonus.prototype = {
  ...Bonus.prototype,

  /**
   * Check if bonus is active
   * @returns {boolean} - Whether bonus is active
   */
  isActive() {
    const now = new Date();
    return (
      this.status === 'active' &&
      this.valid_from <= now &&
      this.valid_until >= now &&
      this.remaining_amount > 0
    );
  },

  /**
   * Check if bonus is claimable
   * @returns {boolean} - Whether bonus can be claimed
   */
  isClaimable() {
    return (
      this.status === 'active' ||
      (this.status === 'pending' && this.valid_from <= new Date())
    );
  },

  /**
   * Check if bonus has expired
   * @returns {boolean} - Whether bonus has expired
   */
  isExpired() {
    return this.status === 'expired' || this.valid_until < new Date();
  },

  /**
   * Check if wagering requirement is met
   * @returns {boolean} - Whether wagering requirement is met
   */
  isWageringMet() {
    return this.wagering_met === true;
  },

  /**
   * Get wagering requirement amount
   * @returns {number} - Total wagering requirement
   */
  getWageringRequirementAmount() {
    return parseFloat(this.wagering_requirement) * parseFloat(this.amount);
  },

  /**
   * Get progress percentage toward wagering requirement
   * @returns {number} - Percentage (0-100)
   */
  getWageringProgressPercentage() {
    const total = this.getWageringRequirementAmount();
    if (total === 0) return 100;
    const progress = parseFloat(this.wagering_progress);
    return Math.min((progress / total) * 100, 100);
  },

  /**
   * Get bonus status display name
   * @returns {string} - Display name
   */
  getStatusDisplay() {
    const statusMap = {
      pending: '⏳ Pending',
      active: '🟢 Active',
      claimed: '✅ Claimed',
      expired: '⏰ Expired',
      forfeited: '❌ Forfeited',
      used: '✓ Used',
      cancelled: '⛔ Cancelled',
    };
    return statusMap[this.status] || this.status;
  },

  /**
   * Get bonus type display name
   * @returns {string} - Display name
   */
  getTypeDisplay() {
    const typeMap = {
      welcome: '🎉 Welcome Bonus',
      deposit: '💰 Deposit Bonus',
      reload: '🔄 Reload Bonus',
      cashback: '💵 Cashback',
      freebet: '🎯 Free Bet',
      vip: '👑 VIP Bonus',
      referral: '👥 Referral Bonus',
      birthday: '🎂 Birthday Bonus',
      promotional: '🎁 Promotional Bonus',
      loyalty: '⭐ Loyalty Bonus',
      win_bonus: '🏆 Win Bonus',
      other: '📦 Other',
    };
    return typeMap[this.type] || this.type;
  },

  /**
   * Get bonus summary for display
   * @param {string} currency - Currency symbol
   * @returns {Object} - Bonus summary
   */
  getSummary(currency = '$') {
    return {
      id: this.id,
      reference: this.reference,
      type: this.type,
      typeDisplay: this.getTypeDisplay(),
      status: this.status,
      statusDisplay: this.getStatusDisplay(),
      amount: `${currency}${parseFloat(this.amount).toFixed(2)}`,
      remaining: `${currency}${parseFloat(this.remaining_amount).toFixed(2)}`,
      wageringRequirement: `${this.wagering_requirement}x`,
      wageringProgress: `${parseFloat(this.wagering_progress).toFixed(2)} / ${this.getWageringRequirementAmount().toFixed(2)}`,
      progressPercentage: this.getWageringProgressPercentage(),
      validFrom: this.valid_from,
      validUntil: this.valid_until,
      claimedAt: this.claimed_at,
    };
  },

  /**
   * Claim the bonus
   * @returns {Promise<Bonus>} - Updated bonus
   */
  async claim() {
    if (!this.isClaimable()) {
      throw new Error('Bonus is not claimable');
    }

    this.status = 'claimed';
    this.claimed_at = new Date();
    this.claims_count += 1;
    this.total_claimed += 1;

    await this.save();
    logger.info(`Bonus ${this.reference} claimed by user ${this.user_id}`);
    return this;
  },

  /**
   * Use part of the bonus
   * @param {number} amount - Amount to use
   * @returns {Promise<Bonus>} - Updated bonus
   */
  async useBonus(amount) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    if (this.remaining_amount < amount) {
      throw new Error('Insufficient bonus balance');
    }

    this.used_amount = parseFloat(this.used_amount) + amount;
    this.remaining_amount = parseFloat(this.remaining_amount) - amount;

    if (this.remaining_amount === 0) {
      this.status = 'used';
      this.used_at = new Date();
    }

    await this.save();
    logger.info(`Used ${amount} from bonus ${this.reference}`);
    return this;
  },

  /**
   * Update wagering progress
   * @param {number} amount - Amount wagered
   * @returns {Promise<Bonus>} - Updated bonus
   */
  async updateWageringProgress(amount) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    this.wagering_progress = parseFloat(this.wagering_progress) + amount;

    if (!this.wagering_met && this.wagering_progress >= this.getWageringRequirementAmount()) {
      this.wagering_met = true;
    }

    await this.save();
    return this;
  },

  /**
   * Add winnings from bonus
   * @param {number} amount - Winnings amount
   * @returns {Promise<Bonus>} - Updated bonus
   */
  async addWinnings(amount) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    this.winnings_from_bonus = parseFloat(this.winnings_from_bonus) + amount;
    await this.save();
    return this;
  },
};

/**
 * Static methods
 */
Bonus.findByUser = async function(userId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    type = null,
    status = null,
    active = false,
    includeExpired = false,
  } = options;

  const where = { user_id: userId };
  if (type) where.type = type;
  if (status) where.status = status;

  if (!includeExpired) {
    where.valid_until = {
      [sequelize.Op.gt]: new Date(),
    };
  }

  if (active) {
    where.status = 'active';
  }

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['valid_until', 'ASC'],
      ['created_at', 'DESC'],
    ],
  });
};

Bonus.findActiveBonuses = async function(userId) {
  const now = new Date();
  return this.findAll({
    where: {
      user_id: userId,
      status: 'active',
      valid_from: {
        [sequelize.Op.lte]: now,
      },
      valid_until: {
        [sequelize.Op.gte]: now,
      },
      remaining_amount: {
        [sequelize.Op.gt]: 0,
      },
    },
    order: [['valid_until', 'ASC']],
  });
};

Bonus.findByCode = async function(code) {
  return this.findOne({
    where: { code: code.trim() },
  });
};

Bonus.findByReference = async function(reference) {
  return this.findOne({
    where: { reference: reference.trim() },
  });
};

Bonus.findExpiredBonuses = async function() {
  const now = new Date();
  return this.findAll({
    where: {
      status: ['active', 'pending'],
      valid_until: {
        [sequelize.Op.lt]: now,
      },
    },
  });
};

Bonus.findAvailableBonuses = async function(userId, options = {}) {
  const {
    type = null,
    minDeposit = null,
    tier = null,
    country = null,
  } = options;

  const where = {
    status: 'active',
    valid_from: {
      [sequelize.Op.lte]: new Date(),
    },
    valid_until: {
      [sequelize.Op.gte]: new Date(),
    },
    remaining_amount: {
      [sequelize.Op.gt]: 0,
    },
    // Exclude user-specific bonuses already claimed
    user_id: userId,
  };

  // Filter by type
  if (type) {
    where.type = type;
  }

  // Filter by min deposit
  if (minDeposit !== null) {
    where.min_deposit = {
      [sequelize.Op.lte]: minDeposit,
    };
  }

  // Filter by tier eligibility
  if (tier) {
    where.eligible_tiers = {
      [sequelize.Op.or]: [
        { [sequelize.Op.eq]: [] },
        { [sequelize.Op.contains]: [tier] },
      ],
    };
  }

  // Filter by country eligibility
  if (country) {
    where.eligible_countries = {
      [sequelize.Op.or]: [
        { [sequelize.Op.eq]: [] },
        { [sequelize.Op.contains]: [country] },
      ],
    };
    where.excluded_countries = {
      [sequelize.Op.not]: {
        [sequelize.Op.contains]: [country],
      },
    };
  }

  // Limit claims per user
  where.claims_count = {
    [sequelize.Op.lt]: sequelize.col('max_claims_per_user'),
  };

  // Limit total claims
  if (options.maxClaimsTotal !== undefined) {
    where.total_claimed = {
      [sequelize.Op.lt]: options.maxClaimsTotal,
    };
  }

  return this.findAll({
    where,
    order: [
      ['priority', 'DESC'],
      ['valid_until', 'ASC'],
    ],
  });
};

Bonus.getUserBonusStats = async function(userId) {
  const stats = await this.findOne({
    where: { user_id: userId },
    attributes: [
      [
        sequelize.fn(
          'SUM',
          sequelize.literal(`CASE WHEN status = 'active' THEN amount ELSE 0 END`)
        ),
        'active_bonus',
      ],
      [
        sequelize.fn(
          'SUM',
          sequelize.literal(`CASE WHEN status = 'claimed' THEN amount ELSE 0 END`)
        ),
        'claimed_bonus',
      ],
      [
        sequelize.fn(
          'SUM',
          sequelize.literal(`CASE WHEN status IN ('active', 'claimed') THEN remaining_amount ELSE 0 END`)
        ),
        'remaining_bonus',
      ],
      [
        sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = \'active\' THEN 1 END')),
        'active_count',
      ],
      [
        sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = \'claimed\' THEN 1 END')),
        'claimed_count',
      ],
    ],
    raw: true,
  });

  return {
    active_bonus: parseFloat(stats.active_bonus) || 0,
    claimed_bonus: parseFloat(stats.claimed_bonus) || 0,
    remaining_bonus: parseFloat(stats.remaining_bonus) || 0,
    active_count: parseInt(stats.active_count) || 0,
    claimed_count: parseInt(stats.claimed_count) || 0,
  };
};

Bonus.getTotalBonusStats = async function() {
  const stats = await this.findAll({
    attributes: [
      'type',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('amount')), 'total_amount'],
      [
        sequelize.fn(
          'SUM',
          sequelize.literal('CASE WHEN status = \'claimed\' THEN amount ELSE 0 END')
        ),
        'claimed_amount',
      ],
    ],
    group: ['type'],
    raw: true,
  });

  const result = {
    total_bonuses: 0,
    total_amount: 0,
    claimed_amount: 0,
    by_type: {},
  };

  for (const row of stats) {
    const count = parseInt(row.count) || 0;
    const amount = parseFloat(row.total_amount) || 0;
    const claimed = parseFloat(row.claimed_amount) || 0;

    result.total_bonuses += count;
    result.total_amount += amount;
    result.claimed_amount += claimed;

    result.by_type[row.type] = {
      count,
      amount,
      claimed,
    };
  }

  return result;
};

// Export the model
module.exports = Bonus;
