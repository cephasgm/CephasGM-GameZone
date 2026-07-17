/**
 * Bonus Service - Bonus & Reward Management Business Logic
 * CephasGM GameZone
 * 
 * This service handles all bonus-related business logic including:
 * - Bonus creation and allocation
 * - Bonus claiming and activation
 * - Wagering requirement tracking
 * - Bonus expiration management
 * - Bonus types (welcome, deposit, reload, cashback, freebet, VIP, referral, birthday, promotional, loyalty)
 * - Bonus validation and eligibility checks
 * - Bonus statistics and reporting
 * - Bonus history and tracking
 */

const { Op } = require('sequelize');
const { Bonus, User, Wallet, Transaction, Promotion, AuditLog } = require('../models');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const { logAudit } = require('../utils/logger');
const walletService = require('./walletService');

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const CACHE_TTL = {
  AVAILABLE_BONUSES: 300, // 5 minutes
  USER_BONUSES: 300, // 5 minutes
  BONUS_STATS: 600, // 10 minutes
};

const BONUS_TYPES = {
  WELCOME: 'welcome',
  DEPOSIT: 'deposit',
  RELOAD: 'reload',
  CASHBACK: 'cashback',
  FREEBET: 'freebet',
  VIP: 'vip',
  REFERRAL: 'referral',
  BIRTHDAY: 'birthday',
  PROMOTIONAL: 'promotional',
  LOYALTY: 'loyalty',
  WIN_BONUS: 'win_bonus',
  OTHER: 'other',
};

const BONUS_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  CLAIMED: 'claimed',
  EXPIRED: 'expired',
  FORFEITED: 'forfeited',
  USED: 'used',
  CANCELLED: 'cancelled',
};

const BONUS_TIER_MAP = {
  none: 'Standard',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
  diamond: 'Diamond',
  elite: 'Elite',
};

// ============================================
// BONUS CREATION & ALLOCATION
// ============================================

/**
 * Create a new bonus
 * @param {Object} bonusData - Bonus data
 * @param {string} bonusData.userId - User ID
 * @param {string} bonusData.type - Bonus type
 * @param {number} bonusData.amount - Bonus amount
 * @param {number} bonusData.wageringRequirement - Wagering requirement multiplier
 * @param {Date} bonusData.validFrom - Valid from date
 * @param {Date} bonusData.validUntil - Valid until date
 * @param {Object} bonusData.metadata - Additional metadata
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Created bonus
 */
