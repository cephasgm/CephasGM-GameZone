/**
 * Promotion Model - Marketing & Promotional Campaign Management
 * CephasGM GameZone
 * 
 * This model manages all promotional campaigns, offers, and marketing
 * initiatives. It supports targeted promotions, time-limited offers,
 * user segmentation, and performance tracking.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Promotion Model Definition
 */
const Promotion = sequelize.define(
  'Promotion',
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    // Promotion Identification
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 100],
      },
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        isLowercase: true,
        len: [3, 100],
      },
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },

    // Promotion Type
    type: {
      type: DataTypes.ENUM(
        'welcome',
        'deposit_match',
        'reload',
        'cashback',
        'freebet',
        'free_spins',
        'referral',
        'vip',
        'birthday',
        'seasonal',
        'holiday',
        'flash_sale',
        'tournament',
        'leaderboard',
        'loyalty',
        'retention',
        'reactivation',
        'other'
      ),
      allowNull: false,
    },

    // Promotion Status
    status: {
      type: DataTypes.ENUM(
        'draft',
        'pending_review',
        'scheduled',
        'active',
        'paused',
        'ended',
        'cancelled',
        'archived'
      ),
      defaultValue: 'draft',
      allowNull: false,
    },

    // Visual Assets
    banner_image: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    banner_mobile: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    icon: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    background_color: {
      type: DataTypes.STRING(7),
      allowNull: true,
      validate: {
        is: /^#[0-9a-fA-F]{6}$/,
      },
    },

    // Content
    title: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    subtitle: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 5000],
      },
    },
    short_description: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    terms_conditions: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    how_it_works: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    faqs: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },

    // Promotion Value
    value_type: {
      type: DataTypes.ENUM('fixed', 'percentage', 'free_bet', 'free_spins', 'cashback', 'other'),
      allowNull: false,
      defaultValue: 'fixed',
    },
    value: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
    max_value: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
      allowNull: false,
    },

    // Bonus Configuration
    bonus_type: {
      type: DataTypes.ENUM('bonus', 'free_bet', 'free_spins', 'cashback', 'voucher', 'other'),
      allowNull: true,
    },
    bonus_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
    },
    wagering_requirement: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    min_deposit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    max_win: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },

    // Target Audience
    target_audience: {
      type: DataTypes.ENUM('all', 'new_users', 'existing_users', 'vip', 'specific_countries', 'custom'),
      defaultValue: 'all',
      allowNull: false,
    },
    target_countries: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },
    exclude_countries: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },
    target_tiers: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
      comment: 'VIP tiers eligible for this promotion',
    },
    target_ages: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
      comment: 'Age ranges (e.g., [18, 25, 35, 50])',
    },
    target_genders: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
      comment: 'Gender preferences',
    },

    // Time Period
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    end_date: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isAfter: {
          args: 'start_date',
          msg: 'End date must be after start date',
        },
      },
    },
    timezone: {
      type: DataTypes.STRING(50),
      defaultValue: 'UTC',
      allowNull: false,
    },

    // Usage Limits
    max_claims_per_user: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
    },
    max_total_claims: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: '0 = unlimited',
    },
    total_claims: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    total_users_claimed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },

    // Tracking
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    clicks: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    conversions: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    conversion_rate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
      allowNull: false,
    },

    // Budget Tracking
    budget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      validate: {
        min: 0,
      },
    },
    budget_spent: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
    },
    budget_remaining: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
    },
    cost_per_acquisition: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      allowNull: false,
    },

    // ROI Tracking
    revenue_generated: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0,
      allowNull: false,
    },
    roi: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      allowNull: false,
    },

    // Channel & Placement
    channels: {
      type: DataTypes.JSONB,
      defaultValue: ['website', 'app', 'email', 'push', 'sms'],
      allowNull: false,
    },
    placement: {
      type: DataTypes.ENUM('homepage', 'sports', 'casino', 'promotions', 'email', 'push', 'all'),
      defaultValue: 'all',
      allowNull: false,
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },

    // Display Settings
    display_settings: {
      type: DataTypes.JSONB,
      defaultValue: {
        show_countdown: true,
        show_claim_button: true,
        show_terms: true,
        highlight_color: '#0055ff',
        animation: 'fade',
      },
      allowNull: false,
    },

    // SEO
    meta_title: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    meta_description: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    meta_keywords: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },

    // Admin
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
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
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
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
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    ended_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    // Model options
    tableName: 'promotions',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      {
        fields: ['name'],
      },
      {
        fields: ['slug'],
        unique: true,
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
        fields: ['type'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['start_date', 'end_date'],
      },
      {
        fields: ['priority'],
      },
      {
        fields: ['target_audience'],
      },
      {
        // For active promotions queries
        fields: ['status', 'start_date', 'end_date'],
      },
      {
        // For tracking performance
        fields: ['conversion_rate'],
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a promotion, generate slug and set defaults
       */
      beforeCreate: (promotion) => {
        if (!promotion.slug) {
          promotion.slug = promotion.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        }

        // Set budget remaining to budget if set
        if (promotion.budget) {
          promotion.budget_remaining = parseFloat(promotion.budget);
        }

        // Set published_at if status is active or scheduled
        if (promotion.status === 'active' || promotion.status === 'scheduled') {
          promotion.published_at = new Date();
        }

        // Ensure start_date is set
        if (!promotion.start_date) {
          promotion.start_date = new Date();
        }
        // Ensure end_date is set (default 30 days from start)
        if (!promotion.end_date) {
          const endDate = new Date(promotion.start_date);
          endDate.setDate(endDate.getDate() + 30);
          promotion.end_date = endDate;
        }
      },

      /**
       * Before updating a promotion, handle status changes
       */
      beforeUpdate: (promotion) => {
        // Handle slug change
        if (promotion.changed('name') && !promotion.changed('slug')) {
          promotion.slug = promotion.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        }

        // Handle status changes
        if (promotion.changed('status')) {
          const newStatus = promotion.status;
          if (newStatus === 'active' && !promotion.published_at) {
            promotion.published_at = new Date();
          }
          if (newStatus === 'ended' && !promotion.ended_at) {
            promotion.ended_at = new Date();
          }
        }

        // Auto-end if past end date
        if (promotion.end_date && promotion.end_date < new Date() && promotion.status === 'active') {
          promotion.status = 'ended';
          promotion.ended_at = new Date();
        }

        // Calculate conversion rate
        if (promotion.clicks > 0) {
          promotion.conversion_rate = (promotion.conversions / promotion.clicks) * 100;
        }

        // Calculate ROI
        if (promotion.budget_spent > 0) {
          promotion.roi = ((promotion.revenue_generated - promotion.budget_spent) / promotion.budget_spent) * 100;
        }

        // Calculate cost per acquisition
        if (promotion.conversions > 0) {
          promotion.cost_per_acquisition = promotion.budget_spent / promotion.conversions;
        }

        // Update budget remaining
        if (promotion.budget) {
          promotion.budget_remaining = Math.max(
            0,
            parseFloat(promotion.budget) - parseFloat(promotion.budget_spent)
          );
        }
      },
    },
  }
);

