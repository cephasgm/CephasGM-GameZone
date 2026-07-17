/**
 * Admin Controller - Administrative HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all administrative HTTP requests including:
 * - Admin dashboard data
 * - User management (list, create, update, suspend, ban)
 * - System settings management
 * - Platform statistics and analytics
 * - Audit log viewing
 * - Admin user management
 * - Role and permission management
 * - System health monitoring
 */

const adminService = require('../services/adminService');
const userService = require('../services/userService');
const { catchAsync, createValidationError, createNotFoundError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// ADMIN DASHBOARD
// ============================================

/**
 * Get admin dashboard data
 * GET /api/v1/admin/dashboard
 */
const getDashboard = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { period = 'today' } = req.query;

  const dashboard = await adminService.getDashboardStats(period);

  res.status(200).json({
    success: true,
    data: {
      dashboard,
    },
  });
});

/**
 * Get admin dashboard charts data
 * GET /api/v1/admin/dashboard/charts
 */
const getDashboardCharts = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { days = 30 } = req.query;

  const charts = await adminService.getDashboardCharts(parseInt(days));

  res.status(200).json({
    success: true,
    data: {
      charts,
    },
  });
});

/**
 * Get admin dashboard stats (realtime)
 * GET /api/v1/admin/dashboard/realtime
 */
const getRealtimeStats = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const stats = await adminService.getRealtimeStats();

  res.status(200).json({
    success: true,
    data: {
      stats,
    },
  });
});

// ============================================
// USER MANAGEMENT
// ============================================

/**
 * Get all users (admin only)
 * GET /api/v1/admin/users
 */
const getAllUsers = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const {
    limit = 50,
    offset = 0,
    status = null,
    role = null,
    vipTier = null,
    country = null,
    kycStatus = null,
    query = null,
    startDate = null,
    endDate = null,
    sortBy = 'created_at',
    sortOrder = 'DESC',
  } = req.query;

  const result = await adminService.getAllUsers({
    limit: parseInt(limit),
    offset: parseInt(offset),
    status,
    role,
    vipTier,
    country,
    kycStatus,
    query,
    startDate,
    endDate,
    sortBy,
    sortOrder,
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
 * Get user details (admin only)
 * GET /api/v1/admin/users/:userId
 */
const getUserDetails = catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const user = await adminService.getUserDetails(userId);

  res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
});

/**
 * Update user (admin only)
 * PUT /api/v1/admin/users/:userId
 */
const updateUser = catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    status,
    role,
    vipTier,
    country,
    currency,
    depositLimits,
  } = req.body;

  const updates = {};
  if (firstName !== undefined) updates.first_name = firstName;
  if (lastName !== undefined) updates.last_name = lastName;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (status !== undefined) updates.status = status;
  if (role !== undefined) updates.role = role;
  if (vipTier !== undefined) updates.vip_tier = vipTier;
  if (country !== undefined) updates.country = country;
  if (currency !== undefined) updates.currency = currency;
  if (depositLimits !== undefined) updates.deposit_limits = depositLimits;

  const user = await adminService.updateUser(userId, updates, req);

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: {
      user,
    },
  });
});

/**
 * Suspend user (admin only)
 * POST /api/v1/admin/users/:userId/suspend
 */
const suspendUser = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { reason, duration = null } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  if (!reason) {
    throw createValidationError('Suspension reason is required');
  }

  const user = await adminService.suspendUser(userId, reason, duration, req);

  res.status(200).json({
    success: true,
    message: 'User suspended successfully',
    data: {
      user,
    },
  });
});

/**
 * Unsuspend user (admin only)
 * POST /api/v1/admin/users/:userId/unsuspend
 */
const unsuspendUser = catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const user = await adminService.unsuspendUser(userId, req);

  res.status(200).json({
    success: true,
    message: 'User unsuspended successfully',
    data: {
      user,
    },
  });
});

/**
 * Ban user (admin only)
 * POST /api/v1/admin/users/:userId/ban
 */
const banUser = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const { reason } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  if (!reason) {
    throw createValidationError('Ban reason is required');
  }

  const user = await adminService.banUser(userId, reason, req);

  res.status(200).json({
    success: true,
    message: 'User banned successfully',
    data: {
      user,
    },
  });
});

/**
 * Unban user (admin only)
 * POST /api/v1/admin/users/:userId/unban
 */
const unbanUser = catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const user = await adminService.unbanUser(userId, req);

  res.status(200).json({
    success: true,
    message: 'User unbanned successfully',
    data: {
      user,
    },
  });
});

// ============================================
// ADMIN USER MANAGEMENT
// ============================================

/**
 * Get all admin users (super admin only)
 * GET /api/v1/admin/admins
 */