const createBonus = async (bonusData, req = null) => {
  const {
    userId,
    type,
    amount,
    wageringRequirement = 1,
    validFrom = new Date(),
    validUntil = null,
    metadata = {},
    promotionId = null,
    minDeposit = 0,
    maxWin = 0,
    eligibleTiers = [],
    description = '',
  } = bonusData;

  // Validate bonus type
  if (!Object.values(BONUS_TYPES).includes(type)) {
    throw new Error(`Invalid bonus type: ${type}`);
  }

  // Validate amount
  if (amount <= 0) {
    throw new Error('Bonus amount must be greater than 0');
  }

  // Validate wagering requirement
  if (wageringRequirement < 0) {
    throw new Error('Wagering requirement cannot be negative');
  }

  // Validate user exists
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Set default validUntil if not provided
  let finalValidUntil = validUntil;
  if (!finalValidUntil) {
    finalValidUntil = new Date(validFrom);
    finalValidUntil.setDate(finalValidUntil.getDate() + 30); // Default 30 days
  }

  // Check if user already has an active bonus of this type (if max 1 per type)
  if (type === BONUS_TYPES.WELCOME || type === BONUS_TYPES.REFERRAL) {
    const existing = await Bonus.findOne({
      where: {
        user_id: userId,
        type: type,
        status: {
          [Op.in]: [BONUS_STATUS.ACTIVE, BONUS_STATUS.PENDING, BONUS_STATUS.CLAIMED],
        },
      },
    });
    if (existing) {
      throw new Error(`User already has an active ${type} bonus`);
    }
  }

  // Create bonus
  const bonus = await Bonus.create({
    user_id: userId,
    type: type,
    amount: amount,
    currency: user.currency || 'USD',
    wagering_requirement: wageringRequirement,
    valid_from: validFrom,
    valid_until: finalValidUntil,
    status: validFrom <= new Date() ? BONUS_STATUS.ACTIVE : BONUS_STATUS.PENDING,
    min_deposit: minDeposit,
    max_win: maxWin,
    eligible_tiers: eligibleTiers,
    description: description,
    promotion_id: promotionId,
    metadata: metadata,
    remaining_amount: amount,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // If this is a promotion bonus, update promotion stats
  if (promotionId) {
    try {
      await Promotion.increment('total_claims', { by: 1, where: { id: promotionId } });
    } catch (error) {
      logger.error(`Failed to update promotion stats for ${promotionId}:`, error);
    }
  }

  // Log audit
  await logAudit('BONUS_CREATED', userId, {
    bonusId: bonus.id,
    type: type,
    amount: amount,
    wageringRequirement: wageringRequirement,
  }, req);

  logger.info(`Bonus created: ${bonus.id} - ${type} - ${amount} for user ${userId}`);

  // Clear cache
  await cache.del(`available_bonuses:${userId}`);
  await cache.del(`user_bonuses:${userId}`);
  await cache.del(`user_bonuses:${userId}:active`);

  return bonus;
};

/**
 * Create welcome bonus for new user
 * @param {string} userId - User ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Created bonus
 */
const createWelcomeBonus = async (userId, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check if user already has welcome bonus
  const existing = await Bonus.findOne({
    where: {
      user_id: userId,
      type: BONUS_TYPES.WELCOME,
    },
  });

  if (existing) {
    throw new Error('User already has a welcome bonus');
  }

  // Welcome bonus: 100% match up to $500
  const bonusData = {
    userId: userId,
    type: BONUS_TYPES.WELCOME,
    amount: 500,
    wageringRequirement: 35,
    minDeposit: 10,
    maxWin: 1000,
    description: 'Welcome Bonus - 100% match up to $500',
    metadata: {
      matchPercentage: 100,
      maxBonus: 500,
      minDeposit: 10,
      freeSpins: 50,
    },
  };

  return await createBonus(bonusData, req);
};

/**
 * Create deposit bonus
 * @param {string} userId - User ID
 * @param {number} depositAmount - Deposit amount
 * @param {number} matchPercentage - Match percentage
 * @param {number} maxBonus - Maximum bonus amount
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Created bonus
 */
const createDepositBonus = async (userId, depositAmount, matchPercentage = 50, maxBonus = 250, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Calculate bonus amount
  const bonusAmount = Math.min(depositAmount * (matchPercentage / 100), maxBonus);

  if (bonusAmount <= 0) {
    throw new Error('Deposit amount too low for bonus');
  }

  const bonusData = {
    userId: userId,
    type: BONUS_TYPES.DEPOSIT,
    amount: bonusAmount,
    wageringRequirement: 30,
    minDeposit: depositAmount,
    description: `Deposit Bonus - ${matchPercentage}% match up to $${maxBonus}`,
    metadata: {
      depositAmount: depositAmount,
      matchPercentage: matchPercentage,
      maxBonus: maxBonus,
    },
  };

  return await createBonus(bonusData, req);
};

/**
 * Create reload bonus
 * @param {string} userId - User ID
 * @param {number} amount - Bonus amount
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Created bonus
 */
const createReloadBonus = async (userId, amount, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const bonusData = {
    userId: userId,
    type: BONUS_TYPES.RELOAD,
    amount: amount,
    wageringRequirement: 25,
    description: `Reload Bonus - $${amount}`,
    metadata: {
      reloadAmount: amount,
    },
  };

  return await createBonus(bonusData, req);
};

/**
 * Create cashback bonus
 * @param {string} userId - User ID
 * @param {number} cashbackAmount - Cashback amount
 * @param {number} percentage - Cashback percentage
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Created bonus
 */
const createCashbackBonus = async (userId, cashbackAmount, percentage = 10, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (cashbackAmount <= 0) {
    throw new Error('Cashback amount must be greater than 0');
  }

  const bonusData = {
    userId: userId,
    type: BONUS_TYPES.CASHBACK,
    amount: cashbackAmount,
    wageringRequirement: 1, // No wagering for cashback
    description: `Cashback Bonus - ${percentage}%`,
    metadata: {
      cashbackPercentage: percentage,
      cashbackAmount: cashbackAmount,
    },
  };

  return await createBonus(bonusData, req);
};

/**
 * Create VIP bonus
 * @param {string} userId - User ID
 * @param {number} amount - Bonus amount
 * @param {string} tier - VIP tier
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Created bonus
 */
const createVipBonus = async (userId, amount, tier = 'gold', req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const bonusData = {
    userId: userId,
    type: BONUS_TYPES.VIP,
    amount: amount,
    wageringRequirement: 15,
    eligibleTiers: [tier],
    description: `VIP Bonus - ${tier.toUpperCase()} tier`,
    metadata: {
      vipTier: tier,
      bonusAmount: amount,
    },
  };

  return await createBonus(bonusData, req);
};

/**
 * Create referral bonus
 * @param {string} userId - User ID (referrer)
 * @param {string} referredUserId - Referred user ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Created bonus
 */
const createReferralBonus = async (userId, referredUserId, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const referredUser = await User.findByPk(referredUserId);
  if (!referredUser) {
    throw new Error('Referred user not found');
  }

  // Check if referral bonus already exists for this referrer-referred pair
  const existing = await Bonus.findOne({
    where: {
      user_id: userId,
      type: BONUS_TYPES.REFERRAL,
      metadata: {
        [Op.contains]: { referredUserId: referredUserId },
      },
    },
  });

  if (existing) {
    throw new Error('Referral bonus already claimed for this user');
  }

  const bonusData = {
    userId: userId,
    type: BONUS_TYPES.REFERRAL,
    amount: 50,
    wageringRequirement: 10,
    description: `Referral Bonus - ${referredUser.email}`,
    metadata: {
      referredUserId: referredUserId,
      referredEmail: referredUser.email,
    },
  };

  return await createBonus(bonusData, req);
};

/**
 * Create birthday bonus
 * @param {string} userId - User ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Created bonus
 */
const createBirthdayBonus = async (userId, req = null) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check if user already had birthday bonus this year
  const currentYear = new Date().getFullYear();
  const existing = await Bonus.findOne({
    where: {
      user_id: userId,
      type: BONUS_TYPES.BIRTHDAY,
      created_at: {
        [Op.gte]: new Date(`${currentYear}-01-01`),
      },
    },
  });

  if (existing) {
    throw new Error('Birthday bonus already claimed this year');
  }

  const bonusData = {
    userId: userId,
    type: BONUS_TYPES.BIRTHDAY,
    amount: 50,
    wageringRequirement: 5,
    description: 'Birthday Bonus - $50 Free Bet',
    metadata: {
      birthdayYear: currentYear,
    },
  };

  return await createBonus(bonusData, req);
};

// ============================================
// BONUS CLAIMING & ACTIVATION
// ============================================

/**
 * Claim a bonus
 * @param {string} userId - User ID
 * @param {string} bonusId - Bonus ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Claimed bonus
 */
const claimBonus = async (userId, bonusId, req = null) => {
  const bonus = await Bonus.findOne({
    where: {
      id: bonusId,
      user_id: userId,
    },
  });

  if (!bonus) {
    throw new Error('Bonus not found');
  }

  if (!bonus.isClaimable()) {
    throw new Error('Bonus is not claimable');
  }

  // Check if user has made the minimum deposit
  if (bonus.min_deposit > 0) {
    // Get user's total deposits
    const totalDeposits = await Transaction.sum('amount', {
      where: {
        user_id: userId,
        type: 'deposit',
        status: 'completed',
      },
    });

    if ((totalDeposits || 0) < bonus.min_deposit) {
      throw new Error(`Minimum deposit of $${bonus.min_deposit} required to claim this bonus`);
    }
  }

  // Check user VIP tier eligibility
  const user = await User.findByPk(userId);
  if (bonus.eligible_tiers && bonus.eligible_tiers.length > 0) {
    if (!bonus.eligible_tiers.includes(user.vip_tier)) {
      throw new Error(`This bonus is only available for ${bonus.eligible_tiers.join(', ')} VIP members`);
    }
  }

  // Credit bonus to wallet
  await walletService.creditBonus(userId, bonus.amount, bonusId, `Bonus claimed: ${bonus.type}`, req);

  // Update bonus
  await bonus.update({
    status: BONUS_STATUS.CLAIMED,
    claimed_at: new Date(),
    remaining_amount: 0,
  });

  // Clear cache
  await cache.del(`available_bonuses:${userId}`);
  await cache.del(`user_bonuses:${userId}`);

  // Log audit
  await logAudit('BONUS_CLAIMED', userId, {
    bonusId: bonus.id,
    type: bonus.type,
    amount: bonus.amount,
  }, req);

  logger.info(`Bonus claimed: ${bonus.id} - ${bonus.amount} for user ${userId}`);

  return bonus;
};

/**
 * Check if a bonus is available for a user
 * @param {string} userId - User ID
 * @param {string} bonusId - Bonus ID
 * @returns {Promise<Object>} - Availability check result
 */
const checkBonusAvailability = async (userId, bonusId) => {
  const bonus = await Bonus.findOne({
    where: {
      id: bonusId,
      user_id: userId,
    },
  });

  if (!bonus) {
    return { available: false, reason: 'Bonus not found' };
  }

  if (!bonus.isClaimable()) {
    return { available: false, reason: 'Bonus is not claimable' };
  }

  // Check minimum deposit
  if (bonus.min_deposit > 0) {
    const totalDeposits = await Transaction.sum('amount', {
      where: {
        user_id: userId,
        type: 'deposit',
        status: 'completed',
      },
    });

    if ((totalDeposits || 0) < bonus.min_deposit) {
      return { available: false, reason: `Minimum deposit of $${bonus.min_deposit} required` };
    }
  }

  // Check VIP tier eligibility
  const user = await User.findByPk(userId);
  if (bonus.eligible_tiers && bonus.eligible_tiers.length > 0) {
    if (!bonus.eligible_tiers.includes(user.vip_tier)) {
      return { available: false, reason: `Only available for ${bonus.eligible_tiers.join(', ')} VIP members` };
    }
  }

  return { available: true };
};

/**
 * Get available bonuses for a user
 * @param {string} userId - User ID
 * @param {Object} options - Options
 * @returns {Promise<Array>} - Available bonuses
 */
const getAvailableBonuses = async (userId, options = {}) => {
  const { includeClaimed = false, type = null, tier = null } = options;

  // Check cache
  const cacheKey = `available_bonuses:${userId}:${type || 'all'}:${tier || 'all'}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Invalid cache, continue
    }
  }

  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Build where clause
  const where = {
    user_id: userId,
    status: BONUS_STATUS.ACTIVE,
    valid_from: { [Op.lte]: new Date() },
    valid_until: { [Op.gte]: new Date() },
    remaining_amount: { [Op.gt]: 0 },
  };

  if (type) where.type = type;

  // Filter by tier eligibility
  if (tier) {
    where[Op.or] = [
      { eligible_tiers: { [Op.eq]: [] } },
      { eligible_tiers: { [Op.contains]: [tier] } },
    ];
  }

  // Exclude claimed bonuses if not requested
  if (!includeClaimed) {
    where.status = BONUS_STATUS.ACTIVE;
  }

  const bonuses = await Bonus.findAll({
    where,
    order: [
      ['valid_until', 'ASC'],
      ['created_at', 'DESC'],
    ],
  });

  // Filter bonuses by minimum deposit and VIP tier
  const filteredBonuses = [];
  for (const bonus of bonuses) {
    const availability = await checkBonusAvailability(userId, bonus.id);
    if (availability.available) {
      filteredBonuses.push(bonus);
    }
  }

  await cache.set(cacheKey, JSON.stringify(filteredBonuses), CACHE_TTL.AVAILABLE_BONUSES);

  return filteredBonuses;
};

// ============================================
// WAGERING REQUIREMENT TRACKING
// ============================================

/**
 * Update wagering progress for a bonus
 * @param {string} userId - User ID
 * @param {number} amount - Amount wagered
 * @param {string} bonusId - Bonus ID (optional)
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated bonus
 */
const updateWageringProgress = async (userId, amount, bonusId = null, req = null) => {
  if (amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  const where = {
    user_id: userId,
    status: BONUS_STATUS.CLAIMED,
    remaining_amount: { [Op.gt]: 0 },
    valid_until: { [Op.gte]: new Date() },
  };

  if (bonusId) {
    where.id = bonusId;
  }

  const bonuses = await Bonus.findAll({
    where,
    order: [['created_at', 'ASC']],
  });

  if (bonuses.length === 0) {
    return { updated: false, message: 'No active bonuses to update' };
  }

  let updatedCount = 0;
  let remainingAmount = amount;

  for (const bonus of bonuses) {
    if (remainingAmount <= 0) break;

    // Calculate how much wagering is still required
    const totalRequirement = bonus.wagering_requirement * bonus.amount;
    const currentProgress = bonus.wagering_progress || 0;
    const remainingRequirement = totalRequirement - currentProgress;

    if (remainingRequirement <= 0) {
      // Bonus already met wagering requirements
      continue;
    }

    const amountToApply = Math.min(remainingAmount, remainingRequirement);
    const newProgress = currentProgress + amountToApply;

    await bonus.update({
      wagering_progress: newProgress,
    });

    // Check if wagering requirement is met
    if (newProgress >= totalRequirement) {
      await bonus.update({
        wagering_met: true,
      });

      // Transfer remaining bonus balance to main balance
      if (bonus.remaining_amount > 0) {
        await walletService.processBonusClaim(
          userId,
          bonus.remaining_amount,
          bonus.id,
          req
        );
      }
    }

    remainingAmount -= amountToApply;
    updatedCount++;
  }

  // Clear cache
  await cache.del(`user_bonuses:${userId}`);
  await cache.del(`available_bonuses:${userId}`);

  return {
    updated: updatedCount > 0,
    count: updatedCount,
    remainingAmount,
  };
};

/**
 * Get wagering progress for a bonus
 * @param {string} userId - User ID
 * @param {string} bonusId - Bonus ID
 * @returns {Promise<Object>} - Wagering progress
 */
const getWageringProgress = async (userId, bonusId) => {
  const bonus = await Bonus.findOne({
    where: {
      id: bonusId,
      user_id: userId,
    },
  });

  if (!bonus) {
    throw new Error('Bonus not found');
  }

  const totalRequirement = bonus.wagering_requirement * bonus.amount;
  const currentProgress = bonus.wagering_progress || 0;
  const remainingRequirement = Math.max(0, totalRequirement - currentProgress);

  return {
    bonusId: bonus.id,
    type: bonus.type,
    amount: bonus.amount,
    wageringRequirement: bonus.wagering_requirement,
    totalRequirement: totalRequirement,
    currentProgress: currentProgress,
    remainingRequirement: remainingRequirement,
    progressPercentage: totalRequirement > 0 ? (currentProgress / totalRequirement) * 100 : 0,
    isMet: bonus.wagering_met || false,
  };
};

// ============================================
// BONUS EXPIRATION MANAGEMENT
// ============================================

/**
 * Check and expire bonuses
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Expiration result
 */
const expireBonuses = async (req = null) => {
  const now = new Date();

  // Find expired bonuses
  const expiredBonuses = await Bonus.findAll({
    where: {
      status: {
        [Op.in]: [BONUS_STATUS.ACTIVE, BONUS_STATUS.PENDING, BONUS_STATUS.CLAIMED],
      },
      valid_until: {
        [Op.lt]: now,
      },
    },
  });

  let expiredCount = 0;
  let forfeitedCount = 0;

  for (const bonus of expiredBonuses) {
    // If bonus has remaining amount, forfeit it
    if (bonus.remaining_amount > 0 && bonus.status === BONUS_STATUS.CLAIMED) {
      // Forfeit bonus amount
      await bonus.update({
        status: BONUS_STATUS.EXPIRED,
        expired_at: now,
        remaining_amount: 0,
      });
      forfeitedCount++;
    } else {
      await bonus.update({
        status: BONUS_STATUS.EXPIRED,
        expired_at: now,
      });
    }
    expiredCount++;

    // Log audit
    await logAudit('BONUS_EXPIRED', bonus.user_id, {
      bonusId: bonus.id,
      type: bonus.type,
      amount: bonus.amount,
    }, req);
  }

  logger.info(`Expired ${expiredCount} bonuses (${forfeitedCount} forfeited)`);

  return {
    expiredCount,
    forfeitedCount,
  };
};

/**
 * Forfeit a bonus (admin)
 * @param {string} bonusId - Bonus ID
 * @param {string} reason - Forfeit reason
 * @param {string} adminId - Admin user ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Forfeited bonus
 */
const forfeitBonus = async (bonusId, reason, adminId, req = null) => {
  const bonus = await Bonus.findByPk(bonusId);
  if (!bonus) {
    throw new Error('Bonus not found');
  }

  if (bonus.status === BONUS_STATUS.EXPIRED || bonus.status === BONUS_STATUS.FORFEITED) {
    throw new Error('Bonus is already expired or forfeited');
  }

  await bonus.update({
    status: BONUS_STATUS.FORFEITED,
    remaining_amount: 0,
    admin_notes: reason,
  });

  // Log audit
  await logAudit('BONUS_FORFEITED', bonus.user_id, {
    bonusId: bonus.id,
    type: bonus.type,
    amount: bonus.amount,
    reason,
    adminId,
  }, req);

  logger.info(`Bonus forfeited: ${bonus.id} by admin ${adminId}`);

  return bonus;
};

// ============================================
// BONUS RETRIEVAL
// ============================================

/**
 * Get bonus by ID
 * @param {string} bonusId - Bonus ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} - Bonus
 */
const getBonusById = async (bonusId, userId) => {
  const bonus = await Bonus.findOne({
    where: {
      id: bonusId,
      user_id: userId,
    },
  });

  if (!bonus) {
    throw new Error('Bonus not found');
  }

  return bonus;
};

/**
 * Get user bonuses
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - User bonuses
 */
const getUserBonuses = async (userId, options = {}) => {
  const {
    limit = 50,
    offset = 0,
    type = null,
    status = null,
    active = false,
    includeExpired = false,
  } = options;

  // Check cache
  const cacheKey = `user_bonuses:${userId}:${type || 'all'}:${status || 'all'}`;
  if (!active && includeExpired) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        // Invalid cache, continue
      }
    }
  }

  const where = { user_id: userId };
  if (type) where.type = type;
  if (status) where.status = status;

  if (active) {
    where.status = BONUS_STATUS.ACTIVE;
    where.valid_from = { [Op.lte]: new Date() };
    where.valid_until = { [Op.gte]: new Date() };
    where.remaining_amount = { [Op.gt]: 0 };
  }

  if (!includeExpired) {
    where.status = {
      [Op.notIn]: [BONUS_STATUS.EXPIRED, BONUS_STATUS.FORFEITED],
    };
  }

  const { count, rows } = await Bonus.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });

  const result = {
    bonuses: rows,
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
  };

  // Cache only if not filtered by status
  if (!active && offset === 0 && !status) {
    await cache.set(cacheKey, JSON.stringify(result), CACHE_TTL.USER_BONUSES);
  }

  return result;
};

/**
 * Get active bonuses for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Active bonuses
 */
const getActiveBonuses = async (userId) => {
  // Check cache
  const cacheKey = `user_bonuses:${userId}:active`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Invalid cache, continue
    }
  }

  const bonuses = await Bonus.findAll({
    where: {
      user_id: userId,
      status: BONUS_STATUS.ACTIVE,
      valid_from: { [Op.lte]: new Date() },
      valid_until: { [Op.gte]: new Date() },
      remaining_amount: { [Op.gt]: 0 },
    },
    order: [['valid_until', 'ASC']],
  });

  await cache.set(cacheKey, JSON.stringify(bonuses), CACHE_TTL.USER_BONUSES);

  return bonuses;
};

// ============================================
// BONUS STATISTICS
// ============================================

/**
 * Get bonus statistics
 * @param {string} userId - User ID
 * @param {Object} options - Options (period)
 * @returns {Promise<Object>} - Bonus statistics
 */
const getBonusStats = async (userId, options = {}) => {
  const { period = 'all' } = options;

  // Check cache
  const cacheKey = `bonus_stats:${userId}:${period}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Invalid cache, continue
    }
  }

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

  const where = { user_id: userId, ...dateFilter };

  const stats = await Bonus.findOne({
    where,
    attributes: [
      [Bonus.sequelize.fn('COUNT', Bonus.sequelize.col('id')), 'total_bonuses'],
      [Bonus.sequelize.fn('SUM', Bonus.sequelize.literal('CASE WHEN status = \'claimed\' THEN amount ELSE 0 END')), 'total_claimed'],
      [Bonus.sequelize.fn('SUM', Bonus.sequelize.literal('CASE WHEN status = \'active\' THEN amount ELSE 0 END')), 'total_active'],
      [Bonus.sequelize.fn('SUM', Bonus.sequelize.literal('CASE WHEN status = \'expired\' THEN amount ELSE 0 END')), 'total_expired'],
      [Bonus.sequelize.fn('COUNT', Bonus.sequelize.literal('CASE WHEN status = \'claimed\' THEN 1 END')), 'claimed_count'],
      [Bonus.sequelize.fn('COUNT', Bonus.sequelize.literal('CASE WHEN status = \'active\' THEN 1 END')), 'active_count'],
      [Bonus.sequelize.fn('COUNT', Bonus.sequelize.literal('CASE WHEN status = \'expired\' THEN 1 END')), 'expired_count'],
    ],
    raw: true,
  });

  const result = {
    totalBonuses: parseInt(stats?.total_bonuses || 0),
    totalClaimed: parseFloat(stats?.total_claimed || 0),
    totalActive: parseFloat(stats?.total_active || 0),
    totalExpired: parseFloat(stats?.total_expired || 0),
    claimedCount: parseInt(stats?.claimed_count || 0),
    activeCount: parseInt(stats?.active_count || 0),
    expiredCount: parseInt(stats?.expired_count || 0),
    claimRate: (parseInt(stats?.total_bonuses || 0) > 0)
      ? (parseInt(stats?.claimed_count || 0) / parseInt(stats?.total_bonuses || 0)) * 100
      : 0,
  };

  await cache.set(cacheKey, JSON.stringify(result), CACHE_TTL.BONUS_STATS);

  return result;
};

