/**
 * User Model - User Account Management
 * CephasGM GameZone
 * 
 * This model represents user accounts in the system with comprehensive
 * fields for authentication, profile, preferences, and account status.
 * Includes hooks for password hashing and automatic field updates.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { hashPassword, generateSalt } = require('../utils/encryption');
const logger = require('../utils/logger');

/**
 * User Model Definition
 */
const User = sequelize.define(
  'User',
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    // Personal Information
    first_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
    last_name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true,
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        len: [7, 20],
      },
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
        isBefore: new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    },
    country: {
      type: DataTypes.STRING(2),
      allowNull: true,
      validate: {
        len: [2, 2],
        isUppercase: true,
      },
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'USD',
      allowNull: false,
      validate: {
        len: [3, 3],
        isUppercase: true,
      },
    },

    // Authentication
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    password_hash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    salt: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    last_password_change: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },

    // OAuth IDs
    google_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    facebook_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    github_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    apple_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // Profile
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500],
      },
    },
    display_name: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    username: {
      type: DataTypes.STRING(30),
      allowNull: true,
      unique: true,
      validate: {
        len: [3, 30],
        isAlphanumeric: true,
      },
    },

    // Account Status
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended', 'verified', 'banned'),
      defaultValue: 'active',
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('user', 'agent', 'admin', 'super_admin'),
      defaultValue: 'user',
      allowNull: false,
    },
    vip_tier: {
      type: DataTypes.ENUM('none', 'silver', 'gold', 'platinum', 'diamond', 'elite'),
      defaultValue: 'none',
      allowNull: false,
    },

    // Login & Security
    last_login_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_login_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    failed_login_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Two-Factor Authentication
    two_factor_enabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    two_factor_secret: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    two_factor_backup_codes: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const raw = this.getDataValue('two_factor_backup_codes');
        return raw ? JSON.parse(raw) : [];
      },
      set(value) {
        this.setDataValue('two_factor_backup_codes', JSON.stringify(value));
      },
    },

    // Preferences
    preferences: {
      type: DataTypes.JSONB,
      defaultValue: {
        language: 'en',
        timezone: 'UTC',
        notifications: {
          email: true,
          push: true,
          sms: false,
          marketing: true,
        },
        oddsFormat: 'decimal',
        darkMode: true,
      },
      allowNull: false,
    },

    // Deposit Limits (Responsible Gambling)
    deposit_limits: {
      type: DataTypes.JSONB,
      defaultValue: {
        daily: 0,
        weekly: 0,
        monthly: 0,
      },
      allowNull: false,
    },

    // Self-Exclusion
    self_excluded: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    self_excluded_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    self_exclusion_reason: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // Referral
    referral_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },
    referred_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },

    // KYC
    kyc_status: {
      type: DataTypes.ENUM('pending', 'verified', 'rejected', 'not_started'),
      defaultValue: 'not_started',
      allowNull: false,
    },
    kyc_submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    kyc_verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    kyc_rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Timestamps (automatic with paranoid)
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
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    // Model options
    tableName: 'users',
    timestamps: true,
    paranoid: true, // Soft deletes
    underscored: true,
    indexes: [
      {
        fields: ['email'],
        unique: true,
      },
      {
        fields: ['username'],
        unique: true,
        where: {
          username: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        fields: ['referral_code'],
        unique: true,
        where: {
          referral_code: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        fields: ['status'],
      },
      {
        fields: ['role'],
      },
      {
        fields: ['vip_tier'],
      },
      {
        fields: ['google_id'],
      },
      {
        fields: ['facebook_id'],
      },
      {
        fields: ['github_id'],
      },
      {
        fields: ['apple_id'],
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a user, hash the password and generate salt
       */
      beforeCreate: async (user) => {
        if (user.password_hash) {
          const salt = generateSalt(16);
          const { hash } = await hashPassword(user.password_hash, salt);
          user.password_hash = hash;
          user.salt = salt;
        }

        // Generate username if not provided
        if (!user.username && user.email) {
          const base = user.email.split('@')[0];
          const random = Math.floor(1000 + Math.random() * 9000);
          user.username = `${base}${random}`;
        }

        // Generate referral code if not provided
        if (!user.referral_code) {
          user.referral_code = generateReferralCode();
        }

        logger.info(`User created: ${user.email}`);
      },

      /**
       * Before updating a user, check if password is being changed
       */
      beforeUpdate: async (user) => {
        if (user.changed('password_hash') && user.password_hash) {
          const salt = generateSalt(16);
          const { hash } = await hashPassword(user.password_hash, salt);
          user.password_hash = hash;
          user.salt = salt;
          user.last_password_change = new Date();
        }

        if (user.changed('email') && !user.email_verified) {
          user.email_verified = false;
        }
      },
    },
  }
);

/**
 * Generate a unique referral code
 * @returns {string} - Unique referral code
 */
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * Instance methods
 */
User.prototype = {
  ...User.prototype,

  /**
   * Get full name
   * @returns {string} - Full name
   */
  getFullName() {
    return `${this.first_name} ${this.last_name}`.trim();
  },

  /**
   * Get display name
   * @returns {string} - Display name
   */
  getDisplayName() {
    return this.display_name || this.getFullName() || this.email;
  },

  /**
   * Check if user is an admin
   * @returns {boolean} - Whether user is an admin
   */
  isAdmin() {
    return ['admin', 'super_admin'].includes(this.role);
  },

  /**
   * Check if user is a super admin
   * @returns {boolean} - Whether user is a super admin
   */
  isSuperAdmin() {
    return this.role === 'super_admin';
  },

  /**
   * Check if user account is locked
   * @returns {boolean} - Whether account is locked
   */
  isLocked() {
    return this.locked_until && new Date(this.locked_until) > new Date();
  },

  /**
   * Check if user is self-excluded
   * @returns {boolean} - Whether user is self-excluded
   */
  isSelfExcluded() {
    if (!this.self_excluded) return false;
    if (this.self_excluded_until) {
      return new Date(this.self_excluded_until) > new Date();
    }
    return true;
  },

  /**
   * Check if user can place bets
   * @returns {boolean} - Whether user can place bets
   */
  canPlaceBets() {
    return (
      this.status === 'active' &&
      !this.isLocked() &&
      !this.isSelfExcluded() &&
      this.email_verified
    );
  },

  /**
   * Check if KYC is required and completed
   * @param {number} threshold - Amount threshold requiring KYC
   * @returns {boolean} - Whether KYC is compliant
   */
  isKycCompliant(threshold = 1000) {
    // For simplicity, check if KYC is verified
    // In production, this would also check if the user has reached the threshold
    return this.kyc_status === 'verified';
  },

  /**
   * Get user's VIP tier name
   * @returns {string} - VIP tier name
   */
  getVipTierName() {
    const tierMap = {
      none: 'Standard',
      silver: '🥈 Silver',
      gold: '🥇 Gold',
      platinum: '💎 Platinum',
      diamond: '💠 Diamond',
      elite: '⭐ Elite',
    };
    return tierMap[this.vip_tier] || 'Standard';
  },

  /**
   * Get user's VIP tier benefits
   * @returns {Object} - VIP benefits
   */
  getVipBenefits() {
    const benefits = {
      none: {
        cashback: 0,
        freeBets: 0,
        exclusiveBonuses: false,
        personalManager: false,
        prioritySupport: false,
        higherLimits: false,
      },
      silver: {
        cashback: 5,
        freeBets: 2,
        exclusiveBonuses: false,
        personalManager: false,
        prioritySupport: true,
        higherLimits: false,
      },
      gold: {
        cashback: 10,
        freeBets: 4,
        exclusiveBonuses: true,
        personalManager: false,
        prioritySupport: true,
        higherLimits: true,
      },
      platinum: {
        cashback: 15,
        freeBets: 7,
        exclusiveBonuses: true,
        personalManager: true,
        prioritySupport: true,
        higherLimits: true,
      },
      diamond: {
        cashback: 20,
        freeBets: 10,
        exclusiveBonuses: true,
        personalManager: true,
        prioritySupport: true,
        higherLimits: true,
      },
      elite: {
        cashback: 25,
        freeBets: 0, // Unlimited
        exclusiveBonuses: true,
        personalManager: true,
        prioritySupport: true,
        higherLimits: true,
      },
    };
    return benefits[this.vip_tier] || benefits.none;
  },

  /**
   * Get user's deposit limits
   * @param {string} period - Daily, weekly, monthly
   * @returns {number} - Limit amount (0 = no limit)
   */
  getDepositLimit(period) {
    const periods = ['daily', 'weekly', 'monthly'];
    if (!periods.includes(period)) return 0;
    return this.deposit_limits?.[period] || 0;
  },

  /**
   * ToJSON override to exclude sensitive fields
   * @returns {Object} - Safe user object
   */
  toJSON() {
    const values = { ...this.get() };
    delete values.password_hash;
    delete values.salt;
    delete values.two_factor_secret;
    delete values.two_factor_backup_codes;
    return values;
  },
};

/**
 * Static methods
 */
User.findByEmail = async function(email) {
  return this.findOne({
    where: { email: email.toLowerCase().trim() },
  });
};

User.findByUsername = async function(username) {
  return this.findOne({
    where: { username: username.trim() },
  });
};

User.findByReferralCode = async function(referralCode) {
  return this.findOne({
    where: { referral_code: referralCode.trim() },
  });
};

User.findByOAuthId = async function(provider, id) {
  const field = `${provider}_id`;
  return this.findOne({
    where: { [field]: id },
  });
};

User.findActiveUsers = async function(options = {}) {
  const { limit = 100, offset = 0, role = null } = options;
  const where = { status: 'active' };
  if (role) where.role = role;
  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: {
      exclude: ['password_hash', 'salt', 'two_factor_secret', 'two_factor_backup_codes'],
    },
  });
};

User.getVipUsers = async function(tier) {
  return this.findAll({
    where: {
      vip_tier: tier,
      status: 'active',
    },
    attributes: {
      exclude: ['password_hash', 'salt', 'two_factor_secret', 'two_factor_backup_codes'],
    },
    order: [['created_at', 'DESC']],
  });
};

// Export the model
module.exports = User;
