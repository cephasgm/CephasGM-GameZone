/**
 * User Service - User Management Business Logic
 * CephasGM GameZone
 * 
 * This service handles all user-related business logic including:
 * - Profile management (get, update, delete)
 * - User settings and preferences
 * - User statistics and analytics
 * - User search and filtering
 * - Account management (deactivation, reactivation)
 * - User activity tracking
 * - Notification preferences
 * - VIP tier management
 * - KYC status management
 */

const { Op } = require('sequelize');
const { User, Wallet, Bet, Transaction, KycDocument, AuditLog } = require('../models');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const { maskEmail, maskPhone } = require('../utils/encryption');
const { logAudit } = require('../utils/logger');

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const CACHE_TTL = {
  PROFILE: 300, // 5 minutes
  STATS: 600, // 10 minutes
  PREFERENCES: 300, // 5 minutes
};

const DEFAULT_PREFERENCES = {
  language: 'en',
  timezone: 'UTC',
  oddsFormat: 'decimal',
  darkMode: true,
  notifications: {
    email: true,
    push: true,
    sms: false,
    marketing: true,
    betConfirmations: true,
    promotions: true,
    securityAlerts: true,
  },
};

// ============================================
// PROFILE MANAGEMENT
// ============================================

/**
 * Get user profile by ID
 * @param {string} userId - User ID
 * @param {Object} options - Options (include sensitive data)
 * @returns {Promise<Object>} - User profile
 */
const getUserProfile = async (userId, options = {}) => {
  const { includeSensitive = false, includeWallet = true, includeStats = true } = options;

  // Check cache first
  const cacheKey = `user:profile:${userId}`;
  if (!includeSensitive) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        // Invalid cache, continue
      }
    }
  }

  // Build attributes
  const attributes = {
    exclude: includeSensitive ? [] : ['password_hash', 'salt', 'two_factor_secret', 'two_factor_backup_codes'],
  };

  // Find user
  const user = await User.findByPk(userId, {
    attributes,
    include: [],
  });

  if (!user) {
    throw new Error('User not found');
  }

  const profile = user.toJSON();

  // Include wallet if requested
  if (includeWallet) {
    const wallet = await Wallet.findOne({
      where: { user_id: userId },
      attributes: ['id', 'balance', 'bonus_balance', 'locked_balance', 'pending_balance', 'currency'],
    });
    if (wallet) {
      profile.wallet = wallet.toJSON();
    }
  }

  // Include stats if requested
  if (includeStats) {
    profile.stats = await getUserStats(userId);
  }

  // Include KYC status
  profile.kycStatus = user.kyc_status;

  // Mask sensitive data if not including sensitive
  if (!includeSensitive) {
    if (profile.email) {
      profile.email = maskEmail(profile.email);
    }
    if (profile.phone) {
      profile.phone = maskPhone(profile.phone);
    }
  }

  // Cache the profile
  if (!includeSensitive) {
    await cache.set(cacheKey, JSON.stringify(profile), CACHE_TTL.PROFILE);
  }

  return profile;
};

/**
 * Update user profile
 * @param {string} userId - User ID
 * @param {Object} updates - Profile updates
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated user profile
 */
const updateUserProfile = async (userId, updates, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Allowed update fields
  const allowedFields = [
    'first_name',
    'last_name',
    'phone',
    'date_of_birth',
    'country',
    'currency',
    'bio',
    'display_name',
    'username',
    'avatar_url',
  ];

  const updateData = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }

  // Validate username uniqueness
  if (updateData.username) {
    const existing = await User.findOne({
      where: {
        username: updateData.username,
        id: { [Op.ne]: userId },
      },
    });
    if (existing) {
      throw new Error('Username already taken');
    }
  }

  // Update user
  await user.update(updateData);

  // Clear cache
  await cache.del(`user:profile:${userId}`);

  // Log audit
  await logAudit('PROFILE_UPDATED', userId, { updates: Object.keys(updateData) }, req);
  logger.info(`Profile updated for user: ${user.email} (${userId})`);

  // Return updated profile
  return getUserProfile(userId, { includeSensitive: true });
};

/**
 * Update user avatar
 * @param {string} userId - User ID
 * @param {string} avatarUrl - New avatar URL
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated user profile
 */
