/**
 * Notification Service - User Notification Management Business Logic
 * CephasGM GameZone
 * 
 * This service handles all notification-related business logic including:
 * - Email notifications (SendGrid, SES)
 * - Push notifications (FCM)
 * - SMS notifications (Twilio)
 * - In-app notifications
 * - Notification templating
 * - Delivery tracking and retry
 * - User notification preferences
 * - Batch notification processing
 * - Notification scheduling
 */

const { Op } = require('sequelize');
const { Notification, User, AuditLog } = require('../models');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const { logAudit } = require('../utils/logger');
const emailService = require('../integrations/notifications/email');
const pushService = require('../integrations/notifications/push');
const smsService = require('../integrations/notifications/sms');

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const CACHE_TTL = {
  UNREAD_COUNT: 60, // 1 minute
  NOTIFICATIONS: 300, // 5 minutes
};

const NOTIFICATION_TYPES = {
  // Betting
  BET_CONFIRMATION: 'bet_confirmation',
  BET_WIN: 'bet_win',
  BET_LOSS: 'bet_loss',
  BET_CASHOUT: 'bet_cashout',

  // Payments
  DEPOSIT_CONFIRMATION: 'deposit_confirmation',
  WITHDRAWAL_CONFIRMATION: 'withdrawal_confirmation',
  WITHDRAWAL_PROCESSING: 'withdrawal_processing',
  DEPOSIT_SUCCESS: 'deposit_success',
  DEPOSIT_FAILED: 'deposit_failed',
  WITHDRAWAL_SUCCESS: 'withdrawal_success',
  WITHDRAWAL_FAILED: 'withdrawal_failed',

  // Bonuses
  BONUS_CLAIMED: 'bonus_claimed',
  BONUS_AVAILABLE: 'bonus_available',
  BONUS_EXPIRING: 'bonus_expiring',
  BONUS_EXPIRED: 'bonus_expired',

  // Promotions
  PROMOTION_NEW: 'promotion_new',
  PROMOTION_ENDING: 'promotion_ending',

  // VIP
  VIP_UPGRADE: 'vip_upgrade',
  VIP_BENEFIT: 'vip_benefit',

  // KYC
  KYC_STATUS: 'kyc_status',
  KYC_REQUIRED: 'kyc_required',
  KYC_VERIFIED: 'kyc_verified',
  KYC_REJECTED: 'kyc_rejected',

  // Security
  ACCOUNT_SECURITY: 'account_security',
  LOGIN_ALERT: 'login_alert',
  PASSWORD_CHANGED: 'password_changed',
  TWO_FACTOR_ENABLED: 'two_factor_enabled',

  // Responsible Gambling
  SELF_EXCLUSION: 'self_exclusion',
  LIMIT_REACHED: 'limit_reached',

  // System
  SYSTEM_ALERT: 'system_alert',
  MAINTENANCE: 'maintenance',
  UPDATE_AVAILABLE: 'update_available',

  // Social
  REFERRAL_EARNED: 'referral_earned',
  REFERRAL_JOINED: 'referral_joined',
  MESSAGE_RECEIVED: 'message_received',

  // Support
  SUPPORT_RESPONSE: 'support_response',
  SUPPORT_TICKET_UPDATE: 'support_ticket_update',

  // Tournaments
  TOURNAMENT_START: 'tournament_start',
  TOURNAMENT_UPDATE: 'tournament_update',
  LEADERBOARD_UPDATE: 'leaderboard_update',

  // Welcome
  WELCOME: 'welcome',
  BIRTHDAY: 'birthday',
  ANNOUNCEMENT: 'announcement',
  OTHER: 'other',
};

const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
};

const DELIVERY_CHANNELS = {
  IN_APP: 'in_app',
  EMAIL: 'email',
  PUSH: 'push',
  SMS: 'sms',
};

// ============================================
// NOTIFICATION CREATION
// ============================================

/**
 * Create a notification
 * @param {Object} notificationData - Notification data
 * @param {string} notificationData.userId - User ID
 * @param {string} notificationData.type - Notification type
 * @param {string} notificationData.title - Notification title
 * @param {string} notificationData.message - Notification message
 * @param {string} notificationData.priority - Notification priority
 * @param {Array} notificationData.channels - Delivery channels
 * @param {Date} notificationData.scheduledFor - Scheduled delivery time
 * @param {Object} notificationData.metadata - Additional metadata
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Created notification
 */