/**
 * Get bonus summary for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Bonus summary
 */
const getBonusSummary = async (userId) => {
  const activeBonuses = await getActiveBonuses(userId);

  let totalActiveAmount = 0;
  let totalWageringProgress = 0;
  let totalWageringRequirement = 0;

  for (const bonus of activeBonuses) {
    totalActiveAmount += parseFloat(bonus.remaining_amount || 0);
    const reqAmount = bonus.wagering_requirement * bonus.amount;
    totalWageringRequirement += reqAmount;
    totalWageringProgress += parseFloat(bonus.wagering_progress || 0);
  }

  const wageringProgressPercentage = totalWageringRequirement > 0
    ? (totalWageringProgress / totalWageringRequirement) * 100
    : 0;

  return {
    activeBonuses: activeBonuses.length,
    totalActiveAmount: totalActiveAmount,
    wageringProgress: {
      total: totalWageringProgress,
      requirement: totalWageringRequirement,
      percentage: wageringProgressPercentage,
    },
    bonuses: activeBonuses.map(bonus => ({
      id: bonus.id,
      type: bonus.type,
      amount: bonus.amount,
      remaining: bonus.remaining_amount,
      wageringProgress: bonus.wagering_progress || 0,
      wageringRequirement: bonus.wagering_requirement * bonus.amount,
      validUntil: bonus.valid_until,
    })),
  };
};