const updateAvatar = async (userId, avatarUrl, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  await user.update({ avatar_url: avatarUrl });

  // Clear cache
  await cache.del(`user:profile:${userId}`);

  await logAudit('AVATAR_UPDATED', userId, {}, req);
  logger.info(`Avatar updated for user: ${user.email} (${userId})`);

  return getUserProfile(userId);
};

/**
 * Delete user account (soft delete)
 * @param {string} userId - User ID
 * @param {string} reason - Deletion reason
 * @param {Object} req - Express request object
 * @returns {Promise<void>}
 */
const deleteAccount = async (userId, reason = null, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check if user has pending balance
  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (wallet && parseFloat(wallet.balance) > 0) {
    throw new Error('Cannot delete account with remaining balance. Please withdraw all funds first.');
  }

  // Log audit before deletion
  await logAudit('ACCOUNT_DELETED', userId, { reason }, req);

  // Soft delete user
  await user.destroy();

  // Clear cache
  await cache.del(`user:profile:${userId}`);

  logger.info(`Account deleted for user: ${user.email} (${userId})`);
};

/**
 * Reactivate a deleted account (if within grace period)
 * @param {string} userId - User ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Reactivated user
 */
const reactivateAccount = async (userId, req = null) => {
  const user = await User.findByPk(userId, { paranoid: false });
  if (!user) {
    throw new Error('User not found');
  }

  if (!user.deleted_at) {
    throw new Error('Account is not deleted');
  }

  // Check if within grace period (30 days)
  const deletedAt = new Date(user.deleted_at);
  const now = new Date();
  const daysSinceDeletion = (now - deletedAt) / (1000 * 60 * 60 * 24);
  if (daysSinceDeletion > 30) {
    throw new Error('Account cannot be reactivated after 30 days');
  }

  // Reactivate user
  await user.restore();

  // Clear cache
  await cache.del(`user:profile:${userId}`);

  await logAudit('ACCOUNT_REACTIVATED', userId, {}, req);
  logger.info(`Account reactivated for user: ${user.email} (${userId})`);

  return getUserProfile(userId, { includeSensitive: true });
};

// ============================================
// USER STATISTICS
// ============================================

/**
 * Get user statistics
 * @param {string} userId - User ID
 * @param {Object} options - Options (period, includeHistory)
 * @returns {Promise<Object>} - User statistics
 */