const createNotification = async (notificationData, req = null) => {
  const {
    userId,
    type,
    title,
    message,
    shortMessage = null,
    priority = NOTIFICATION_PRIORITY.NORMAL,
    channels = [DELIVERY_CHANNELS.IN_APP],
    scheduledFor = null,
    metadata = {},
    link = null,
    linkType = null,
    linkParams = {},
    icon = null,
    color = null,
    actions = [],
  } = notificationData;

  // Validate notification type
  if (!Object.values(NOTIFICATION_TYPES).includes(type)) {
    throw new Error(`Invalid notification type: ${type}`);
  }

  // Validate priority
  if (!Object.values(NOTIFICATION_PRIORITY).includes(priority)) {
    throw new Error(`Invalid priority: ${priority}`);
  }

  // Validate channels
  for (const channel of channels) {
    if (!Object.values(DELIVERY_CHANNELS).includes(channel)) {
      throw new Error(`Invalid channel: ${channel}`);
    }
  }

  // Get user
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Check user notification preferences
  const preferences = user.preferences?.notifications || {};
  const channelEnabled = channels.every(channel => {
    if (channel === DELIVERY_CHANNELS.EMAIL) return preferences.email !== false;
    if (channel === DELIVERY_CHANNELS.PUSH) return preferences.push !== false;
    if (channel === DELIVERY_CHANNELS.SMS) return preferences.sms !== false;
    return true;
  });

  if (!channelEnabled) {
    // User has disabled this notification channel
    return { success: false, reason: 'User has disabled this notification channel' };
  }

  // Create notification record
  const notification = await Notification.create({
    user_id: userId,
    type,
    priority,
    title,
    message,
    short_message: shortMessage || message.substring(0, 100),
    link,
    link_type: linkType,
    link_params: linkParams,
    icon,
    color: color || getColorForType(type),
    actions,
    channels,
    scheduled_for: scheduledFor || null,
    metadata,
    created_at: new Date(),
    updated_at: new Date(),
  });

  // If not scheduled, send immediately
  if (!scheduledFor || scheduledFor <= new Date()) {
    await deliverNotification(notification);
  }

  // Log audit
  await logAudit('NOTIFICATION_CREATED', userId, {
    notificationId: notification.id,
    type: type,
    channels: channels,
  }, req);

  logger.info(`Notification created: ${notification.id} - ${type} for user ${userId}`);

  return notification;
};

/**
 * Get color for notification type
 * @param {string} type - Notification type
 * @returns {string} - Color hex
 */
const getColorForType = (type) => {
  const colorMap = {
    bet_confirmation: '#0055ff',
    bet_win: '#00ff64',
    bet_loss: '#ff0044',
    bet_cashout: '#ffd700',
    deposit_success: '#00ff64',
    deposit_failed: '#ff0044',
    withdrawal_success: '#00ff64',
    withdrawal_failed: '#ff0044',
    bonus_claimed: '#ffd700',
    bonus_available: '#0055ff',
    bonus_expiring: '#ff6b00',
    vip_upgrade: '#ffd700',
    kyc_verified: '#00ff64',
    kyc_rejected: '#ff0044',
    login_alert: '#ff6b00',
    password_changed: '#0055ff',
    two_factor_enabled: '#00ff64',
    self_exclusion: '#ff0044',
    limit_reached: '#ff6b00',
    system_alert: '#ff0044',
    maintenance: '#ff6b00',
    welcome: '#0055ff',
    birthday: '#ffd700',
    announcement: '#0055ff',
    other: '#888888',
  };
  return colorMap[type] || '#0055ff';
};

// ============================================
// NOTIFICATION DELIVERY
// ============================================

/**
 * Deliver a notification through all channels
 * @param {Object} notification - Notification object
 * @returns {Promise<Object>} - Delivery result
 */