// ============================================
// BONUS VALIDATION
// ============================================

/**
 * Validate bonus eligibility
 * @param {string} userId - User ID
 * @param {string} bonusType - Bonus type
 * @param {Object} context - Additional context
 * @returns {Promise<Object>} - Validation result
 */
const validateBonusEligibility = async (userId, bonusType, context = {}) => {
  const user = await User.findByPk(userId);
  if (!user) {
    return { eligible: false, reason: 'User not found' };
  }

  // Check if user has already claimed this type
  const existing = await Bonus.findOne({
    where: {
      user_id: userId,
      type: bonusType,
      status: {
        [Op.in]: [BONUS_STATUS.CLAIMED, BONUS_STATUS.ACTIVE],
      },
    },
  });

  switch (bonusType) {
    case BONUS_TYPES.WELCOME:
      if (existing) {
        return { eligible: false, reason: 'Welcome bonus already claimed' };
      }
      if (user.created_at && user.created_at > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
        return { eligible: true, reason: 'Welcome bonus available' };
      }
      return { eligible: false, reason: 'Welcome bonus no longer available' };

    case BONUS_TYPES.REFERRAL:
      if (existing) {
        return { eligible: false, reason: 'Referral bonus already claimed' };
      }
      if (context.referredUserId) {
        const referredUser = await User.findByPk(context.referredUserId);
        if (referredUser && referredUser.referred_by === userId) {
          return { eligible: true, reason: 'Referral bonus available' };
        }
        return { eligible: false, reason: 'User not referred by you' };
      }
      return { eligible: false, reason: 'No referred user provided' };

    case BONUS_TYPES.BIRTHDAY:
      if (existing) {
        const currentYear = new Date().getFullYear();
        const existingYear = new Date(existing.created_at).getFullYear();
        if (existingYear === currentYear) {
          return { eligible: false, reason: 'Birthday bonus already claimed this year' };
        }
      }
      return { eligible: true, reason: 'Birthday bonus available' };

    case BONUS_TYPES.VIP:
      const tier = context.tier || user.vip_tier;
      if (tier === 'none') {
        return { eligible: false, reason: 'VIP bonus requires VIP status' };
      }
      return { eligible: true, reason: `VIP bonus available for ${tier} tier` };

    case BONUS_TYPES.CASHBACK:
      if (context.amount && context.amount > 0) {
        return { eligible: true, reason: 'Cashback bonus available' };
      }
      return { eligible: false, reason: 'No cashback amount provided' };

    default:
      return { eligible: true, reason: 'Bonus available' };
  }
};