const getUserStats = async (userId, options = {}) => {
  const { period = 'all', includeHistory = false } = options;

  // Check cache
  const cacheKey = `user:stats:${userId}:${period}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Invalid cache, continue
    }
  }

  // Build date filters
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

  // Get wallet
  const wallet = await Wallet.findOne({
    where: { user_id: userId },
    attributes: ['balance', 'bonus_balance', 'locked_balance', 'pending_balance', 'total_deposited', 'total_withdrawn'],
  });

  // Get bet stats
  const betWhere = { user_id: userId, ...dateFilter };
  const betStats = await Bet.findOne({
    where: betWhere,
    attributes: [
      [Bet.sequelize.fn('COUNT', Bet.sequelize.col('id')), 'total_bets'],
      [Bet.sequelize.fn('SUM', Bet.sequelize.col('stake')), 'total_stake'],
      [Bet.sequelize.fn('SUM', Bet.sequelize.literal('CASE WHEN status = \'settled\' AND settlement_status = \'won\' THEN actual_win ELSE 0 END')), 'total_wins'],
      [Bet.sequelize.fn('COUNT', Bet.sequelize.literal('CASE WHEN status = \'settled\' AND settlement_status = \'won\' THEN 1 END')), 'win_count'],
      [Bet.sequelize.fn('COUNT', Bet.sequelize.literal('CASE WHEN status = \'settled\' AND settlement_status = \'lost\' THEN 1 END')), 'loss_count'],
    ],
    raw: true,
  });

  // Get transaction stats
  const txWhere = { user_id: userId, status: 'completed', ...dateFilter };
  const txStats = await Transaction.findOne({
    where: txWhere,
    attributes: [
      [Transaction.sequelize.fn('SUM', Transaction.sequelize.literal('CASE WHEN type IN (\'deposit\', \'transfer_in\') THEN amount ELSE 0 END')), 'total_deposits'],
      [Transaction.sequelize.fn('SUM', Transaction.sequelize.literal('CASE WHEN type IN (\'withdrawal\', \'transfer_out\') THEN amount ELSE 0 END')), 'total_withdrawals'],
      [Transaction.sequelize.fn('COUNT', Transaction.sequelize.literal('CASE WHEN type = \'deposit\' THEN 1 END')), 'deposit_count'],
      [Transaction.sequelize.fn('COUNT', Transaction.sequelize.literal('CASE WHEN type = \'withdrawal\' THEN 1 END')), 'withdrawal_count'],
    ],
    raw: true,
  });

  // Get KYC status
  const kycDocuments = await KycDocument.findAll({
    where: { user_id: userId },
    attributes: ['type', 'status'],
  });

  // Compile stats
  const stats = {
    wallet: {
      balance: parseFloat(wallet?.balance || 0),
      bonusBalance: parseFloat(wallet?.bonus_balance || 0),
      lockedBalance: parseFloat(wallet?.locked_balance || 0),
      pendingBalance: parseFloat(wallet?.pending_balance || 0),
      totalDeposited: parseFloat(wallet?.total_deposited || 0),
      totalWithdrawn: parseFloat(wallet?.total_withdrawn || 0),
    },
    betting: {
      totalBets: parseInt(betStats?.total_bets || 0),
      totalStake: parseFloat(betStats?.total_stake || 0),
      totalWins: parseFloat(betStats?.total_wins || 0),
      winCount: parseInt(betStats?.win_count || 0),
      lossCount: parseInt(betStats?.loss_count || 0),
      winRate: (parseInt(betStats?.win_count || 0) + parseInt(betStats?.loss_count || 0)) > 0
        ? (parseInt(betStats?.win_count || 0) / (parseInt(betStats?.win_count || 0) + parseInt(betStats?.loss_count || 0))) * 100
        : 0,
    },
    transactions: {
      totalDeposits: parseFloat(txStats?.total_deposits || 0),
      totalWithdrawals: parseFloat(txStats?.total_withdrawals || 0),
      depositCount: parseInt(txStats?.deposit_count || 0),
      withdrawalCount: parseInt(txStats?.withdrawal_count || 0),
      netDeposits: parseFloat(txStats?.total_deposits || 0) - parseFloat(txStats?.total_withdrawals || 0),
    },
    kyc: {
      documents: kycDocuments.map(doc => ({ type: doc.type, status: doc.status })),
      overallStatus: kycDocuments.length > 0 ? 'pending' : 'not_started',
      isVerified: kycDocuments.some(doc => doc.status === 'verified'),
    },
    period: period,
    lastUpdated: new Date().toISOString(),
  };

  // Get user's VIP tier benefits
  const user = await User.findByPk(userId);
  if (user) {
    stats.vip = {
      tier: user.vip_tier,
      tierName: user.getVipTierName(),
      benefits: user.getVipBenefits(),
    };
  }

  // Cache stats
  await cache.set(cacheKey, JSON.stringify(stats), CACHE_TTL.STATS);

  return stats;
};

/**
 * Get user activity history
 * @param {string} userId - User ID
 * @param {Object} options - Options (limit, offset, type)
 * @returns {Promise<Object>} - Activity history
 */
const getUserActivity = async (userId, options = {}) => {
  const { limit = 20, offset = 0, type = null } = options;

  const where = { user_id: userId };
  if (type) {
    if (type === 'bet') {
      // Get recent bets
      const bets = await Bet.findAll({
        where: { user_id: userId },
        limit,
        offset,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'stake', 'odds', 'status', 'potential_win', 'created_at', 'bet_type'],
      });
      return {
        items: bets.map(bet => ({
          type: 'bet',
          id: bet.id,
          stake: bet.stake,
          odds: bet.odds,
          status: bet.status,
          potentialWin: bet.potential_win,
          createdAt: bet.created_at,
          betType: bet.bet_type,
        })),
        count: await Bet.count({ where: { user_id: userId } }),
      };
    }

    if (type === 'transaction') {
      // Get recent transactions
      const transactions = await Transaction.findAll({
        where: { user_id: userId },
        limit,
        offset,
        order: [['created_at', 'DESC']],
        attributes: ['id', 'type', 'amount', 'status', 'description', 'created_at'],
      });
      return {
        items: transactions.map(tx => ({
          type: 'transaction',
          id: tx.id,
          transactionType: tx.type,
          amount: tx.amount,
          status: tx.status,
          description: tx.description,
          createdAt: tx.created_at,
        })),
        count: await Transaction.count({ where: { user_id: userId } }),
      };
    }
  }

  // Combined activity (mix of bets and transactions)
  const bets = await Bet.findAll({
    where: { user_id: userId },
    limit: Math.ceil(limit / 2),
    offset: Math.floor(offset / 2),
    order: [['created_at', 'DESC']],
    attributes: ['id', 'stake', 'odds', 'status', 'potential_win', 'created_at', 'bet_type'],
  });

  const transactions = await Transaction.findAll({
    where: { user_id: userId },
    limit: Math.ceil(limit / 2),
    offset: Math.floor(offset / 2),
    order: [['created_at', 'DESC']],
    attributes: ['id', 'type', 'amount', 'status', 'description', 'created_at'],
  });

  // Merge and sort by date
  const items = [
    ...bets.map(bet => ({
      type: 'bet',
      id: bet.id,
      stake: bet.stake,
      odds: bet.odds,
      status: bet.status,
      potentialWin: bet.potential_win,
      createdAt: bet.created_at,
      betType: bet.bet_type,
    })),
    ...transactions.map(tx => ({
      type: 'transaction',
      id: tx.id,
      transactionType: tx.type,
      amount: tx.amount,
      status: tx.status,
      description: tx.description,
      createdAt: tx.created_at,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    items: items.slice(0, limit),
    total: items.length,
  };
};

// ============================================
// USER PREFERENCES
// ============================================

/**
 * Get user preferences
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - User preferences
 */
const getPreferences = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Merge with defaults
  const preferences = {
    ...DEFAULT_PREFERENCES,
    ...user.preferences,
  };

  return preferences;
};

/**
 * Update user preferences
 * @param {string} userId - User ID
 * @param {Object} updates - Preference updates
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated preferences
 */
const updatePreferences = async (userId, updates, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const currentPreferences = { ...DEFAULT_PREFERENCES, ...user.preferences };

  // Deep merge updates
  const newPreferences = deepMerge(currentPreferences, updates);

  await user.update({ preferences: newPreferences });

  await logAudit('PREFERENCES_UPDATED', userId, { updates: Object.keys(updates) }, req);
  logger.info(`Preferences updated for user: ${user.email} (${userId})`);

  return newPreferences;
};

/**
 * Update notification preferences
 * @param {string} userId - User ID
 * @param {Object} updates - Notification preferences
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated preferences
 */
const updateNotificationPreferences = async (userId, updates, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const currentPreferences = { ...DEFAULT_PREFERENCES, ...user.preferences };
  const currentNotifications = currentPreferences.notifications || {};

  const newNotifications = {
    ...currentNotifications,
    ...updates,
  };

  await user.update({
    preferences: {
      ...currentPreferences,
      notifications: newNotifications,
    },
  });

  await logAudit('NOTIFICATION_PREFERENCES_UPDATED', userId, { updates: Object.keys(updates) }, req);
  logger.info(`Notification preferences updated for user: ${user.email} (${userId})`);

  return newNotifications;
};

// ============================================
// VIP TIER MANAGEMENT
// ============================================

/**
 * Get VIP tier benefits
 * @param {string} tier - VIP tier
 * @returns {Object} - VIP benefits
 */
const getVipBenefits = (tier) => {
  const benefits = {
    none: {
      name: 'Standard',
      cashback: 0,
      freeBets: 0,
      exclusiveBonuses: false,
      personalManager: false,
      prioritySupport: false,
      higherLimits: false,
      icon: '⭐',
    },
    silver: {
      name: 'Silver',
      cashback: 5,
      freeBets: 2,
      exclusiveBonuses: false,
      personalManager: false,
      prioritySupport: true,
      higherLimits: false,
      icon: '🥈',
    },
    gold: {
      name: 'Gold',
      cashback: 10,
      freeBets: 4,
      exclusiveBonuses: true,
      personalManager: false,
      prioritySupport: true,
      higherLimits: true,
      icon: '🥇',
    },
    platinum: {
      name: 'Platinum',
      cashback: 15,
      freeBets: 7,
      exclusiveBonuses: true,
      personalManager: true,
      prioritySupport: true,
      higherLimits: true,
      icon: '💎',
    },
    diamond: {
      name: 'Diamond',
      cashback: 20,
      freeBets: 10,
      exclusiveBonuses: true,
      personalManager: true,
      prioritySupport: true,
      higherLimits: true,
      icon: '💠',
    },
    elite: {
      name: 'Elite',
      cashback: 25,
      freeBets: 0, // Unlimited
      exclusiveBonuses: true,
      personalManager: true,
      prioritySupport: true,
      higherLimits: true,
      icon: '⭐',
    },
  };

  return benefits[tier] || benefits.none;
};

/**
 * Update user VIP tier
 * @param {string} userId - User ID
 * @param {string} tier - New VIP tier
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated user
 */
const updateVipTier = async (userId, tier, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const validTiers = ['none', 'silver', 'gold', 'platinum', 'diamond', 'elite'];
  if (!validTiers.includes(tier)) {
    throw new Error('Invalid VIP tier');
  }

  await user.update({ vip_tier: tier });

  // Clear cache
  await cache.del(`user:profile:${userId}`);
  await cache.del(`user:stats:${userId}`);

  await logAudit('VIP_TIER_UPDATED', userId, { tier }, req);
  logger.info(`VIP tier updated for user: ${user.email} (${userId}) -> ${tier}`);

  return getUserProfile(userId);
};

/**
 * Calculate VIP tier based on user activity
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Calculated VIP tier
 */
const calculateVipTier = async (userId) => {
  // Get user stats
  const stats = await getUserStats(userId, { period: 'all' });

  const totalWagered = stats.betting.totalStake || 0;
  const winCount = stats.betting.winCount || 0;
  const totalBets = stats.betting.totalBets || 0;

  // Calculate tier based on wagered amount and activity
  if (totalWagered >= 500000 && winCount > 100) {
    return 'elite';
  }
  if (totalWagered >= 150000 && winCount > 50) {
    return 'diamond';
  }
  if (totalWagered >= 50000 && winCount > 25) {
    return 'platinum';
  }
  if (totalWagered >= 15000 && winCount > 10) {
    return 'gold';
  }
  if (totalWagered >= 5000 && winCount > 5) {
    return 'silver';
  }
  return 'none';
};

/**
 * Auto-upgrade VIP tier if eligible
 * @param {string} userId - User ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated user
 */
const autoUpgradeVipTier = async (userId, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const currentTier = user.vip_tier;
  const calculatedTier = await calculateVipTier(userId);

  // Tier hierarchy
  const tierOrder = ['none', 'silver', 'gold', 'platinum', 'diamond', 'elite'];
  const currentIndex = tierOrder.indexOf(currentTier);
  const calculatedIndex = tierOrder.indexOf(calculatedTier);

  if (calculatedIndex > currentIndex) {
    // Upgrade
    await updateVipTier(userId, calculatedTier, req);
    return { upgraded: true, newTier: calculatedTier, oldTier: currentTier };
  }

  return { upgraded: false, currentTier };
};

// ============================================
// USER SEARCH & FILTERING
// ============================================

/**
 * Search users
 * @param {Object} filters - Search filters
 * @param {Object} pagination - Pagination options
 * @returns {Promise<Object>} - Search results
 */
const searchUsers = async (filters = {}, pagination = {}) => {
  const { limit = 20, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = pagination;

  const where = {};

  // Text search
  if (filters.query) {
    where[Op.or] = [
      { email: { [Op.iLike]: `%${filters.query}%` } },
      { first_name: { [Op.iLike]: `%${filters.query}%` } },
      { last_name: { [Op.iLike]: `%${filters.query}%` } },
      { username: { [Op.iLike]: `%${filters.query}%` } },
    ];
  }

  // Exact filters
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.role) {
    where.role = filters.role;
  }
  if (filters.vipTier) {
    where.vip_tier = filters.vipTier;
  }
  if (filters.country) {
    where.country = filters.country;
  }
  if (filters.kycStatus) {
    where.kyc_status = filters.kycStatus;
  }
  if (filters.emailVerified !== undefined) {
    where.email_verified = filters.emailVerified;
  }

  // Date range
  if (filters.startDate) {
    where.created_at = { [Op.gte]: new Date(filters.startDate) };
  }
  if (filters.endDate) {
    where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.endDate) };
  }

  // Exclude deleted users
  where.deleted_at = null;

  const { count, rows } = await User.findAndCountAll({
    where,
    limit,
    offset,
    order: [[sortBy, sortOrder]],
    attributes: {
      exclude: ['password_hash', 'salt', 'two_factor_secret', 'two_factor_backup_codes'],
    },
  });

  return {
    users: rows.map(user => user.toJSON()),
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
  };
};

/**
 * Get users by VIP tier
 * @param {string} tier - VIP tier
 * @param {Object} pagination - Pagination options
 * @returns {Promise<Object>} - Users
 */
const getUsersByVipTier = async (tier, pagination = {}) => {
  const { limit = 20, offset = 0 } = pagination;

  const { count, rows } = await User.findAndCountAll({
    where: {
      vip_tier: tier,
      status: 'active',
      deleted_at: null,
    },
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: {
      exclude: ['password_hash', 'salt', 'two_factor_secret', 'two_factor_backup_codes'],
    },
  });

  return {
    users: rows.map(user => user.toJSON()),
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
  };
};

/**
 * Get users by KYC status
 * @param {string} kycStatus - KYC status
 * @param {Object} pagination - Pagination options
 * @returns {Promise<Object>} - Users
 */
const getUsersByKycStatus = async (kycStatus, pagination = {}) => {
  const { limit = 20, offset = 0 } = pagination;

  const { count, rows } = await User.findAndCountAll({
    where: {
      kyc_status: kycStatus,
      deleted_at: null,
    },
    limit,
    offset,
    order: [['created_at', 'DESC']],
    attributes: {
      exclude: ['password_hash', 'salt', 'two_factor_secret', 'two_factor_backup_codes'],
    },
  });

  return {
    users: rows.map(user => user.toJSON()),
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
  };
};

// ============================================
// USER KYC MANAGEMENT
// ============================================

/**
 * Get user KYC status
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - KYC status
 */
const getUserKycStatus = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const documents = await KycDocument.findAll({
    where: { user_id: userId },
    attributes: ['type', 'status', 'created_at', 'updated_at'],
    order: [['created_at', 'DESC']],
  });

  return {
    overallStatus: user.kyc_status,
    documents: documents.map(doc => ({
      type: doc.type,
      status: doc.status,
      submittedAt: doc.created_at,
      updatedAt: doc.updated_at,
    })),
    isVerified: user.kyc_status === 'verified',
    isPending: user.kyc_status === 'pending',
    isRejected: user.kyc_status === 'rejected',
  };
};

/**
 * Update user KYC status
 * @param {string} userId - User ID
 * @param {string} status - New KYC status
 * @param {string} reason - Rejection reason (if rejected)
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated KYC status
 */
const updateKycStatus = async (userId, status, reason = null, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const validStatuses = ['pending', 'verified', 'rejected', 'not_started'];
  if (!validStatuses.includes(status)) {
    throw new Error('Invalid KYC status');
  }

  const updateData = { kyc_status: status };

  if (status === 'verified') {
    updateData.kyc_verified_at = new Date();
    updateData.kyc_rejection_reason = null;
  } else if (status === 'rejected') {
    updateData.kyc_rejection_reason = reason;
    updateData.kyc_verified_at = null;
  } else {
    updateData.kyc_rejection_reason = null;
    updateData.kyc_verified_at = null;
  }

  await user.update(updateData);

  await logAudit('KYC_STATUS_UPDATED', userId, { status, reason }, req);
  logger.info(`KYC status updated for user: ${user.email} (${userId}) -> ${status}`);

  return getUserKycStatus(userId);
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Deep merge objects
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @returns {Object} - Merged object
 */
const deepMerge = (target, source) => {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Profile Management
  getUserProfile,
  updateUserProfile,
  updateAvatar,
  deleteAccount,
  reactivateAccount,

  // Statistics
  getUserStats,
  getUserActivity,

  // Preferences
  getPreferences,
  updatePreferences,
  updateNotificationPreferences,

  // VIP Tier Management
  getVipBenefits,
  updateVipTier,
  calculateVipTier,
  autoUpgradeVipTier,

  // Search & Filtering
  searchUsers,
  getUsersByVipTier,
  getUsersByKycStatus,

  // KYC Management
  getUserKycStatus,
  updateKycStatus,

  // Constants
  DEFAULT_PREFERENCES,
  CACHE_TTL,
};
