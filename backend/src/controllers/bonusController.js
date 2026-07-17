/**
 * Bonus Controller - Bonus & Reward HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all bonus-related HTTP requests including:
 * - Bonus listing (available, active, claimed, expired)
 * - Bonus claiming
 * - Wagering progress tracking
 * - Bonus statistics
 * - Bonus history
 * - Admin bonus management (create, forfeit, expire)
 * - Bonus validation and eligibility checks
 */

const bonusService = require('../services/bonusService');
const { catchAsync, createValidationError, createNotFoundError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// BONUS RETRIEVAL
// ============================================

/**
 * Get available bonuses for current user
 * GET /api/v1/bonuses/available
 */
const getAvailableBonuses = catchAsync(async (req, res) => {
  const { type = null, tier = null } = req.query;

  const bonuses = await bonusService.getAvailableBonuses(req.user.id, {
    type,
    tier: tier || req.user.vip_tier,
  });

  res.status(200).json({
    success: true,
    data: {
      bonuses,
      count: bonuses.length,
    },
  });
});

/**
 * Get user bonuses (all)
 * GET /api/v1/bonuses/history
 */
const getUserBonuses = catchAsync(async (req, res) => {
  const {
    limit = 50,
    offset = 0,
    type = null,
    status = null,
    active = false,
    includeExpired = false,
  } = req.query;

  const result = await bonusService.getUserBonuses(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    type,
    status,
    active: active === 'true',
    includeExpired: includeExpired === 'true',
  });

  res.status(200).json({
    success: true,
    data: {
      bonuses: result.bonuses,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get active bonuses for current user
 * GET /api/v1/bonuses/active
 */
const getActiveBonuses = catchAsync(async (req, res) => {
  const bonuses = await bonusService.getActiveBonuses(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      bonuses,
      count: bonuses.length,
    },
  });
});

/**
 * Get bonus by ID
 * GET /api/v1/bonuses/:bonusId
 */
const getBonusById = catchAsync(async (req, res) => {
  const { bonusId } = req.params;

  const bonus = await bonusService.getBonusById(bonusId, req.user.id);

  res.status(200).json({
    success: true,
    data: {
      bonus,
    },
  });
});

/**
 * Get bonus summary for current user
 * GET /api/v1/bonuses/summary
 */
const getBonusSummary = catchAsync(async (req, res) => {
  const summary = await bonusService.getBonusSummary(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      summary,
    },
  });
});

/**
 * Get bonus statistics
 * GET /api/v1/bonuses/stats
 */
const getBonusStats = catchAsync(async (req, res) => {
  const { period = 'all' } = req.query;

  const stats = await bonusService.getBonusStats(req.user.id, { period });

  res.status(200).json({
    success: true,
    data: {
      stats,
    },
  });
});

// ============================================
// BONUS WAGERING PROGRESS
// ============================================

/**
 * Get wagering progress for a bonus
 * GET /api/v1/bonuses/:bonusId/wagering
 */
const getWageringProgress = catchAsync(async (req, res) => {
  const { bonusId } = req.params;

  const progress = await bonusService.getWageringProgress(req.user.id, bonusId);

  res.status(200).json({
    success: true,
    data: {
      progress,
    },
  });
});

// ============================================
// BONUS CLAIMING
// ============================================

/**
 * Claim a bonus
 * POST /api/v1/bonuses/claim/:bonusId
 */
const claimBonus = catchAsync(async (req, res) => {
  const { bonusId } = req.params;

  const bonus = await bonusService.claimBonus(req.user.id, bonusId, req);

  res.status(200).json({
    success: true,
    message: 'Bonus claimed successfully',
    data: {
      bonus,
    },
  });
});

/**
 * Check bonus availability before claiming
 * GET /api/v1/bonuses/:bonusId/check
 */
const checkBonusAvailability = catchAsync(async (req, res) => {
  const { bonusId } = req.params;

  const result = await bonusService.checkBonusAvailability(req.user.id, bonusId);

  res.status(200).json({
    success: true,
    data: {
      available: result.available,
      reason: result.reason || null,
    },
  });
});

/**
 * Validate bonus eligibility for a type
 * GET /api/v1/bonuses/validate/:type
 */
const validateBonusEligibility = catchAsync(async (req, res) => {
  const { type } = req.params;
  const { amount, referredUserId, tier } = req.query;

  const result = await bonusService.validateBonusEligibility(req.user.id, type, {
    amount: amount ? parseFloat(amount) : null,
    referredUserId,
    tier: tier || req.user.vip_tier,
  });

  res.status(200).json({
    success: true,
    data: {
      eligible: result.eligible,
      reason: result.reason || null,
    },
  });
});

// ============================================
// BONUS CREATION (Admin Only)
// ============================================

/**
 * Create a bonus (admin only)
 * POST /api/v1/bonuses/admin/create
 */
const createBonus = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can create bonuses');
  }

  const {
    userId,
    type,
    amount,
    wageringRequirement = 1,
    validFrom = null,
    validUntil = null,
    metadata = {},
    minDeposit = 0,
    maxWin = 0,
    eligibleTiers = [],
    description = '',
    promotionId = null,
  } = req.body;

  if (!userId) {
    throw createValidationError('User ID is required');
  }

  if (!type) {
    throw createValidationError('Bonus type is required');
  }

  if (!amount || amount <= 0) {
    throw createValidationError('Valid bonus amount is required');
  }

  const bonus = await bonusService.createBonus({
    userId,
    type,
    amount: parseFloat(amount),
    wageringRequirement: parseFloat(wageringRequirement),
    validFrom: validFrom ? new Date(validFrom) : null,
    validUntil: validUntil ? new Date(validUntil) : null,
    metadata,
    minDeposit: parseFloat(minDeposit),
    maxWin: parseFloat(maxWin),
    eligibleTiers: Array.isArray(eligibleTiers) ? eligibleTiers : [],
    description,
    promotionId,
  }, req);

  res.status(201).json({
    success: true,
    message: 'Bonus created successfully',
    data: {
      bonus,
    },
  });
});

