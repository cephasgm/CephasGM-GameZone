/**
 * Notification Routes - User Notification API Routes
 * CephasGM GameZone
 * 
 * This module defines all notification-related API routes including:
 * - Notification listing (all, unread, read)
 * - Notification details
 * - Mark notification as read/unread
 * - Mark all notifications as read
 * - Dismiss notifications
 * - Notification preferences
 * - Admin notification broadcast
 * - Notification statistics (admin)
 * - Notification templates (admin)
 * 
 * All routes are mounted under /api/v1/notifications
 */

const express = require('express');
const router = express.Router();

// Import controllers
const notificationController = require('../../controllers/notificationController');

// Import middleware
const { authenticate } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../../middleware/admin');
const { notificationRateLimit } = require('../../middleware/rateLimit');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// NOTIFICATION RETRIEVAL ROUTES
// ============================================

/**
 * @route   GET /api/v1/notifications
 * @desc    Get all notifications for current user
 * @access  Private
 */
router.get(
  '/',
  authenticate,
  notificationController.getNotifications
);

/**
 * @route   GET /api/v1/notifications/unread
 * @desc    Get unread notifications for current user
 * @access  Private
 */
router.get(
  '/unread',
  authenticate,
  notificationController.getUnreadNotifications
);

/**
 * @route   GET /api/v1/notifications/count/unread
 * @desc    Get unread notification count
 * @access  Private
 */
router.get(
  '/count/unread',
  authenticate,
  notificationController.getUnreadCount
);

/**
 * @route   GET /api/v1/notifications/:notificationId
 * @desc    Get notification by ID
 * @access  Private
 */
router.get(
  '/:notificationId',
  authenticate,
  validateParams(validationSchemas.idParam),
  notificationController.getNotificationById
);

// ============================================
// NOTIFICATION MANAGEMENT ROUTES
// ============================================

/**
 * @route   PUT /api/v1/notifications/:notificationId/read
 * @desc    Mark notification as read
 * @access  Private
 */
router.put(
  '/:notificationId/read',
  authenticate,
  validateParams(validationSchemas.idParam),
  notificationController.markAsRead
);

/**
 * @route   PUT /api/v1/notifications/:notificationId/unread
 * @desc    Mark notification as unread
 * @access  Private
 */
router.put(
  '/:notificationId/unread',
  authenticate,
  validateParams(validationSchemas.idParam),
  notificationController.markAsUnread
);

/**
 * @route   PUT /api/v1/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put(
  '/read-all',
  authenticate,
  notificationController.markAllAsRead
);

/**
 * @route   DELETE /api/v1/notifications/:notificationId/dismiss
 * @desc    Dismiss notification
 * @access  Private
 */
router.delete(
  '/:notificationId/dismiss',
  authenticate,
  validateParams(validationSchemas.idParam),
  notificationController.dismissNotification
);

/**
 * @route   DELETE /api/v1/notifications/dismiss-all
 * @desc    Dismiss all notifications
 * @access  Private
 */
router.delete(
  '/dismiss-all',
  authenticate,
  notificationController.dismissAllNotifications
);

// ============================================
// NOTIFICATION PREFERENCES ROUTES
// ============================================

/**
 * @route   GET /api/v1/notifications/preferences
 * @desc    Get notification preferences
 * @access  Private
 */
router.get(
  '/preferences',
  authenticate,
  notificationController.getPreferences
);

/**
 * @route   PUT /api/v1/notifications/preferences
 * @desc    Update notification preferences
 * @access  Private
 */
router.put(
  '/preferences',
  authenticate,
  notificationRateLimit('update'),
  sanitize({ strategy: 'strict' }),
  notificationController.updatePreferences
);

// ============================================
// ADMIN NOTIFICATION ROUTES
// ============================================

/**
 * @route   POST /api/v1/notifications/admin/send
 * @desc    Send notification to a single user (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/send',
  authenticate,
  requireAdmin,
  sanitize({ strategy: 'strict' }),
  notificationController.sendNotification
);

/**
 * @route   POST /api/v1/notifications/admin/bulk
 * @desc    Send bulk notification (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/bulk',
  authenticate,
  requireAdmin,
  sanitize({ strategy: 'strict' }),
  notificationController.sendBulkNotification
);

/**
 * @route   POST /api/v1/notifications/admin/broadcast
 * @desc    Broadcast notification to users matching criteria (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/broadcast',
  authenticate,
  requireAdmin,
  sanitize({ strategy: 'strict' }),
  notificationController.broadcastNotification
);

/**
 * @route   GET /api/v1/notifications/admin/stats
 * @desc    Get notification statistics (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/stats',
  authenticate,
  requireAdmin,
  notificationController.getNotificationStats
);

/**
 * @route   GET /api/v1/notifications/admin/templates
 * @desc    Get notification templates (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/templates',
  authenticate,
  requireAdmin,
  notificationController.getNotificationTemplates
);

/**
 * @route   POST /api/v1/notifications/admin/template/:templateId/send
 * @desc    Send notification from template (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/template/:templateId/send',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  notificationController.sendFromTemplate
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