const deliverNotification = async (notification) => {
  const channels = notification.channels || [DELIVERY_CHANNELS.IN_APP];
  const results = {};
  let allSuccess = true;

  // Get user
  const user = await User.findByPk(notification.user_id);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  for (const channel of channels) {
    try {
      switch (channel) {
        case DELIVERY_CHANNELS.IN_APP:
          // In-app notification is already created
          results[channel] = { success: true };
          break;

        case DELIVERY_CHANNELS.EMAIL:
          results[channel] = await deliverEmailNotification(notification, user);
          break;

        case DELIVERY_CHANNELS.PUSH:
          results[channel] = await deliverPushNotification(notification, user);
          break;

        case DELIVERY_CHANNELS.SMS:
          results[channel] = await deliverSmsNotification(notification, user);
          break;

        default:
          results[channel] = { success: false, error: 'Unknown channel' };
          allSuccess = false;
      }

      if (!results[channel].success) {
        allSuccess = false;
      }
    } catch (error) {
      results[channel] = { success: false, error: error.message };
      allSuccess = false;
      logger.error(`Failed to deliver notification ${notification.id} via ${channel}:`, error);
    }
  }

  // Update notification delivery status
  const successfulChannels = Object.keys(results).filter(key => results[key].success);
  const failedChannels = Object.keys(results).filter(key => !results[key].success);

  await notification.update({
    channels_sent: successfulChannels,
    delivery_status: allSuccess ? 'sent' : 'failed',
    sent_at: successfulChannels.length > 0 ? new Date() : null,
    failure_reason: failedChannels.length > 0 ? `Failed channels: ${failedChannels.join(', ')}` : null,
  });

  // Update per-channel delivery timestamps
  const deliveredAtChannel = notification.delivered_at_channel || {};
  for (const channel of successfulChannels) {
    deliveredAtChannel[channel] = new Date();
  }
  await notification.update({
    delivered_at_channel: deliveredAtChannel,
  });

  return {
    success: allSuccess,
    results,
  };
};

/**
 * Deliver email notification
 * @param {Object} notification - Notification object
 * @param {Object} user - User object
 * @returns {Promise<Object>} - Delivery result
 */