/**
 * Create welcome bonus for a user (admin only)
 * POST /api/v1/bonuses/admin/welcome/:userId
 */
const createWelcomeBonus = catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can create welcome bonuses');
  }

  const bonus = await bonusService.createWelcomeBonus(userId, req);

  res.status(201).json({
    success: true,
    message: 'Welcome bonus created successfully',
    data: {
      bonus,
    },
  });
});

/**
 * Create deposit bonus for a user (admin only)
 * POST /api/v1/bonuses/admin/deposit/:userId
 */
const createDepositBonus = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { depositAmount, matchPercentage = 50, maxBonus = 250 } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can create deposit bonuses');
  }

  if (!depositAmount || depositAmount <= 0) {
    throw createValidationError('Valid deposit amount is required');
  }

  const bonus = await bonusService.createDepositBonus(
    userId,
    parseFloat(depositAmount),
    parseFloat(matchPercentage),
    parseFloat(maxBonus),
    req
  );

  res.status(201).json({
    success: true,
    message: 'Deposit bonus created successfully',
    data: {
      bonus,
    },
  });
});

/**
 * Create VIP bonus for a user (admin only)
 * POST /api/v1/bonuses/admin/vip/:userId
 */
const createVipBonus = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { amount, tier = 'gold' } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can create VIP bonuses');
  }

  if (!amount || amount <= 0) {
    throw createValidationError('Valid bonus amount is required');
  }

  const bonus = await bonusService.createVipBonus(
    userId,
    parseFloat(amount),
    tier,
    req
  );

  res.status(201).json({
    success: true,
    message: 'VIP bonus created successfully',
    data: {
      bonus,
    },
  });
});

/**
 * Create referral bonus (admin only)
 * POST /api/v1/bonuses/admin/referral
 */
const createReferralBonus = catchAsync(async (req, res) => {
  const { referrerId, referredUserId } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can create referral bonuses');
  }

  if (!referrerId || !referredUserId) {
    throw createValidationError('Referrer ID and referred user ID are required');
  }

  const bonus = await bonusService.createReferralBonus(referrerId, referredUserId, req);

  res.status(201).json({
    success: true,
    message: 'Referral bonus created successfully',
    data: {
      bonus,
    },
  });
});

/**
 * Create birthday bonus for a user (admin only)
 * POST /api/v1/bonuses/admin/birthday/:userId
 */
const createBirthdayBonus = catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can create birthday bonuses');
  }

  const bonus = await bonusService.createBirthdayBonus(userId, req);

  res.status(201).json({
    success: true,
    message: 'Birthday bonus created successfully',
    data: {
      bonus,
    },
  });
});

// ============================================
// ADMIN BONUS MANAGEMENT
// ============================================

/**
 * Get all bonuses (admin only)
 * GET /api/v1/bonuses/admin/all
 */
const getAllBonuses = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view all bonuses');
  }

  const { type, status, userId, minAmount, maxAmount, startDate, endDate, limit = 50, offset = 0 } = req.query;

  const result = await bonusService.getAllBonuses(
    {
      type,
      status,
      userId,
      minAmount: minAmount ? parseFloat(minAmount) : null,
      maxAmount: maxAmount ? parseFloat(maxAmount) : null,
      startDate,
      endDate,
    },
    {
      limit: parseInt(limit),
      offset: parseInt(offset),
    }
  );

  res.status(200).json({
    success: true,
    data: {
      bonuses: result.bonuses,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get bonus statistics (admin only)
 * GET /api/v1/bonuses/admin/stats
 */
const getAdminBonusStats = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view bonus statistics');
  }

  const { startDate = null, endDate = null } = req.query;

  const stats = await bonusService.getAdminBonusStats({
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: {
      stats,
    },
  });
});

/**
 * Forfeit a bonus (admin only)
 * POST /api/v1/bonuses/admin/forfeit/:bonusId
 */
const forfeitBonus = catchAsync(async (req, res) => {
  const { bonusId } = req.params;
  const { reason } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can forfeit bonuses');
  }

  if (!reason) {
    throw createValidationError('Forfeit reason is required');
  }

  const bonus = await bonusService.forfeitBonus(bonusId, reason, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Bonus forfeited successfully',
    data: {
      bonus,
    },
  });
});

/**
 * Expire bonuses (admin only - triggers manual expiry)
 * POST /api/v1/bonuses/admin/expire
 */
const expireBonuses = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can expire bonuses');
  }

  const result = await bonusService.expireBonuses(req);

  res.status(200).json({
    success: true,
    message: `${result.expiredCount} bonuses expired (${result.forfeitedCount} forfeited)`,
    data: {
      expiredCount: result.expiredCount,
      forfeitedCount: result.forfeitedCount,
    },
  });
});

// Export all controller methods
module.exports = {
  // Bonus Retrieval
  getAvailableBonuses,
  getUserBonuses,
  getActiveBonuses,
  getBonusById,
  getBonusSummary,
  getBonusStats,

  // Wagering Progress
  getWageringProgress,

  // Bonus Claiming
  claimBonus,
  checkBonusAvailability,
  validateBonusEligibility,

  // Admin Bonus Creation
  createBonus,
  createWelcomeBonus,
  createDepositBonus,
  createVipBonus,
  createReferralBonus,
  createBirthdayBonus,

  // Admin Bonus Management
  getAllBonuses,
  getAdminBonusStats,
  forfeitBonus,
  expireBonuses,
};