/**
 * Instance methods
 */
Promotion.prototype = {
  ...Promotion.prototype,

  /**
   * Check if promotion is active
   * @returns {boolean} - Whether promotion is active
   */
  isActive() {
    const now = new Date();
    return (
      this.status === 'active' &&
      this.start_date <= now &&
      this.end_date >= now &&
      (this.max_total_claims === 0 || this.total_claims < this.max_total_claims)
    );
  },

  /**
   * Check if promotion has expired
   * @returns {boolean} - Whether promotion has expired
   */
  isExpired() {
    return this.status === 'ended' || this.end_date < new Date();
  },

  /**
   * Check if user is eligible for this promotion
   * @param {Object} user - User object
   * @returns {boolean} - Whether user is eligible
   */
  isUserEligible(user) {
    // Check target audience
    if (this.target_audience === 'new_users' && user.created_at > this.start_date) {
      return true;
    }
    if (this.target_audience === 'new_users' && user.created_at <= this.start_date) {
      return false;
    }
    if (this.target_audience === 'vip' && user.vip_tier === 'none') {
      return false;
    }

    // Check VIP tier eligibility
    if (this.target_tiers && this.target_tiers.length > 0) {
      if (!this.target_tiers.includes(user.vip_tier)) {
        return false;
      }
    }

    // Check country eligibility
    if (this.target_countries && this.target_countries.length > 0) {
      if (!this.target_countries.includes(user.country)) {
        return false;
      }
    }

    // Check excluded countries
    if (this.exclude_countries && this.exclude_countries.length > 0) {
      if (this.exclude_countries.includes(user.country)) {
        return false;
      }
    }

    // Check max claims per user
    const claims = user.bonuses ? user.bonuses.length : 0;
    if (claims >= this.max_claims_per_user) {
      return false;
    }

    // Check total claims
    if (this.max_total_claims > 0 && this.total_claims >= this.max_total_claims) {
      return false;
    }

    return true;
  },

  /**
   * Get promotion status display name
   * @returns {string} - Display name
   */
  getStatusDisplay() {
    const statusMap = {
      draft: '📝 Draft',
      pending_review: '⏳ Pending Review',
      scheduled: '📅 Scheduled',
      active: '🟢 Active',
      paused: '⏸️ Paused',
      ended: '🏁 Ended',
      cancelled: '❌ Cancelled',
      archived: '📦 Archived',
    };
    return statusMap[this.status] || this.status;
  },

  /**
   * Get promotion type display name
   * @returns {string} - Display name
   */
  getTypeDisplay() {
    const typeMap = {
      welcome: '🎉 Welcome',
      deposit_match: '💰 Deposit Match',
      reload: '🔄 Reload',
      cashback: '💵 Cashback',
      freebet: '🎯 Free Bet',
      free_spins: '🎰 Free Spins',
      referral: '👥 Referral',
      vip: '👑 VIP',
      birthday: '🎂 Birthday',
      seasonal: '🌿 Seasonal',
      holiday: '🎄 Holiday',
      flash_sale: '⚡ Flash Sale',
      tournament: '🏆 Tournament',
      leaderboard: '📊 Leaderboard',
      loyalty: '⭐ Loyalty',
      retention: '🔄 Retention',
      reactivation: '🔄 Reactivation',
      other: '📦 Other',
    };
    return typeMap[this.type] || this.type;
  },

  /**
   * Get promotion summary for display
   * @param {string} currency - Currency symbol
   * @returns {Object} - Promotion summary
   */
  getSummary(currency = '$') {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      type: this.type,
      typeDisplay: this.getTypeDisplay(),
      status: this.status,
      statusDisplay: this.getStatusDisplay(),
      title: this.title,
      description: this.short_description || this.description,
      value: `${this.value}${this.value_type === 'percentage' ? '%' : ''}`,
      maxValue: this.max_value ? `${currency}${parseFloat(this.max_value).toFixed(2)}` : null,
      startDate: this.start_date,
      endDate: this.end_date,
      isActive: this.isActive(),
      views: this.views,
      clicks: this.clicks,
      conversions: this.conversions,
      conversionRate: parseFloat(this.conversion_rate).toFixed(2) + '%',
    };
  },

  /**
   * Get full promotion data for display
   * @param {string} currency - Currency symbol
   * @returns {Object} - Full promotion data
   */
  getFullData(currency = '$') {
    return {
      ...this.getSummary(currency),
      bannerImage: this.banner_image,
      bannerMobile: this.banner_mobile,
      icon: this.icon,
      backgroundColor: this.background_color,
      subtitle: this.subtitle,
      fullDescription: this.description,
      termsConditions: this.terms_conditions,
      howItWorks: this.how_it_works,
      faqs: this.faqs,
      wageringRequirement: this.wagering_requirement ? `${this.wagering_requirement}x` : null,
      minDeposit: this.min_deposit ? `${currency}${parseFloat(this.min_deposit).toFixed(2)}` : null,
      maxWin: this.max_win ? `${currency}${parseFloat(this.max_win).toFixed(2)}` : null,
      remainingClaims: this.max_total_claims > 0 ? this.max_total_claims - this.total_claims : 'Unlimited',
      targetAudience: this.target_audience,
      displaySettings: this.display_settings,
    };
  },

  /**
   * Record a view for this promotion
   * @returns {Promise<Promotion>} - Updated promotion
   */
  async recordView() {
    this.views += 1;
    await this.save();
    return this;
  },

  /**
   * Record a click for this promotion
   * @returns {Promise<Promotion>} - Updated promotion
   */
  async recordClick() {
    this.clicks += 1;
    // Update conversion rate
    if (this.clicks > 0) {
      this.conversion_rate = (this.conversions / this.clicks) * 100;
    }
    await this.save();
    return this;
  },

  /**
   * Record a conversion for this promotion
   * @param {number} amount - Conversion amount
   * @returns {Promise<Promotion>} - Updated promotion
   */
  async recordConversion(amount = 0) {
    this.conversions += 1;
    this.total_claims += 1;
    this.total_users_claimed += 1;

    // Update conversion rate
    if (this.clicks > 0) {
      this.conversion_rate = (this.conversions / this.clicks) * 100;
    }

    // Update budget spent
    if (amount > 0) {
      this.budget_spent = parseFloat(this.budget_spent) + amount;
      this.budget_remaining = Math.max(0, parseFloat(this.budget) - parseFloat(this.budget_spent));
      this.revenue_generated = parseFloat(this.revenue_generated) + amount;
    }

    await this.save();
    return this;
  },

  /**
   * Track revenue generated
   * @param {number} amount - Revenue amount
   * @returns {Promise<Promotion>} - Updated promotion
   */
  async trackRevenue(amount) {
    if (amount > 0) {
      this.revenue_generated = parseFloat(this.revenue_generated) + amount;
      // Update ROI
      if (this.budget_spent > 0) {
        this.roi = ((this.revenue_generated - this.budget_spent) / this.budget_spent) * 100;
      }
      await this.save();
    }
    return this;
  },
};

