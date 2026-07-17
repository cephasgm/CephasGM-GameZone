/**
 * User Controller - User Management HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all user-related HTTP requests including:
 * - User profile management (get, update, delete)
 * - User settings and preferences
 * - User statistics
 * - User activity history
 * - Account management
 * - KYC status management
 * - VIP tier management
 * - User search and filtering (admin)
 */

const userService = require('../services/userService');
const { catchAsync, createNotFoundError, createValidationError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// PROFILE MANAGEMENT
// ============================================

/**
 * Get current user profile
 * GET /api/v1/users/me
 */
const getProfile = catchAsync(async (req, res) => {
  const user = await userService.getUserProfile(req.user.id, {
    includeWallet: true,
    includeStats: true,
  });

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
});

/**
 * Get user profile by ID (admin or self)
 * GET /api/v1/users/:userId
 */
const getUserById = catchAsync(async (req, res) => {
  const { userId } = req.params;

  // Check if user is requesting their own profile or is admin
  if (userId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('You do not have permission to view this user');
  }

  const user = await userService.getUserProfile(userId, {
    includeWallet: req.user.role === 'admin' || req.user.role === 'super_admin',
    includeStats: true,
    includeSensitive: req.user.role === 'admin' || req.user.role === 'super_admin',
  });

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
});

/**
 * Update current user profile
 * PUT /api/v1/users/me
 */
const updateProfile = catchAsync(async (req, res) => {
  const { firstName, lastName, phone, dateOfBirth, country, currency, bio, displayName, username } = req.body;

  const updates = {
    first_name: firstName,
    last_name: lastName,
    phone,
    date_of_birth: dateOfBirth,
    country,
    currency,
    bio,
    display_name: displayName,
    username,
  };

  const user = await userService.updateUserProfile(req.user.id, updates, req);

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user,
    },
  });
});

/**
 * Update user avatar
 * PUT /api/v1/users/me/avatar
 */
const updateAvatar = catchAsync(async (req, res) => {
  const { avatarUrl } = req.body;

  if (!avatarUrl) {
    throw createValidationError('Avatar URL is required');
  }

  const user = await userService.updateAvatar(req.user.id, avatarUrl, req);

  res.status(200).json({
    success: true,
    message: 'Avatar updated successfully',
    data: {
      user,
    },
  });
});

/**
 * Delete user account
 * DELETE /api/v1/users/me
 */
const deleteAccount = catchAsync(async (req, res) => {
  const { reason } = req.body;

  await userService.deleteAccount(req.user.id, reason || 'User requested deletion', req);

  res.status(200).json({
    success: true,
    message: 'Account deleted successfully',
  });
});

/**
 * Reactivate deleted account
 * POST /api/v1/users/me/reactivate
 */
const reactivateAccount = catchAsync(async (req, res) => {
  const user = await userService.reactivateAccount(req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Account reactivated successfully',
    data: {
      user,
    },
  });
});

// ============================================
// USER STATISTICS
// ============================================

/**
 * Get user statistics
 * GET /api/v1/users/me/stats
 */
const getUserStats = catchAsync(async (req, res) => {
  const { period = 'all' } = req.query;

  const stats = await userService.getUserStats(req.user.id, { period });

  res.status(200).json({
    success: true,
    data: {
      stats,
    },
  });
});

/**
 * Get user activity history
 * GET /api/v1/users/me/activity
 */
const getUserActivity = catchAsync(async (req, res) => {
  const { limit = 20, offset = 0, type = null } = req.query;

  const activity = await userService.getUserActivity(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    type,
  });

  res.status(200).json({
    success: true,
    data: {
      activity,
    },
  });
});

// ============================================
// USER PREFERENCES
// ============================================

/**
 * Get user preferences
 * GET /api/v1/users/me/preferences
 */
const getPreferences = catchAsync(async (req, res) => {
  const preferences = await userService.getPreferences(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      preferences,
    },
  });
});

/**
 * Update user preferences
 * PUT /api/v1/users/me/preferences
 */
const updatePreferences = catchAsync(async (req, res) => {
  const { language, timezone, oddsFormat, darkMode } = req.body;

  const updates = {};
  if (language !== undefined) updates.language = language;
  if (timezone !== undefined) updates.timezone = timezone;
  if (oddsFormat !== undefined) updates.oddsFormat = oddsFormat;
  if (darkMode !== undefined) updates.darkMode = darkMode;

  const preferences = await userService.updatePreferences(req.user.id, updates, req);

  res.status(200).json({
    success: true,
    message: 'Preferences updated successfully',
    data: {
      preferences,
    },
  });
});

/**
 * Update notification preferences
 * PUT /api/v1/users/me/preferences/notifications
 */
