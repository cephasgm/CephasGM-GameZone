/**
 * Admin Routes - Administrative API Routes
 * CephasGM GameZone
 * 
 * This module defines all administrative API routes including:
 * - Admin dashboard data
 * - User management (list, create, update, suspend, ban)
 * - System settings management
 * - Platform statistics and analytics
 * - Audit log viewing
 * - Admin user management
 * - Role and permission management
 * - System health monitoring
 * 
 * All routes are mounted under /api/v1/admin
 * All routes require admin or super_admin role
 */

const express = require('express');
const router = express.Router();

// Import controllers
const adminController = require('../../controllers/adminController');

// Import middleware
const { authenticate } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin, requirePermission, PERMISSIONS, logAdminAction, adminRateLimit } = require('../../middleware/admin');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// ADMIN DASHBOARD ROUTES
// ============================================

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get admin dashboard data
 * @access  Private/Admin
 */
router.get(
  '/dashboard',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  adminController.getDashboard
);

/**
 * @route   GET /api/v1/admin/dashboard/charts
 * @desc    Get admin dashboard charts data
 * @access  Private/Admin
 */
router.get(
  '/dashboard/charts',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  adminController.getDashboardCharts
);

/**
 * @route   GET /api/v1/admin/dashboard/realtime
 * @desc    Get realtime stats for dashboard
 * @access  Private/Admin
 */
router.get(
  '/dashboard/realtime',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  adminController.getRealtimeStats
);

// ============================================
// ADMIN USER MANAGEMENT ROUTES
// ============================================

/**
 * @route   GET /api/v1/admin/users
 * @desc    Get all users (admin only)
 * @access  Private/Admin
 */
router.get(
  '/users',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  adminController.getAllUsers
);

/**
 * @route   GET /api/v1/admin/users/:userId
 * @desc    Get user details (admin only)
 * @access  Private/Admin
 */
router.get(
  '/users/:userId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  logAdminAction,
  adminController.getUserDetails
);

/**
 * @route   PUT /api/v1/admin/users/:userId
 * @desc    Update user (admin only)
 * @access  Private/Admin
 */
router.put(
  '/users/:userId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  sanitize({ strategy: 'strict' }),
  logAdminAction,
  adminController.updateUser
);

/**
 * @route   POST /api/v1/admin/users/:userId/suspend
 * @desc    Suspend user (admin only)
 * @access  Private/Admin
 */
router.post(
  '/users/:userId/suspend',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  sanitize({ strategy: 'strict' }),
  logAdminAction,
  adminController.suspendUser
);

/**
 * @route   POST /api/v1/admin/users/:userId/unsuspend
 * @desc    Unsuspend user (admin only)
 * @access  Private/Admin
 */
router.post(
  '/users/:userId/unsuspend',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  logAdminAction,
  adminController.unsuspendUser
);

/**
 * @route   POST /api/v1/admin/users/:userId/ban
 * @desc    Ban user (admin only)
 * @access  Private/Admin
 */
router.post(
  '/users/:userId/ban',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  sanitize({ strategy: 'strict' }),
  logAdminAction,
  adminController.banUser
);

/**
 * @route   POST /api/v1/admin/users/:userId/unban
 * @desc    Unban user (admin only)
 * @access  Private/Admin
 */
router.post(
  '/users/:userId/unban',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  logAdminAction,
  adminController.unbanUser
);

// ============================================
// ADMIN USER (Super Admin) ROUTES
// ============================================

/**
 * @route   GET /api/v1/admin/admins
 * @desc    Get all admin users (super admin only)
 * @access  Private/SuperAdmin
 */
router.get(
  '/admins',
  authenticate,
  requireSuperAdmin,
  adminRateLimit(),
  logAdminAction,
  adminController.getAdminUsers
);

/**
 * @route   POST /api/v1/admin/admins
 * @desc    Create admin user (super admin only)
 * @access  Private/SuperAdmin
 */
router.post(
  '/admins',
  authenticate,
  requireSuperAdmin,
  sanitize({ strategy: 'strict' }),
  logAdminAction,
  adminController.createAdmin
);

/**
 * @route   PUT /api/v1/admin/admins/:adminId
 * @desc    Update admin user (super admin only)
 * @access  Private/SuperAdmin
 */
router.put(
  '/admins/:adminId',
  authenticate,
  requireSuperAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  logAdminAction,
  adminController.updateAdmin
);

/**
 * @route   DELETE /api/v1/admin/admins/:adminId
 * @desc    Delete admin user (super admin only)
 * @access  Private/SuperAdmin
 */
router.delete(
  '/admins/:adminId',
  authenticate,
  requireSuperAdmin,
  validateParams(validationSchemas.idParam),
  logAdminAction,
  adminController.deleteAdmin
);

// ============================================
// SYSTEM SETTINGS ROUTES
// ============================================

/**
 * @route   GET /api/v1/admin/settings
 * @desc    Get system settings (admin only)
 * @access  Private/Admin
 */
router.get(
  '/settings',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  adminController.getSystemSettings
);

/**
 * @route   PUT /api/v1/admin/settings
 * @desc    Update system settings (admin only)
 * @access  Private/Admin
 */
router.put(
  '/settings',
  authenticate,
  requireAdmin,
  sanitize({ strategy: 'strict' }),
  logAdminAction,
  adminController.updateSystemSettings
);

// ============================================
// AUDIT LOG ROUTES
// ============================================

/**
 * @route   GET /api/v1/admin/audit
 * @desc    Get audit logs (admin only)
 * @access  Private/Admin
 */
router.get(
  '/audit',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  adminController.getAuditLogs
);

/**
 * @route   GET /api/v1/admin/audit/:logId
 * @desc    Get audit log by ID (admin only)
 * @access  Private/Admin
 */
router.get(
  '/audit/:logId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  adminController.getAuditLogById
);

// ============================================
// SYSTEM HEALTH & MONITORING ROUTES
// ============================================

/**
 * @route   GET /api/v1/admin/health
 * @desc    Get system health (admin only)
 * @access  Private/Admin
 */
router.get(
  '/health',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  adminController.getSystemHealth
);

/**
 * @route   GET /api/v1/admin/metrics
 * @desc    Get system metrics (admin only)
 * @access  Private/Admin
 */
router.get(
  '/metrics',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  adminController.getSystemMetrics
);

/**
 * @route   POST /api/v1/admin/cache/clear
 * @desc    Clear cache (admin only)
 * @access  Private/Admin
 */
router.post(
  '/cache/clear',
  authenticate,
  requireAdmin,
  sanitize({ strategy: 'strict' }),
  logAdminAction,
  adminController.clearCache
);

// ============================================
// INTERNAL SERVICE ROUTES (API Key required)
// ============================================

/**
 * @route   GET /api/v1/admin/internal/health
 * @desc    Internal health check (for load balancers)
 * @access  Internal
 */
router.get(
  '/internal/health',
  adminController.getSystemHealth
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
