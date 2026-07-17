/**
 * Notification Controller - User Notification HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all notification-related HTTP requests including:
 * - Notification listing (all, unread, read)
 * - Notification details
 * - Mark notification as read/unread
 * - Mark all notifications as read
 * - Dismiss notifications
 * - Notification preferences
 * - Admin notification broadcast
 * - Notification statistics
 */

const notificationService = require('../services/notificationService');
const { catchAsync, createValidationError, createNotFoundError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// NOTIFICATION RETRIEVAL
// ============================================

/**
 * Get all notifications for current user
 * GET /api/v1/notifications
 */
const getNotifications = catchAsync(async (req, res) => {
  const {
    limit = 50,
    offset = 0,
    type = null,
    read = null,
    priority = null,
    startDate = null,
    endDate = null,
    includeExpired = false,
  } = req.query;

  const result = await notificationService.getUserNotifications(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    type,
    read: read !== null ? read === 'true' : null,
    priority,
    startDate,
    endDate,
    includeExpired: includeExpired === 'true',
  });

  res.status(200).json({
    success: true,
    data: {
      notifications: result.notifications,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get unread notifications for current user
 * GET /api/v1/notifications/unread
 */
const getUnreadNotifications = catchAsync(async (req, res) => {
  const { limit = 20 } = req.query;

  const notifications = await notificationService.getUnreadNotifications(req.user.id, parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      notifications,
      count: notifications.length,
    },
  });
});

/**
 * Get notification by ID
 * GET /api/v1/notifications/:notificationId
 */
const getNotificationById = catchAsync(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await notificationService.getNotificationById(notificationId, req.user.id);

  if (!notification) {
    throw createNotFoundError('Notification', notificationId);
  }

  res.status(200).json({
    success: true,
    data: {
      notification,
    },
  });
});

/**
 * Get unread notification count
 * GET /api/v1/notifications/count/unread
 */
const getUnreadCount = catchAsync(async (req, res) => {
  const count = await notificationService.getUnreadCount(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      count,
    },
  });
});

// ============================================
// NOTIFICATION MANAGEMENT
// ============================================

/**
 * Mark notification as read
 * PUT /api/v1/notifications/:notificationId/read
 */
const markAsRead = catchAsync(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await notificationService.markAsRead(notificationId, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: {
      notification,
    },
  });
});

/**
 * Mark notification as unread
 * PUT /api/v1/notifications/:notificationId/unread
 */
const markAsUnread = catchAsync(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await notificationService.markAsUnread(notificationId, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Notification marked as unread',
    data: {
      notification,
    },
  });
});

/**
 * Mark all notifications as read
 * PUT /api/v1/notifications/read-all
 */
const markAllAsRead = catchAsync(async (req, res) => {
  const count = await notificationService.markAllAsRead(req.user.id, req);

  res.status(200).json({
    success: true,
    message: `${count} notifications marked as read`,
    data: {
      count,
    },
  });
});

/**
 * Dismiss notification
 * DELETE /api/v1/notifications/:notificationId/dismiss
 */
const dismissNotification = catchAsync(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await notificationService.dismissNotification(notificationId, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Notification dismissed',
    data: {
      notification,
    },
  });
});

/**
 * Dismiss all notifications
 * DELETE /api/v1/notifications/dismiss-all
 */
const dismissAllNotifications = catchAsync(async (req, res) => {
  const count = await notificationService.dismissAllNotifications(req.user.id, req);

  res.status(200).json({
    success: true,
    message: `${count} notifications dismissed`,
    data: {
      count,
    },
  });
});

// ============================================
// NOTIFICATION PREFERENCES
// ============================================

/**
 * Get notification preferences
 * GET /api/v1/notifications/preferences
 */
const getPreferences = catchAsync(async (req, res) => {
  const preferences = await notificationService.getUserPreferences(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      preferences,
    },
  });
});

/**
 * Update notification preferences
 * PUT /api/v1/notifications/preferences
 */
const updatePreferences = catchAsync(async (req, res) => {
  const {
    email,
    push,
    sms,
    marketing,
    betConfirmations,
    promotions,
    securityAlerts,
  } = req.body;

  const updates = {};
  if (email !== undefined) updates.email = email;
  if (push !== undefined) updates.push = push;
  if (sms !== undefined) updates.sms = sms;
  if (marketing !== undefined) updates.marketing = marketing;
  if (betConfirmations !== undefined) updates.betConfirmations = betConfirmations;
  if (promotions !== undefined) updates.promotions = promotions;
  if (securityAlerts !== undefined) updates.securityAlerts = securityAlerts;

  const preferences = await notificationService.updateUserPreferences(req.user.id, updates, req);

  res.status(200).json({
    success: true,
    message: 'Notification preferences updated',
    data: {
      preferences,
    },
  });
});

// ============================================
// ADMIN NOTIFICATION BROADCAST
// ============================================

/**
 * Send notification to a single user (admin only)
 * POST /api/v1/notifications/admin/send
 */
