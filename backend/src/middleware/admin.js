/**
 * Admin Middleware - Role-Based Access Control
 * CephasGM GameZone
 * 
 * This middleware handles authorization for admin routes, verifying
 * user roles and permissions. It supports role-based access control
 * (RBAC) with granular permissions for different admin actions.
 */

const logger = require('../utils/logger');
const { User } = require('../models');

// Permission definitions
const PERMISSIONS = {
  // User Management
  VIEW_USERS: 'view_users',
  MANAGE_USERS: 'manage_users',
  SUSPEND_USERS: 'suspend_users',
  BAN_USERS: 'ban_users',
  
  // Bet Management
  VIEW_BETS: 'view_bets',
  MANAGE_BETS: 'manage_bets',
  VOID_BETS: 'void_bets',
  
  // Payment Management
  VIEW_PAYMENTS: 'view_payments',
  MANAGE_PAYMENTS: 'manage_payments',
  APPROVE_WITHDRAWALS: 'approve_withdrawals',
  
  // Bonus & Promotion Management
  MANAGE_BONUSES: 'manage_bonuses',
  MANAGE_PROMOTIONS: 'manage_promotions',
  
  // Content Management
  MANAGE_SPORTS: 'manage_sports',
  MANAGE_LEAGUES: 'manage_leagues',
  MANAGE_MATCHES: 'manage_matches',
  MANAGE_ODDS: 'manage_odds',
  
  // Reporting
  VIEW_REPORTS: 'view_reports',
  GENERATE_REPORTS: 'generate_reports',
  
  // System Management
  MANAGE_SETTINGS: 'manage_settings',
  VIEW_AUDIT_LOGS: 'view_audit_logs',
  MANAGE_ADMINS: 'manage_admins',
  
  // Support
  VIEW_SUPPORT: 'view_support',
  MANAGE_SUPPORT: 'manage_support',
  
  // KYC
  VIEW_KYC: 'view_kyc',
  VERIFY_KYC: 'verify_kyc',
  REJECT_KYC: 'reject_kyc',
  
  // Risk Management
  VIEW_RISK: 'view_risk',
  MANAGE_RISK: 'manage_risk',
  VIEW_FRAUD: 'view_fraud',
  MANAGE_FRAUD: 'manage_fraud',
  
  // Full Access (Super Admin only)
  FULL_ACCESS: 'full_access',
};

/**
 * Role definitions with associated permissions
 */
const ROLE_PERMISSIONS = {
  user: [],
  agent: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_BETS,
    PERMISSIONS.VIEW_PAYMENTS,
    PERMISSIONS.VIEW_SUPPORT,
  ],
  admin: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.SUSPEND_USERS,
    PERMISSIONS.VIEW_BETS,
    PERMISSIONS.MANAGE_BETS,
    PERMISSIONS.VOID_BETS,
    PERMISSIONS.VIEW_PAYMENTS,
    PERMISSIONS.MANAGE_PAYMENTS,
    PERMISSIONS.APPROVE_WITHDRAWALS,
    PERMISSIONS.MANAGE_BONUSES,
    PERMISSIONS.MANAGE_PROMOTIONS,
    PERMISSIONS.MANAGE_SPORTS,
    PERMISSIONS.MANAGE_LEAGUES,
    PERMISSIONS.MANAGE_MATCHES,
    PERMISSIONS.MANAGE_ODDS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.GENERATE_REPORTS,
    PERMISSIONS.VIEW_AUDIT_LOGS,
    PERMISSIONS.VIEW_SUPPORT,
    PERMISSIONS.MANAGE_SUPPORT,
    PERMISSIONS.VIEW_KYC,
    PERMISSIONS.VERIFY_KYC,
    PERMISSIONS.REJECT_KYC,
    PERMISSIONS.VIEW_RISK,
    PERMISSIONS.VIEW_FRAUD,
  ],
  super_admin: Object.values(PERMISSIONS),
};

/**
 * Check if user has a specific role
 * @param {Object} user - User object
 * @param {string} role - Role to check
 * @returns {boolean} - Whether user has the role
 */
const hasRole = (user, role) => {
  if (!user) return false;
  return user.role === role;
};

/**
 * Check if user has a specific permission
 * @param {Object} user - User object
 * @param {string} permission - Permission to check
 * @returns {boolean} - Whether user has the permission
 */
const hasPermission = (user, permission) => {
  if (!user) return false;
  
  // Super admin has full access
  if (user.role === 'super_admin') {
    return true;
  }
  
  const userPermissions = ROLE_PERMISSIONS[user.role] || [];
  return userPermissions.includes(permission) || userPermissions.includes(PERMISSIONS.FULL_ACCESS);
};