/**
 * Static methods
 */
Promotion.findBySlug = async function(slug) {
  return this.findOne({
    where: { slug: slug.toLowerCase() },
  });
};

Promotion.findByCode = async function(code) {
  return this.findOne({
    where: { code: code.trim() },
  });
};

Promotion.findActivePromotions = async function(options = {}) {
  const { limit = 50, offset = 0, type = null, placement = null, targetAudience = null } = options;

  const where = {
    status: 'active',
    start_date: {
      [sequelize.Op.lte]: new Date(),
    },
    end_date: {
      [sequelize.Op.gte]: new Date(),
    },
  };

  if (type) where.type = type;
  if (placement) where.placement = placement;
  if (targetAudience) where.target_audience = targetAudience;

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['priority', 'DESC'],
      ['start_date', 'ASC'],
    ],
  });
};

Promotion.findUpcomingPromotions = async function(limit = 10) {
  return this.findAll({
    where: {
      status: 'scheduled',
      start_date: {
        [sequelize.Op.gt]: new Date(),
      },
    },
    order: [['start_date', 'ASC']],
    limit,
  });
};

Promotion.findExpiredPromotions = async function() {
  return this.findAll({
    where: {
      status: 'active',
      end_date: {
        [sequelize.Op.lt]: new Date(),
      },
    },
  });
};