const getAdminUsers = catchAsync(async (req, res) => {
  if (req.user.role !== 'super_admin') {
    throw createForbiddenError('Super admin access required');
  }

  const { limit = 50, offset = 0 } = req.query;

  const result = await adminService.getAdminUsers({
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      admins: result.admins,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Create admin user (super admin only)
 * POST /api/v1/admin/admins
 */
const createAdmin = catchAsync(async (req, res) => {
  if (req.user.role !== 'super_admin') {
    throw createForbiddenError('Super admin access required');
  }

  const { email, firstName, lastName, role = 'admin', permissions = [] } = req.body;

  if (!email) throw createValidationError('Email is required');
  if (!firstName) throw createValidationError('First name is required');
  if (!lastName) throw createValidationError('Last name is required');

  const admin = await adminService.createAdmin({
    email,
    firstName,
    lastName,
    role,
    permissions,
  }, req);

  res.status(201).json({
    success: true,
    message: 'Admin user created successfully',
    data: {
      admin,
    },
  });
});

/**
 * Update admin user (super admin only)
 * PUT /api/v1/admin/admins/:adminId
 */
const updateAdmin = catchAsync(async (req, res) => {
  const { adminId } = req.params;

  if (req.user.role !== 'super_admin') {
    throw createForbiddenError('Super admin access required');
  }

  const { firstName, lastName, role, permissions, status } = req.body;

  const updates = {};
  if (firstName !== undefined) updates.first_name = firstName;
  if (lastName !== undefined) updates.last_name = lastName;
  if (role !== undefined) updates.role = role;
  if (permissions !== undefined) updates.permissions = permissions;
  if (status !== undefined) updates.status = status;

  const admin = await adminService.updateAdmin(adminId, updates, req);

  res.status(200).json({
    success: true,
    message: 'Admin user updated successfully',
    data: {
      admin,
    },
  });
});

/**
 * Delete admin user (super admin only)
 * DELETE /api/v1/admin/admins/:adminId
 */
const deleteAdmin = catchAsync(async (req, res) => {
  const { adminId } = req.params;

  if (req.user.role !== 'super_admin') {
    throw createForbiddenError('Super admin access required');
  }

  await adminService.deleteAdmin(adminId, req);

  res.status(200).json({
    success: true,
    message: 'Admin user deleted successfully',
  });
});

// ============================================
// SYSTEM SETTINGS
// ============================================

/**
 * Get system settings (admin only)
 * GET /api/v1/admin/settings
 */
const getSystemSettings = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const settings = await adminService.getSystemSettings();

  res.status(200).json({
    success: true,
    data: {
      settings,
    },
  });
});

/**
 * Update system settings (admin only)
 * PUT /api/v1/admin/settings
 */
const updateSystemSettings = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { settings } = req.body;

  if (!settings || typeof settings !== 'object') {
    throw createValidationError('Valid settings object is required');
  }

  const updatedSettings = await adminService.updateSystemSettings(settings, req);

  res.status(200).json({
    success: true,
    message: 'System settings updated successfully',
    data: {
      settings: updatedSettings,
    },
  });
});

// ============================================
// AUDIT LOGS
// ============================================

/**
 * Get audit logs (admin only)
 * GET /api/v1/admin/audit
 */
const getAuditLogs = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const {
    limit = 50,
    offset = 0,
    userId = null,
    action = null,
    category = null,
    startDate = null,
    endDate = null,
    riskLevel = null,
  } = req.query;

  const result = await adminService.getAuditLogs({
    limit: parseInt(limit),
    offset: parseInt(offset),
    userId,
    action,
    category,
    startDate,
    endDate,
    riskLevel,
  });

  res.status(200).json({
    success: true,
    data: {
      logs: result.logs,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get audit log by ID (admin only)
 * GET /api/v1/admin/audit/:logId
 */
const getAuditLogById = catchAsync(async (req, res) => {
  const { logId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const log = await adminService.getAuditLogById(logId);

  if (!log) {
    throw createNotFoundError('Audit log', logId);
  }

  res.status(200).json({
    success: true,
    data: {
      log,
    },
  });
});

// ============================================
// SYSTEM HEALTH & MONITORING
// ============================================

/**
 * Get system health (admin only)
 * GET /api/v1/admin/health
 */
const getSystemHealth = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const health = await adminService.getSystemHealth();

  res.status(200).json({
    success: true,
    data: {
      health,
    },
  });
});

/**
 * Get system metrics (admin only)
 * GET /api/v1/admin/metrics
 */
const getSystemMetrics = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const metrics = await adminService.getSystemMetrics();

  res.status(200).json({
    success: true,
    data: {
      metrics,
    },
  });
});

/**
 * Clear cache (admin only)
 * POST /api/v1/admin/cache/clear
 */
const clearCache = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { pattern = null } = req.body;

  const result = await adminService.clearCache(pattern);

  res.status(200).json({
    success: true,
    message: 'Cache cleared successfully',
    data: {
      result,
    },
  });
});

// Export all controller methods
module.exports = {
  // Dashboard
  getDashboard,
  getDashboardCharts,
  getRealtimeStats,

  // User Management
  getAllUsers,
  getUserDetails,
  updateUser,
  suspendUser,
  unsuspendUser,
  banUser,
  unbanUser,

  // Admin User Management
  getAdminUsers,
  createAdmin,
  updateAdmin,
  deleteAdmin,

  // System Settings
  getSystemSettings,
  updateSystemSettings,

  // Audit Logs
  getAuditLogs,
  getAuditLogById,

  // System Health
  getSystemHealth,
  getSystemMetrics,
  clearCache,
};