const deliverEmailNotification = async (notification, user) => {
  // Check email notification preference
  const preferences = user.preferences?.notifications || {};
  if (preferences.email === false) {
    return { success: false, error: 'Email notifications disabled' };
  }

  try {
    const result = await emailService.sendEmail({
      to: user.email,
      subject: notification.title,
      html: notification.message,
      text: notification.short_message || notification.message,
      template: getEmailTemplate(notification.type),
      templateData: {
        user: user,
        notification: notification,
        ...notification.metadata,
      },
    });

    return { success: true, result };
  } catch (error) {
    logger.error(`Email delivery failed for notification ${notification.id}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Deliver push notification
 * @param {Object} notification - Notification object
 * @param {Object} user - User object
 * @returns {Promise<Object>} - Delivery result
 */
const deliverPushNotification = async (notification, user) => {
  // Check push notification preference
  const preferences = user.preferences?.notifications || {};
  if (preferences.push === false) {
    return { success: false, error: 'Push notifications disabled' };
  }

  try {
    const result = await pushService.sendPush({
      userId: user.id,
      title: notification.title,
      body: notification.short_message || notification.message,
      data: {
        type: notification.type,
        notificationId: notification.id,
        link: notification.link,
        linkType: notification.link_type,
        linkParams: notification.link_params,
        ...notification.metadata,
      },
      priority: notification.priority === NOTIFICATION_PRIORITY.URGENT ? 'high' : 'normal',
    });

    return { success: true, result };
  } catch (error) {
    logger.error(`Push delivery failed for notification ${notification.id}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Deliver SMS notification
 * @param {Object} notification - Notification object
 * @param {Object} user - User object
 * @returns {Promise<Object>} - Delivery result
 */
const deliverSmsNotification = async (notification, user) => {
  // Check SMS notification preference
  const preferences = user.preferences?.notifications || {};
  if (preferences.sms === false) {
    return { success: false, error: 'SMS notifications disabled' };
  }

  // Check if user has phone number
  if (!user.phone) {
    return { success: false, error: 'User has no phone number' };
  }

  try {
    const result = await smsService.sendSms({
      to: user.phone,
      message: notification.short_message || notification.message.substring(0, 160),
    });

    return { success: true, result };
  } catch (error) {
    logger.error(`SMS delivery failed for notification ${notification.id}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Get email template for notification type
 * @param {string} type - Notification type
 * @returns {string} - Template name
 */
const getEmailTemplate = (type) => {
  const templateMap = {
    bet_confirmation: 'bet-confirmation',
    bet_win: 'bet-win',
    bet_loss: 'bet-loss',
    deposit_success: 'deposit-success',
    withdrawal_success: 'withdrawal-success',
    bonus_claimed: 'bonus-claimed',
    bonus_available: 'bonus-available',
    welcome: 'welcome',
    password_changed: 'password-changed',
    kyc_verified: 'kyc-verified',
    kyc_rejected: 'kyc-rejected',
    login_alert: 'login-alert',
    promotion_new: 'promotion-new',
    vip_upgrade: 'vip-upgrade',
    birthday: 'birthday',
  };
  return templateMap[type] || 'default';
};

// ============================================
// BULK NOTIFICATIONS
// ============================================

/**
 * Send notification to multiple users
 * @param {Object} notificationData - Notification data
 * @param {Array} userIds - Array of user IDs
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Bulk send result
 */
const sendBulkNotification = async (notificationData, userIds, req = null) => {
  const {
    type,
    title,
    message,
    priority = NOTIFICATION_PRIORITY.NORMAL,
    channels = [DELIVERY_CHANNELS.IN_APP],
    metadata = {},
  } = notificationData;

  const results = [];
  let successCount = 0;
  let failCount = 0;

  for (const userId of userIds) {
    try {
      const notification = await createNotification({
        userId,
        type,
        title,
        message,
        priority,
        channels,
        metadata,
      }, req);
      results.push({ userId, success: true, notificationId: notification.id });
      successCount++;
    } catch (error) {
      results.push({ userId, success: false, error: error.message });
      failCount++;
    }
  }

  logger.info(`Bulk notification sent: ${successCount} success, ${failCount} failures`);

  return {
    success: failCount === 0,
    successCount,
    failCount,
    results,
  };
};

/**
 * Send notification to all users matching criteria
 * @param {Object} notificationData - Notification data
 * @param {Object} criteria - User filter criteria
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Bulk send result
 */
const sendNotificationToUsers = async (notificationData, criteria = {}, req = null) => {
  const { type, title, message, priority = NOTIFICATION_PRIORITY.NORMAL, channels = [DELIVERY_CHANNELS.IN_APP] } = notificationData;

  // Build user query
  const where = { status: 'active' };
  if (criteria.vipTier) {
    where.vip_tier = criteria.vipTier;
  }
  if (criteria.country) {
    where.country = criteria.country;
  }
  if (criteria.minDeposits) {
    // This would require a subquery or join
    // For simplicity, we'll handle it in the loop
  }

  const users = await User.findAll({
    where,
    attributes: ['id'],
    limit: criteria.limit || 1000,
  });

  const userIds = users.map(user => user.id);

  return await sendBulkNotification({
    type,
    title,
    message,
    priority,
    channels,
    metadata: notificationData.metadata || {},
  }, userIds, req);
};

// ============================================
// NOTIFICATION SCHEDULING
// ============================================

/**
 * Schedule notifications
 * @param {Object} options - Scheduling options
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Scheduled result
 */
const scheduleNotifications = async (options = {}, req = null) => {
  // This would integrate with a job queue system (e.g., Bull, Agenda)
  // For now, we'll just create scheduled notifications
  const { type, title, message, userIds, scheduledFor, metadata = {} } = options;

  const results = [];

  for (const userId of userIds) {
    try {
      const notification = await createNotification({
        userId,
        type,
        title,
        message,
        scheduledFor,
        metadata,
      }, req);
      results.push({ userId, success: true, notificationId: notification.id });
    } catch (error) {
      results.push({ userId, success: false, error: error.message });
    }
  }

  return {
    success: true,
    scheduled: results.filter(r => r.success).length,
    total: userIds.length,
    results,
  };
};

/**
 * Process scheduled notifications (should be called by a cron job)
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Processed result
 */
const processScheduledNotifications = async (req = null) => {
  const now = new Date();

  const notifications = await Notification.findAll({
    where: {
      scheduled_for: {
        [Op.lte]: now,
      },
      delivery_status: 'pending',
    },
  });

  let processedCount = 0;
  let successCount = 0;
  let failCount = 0;

  for (const notification of notifications) {
    try {
      const result = await deliverNotification(notification);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
      processedCount++;
    } catch (error) {
      failCount++;
      logger.error(`Failed to process scheduled notification ${notification.id}:`, error);
    }
  }

  logger.info(`Processed ${processedCount} scheduled notifications: ${successCount} success, ${failCount} failures`);

  return {
    processedCount,
    successCount,
    failCount,
  };
};

// ============================================
// NOTIFICATION RETRIEVAL
// ============================================

/**
 * Get user notifications
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Notifications
 */
const getUserNotifications = async (userId, options = {}) => {
  const {
    limit = 50,
    offset = 0,
    type = null,
    read = null,
    priority = null,
    startDate = null,
    endDate = null,
    includeExpired = false,
  } = options;

  const where = { user_id: userId };

  if (type) where.type = type;
  if (read !== null) where.is_read = read;
  if (priority) where.priority = priority;
  if (startDate) where.created_at = { [Op.gte]: new Date(startDate) };
  if (endDate) where.created_at = { ...where.created_at, [Op.lte]: new Date(endDate) };

  if (!includeExpired) {
    where[Op.or] = [
      { expires_at: { [Op.gt]: new Date() } },
      { expires_at: null },
    ];
  }

  // Check cache for common queries
  const cacheKey = `notifications:${userId}:${JSON.stringify({ limit, offset, type, read })}`;
  if (offset === 0 && !startDate && !endDate && !priority) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (error) {
        // Invalid cache, continue
      }
    }
  }

  const { count, rows } = await Notification.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['priority', 'DESC'],
      ['created_at', 'DESC'],
    ],
  });

  const result = {
    notifications: rows,
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
  };

  // Cache only first page
  if (offset === 0) {
    await cache.set(cacheKey, JSON.stringify(result), CACHE_TTL.NOTIFICATIONS);
  }

  return result;
};

/**
 * Get unread notification count
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Unread count
 */
const getUnreadCount = async (userId) => {
  // Check cache
  const cacheKey = `unread_count:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return parseInt(cached);
    } catch (error) {
      // Invalid cache, continue
    }
  }

  const count = await Notification.count({
    where: {
      user_id: userId,
      is_read: false,
      is_dismissed: false,
      [Op.or]: [
        { expires_at: { [Op.gt]: new Date() } },
        { expires_at: null },
      ],
    },
  });

  await cache.set(cacheKey, count, CACHE_TTL.UNREAD_COUNT);

  return count;
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated notification
 */
const markAsRead = async (notificationId, userId, req = null) => {
  const notification = await Notification.findOne({
    where: {
      id: notificationId,
      user_id: userId,
    },
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  await notification.markAsRead();

  // Clear cache
  await cache.del(`unread_count:${userId}`);
  await cache.del(`notifications:${userId}:*`);

  return notification;
};

/**
 * Mark all notifications as read
 * @param {string} userId - User ID
 * @param {Object} req - Express request object
 * @returns {Promise<number>} - Number of notifications marked
 */
const markAllAsRead = async (userId, req = null) => {
  const count = await Notification.update(
    { is_read: true, read_at: new Date() },
    {
      where: {
        user_id: userId,
        is_read: false,
      },
    }
  );

  // Clear cache
  await cache.del(`unread_count:${userId}`);
  await cache.del(`notifications:${userId}:*`);

  logger.info(`Marked ${count[0]} notifications as read for user ${userId}`);

  return count[0];
};

/**
 * Dismiss notification
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated notification
 */
const dismissNotification = async (notificationId, userId, req = null) => {
  const notification = await Notification.findOne({
    where: {
      id: notificationId,
      user_id: userId,
    },
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  await notification.dismiss();

  // Clear cache
  await cache.del(`notifications:${userId}:*`);

  return notification;
};

// ============================================
// NOTIFICATION TEMPLATES
// ============================================

/**
 * Get notification template
 * @param {string} type - Notification type
 * @param {Object} data - Template data
 * @returns {Object} - Template with title and message
 */
const getNotificationTemplate = (type, data = {}) => {
  const templates = {
    [NOTIFICATION_TYPES.WELCOME]: {
      title: 'Welcome to CephasGM GameZone! 🎉',
      message: `Welcome ${data.name}! Get started with your first bet and claim your welcome bonus.`,
    },
    [NOTIFICATION_TYPES.BET_CONFIRMATION]: {
      title: 'Bet Confirmation ✅',
      message: `Your bet of $${data.stake} on ${data.match} has been placed successfully. Good luck!`,
    },
    [NOTIFICATION_TYPES.BET_WIN]: {
      title: '🎉 You Won!',
      message: `Congratulations! Your bet on ${data.match} has won. You've won $${data.amount}!`,
    },
    [NOTIFICATION_TYPES.BET_LOSS]: {
      title: 'Bet Lost ❌',
      message: `Your bet on ${data.match} has lost. Better luck next time!`,
    },
    [NOTIFICATION_TYPES.BET_CASHOUT]: {
      title: 'Cash Out Successful 💰',
      message: `You've cashed out your bet on ${data.match} for $${data.amount}.`,
    },
    [NOTIFICATION_TYPES.DEPOSIT_SUCCESS]: {
      title: 'Deposit Successful 💳',
      message: `Your deposit of $${data.amount} has been successfully processed. Your new balance is $${data.balance}.`,
    },
    [NOTIFICATION_TYPES.DEPOSIT_FAILED]: {
      title: 'Deposit Failed ❌',
      message: `Your deposit of $${data.amount} has failed. Please check your payment method and try again.`,
    },
    [NOTIFICATION_TYPES.WITHDRAWAL_SUCCESS]: {
      title: 'Withdrawal Successful 💳',
      message: `Your withdrawal of $${data.amount} has been successfully processed.`,
    },
    [NOTIFICATION_TYPES.WITHDRAWAL_FAILED]: {
      title: 'Withdrawal Failed ❌',
      message: `Your withdrawal of $${data.amount} has failed. Please check your withdrawal details and try again.`,
    },
    [NOTIFICATION_TYPES.BONUS_AVAILABLE]: {
      title: '🎁 New Bonus Available!',
      message: `You have a new ${data.bonusType} bonus worth $${data.amount}! Claim it now before it expires.`,
    },
    [NOTIFICATION_TYPES.BONUS_CLAIMED]: {
      title: '🎁 Bonus Claimed!',
      message: `You've successfully claimed your ${data.bonusType} bonus of $${data.amount}.`,
    },
    [NOTIFICATION_TYPES.BONUS_EXPIRING]: {
      title: '⏰ Bonus Expiring Soon',
      message: `Your ${data.bonusType} bonus of $${data.amount} expires in ${data.days} days. Use it before it's gone!`,
    },
    [NOTIFICATION_TYPES.VIP_UPGRADE]: {
      title: '👑 VIP Upgrade!',
      message: `Congratulations! You've been upgraded to ${data.tier} VIP tier. Enjoy your new benefits!`,
    },
    [NOTIFICATION_TYPES.PROMOTION_NEW]: {
      title: '🎯 New Promotion!',
      message: `Check out our new promotion: ${data.promotionTitle}. Don't miss out!`,
    },
    [NOTIFICATION_TYPES.KYC_VERIFIED]: {
      title: '✅ KYC Verified',
      message: 'Your identity has been successfully verified. You now have full access to all features.',
    },
    [NOTIFICATION_TYPES.KYC_REJECTED]: {
      title: '❌ KYC Verification Failed',
      message: `Your KYC verification has been rejected. Reason: ${data.reason}. Please resubmit your documents.`,
    },
    [NOTIFICATION_TYPES.LOGIN_ALERT]: {
      title: '🔔 New Login Detected',
      message: `A new login to your account was detected from ${data.location} on ${data.device}. If this wasn't you, please secure your account immediately.`,
    },
    [NOTIFICATION_TYPES.PASSWORD_CHANGED]: {
      title: '🔒 Password Changed',
      message: 'Your password has been changed successfully. If you didn't make this change, please contact support.',
    },
    [NOTIFICATION_TYPES.REFERRAL_EARNED]: {
      title: '👥 Referral Bonus Earned!',
      message: `You've earned $${data.amount} from your referral ${data.referredUser}. Keep sharing!`,
    },
    [NOTIFICATION_TYPES.REFERRAL_JOINED]: {
      title: '👥 Someone Joined Through Your Referral!',
      message: `${data.referredUser} just joined CephasGM GameZone using your referral link.`,
    },
    [NOTIFICATION_TYPES.BIRTHDAY]: {
      title: '🎂 Happy Birthday!',
      message: `Happy Birthday ${data.name}! Here's a special $${data.amount} bonus just for you.`,
    },
    [NOTIFICATION_TYPES.ANNOUNCEMENT]: {
      title: '📢 Announcement',
      message: `${data.message}`,
    },
    [NOTIFICATION_TYPES.SYSTEM_ALERT]: {
      title: '⚙️ System Alert',
      message: `${data.message}`,
    },
    [NOTIFICATION_TYPES.MAINTENANCE]: {
      title: '🔧 Scheduled Maintenance',
      message: `The platform will be undergoing maintenance on ${data.time}. We apologize for any inconvenience.`,
    },
    [NOTIFICATION_TYPES.LIMIT_REACHED]: {
      title: '⚠️ Limit Reached',
      message: `You've reached your ${data.limitType} limit of $${data.limit}. Your ${data.limitType} activity will be paused until ${data.resetTime}.`,
    },
    [NOTIFICATION_TYPES.SUPPORT_RESPONSE]: {
      title: '📨 Support Response',
      message: `Your support ticket #${data.ticketId} has received a response from our team.`,
    },
    [NOTIFICATION_TYPES.MESSAGE_RECEIVED]: {
      title: '💬 New Message',
      message: `You have a new message from ${data.senderName}.`,
    },
    [NOTIFICATION_TYPES.LEADERBOARD_UPDATE]: {
      title: '📊 Leaderboard Update',
      message: `You're now ranked #${data.rank} on the leaderboard!`,
    },
  };

  return templates[type] || {
    title: 'Notification',
    message: data.message || 'You have a new notification',
  };
};

/**
 * Create notification from template
 * @param {string} userId - User ID
 * @param {string} type - Notification type
 * @param {Object} data - Template data
 * @param {Object} options - Additional options
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Created notification
 */
const createNotificationFromTemplate = async (userId, type, data = {}, options = {}, req = null) => {
  const template = getNotificationTemplate(type, data);

  return await createNotification({
    userId,
    type,
    title: template.title,
    message: template.message,
    metadata: data,
    ...options,
  }, req);
};

// ============================================
// EXPIRATION & CLEANUP
// ============================================

/**
 * Clean up old notifications
 * @param {Object} options - Cleanup options
 * @param {Object} req - Express request object
 * @returns {Promise<number>} - Number of deleted notifications
 */
const cleanupOldNotifications = async (options = {}, req = null) => {
  const { days = 90, batchSize = 1000 } = options;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  let totalDeleted = 0;
  let batchDeleted;

  do {
    batchDeleted = await Notification.destroy({
      where: {
        created_at: {
          [Op.lt]: cutoffDate,
        },
        is_read: true,
        is_dismissed: true,
      },
      limit: batchSize,
    });

    totalDeleted += batchDeleted;
  } while (batchDeleted === batchSize);

  logger.info(`Cleaned up ${totalDeleted} old notifications older than ${days} days`);

  return totalDeleted;
};

/**
 * Expire old notifications
 * @param {Object} req - Express request object
 * @returns {Promise<number>} - Number of expired notifications
 */
const expireOldNotifications = async (req = null) => {
  const now = new Date();

  const expired = await Notification.update(
    { is_dismissed: true, dismissed_at: now },
    {
      where: {
        expires_at: {
          [Op.lt]: now,
        },
        is_dismissed: false,
      },
    }
  );

  if (expired[0] > 0) {
    logger.info(`Expired ${expired[0]} notifications`);
  }

  return expired[0];
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Notification Creation
  createNotification,
  createNotificationFromTemplate,
  getNotificationTemplate,

  // Notification Delivery
  deliverNotification,
  sendBulkNotification,
  sendNotificationToUsers,

  // Notification Scheduling
  scheduleNotifications,
  processScheduledNotifications,

  // Notification Retrieval
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,

  // Cleanup
  cleanupOldNotifications,
  expireOldNotifications,

  // Constants
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITY,
  DELIVERY_CHANNELS,
  CACHE_TTL,
};