Promotion.findPromotionsByType = async function(type, options = {}) {
  const { activeOnly = true, limit = 50, offset = 0 } = options;

  const where = { type };
  if (activeOnly) {
    where.status = 'active';
    where.start_date = { [sequelize.Op.lte]: new Date() };
    where.end_date = { [sequelize.Op.gte]: new Date() };
  }

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['priority', 'DESC'],
      ['start_date', 'DESC'],
    ],
  });
};

Promotion.findPromotionsForUser = async function(user, options = {}) {
  const { limit = 20, offset = 0, excludeClaimed = true } = options;

  const where = {
    status: 'active',
    start_date: {
      [sequelize.Op.lte]: new Date(),
    },
    end_date: {
      [sequelize.Op.gte]: new Date(),
    },
  };

  // Filter by target audience
  if (user) {
    // Check if user is eligible
    where[sequelize.Op.or] = [
      { target_audience: 'all' },
      { target_audience: 'new_users' },
      { target_audience: 'existing_users' },
      { target_audience: 'vip' },
    ];

    // Exclude claimed promotions
    if (excludeClaimed) {
      // This would require a join with user claims
      // For simplicity, we'll handle this in service layer
    }
  }

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['priority', 'DESC'],
      ['start_date', 'ASC'],
    ],
  });
};