// ============================================
// ADMIN OPERATIONS
// ============================================

/**
 * Get all bonuses (admin)
 * @param {Object} filters - Filters
 * @param {Object} pagination - Pagination options
 * @returns {Promise<Object>} - Bonuses
 */
const getAllBonuses = async (filters = {}, pagination = {}) => {
  const { limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = pagination;

  const where = {};

  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.userId) where.user_id = filters.userId;
  if (filters.minAmount) where.amount = { [Op.gte]: filters.minAmount };
  if (filters.maxAmount) where.amount = { ...where.amount, [Op.lte]: filters.maxAmount };
  if (filters.startDate) where.created_at = { [Op.gte]: new Date(filters.startDate) };
  if (filters.endDate) where.created_at = { ...where.created_at, [Op.lte]: new Date(filters.endDate) };

  const { count, rows } = await Bonus.findAndCountAll({
    where,
    limit,
    offset,
    order: [[sortBy, sortOrder]],
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email', 'username', 'vip_tier'],
      },
    ],
  });

  return {
    bonuses: rows,
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
  };
};

/**
 * Get bonus statistics (admin)
 * @param {Object} options - Options
 * @returns {Promise<Object>} - Statistics
 */
const getAdminBonusStats = async (options = {}) => {
  const { startDate = null, endDate = null } = options;

  const where = {};
  if (startDate) where.created_at = { [Op.gte]: new Date(startDate) };
  if (endDate) where.created_at = { ...where.created_at, [Op.lte]: new Date(endDate) };

  const stats = await Bonus.findOne({
    where,
    attributes: [
      [Bonus.sequelize.fn('COUNT', Bonus.sequelize.col('id')), 'total_bonuses'],
      [Bonus.sequelize.fn('SUM', Bonus.sequelize.col('amount')), 'total_amount'],
      [Bonus.sequelize.fn('SUM', Bonus.sequelize.literal('CASE WHEN status = \'claimed\' THEN amount ELSE 0 END')), 'total_claimed'],
      [Bonus.sequelize.fn('SUM', Bonus.sequelize.literal('CASE WHEN status = \'active\' THEN amount ELSE 0 END')), 'total_active'],
      [Bonus.sequelize.fn('SUM', Bonus.sequelize.literal('CASE WHEN status = \'expired\' THEN amount ELSE 0 END')), 'total_expired'],
      [Bonus.sequelize.fn('COUNT', Bonus.sequelize.literal('CASE WHEN status = \'claimed\' THEN 1 END')), 'claimed_count'],
      [Bonus.sequelize.fn('COUNT', Bonus.sequelize.literal('CASE WHEN status = \'active\' THEN 1 END')), 'active_count'],
      [Bonus.sequelize.fn('COUNT', Bonus.sequelize.literal('CASE WHEN status = \'expired\' THEN 1 END')), 'expired_count'],
    ],
    raw: true,
  });

  // Get breakdown by type
  const typeStats = await Bonus.findAll({
    where,
    attributes: [
      'type',
      [Bonus.sequelize.fn('COUNT', Bonus.sequelize.col('id')), 'count'],
      [Bonus.sequelize.fn('SUM', Bonus.sequelize.col('amount')), 'amount'],
      [Bonus.sequelize.fn('SUM', Bonus.sequelize.literal('CASE WHEN status = \'claimed\' THEN amount ELSE 0 END')), 'claimed_amount'],
    ],
    group: ['type'],
    raw: true,
  });

  const byType = {};
  for (const row of typeStats) {
    byType[row.type] = {
      count: parseInt(row.count) || 0,
      amount: parseFloat(row.amount) || 0,
      claimed: parseFloat(row.claimed_amount) || 0,
    };
  }

  return {
    totalBonuses: parseInt(stats?.total_bonuses || 0),
    totalAmount: parseFloat(stats?.total_amount || 0),
    totalClaimed: parseFloat(stats?.total_claimed || 0),
    totalActive: parseFloat(stats?.total_active || 0),
    totalExpired: parseFloat(stats?.total_expired || 0),
    claimedCount: parseInt(stats?.claimed_count || 0),
    activeCount: parseInt(stats?.active_count || 0),
    expiredCount: parseInt(stats?.expired_count || 0),
    claimRate: (parseInt(stats?.total_bonuses || 0) > 0)
      ? (parseInt(stats?.claimed_count || 0) / parseInt(stats?.total_bonuses || 0)) * 100
      : 0,
    byType,
  };
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Bonus Creation
  createBonus,
  createWelcomeBonus,
  createDepositBonus,
  createReloadBonus,
  createCashbackBonus,
  createVipBonus,
  createReferralBonus,
  createBirthdayBonus,

  // Bonus Claiming
  claimBonus,
  checkBonusAvailability,
  getAvailableBonuses,

  // Wagering Tracking
  updateWageringProgress,
  getWageringProgress,

  // Expiration Management
  expireBonuses,
  forfeitBonus,

  // Bonus Retrieval
  getBonusById,
  getUserBonuses,
  getActiveBonuses,

  // Bonus Statistics
  getBonusStats,
  getBonusSummary,

  // Bonus Validation
  validateBonusEligibility,

  // Admin Operations
  getAllBonuses,
  getAdminBonusStats,

  // Constants
  BONUS_TYPES,
  BONUS_STATUS,
  BONUS_TIER_MAP,
  CACHE_TTL,
};
