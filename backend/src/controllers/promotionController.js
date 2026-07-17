/**
 * Promotion Controller - Promotional Campaign HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all promotion-related HTTP requests including:
 * - Promotion listing (active, upcoming, featured)
 * - Promotion details
 * - Promotion claiming and tracking
 * - Promotion eligibility checks
 * - Promotion statistics
 * - Admin promotion management (create, update, delete)
 * - Promotion performance tracking
 * - User-specific promotion recommendations
 */

const promotionService = require('../services/promotionService');
const { catchAsync, createValidationError, createNotFoundError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// PROMOTION RETRIEVAL (Public)
// ============================================

/**
 * Get active promotions
 * GET /api/v1/promotions/active
 */
const getActivePromotions = catchAsync(async (req, res) => {
  const { type = null, placement = null, targetAudience = null, limit = 50, offset = 0 } = req.query;

  const result = await promotionService.getActivePromotions({
    type,
    placement,
    targetAudience,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      promotions: result.promotions,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get featured promotions
 * GET /api/v1/promotions/featured
 */
const getFeaturedPromotions = catchAsync(async (req, res) => {
  const { limit = 6 } = req.query;

  const promotions = await promotionService.getFeaturedPromotions(parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      promotions,
      count: promotions.length,
    },
  });
});

/**
 * Get upcoming promotions
 * GET /api/v1/promotions/upcoming
 */
const getUpcomingPromotions = catchAsync(async (req, res) => {
  const { limit = 10 } = req.query;

  const promotions = await promotionService.getUpcomingPromotions(parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      promotions,
      count: promotions.length,
    },
  });
});

/**
 * Get promotion by ID
 * GET /api/v1/promotions/:promotionId
 */
const getPromotionById = catchAsync(async (req, res) => {
  const { promotionId } = req.params;

  const promotion = await promotionService.getPromotionById(promotionId);

  if (!promotion) {
    throw createNotFoundError('Promotion', promotionId);
  }

  // Record view
  await promotionService.recordPromotionView(promotionId);

  res.status(200).json({
    success: true,
    data: {
      promotion,
    },
  });
});

/**
 * Get promotion by slug
 * GET /api/v1/promotions/slug/:slug
 */
const getPromotionBySlug = catchAsync(async (req, res) => {
  const { slug } = req.params;

  const promotion = await promotionService.getPromotionBySlug(slug);

  if (!promotion) {
    throw createNotFoundError('Promotion', slug);
  }

  // Record view
  await promotionService.recordPromotionView(promotion.id);

  res.status(200).json({
    success: true,
    data: {
      promotion,
    },
  });
});

/**
 * Get promotions for current user
 * GET /api/v1/promotions/user
 */
const getUserPromotions = catchAsync(async (req, res) => {
  const { limit = 20, offset = 0, excludeClaimed = true } = req.query;

  const result = await promotionService.getPromotionsForUser(req.user, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    excludeClaimed: excludeClaimed === 'true',
  });

  res.status(200).json({
    success: true,
    data: {
      promotions: result.promotions,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get promotions by type
 * GET /api/v1/promotions/type/:type
 */
const getPromotionsByType = catchAsync(async (req, res) => {
  const { type } = req.params;
  const { activeOnly = true, limit = 50, offset = 0 } = req.query;

  const result = await promotionService.getPromotionsByType(type, {
    activeOnly: activeOnly === 'true',
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      promotions: result.promotions,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

// ============================================
// PROMOTION INTERACTION
// ============================================

/**
 * Record a promotion click
 * POST /api/v1/promotions/:promotionId/click
 */
const recordPromotionClick = catchAsync(async (req, res) => {
  const { promotionId } = req.params;

  await promotionService.recordPromotionClick(promotionId, req.user?.id);

  res.status(200).json({
    success: true,
    message: 'Promotion click recorded successfully',
  });
});

/**
 * Record a promotion conversion
 * POST /api/v1/promotions/:promotionId/convert
 */
const recordPromotionConversion = catchAsync(async (req, res) => {
  const { promotionId } = req.params;
  const { amount = 0 } = req.body;

  await promotionService.recordPromotionConversion(promotionId, parseFloat(amount));

  res.status(200).json({
    success: true,
    message: 'Promotion conversion recorded successfully',
  });
});

/**
 * Check if user is eligible for a promotion
 * GET /api/v1/promotions/:promotionId/eligible
 */
const checkPromotionEligibility = catchAsync(async (req, res) => {
  const { promotionId } = req.params;

  const promotion = await promotionService.getPromotionById(promotionId);
  if (!promotion) {
    throw createNotFoundError('Promotion', promotionId);
  }

  const isEligible = await promotionService.isUserEligible(promotion, req.user);

  res.status(200).json({
    success: true,
    data: {
      eligible: isEligible,
      promotionId,
    },
  });
});

// ============================================
// PROMOTION STATISTICS
// ============================================

/**
 * Get promotion performance stats
 * GET /api/v1/promotions/:promotionId/performance
 */
const getPromotionPerformance = catchAsync(async (req, res) => {
  const { promotionId } = req.params;

  const stats = await promotionService.getPromotionPerformance(promotionId);

  if (!stats) {
    throw createNotFoundError('Promotion', promotionId);
  }

  res.status(200).json({
    success: true,
    data: {
      performance: stats,
    },
  });
});

/**
 * Get promotion statistics overview
 * GET /api/v1/promotions/stats
 */
const getPromotionStats = catchAsync(async (req, res) => {
  const stats = await promotionService.getPromotionStats();

  res.status(200).json({
    success: true,
    data: {
      stats,
    },
  });
});

// ============================================
// ADMIN PROMOTION MANAGEMENT
// ============================================

/**
 * Create a promotion (admin only)
 * POST /api/v1/promotions/admin
 */
const createPromotion = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can create promotions');
  }

  const {
    name,
    type,
    title,
    description,
    shortDescription,
    valueType,
    value,
    maxValue,
    currency = 'USD',
    startDate,
    endDate,
    targetAudience = 'all',
    targetCountries = [],
    excludeCountries = [],
    targetTiers = [],
    bonusType = null,
    bonusAmount = null,
    wageringRequirement = null,
    minDeposit = null,
    maxWin = null,
    maxClaimsPerUser = 1,
    maxTotalClaims = 0,
    budget = null,
    channels = ['website', 'app', 'email'],
    placement = 'all',
    priority = 0,
    displaySettings = {},
    termsConditions = null,
    howItWorks = null,
    faqs = [],
    bannerImage = null,
    bannerMobile = null,
    icon = null,
    backgroundColor = null,
    metaTitle = null,
    metaDescription = null,
    metaKeywords = [],
  } = req.body;

  // Validate required fields
  if (!name) throw createValidationError('Promotion name is required');
  if (!type) throw createValidationError('Promotion type is required');
  if (!title) throw createValidationError('Promotion title is required');
  if (!description) throw createValidationError('Promotion description is required');
  if (!valueType) throw createValidationError('Value type is required');
  if (value === undefined || value === null) throw createValidationError('Promotion value is required');
  if (!startDate) throw createValidationError('Start date is required');
  if (!endDate) throw createValidationError('End date is required');

  const promotion = await promotionService.createPromotion({
    name,
    type,
    title,
    description,
    shortDescription,
    valueType,
    value: parseFloat(value),
    maxValue: maxValue ? parseFloat(maxValue) : null,
    currency,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    targetAudience,
    targetCountries,
    excludeCountries,
    targetTiers,
    bonusType,
    bonusAmount: bonusAmount ? parseFloat(bonusAmount) : null,
    wageringRequirement: wageringRequirement ? parseFloat(wageringRequirement) : null,
    minDeposit: minDeposit ? parseFloat(minDeposit) : null,
    maxWin: maxWin ? parseFloat(maxWin) : null,
    maxClaimsPerUser: parseInt(maxClaimsPerUser),
    maxTotalClaims: parseInt(maxTotalClaims),
    budget: budget ? parseFloat(budget) : null,
    channels,
    placement,
    priority: parseInt(priority),
    displaySettings,
    termsConditions,
    howItWorks,
    faqs,
    bannerImage,
    bannerMobile,
    icon,
    backgroundColor,
    metaTitle,
    metaDescription,
    metaKeywords,
  }, req);

  res.status(201).json({
    success: true,
    message: 'Promotion created successfully',
    data: {
      promotion,
    },
  });
});

/**
 * Update a promotion (admin only)
 * PUT /api/v1/promotions/admin/:promotionId
 */
const updatePromotion = catchAsync(async (req, res) => {
  const { promotionId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can update promotions');
  }

  const {
    name,
    type,
    title,
    description,
    shortDescription,
    valueType,
    value,
    maxValue,
    currency,
    startDate,
    endDate,
    status,
    targetAudience,
    targetCountries,
    excludeCountries,
    targetTiers,
    bonusType,
    bonusAmount,
    wageringRequirement,
    minDeposit,
    maxWin,
    maxClaimsPerUser,
    maxTotalClaims,
    budget,
    channels,
    placement,
    priority,
    displaySettings,
    termsConditions,
    howItWorks,
    faqs,
    bannerImage,
    bannerMobile,
    icon,
    backgroundColor,
    metaTitle,
    metaDescription,
    metaKeywords,
  } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (type !== undefined) updates.type = type;
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (shortDescription !== undefined) updates.shortDescription = shortDescription;
  if (valueType !== undefined) updates.valueType = valueType;
  if (value !== undefined) updates.value = parseFloat(value);
  if (maxValue !== undefined) updates.maxValue = maxValue ? parseFloat(maxValue) : null;
  if (currency !== undefined) updates.currency = currency;
  if (startDate !== undefined) updates.startDate = new Date(startDate);
  if (endDate !== undefined) updates.endDate = new Date(endDate);
  if (status !== undefined) updates.status = status;
  if (targetAudience !== undefined) updates.targetAudience = targetAudience;
  if (targetCountries !== undefined) updates.targetCountries = targetCountries;
  if (excludeCountries !== undefined) updates.excludeCountries = excludeCountries;
  if (targetTiers !== undefined) updates.targetTiers = targetTiers;
  if (bonusType !== undefined) updates.bonusType = bonusType;
  if (bonusAmount !== undefined) updates.bonusAmount = bonusAmount ? parseFloat(bonusAmount) : null;
  if (wageringRequirement !== undefined) updates.wageringRequirement = wageringRequirement ? parseFloat(wageringRequirement) : null;
  if (minDeposit !== undefined) updates.minDeposit = minDeposit ? parseFloat(minDeposit) : null;
  if (maxWin !== undefined) updates.maxWin = maxWin ? parseFloat(maxWin) : null;
  if (maxClaimsPerUser !== undefined) updates.maxClaimsPerUser = parseInt(maxClaimsPerUser);
  if (maxTotalClaims !== undefined) updates.maxTotalClaims = parseInt(maxTotalClaims);
  if (budget !== undefined) updates.budget = budget ? parseFloat(budget) : null;
  if (channels !== undefined) updates.channels = channels;
  if (placement !== undefined) updates.placement = placement;
  if (priority !== undefined) updates.priority = parseInt(priority);
  if (displaySettings !== undefined) updates.displaySettings = displaySettings;
  if (termsConditions !== undefined) updates.termsConditions = termsConditions;
  if (howItWorks !== undefined) updates.howItWorks = howItWorks;
  if (faqs !== undefined) updates.faqs = faqs;
  if (bannerImage !== undefined) updates.bannerImage = bannerImage;
  if (bannerMobile !== undefined) updates.bannerMobile = bannerMobile;
  if (icon !== undefined) updates.icon = icon;
  if (backgroundColor !== undefined) updates.backgroundColor = backgroundColor;
  if (metaTitle !== undefined) updates.metaTitle = metaTitle;
  if (metaDescription !== undefined) updates.metaDescription = metaDescription;
  if (metaKeywords !== undefined) updates.metaKeywords = metaKeywords;

  const promotion = await promotionService.updatePromotion(promotionId, updates, req);

  res.status(200).json({
    success: true,
    message: 'Promotion updated successfully',
    data: {
      promotion,
    },
  });
});

/**
 * Delete a promotion (admin only)
 * DELETE /api/v1/promotions/admin/:promotionId
 */
const deletePromotion = catchAsync(async (req, res) => {
  const { promotionId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can delete promotions');
  }

  await promotionService.deletePromotion(promotionId, req);

  res.status(200).json({
    success: true,
    message: 'Promotion deleted successfully',
  });
});

/**
 * Publish a promotion (admin only)
 * POST /api/v1/promotions/admin/:promotionId/publish
 */
const publishPromotion = catchAsync(async (req, res) => {
  const { promotionId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can publish promotions');
  }

  const promotion = await promotionService.publishPromotion(promotionId, req);

  res.status(200).json({
    success: true,
    message: 'Promotion published successfully',
    data: {
      promotion,
    },
  });
});

/**
 * Pause a promotion (admin only)
 * POST /api/v1/promotions/admin/:promotionId/pause
 */
const pausePromotion = catchAsync(async (req, res) => {
  const { promotionId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can pause promotions');
  }

  const promotion = await promotionService.pausePromotion(promotionId, req);

  res.status(200).json({
    success: true,
    message: 'Promotion paused successfully',
    data: {
      promotion,
    },
  });
});

/**
 * Get all promotions (admin only)
 * GET /api/v1/promotions/admin/all
 */
const getAllPromotionsAdmin = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view all promotions');
  }

  const { type, status, targetAudience, placement, startDate, endDate, limit = 50, offset = 0 } = req.query;

  const result = await promotionService.getAllPromotions(
    {
      type,
      status,
      targetAudience,
      placement,
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
      promotions: result.promotions,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

// Export all controller methods
module.exports = {
  // Public
  getActivePromotions,
  getFeaturedPromotions,
  getUpcomingPromotions,
  getPromotionById,
  getPromotionBySlug,
  getUserPromotions,
  getPromotionsByType,

  // Interaction
  recordPromotionClick,
  recordPromotionConversion,
  checkPromotionEligibility,

  // Statistics
  getPromotionPerformance,
  getPromotionStats,

  // Admin
  createPromotion,
  updatePromotion,
  deletePromotion,
  publishPromotion,
  pausePromotion,
  getAllPromotionsAdmin,
};