Promotion.getPromotionStats = async function() {
  const stats = await this.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('views')), 'total_views'],
      [sequelize.fn('SUM', sequelize.col('clicks')), 'total_clicks'],
      [sequelize.fn('SUM', sequelize.col('conversions')), 'total_conversions'],
      [sequelize.fn('SUM', sequelize.col('revenue_generated')), 'total_revenue'],
      [sequelize.fn('SUM', sequelize.col('budget_spent')), 'total_budget_spent'],
    ],
    group: ['status'],
    raw: true,
  });

  const result = {
    total_promotions: 0,
    active_promotions: 0,
    by_status: {},
    total_views: 0,
    total_clicks: 0,
    total_conversions: 0,
    total_revenue: 0,
    total_budget_spent: 0,
  };

  for (const row of stats) {
    const count = parseInt(row.count) || 0;
    result.total_promotions += count;
    if (row.status === 'active') {
      result.active_promotions += count;
    }
    result.by_status[row.status] = {
      count,
      views: parseInt(row.total_views) || 0,
      clicks: parseInt(row.total_clicks) || 0,
      conversions: parseInt(row.total_conversions) || 0,
      revenue: parseFloat(row.total_revenue) || 0,
      budget_spent: parseFloat(row.total_budget_spent) || 0,
    };
    result.total_views += parseInt(row.total_views) || 0;
    result.total_clicks += parseInt(row.total_clicks) || 0;
    result.total_conversions += parseInt(row.total_conversions) || 0;
    result.total_revenue += parseFloat(row.total_revenue) || 0;
    result.total_budget_spent += parseFloat(row.total_budget_spent) || 0;
  }

  // Calculate overall conversion rate
  result.overall_conversion_rate = result.total_clicks > 0
    ? (result.total_conversions / result.total_clicks) * 100
    : 0;

  // Calculate ROI
  result.overall_roi = result.total_budget_spent > 0
    ? ((result.total_revenue - result.total_budget_spent) / result.total_budget_spent) * 100
    : 0;

  return result;
};

Promotion.getPerformanceStats = async function(promotionId) {
  const promotion = await this.findByPk(promotionId);
  if (!promotion) return null;

  return {
    id: promotion.id,
    name: promotion.name,
    views: promotion.views,
    clicks: promotion.clicks,
    conversions: promotion.conversions,
    conversionRate: parseFloat(promotion.conversion_rate),
    budgetSpent: parseFloat(promotion.budget_spent),
    budgetRemaining: parseFloat(promotion.budget_remaining),
    revenueGenerated: parseFloat(promotion.revenue_generated),
    roi: parseFloat(promotion.roi),
    costPerAcquisition: parseFloat(promotion.cost_per_acquisition),
  };
};

// Export the model
module.exports = Promotion;