/**
 * Admin authentication middleware - requires user to be admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireAdmin = async (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to access admin area.',
        code: 'ADMIN_001',
      });
    }

    // Check if user has admin role
    if (!hasRole(req.user, 'admin') && !hasRole(req.user, 'super_admin')) {
      logger.warn(`Unauthorized admin access attempt by user ${req.user.id}`);
      return res.status(403).json({
        success: false,
        message: 'Admin access required.',
        code: 'ADMIN_002',
      });
    }

    // Check if user is active
    if (req.user.status !== 'active' && req.user.status !== 'verified') {
      return res.status(403).json({
        success: false,
        message: `Your account is ${req.user.status}. Please contact support.`,
        code: 'ADMIN_003',
      });
    }

    // Log admin access
    logger.debug(`Admin access granted to user ${req.user.id} (${req.user.role})`);
    next();
  } catch (error) {
    logger.error('Admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Admin authorization failed due to server error.',
      code: 'ADMIN_004',
    });
  }
};

/**
 * Super admin middleware - requires user to be super admin
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
        code: 'ADMIN_005',
      });
    }

    if (!hasRole(req.user, 'super_admin')) {
      logger.warn(`Unauthorized super admin access attempt by user ${req.user.id}`);
      return res.status(403).json({
        success: false,
        message: 'Super admin access required.',
        code: 'ADMIN_006',
      });
    }

    next();
  } catch (error) {
    logger.error('Super admin middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authorization failed due to server error.',
      code: 'ADMIN_007',
    });
  }
};

/**
 * Permission-based middleware - requires specific permission
 * @param {string} permission - Required permission
 * @returns {Function} - Express middleware
 */
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
          code: 'ADMIN_008',
        });
      }

      if (!hasPermission(req.user, permission)) {
        logger.warn(
          `Permission denied for user ${req.user.id}: ${permission}`
        );
        return res.status(403).json({
          success: false,
          message: `You do not have permission to perform this action.`,
          code: 'ADMIN_009',
          requiredPermission: permission,
        });
      }

      next();
    } catch (error) {
      logger.error('Permission middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Authorization failed due to server error.',
        code: 'ADMIN_010',
      });
    }
  };
};

/**
 * Check if user has access to a specific user resource
 * @param {Object} req - Express request object
 * @param {string} targetUserId - Target user ID
 * @returns {boolean} - Whether user has access
 */
const hasUserAccess = async (req, targetUserId) => {
  // Admins and super admins can access any user
  if (hasRole(req.user, 'admin') || hasRole(req.user, 'super_admin')) {
    return true;
  }
  
  // Agents can only access users they manage (in a real system)
  if (hasRole(req.user, 'agent')) {
    // This would check if the agent manages this user
    // For now, return false for safety
    return false;
  }
  
  // Regular users can only access their own data
  return req.user.id === targetUserId;
};

/**
 * Check if user can perform action on a resource
 * @param {Object} user - User object
 * @param {string} resourceType - Type of resource
 * @param {string} action - Action to perform
 * @returns {boolean} - Whether user can perform action
 */
const canPerformAction = (user, resourceType, action) => {
  // Define resource permissions mapping
  const resourcePermissions = {
    user: {
      view: PERMISSIONS.VIEW_USERS,
      create: PERMISSIONS.MANAGE_USERS,
      update: PERMISSIONS.MANAGE_USERS,
      delete: PERMISSIONS.MANAGE_USERS,
      suspend: PERMISSIONS.SUSPEND_USERS,
      ban: PERMISSIONS.BAN_USERS,
    },
    bet: {
      view: PERMISSIONS.VIEW_BETS,
      void: PERMISSIONS.VOID_BETS,
      manage: PERMISSIONS.MANAGE_BETS,
    },
    payment: {
      view: PERMISSIONS.VIEW_PAYMENTS,
      manage: PERMISSIONS.MANAGE_PAYMENTS,
      approve: PERMISSIONS.APPROVE_WITHDRAWALS,
    },
    kyc: {
      view: PERMISSIONS.VIEW_KYC,
      verify: PERMISSIONS.VERIFY_KYC,
      reject: PERMISSIONS.REJECT_KYC,
    },
  };

  const permission = resourcePermissions[resourceType]?.[action];
  if (!permission) return false;

  return hasPermission(user, permission);
};

/**
 * Rate limit for admin endpoints
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const adminRateLimit = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const endpoint = req.path;
    const key = `rate_limit:admin:${userId}:${endpoint}`;
    
    // Admin rate limit: 200 requests per minute
    const limit = 200;
    const window = 60;

    const { cache } = require('../config/redis');
    const currentCount = await cache.incrementCounter(key);

    if (currentCount === 1) {
      await cache.expireKey(key, window);
    }

    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - currentCount));

    if (currentCount > limit) {
      const ttl = await cache.getTTL(key);
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + ttl);
      
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please slow down.',
        code: 'RATE_002',
        retryAfter: ttl,
      });
    }

    next();
  } catch (error) {
    // Don't fail on rate limit errors
    logger.error('Admin rate limit error:', error);
    next();
  }
};

/**
 * Log admin actions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const logAdminAction = (req, res, next) => {
  const startTime = Date.now();
  
  // Capture original send to log after response
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Log admin action
    if (req.user) {
      const action = `${req.method} ${req.path}`;
      const status = res.statusCode;
      const userId = req.user.id;
      const email = req.user.email;
      
      logger.info(`[ADMIN] ${action} by ${email} (${userId}) - ${status} - ${responseTime}ms`);
      
      // Log to audit service if available
      if (req.app && req.app.get('auditService')) {
        const auditService = req.app.get('auditService');
        if (auditService && typeof auditService.logAdminAction === 'function') {
          auditService.logAdminAction({
            userId,
            email,
            action,
            method: req.method,
            path: req.path,
            query: req.query,
            body: req.body,
            status,
            responseTime,
            ip: req.ip,
            userAgent: req.get('user-agent'),
          }).catch(err => {
            logger.error('Failed to log admin action to audit:', err);
          });
        }
      }
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Export middleware functions and constants
module.exports = {
  requireAdmin,
  requireSuperAdmin,
  requirePermission,
  hasRole,
  hasPermission,
  hasUserAccess,
  canPerformAction,
  adminRateLimit,
  logAdminAction,
  PERMISSIONS,
  ROLE_PERMISSIONS,
};