const updateNotificationPreferences = catchAsync(async (req, res) => {
  const { email, push, sms, marketing, betConfirmations, promotions, securityAlerts } = req.body;

  const updates = {};
  if (email !== undefined) updates.email = email;
  if (push !== undefined) updates.push = push;
  if (sms !== undefined) updates.sms = sms;
  if (marketing !== undefined) updates.marketing = marketing;
  if (betConfirmations !== undefined) updates.betConfirmations = betConfirmations;
  if (promotions !== undefined) updates.promotions = promotions;
  if (securityAlerts !== undefined) updates.securityAlerts = securityAlerts;

  const preferences = await userService.updateNotificationPreferences(req.user.id, updates, req);

  res.status(200).json({
    success: true,
    message: 'Notification preferences updated successfully',
    data: {
      preferences,
    },
  });
});

// ============================================
// VIP TIER MANAGEMENT
// ============================================

/**
 * Get VIP tier benefits
 * GET /api/v1/users/me/vip-benefits
 */
const getVipBenefits = catchAsync(async (req, res) => {
  const user = await userService.getUserProfile(req.user.id);
  const benefits = userService.getVipBenefits(user.vip_tier);

  res.status(200).json({
    success: true,
    data: {
      tier: user.vip_tier,
      tierName: user.getVipTierName(),
      benefits,
    },
  });
});

/**
 * Check if VIP tier can be upgraded
 * POST /api/v1/users/me/vip-check
 */
const checkVipUpgrade = catchAsync(async (req, res) => {
  const result = await userService.autoUpgradeVipTier(req.user.id, req);

  res.status(200).json({
    success: true,
    data: {
      upgraded: result.upgraded,
      currentTier: result.currentTier || result.oldTier,
      newTier: result.newTier || result.currentTier,
    },
  });
});

// ============================================
// KYC MANAGEMENT
// ============================================

/**
 * Get KYC status
 * GET /api/v1/users/me/kyc
 */
const getKycStatus = catchAsync(async (req, res) => {
  const kycStatus = await userService.getUserKycStatus(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      kyc: kycStatus,
    },
  });
});

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Get active sessions
 * GET /api/v1/users/me/sessions
 */
const getSessions = catchAsync(async (req, res) => {
  const { authService } = require('../services/authService');
  const sessions = await authService.getUserSessions(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      sessions,
    },
  });
});

/**
 * Terminate a session
 * DELETE /api/v1/users/me/sessions/:sessionId
 */
const terminateSession = catchAsync(async (req, res) => {
  const { sessionId } = req.params;
  const { authService } = require('../services/authService');

  await authService.terminateSession(sessionId, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Session terminated successfully',
  });
});

/**
 * Terminate all sessions (except current)
 * DELETE /api/v1/users/me/sessions
 */
const terminateAllSessions = catchAsync(async (req, res) => {
  const { authService } = require('../services/authService');
  const count = await authService.terminateAllSessions(req.user.id, null, req);

  res.status(200).json({
    success: true,
    message: `${count} sessions terminated successfully`,
  });
});

// ============================================
// ADMIN USER MANAGEMENT
// ============================================

/**
 * Search users (admin only)
 * GET /api/v1/users/search
 */
const searchUsers = catchAsync(async (req, res) => {
  const { query, status, role, vipTier, country, kycStatus, startDate, endDate, limit = 20, offset = 0 } = req.query;

  const filters = {
    query,
    status,
    role,
    vipTier,
    country,
    kycStatus,
    startDate,
    endDate,
  };

  const result = await userService.searchUsers(filters, {
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      users: result.users,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get users by VIP tier (admin only)
 * GET /api/v1/users/vip/:tier
 */
const getUsersByVipTier = catchAsync(async (req, res) => {
  const { tier } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  const result = await userService.getUsersByVipTier(tier, {
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      users: result.users,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get users by KYC status (admin only)
 * GET /api/v1/users/kyc/:status
 */
const getUsersByKycStatus = catchAsync(async (req, res) => {
  const { status } = req.params;
  const { limit = 20, offset = 0 } = req.query;

  const result = await userService.getUsersByKycStatus(status, {
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      users: result.users,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

// Export all controller methods
module.exports = {
  // Profile
  getProfile,
  getUserById,
  updateProfile,
  updateAvatar,
  deleteAccount,
  reactivateAccount,

  // Stats
  getUserStats,
  getUserActivity,

  // Preferences
  getPreferences,
  updatePreferences,
  updateNotificationPreferences,

  // VIP
  getVipBenefits,
  checkVipUpgrade,

  // KYC
  getKycStatus,

  // Sessions
  getSessions,
  terminateSession,
  terminateAllSessions,

  // Admin
  searchUsers,
  getUsersByVipTier,
  getUsersByKycStatus,
};