const sendNotification = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can send notifications');
  }

  const {
    userId,
    type,
    title,
    message,
    priority = 'normal',
    channels = ['in_app'],
    metadata = {},
    link = null,
    linkType = null,
    linkParams = {},
    scheduledFor = null,
  } = req.body;

  if (!userId) throw createValidationError('User ID is required');
  if (!type) throw createValidationError('Notification type is required');
  if (!title) throw createValidationError('Title is required');
  if (!message) throw createValidationError('Message is required');

  const notification = await notificationService.createNotification({
    userId,
    type,
    title,
    message,
    priority,
    channels,
    metadata,
    link,
    linkType,
    linkParams,
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
  }, req);

  res.status(201).json({
    success: true,
    message: 'Notification sent successfully',
    data: {
      notification,
    },
  });
});

/**
 * Send bulk notification (admin only)
 * POST /api/v1/notifications/admin/bulk
 */
const sendBulkNotification = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can send bulk notifications');
  }

  const {
    type,
    title,
    message,
    priority = 'normal',
    channels = ['in_app'],
    userIds,
    metadata = {},
    link = null,
    linkType = null,
    linkParams = {},
    scheduledFor = null,
  } = req.body;

  if (!type) throw createValidationError('Notification type is required');
  if (!title) throw createValidationError('Title is required');
  if (!message) throw createValidationError('Message is required');
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw createValidationError('At least one user ID is required');
  }

  const result = await notificationService.sendBulkNotification({
    type,
    title,
    message,
    priority,
    channels,
    metadata,
    link,
    linkType,
    linkParams,
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
  }, userIds, req);

  res.status(201).json({
    success: true,
    message: `Bulk notification sent: ${result.successCount} successful, ${result.failCount} failed`,
    data: {
      successCount: result.successCount,
      failCount: result.failCount,
      results: result.results,
    },
  });
});

/**
 * Send notification to users matching criteria (admin only)
 * POST /api/v1/notifications/admin/broadcast
 */
const broadcastNotification = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can broadcast notifications');
  }

  const {
    type,
    title,
    message,
    priority = 'normal',
    channels = ['in_app', 'email', 'push'],
    criteria = {},
    metadata = {},
    link = null,
    linkType = null,
    linkParams = {},
    scheduledFor = null,
  } = req.body;

  if (!type) throw createValidationError('Notification type is required');
  if (!title) throw createValidationError('Title is required');
  if (!message) throw createValidationError('Message is required');

  // Validate criteria
  if (Object.keys(criteria).length === 0) {
    throw createValidationError('At least one criteria is required for broadcast');
  }

  const result = await notificationService.broadcastNotification({
    type,
    title,
    message,
    priority,
    channels,
    criteria,
    metadata,
    link,
    linkType,
    linkParams,
    scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
  }, req);

  res.status(201).json({
    success: true,
    message: `Broadcast notification initiated: ${result.totalUsers} users targeted`,
    data: {
      totalUsers: result.totalUsers,
      successCount: result.successCount,
      failCount: result.failCount,
      results: result.results,
    },
  });
});

// ============================================
// NOTIFICATION STATISTICS (Admin)
// ============================================

/**
 * Get notification statistics (admin only)
 * GET /api/v1/notifications/admin/stats
 */
const getNotificationStats = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view notification statistics');
  }

  const { startDate = null, endDate = null, userId = null } = req.query;

  const stats = await notificationService.getNotificationStats({
    startDate,
    endDate,
    userId,
  });

  res.status(200).json({
    success: true,
    data: {
      stats,
    },
  });
});

// ============================================
// NOTIFICATION TEMPLATES (Admin)
// ============================================

/**
 * Get notification templates (admin only)
 * GET /api/v1/notifications/admin/templates
 */
const getNotificationTemplates = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view notification templates');
  }

  const templates = await notificationService.getNotificationTemplates();

  res.status(200).json({
    success: true,
    data: {
      templates,
    },
  });
});

/**
 * Create notification from template (admin only)
 * POST /api/v1/notifications/admin/template/:templateId/send
 */
const sendFromTemplate = catchAsync(async (req, res) => {
  const { templateId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can send from templates');
  }

  const {
    userId,
    data = {},
    channels = ['in_app'],
    priority = 'normal',
    metadata = {},
    scheduledFor = null,
  } = req.body;

  if (!userId) throw createValidationError('User ID is required');

  const notification = await notificationService.sendFromTemplate(
    userId,
    templateId,
    data,
    {
      channels,
      priority,
      metadata,
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
    },
    req
  );

  res.status(201).json({
    success: true,
    message: 'Notification sent from template successfully',
    data: {
      notification,
    },
  });
});

// Export all controller methods
module.exports = {
  // Retrieval
  getNotifications,
  getUnreadNotifications,
  getNotificationById,
  getUnreadCount,

  // Management
  markAsRead,
  markAsUnread,
  markAllAsRead,
  dismissNotification,
  dismissAllNotifications,

  // Preferences
  getPreferences,
  updatePreferences,

  // Admin
  sendNotification,
  sendBulkNotification,
  broadcastNotification,
  getNotificationStats,
  getNotificationTemplates,
  sendFromTemplate,
};
