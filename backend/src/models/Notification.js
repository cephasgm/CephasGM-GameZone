/**
 * Notification Model - User Notification Management
 * CephasGM GameZone
 * 
 * This model manages all user notifications including push notifications,
 * email notifications, SMS, and in-app alerts. It supports delivery
 * tracking, read/unread status, and notification categories.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Notification Model Definition
 */
const Notification = sequelize.define(
  'Notification',
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    // User Association
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },

    // Notification Type
    type: {
      type: DataTypes.ENUM(
        'bet_confirmation',
        'bet_win',
        'bet_loss',
        'bet_cashout',
        'deposit_confirmation',
        'withdrawal_confirmation',
        'withdrawal_processing',
        'deposit_success',
        'deposit_failed',
        'withdrawal_success',
        'withdrawal_failed',
        'bonus_claimed',
        'bonus_available',
        'bonus_expiring',
        'bonus_expired',
        'promotion_new',
        'promotion_ending',
        'vip_upgrade',
        'vip_benefit',
        'kyc_status',
        'kyc_required',
        'kyc_verified',
        'kyc_rejected',
        'account_security',
        'login_alert',
        'password_changed',
        'two_factor_enabled',
        'self_exclusion',
        'limit_reached',
        'system_alert',
        'maintenance',
        'update_available',
        'referral_earned',
        'referral_joined',
        'message_received',
        'support_response',
        'support_ticket_update',
        'tournament_start',
        'tournament_update',
        'leaderboard_update',
        'welcome',
        'birthday',
        'announcement',
        'other'
      ),
      allowNull: false,
    },

    // Notification Priority
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'),
      defaultValue: 'normal',
      allowNull: false,
    },

    // Notification Content
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 200],
      },
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 1000],
      },
    },
    short_message: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // Deep Linking
    link: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    link_type: {
      type: DataTypes.ENUM(
        'web',
        'app',
        'bet',
        'match',
        'wallet',
        'promotion',
        'bonus',
        'profile',
        'settings',
        'support',
        'other'
      ),
      allowNull: true,
    },
    link_params: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },

    // Related Entities
    related_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID of related entity (bet, transaction, etc.)',
    },
    related_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Type of related entity',
    },

    // Notification Status
    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    read_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_dismissed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    dismissed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Delivery Status
    delivery_status: {
      type: DataTypes.ENUM('pending', 'sent', 'delivered', 'failed', 'bounced', 'unsubscribed'),
      defaultValue: 'pending',
      allowNull: false,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    delivered_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    failure_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Delivery Channels
    channels: {
      type: DataTypes.JSONB,
      defaultValue: ['in_app'],
      allowNull: false,
      comment: 'Delivery channels: in_app, email, push, sms',
    },
    channels_sent: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },

    // Scheduling
    scheduled_for: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    delivered_at_channel: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
      comment: 'Track delivery times per channel',
    },

    // Expiry
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Icon & Visual
    icon: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    icon_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: true,
      validate: {
        is: /^#[0-9a-fA-F]{6}$/,
      },
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },

    // Action Buttons
    actions: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
      comment: 'Array of action buttons with labels and callbacks',
    },

    // User Interaction Tracking
    action_taken: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
      comment: 'Track user actions taken on this notification',
    },

    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },

    // Admin
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Timestamps
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
  },
  {
    // Model options
    tableName: 'notifications',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['is_read'],
      },
      {
        fields: ['priority'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['scheduled_for'],
        where: {
          scheduled_for: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        fields: ['delivery_status'],
      },
      {
        // For unread notifications
        fields: ['user_id', 'is_read'],
      },
      {
        // For scheduled notifications
        fields: ['scheduled_for', 'delivery_status'],
      },
      {
        // For user notification history
        fields: ['user_id', 'created_at'],
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a notification, set defaults
       */
      beforeCreate: (notification) => {
        // Set expiry if not set
        if (!notification.expires_at) {
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + 30); // 30 days default expiry
          notification.expires_at = expiry;
        }

        // Set icon based on type if not provided
        if (!notification.icon) {
          const iconMap = {
            bet_confirmation: '✅',
            bet_win: '🏆',
            bet_loss: '❌',
            bet_cashout: '💰',
            deposit_confirmation: '💳',
            withdrawal_confirmation: '💳',
            withdrawal_processing: '⏳',
            deposit_success: '✅',
            deposit_failed: '❌',
            withdrawal_success: '✅',
            withdrawal_failed: '❌',
            bonus_claimed: '🎁',
            bonus_available: '🎉',
            bonus_expiring: '⏰',
            bonus_expired: '⏰',
            promotion_new: '🎯',
            promotion_ending: '⏰',
            vip_upgrade: '👑',
            vip_benefit: '⭐',
            kyc_status: '🛡️',
            kyc_required: '📋',
            kyc_verified: '✅',
            kyc_rejected: '❌',
            account_security: '🔒',
            login_alert: '🔔',
            password_changed: '🔒',
            two_factor_enabled: '🔐',
            self_exclusion: '🛡️',
            limit_reached: '⚠️',
            system_alert: '⚙️',
            maintenance: '🔧',
            update_available: '📱',
            referral_earned: '👥',
            referral_joined: '👥',
            message_received: '💬',
            support_response: '📨',
            support_ticket_update: '📋',
            tournament_start: '🏆',
            tournament_update: '📊',
            leaderboard_update: '📊',
            welcome: '👋',
            birthday: '🎂',
            announcement: '📢',
            other: '📌',
          };
          notification.icon = iconMap[notification.type] || '📌';
        }

        // Set color based on priority
        if (!notification.color) {
          const colorMap = {
            low: '#636e72',
            normal: '#0055ff',
            high: '#ffd700',
            urgent: '#ff0044',
          };
          notification.color = colorMap[notification.priority] || '#0055ff';
        }

        // If scheduled, set delivery status to pending
        if (notification.scheduled_for && notification.scheduled_for > new Date()) {
          notification.delivery_status = 'pending';
        }
      },

      /**
       * Before updating a notification, handle status changes
       */
      beforeUpdate: (notification) => {
        // Handle read status
        if (notification.changed('is_read') && notification.is_read && !notification.read_at) {
          notification.read_at = new Date();
        }

        // Handle dismissed status
        if (notification.changed('is_dismissed') && notification.is_dismissed && !notification.dismissed_at) {
          notification.dismissed_at = new Date();
        }

        // Handle delivery status
        if (notification.changed('delivery_status') && notification.delivery_status === 'sent' && !notification.sent_at) {
          notification.sent_at = new Date();
        }
        if (notification.changed('delivery_status') && notification.delivery_status === 'delivered' && !notification.delivered_at) {
          notification.delivered_at = new Date();
        }
        if (notification.changed('delivery_status') && notification.delivery_status === 'failed' && !notification.failed_at) {
          notification.failed_at = new Date();
        }
      },

      /**
       * After creating a notification, log the event
       */
      afterCreate: async (notification) => {
        logger.info(
          `Notification created for user ${notification.user_id}: ` +
          `${notification.type} - ${notification.title}`
        );
      },
    },
  }
);

/**
 * Instance methods
 */
Notification.prototype = {
  ...Notification.prototype,

  /**
   * Mark notification as read
   * @param {string} channel - Channel (in_app, email, push, sms)
   * @returns {Promise<Notification>} - Updated notification
   */
  async markAsRead(channel = 'in_app') {
    this.is_read = true;
    this.read_at = new Date();

    // Track channel-specific read status
    const readChannels = this.metadata?.read_channels || [];
    if (!readChannels.includes(channel)) {
      readChannels.push(channel);
      this.metadata = {
        ...this.metadata,
        read_channels: readChannels,
      };
    }

    await this.save();
    logger.debug(`Notification ${this.id} marked as read on ${channel}`);
    return this;
  },

  /**
   * Mark notification as dismissed
   * @returns {Promise<Notification>} - Updated notification
   */
  async dismiss() {
    this.is_dismissed = true;
    this.dismissed_at = new Date();
    await this.save();
    logger.debug(`Notification ${this.id} dismissed`);
    return this;
  },

  /**
   * Mark notification as delivered
   * @param {string} channel - Delivery channel
   * @returns {Promise<Notification>} - Updated notification
   */
  async markAsDelivered(channel = 'in_app') {
    const channelsSent = this.channels_sent || [];
    if (!channelsSent.includes(channel)) {
      channelsSent.push(channel);
      this.channels_sent = channelsSent;
    }

    if (this.delivery_status === 'pending') {
      this.delivery_status = 'delivered';
      this.delivered_at = new Date();
    }

    // Track per-channel delivery
    const deliveredAtChannels = this.delivered_at_channel || {};
    deliveredAtChannels[channel] = new Date();
    this.delivered_at_channel = deliveredAtChannels;

    await this.save();
    logger.debug(`Notification ${this.id} marked as delivered on ${channel}`);
    return this;
  },

  /**
   * Mark notification as failed
   * @param {string} reason - Failure reason
   * @param {string} channel - Failed channel
   * @returns {Promise<Notification>} - Updated notification
   */
  async markAsFailed(reason, channel = null) {
    this.delivery_status = 'failed';
    this.failed_at = new Date();
    this.failure_reason = reason;

    if (channel) {
      const failedChannels = this.metadata?.failed_channels || [];
      if (!failedChannels.includes(channel)) {
        failedChannels.push(channel);
        this.metadata = {
          ...this.metadata,
          failed_channels: failedChannels,
        };
      }
    }

    await this.save();
    logger.warn(`Notification ${this.id} failed: ${reason}`);
    return this;
  },

  /**
   * Check if notification is expired
   * @returns {boolean} - Whether notification is expired
   */
  isExpired() {
    return this.expires_at && this.expires_at < new Date();
  },

  /**
   * Check if notification is scheduled
   * @returns {boolean} - Whether notification is scheduled
   */
  isScheduled() {
    return this.scheduled_for && this.scheduled_for > new Date();
  },

  /**
   * Get notification display title with icon
   * @returns {string} - Display title with icon
   */
  getDisplayTitle() {
    return this.icon ? `${this.icon} ${this.title}` : this.title;
  },

  /**
   * Get notification summary for display
   * @returns {Object} - Notification summary
   */
  getSummary() {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      message: this.message,
      shortMessage: this.short_message || this.message.substring(0, 100),
      icon: this.icon,
      color: this.color,
      isRead: this.is_read,
      isDismissed: this.is_dismissed,
      priority: this.priority,
      createdAt: this.created_at,
      readAt: this.read_at,
      link: this.link,
      linkType: this.link_type,
      linkParams: this.link_params,
      relatedId: this.related_id,
      relatedType: this.related_type,
      actions: this.actions,
    };
  },

  /**
   * Get notification data for push/email delivery
   * @returns {Object} - Delivery data
   */
  getDeliveryData() {
    return {
      id: this.id,
      type: this.type,
      title: this.title,
      message: this.short_message || this.message,
      icon: this.icon,
      link: this.link,
      linkType: this.link_type,
      linkParams: this.link_params,
      priority: this.priority,
      userId: this.user_id,
    };
  },

  /**
   * Track user action on notification
   * @param {string} action - Action taken
   * @param {Object} data - Additional data
   * @returns {Promise<Notification>} - Updated notification
   */
  async trackAction(action, data = {}) {
    const actions = this.action_taken || {};
    actions[action] = {
      timestamp: new Date(),
      ...data,
    };
    this.action_taken = actions;
    await this.save();
    return this;
  },
};

/**
 * Static methods
 */
Notification.findByUser = async function(userId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    type = null,
    read = null,
    dismissed = null,
    priority = null,
    startDate = null,
    endDate = null,
  } = options;

  const where = { user_id: userId };
  if (type) where.type = type;
  if (read !== null) where.is_read = read;
  if (dismissed !== null) where.is_dismissed = dismissed;
  if (priority) where.priority = priority;
  if (startDate) where.created_at = { [sequelize.Op.gte]: startDate };
  if (endDate) where.created_at = { ...where.created_at, [sequelize.Op.lte]: endDate };

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['priority', 'DESC'],
      ['created_at', 'DESC'],
    ],
  });
};

Notification.findUnreadByUser = async function(userId, limit = 20) {
  return this.findAll({
    where: {
      user_id: userId,
      is_read: false,
      is_dismissed: false,
    },
    order: [
      ['priority', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit,
  });
};

Notification.findUnreadCountByUser = async function(userId) {
  return this.count({
    where: {
      user_id: userId,
      is_read: false,
      is_dismissed: false,
    },
  });
};

Notification.findRecentByUser = async function(userId, limit = 20) {
  return this.findAll({
    where: {
      user_id: userId,
      is_dismissed: false,
    },
    order: [['created_at', 'DESC']],
    limit,
  });
};

Notification.findByType = async function(type, options = {}) {
  const { limit = 100, offset = 0, userId = null, unreadOnly = false } = options;

  const where = { type };
  if (userId) where.user_id = userId;
  if (unreadOnly) where.is_read = false;

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });
};

Notification.findScheduledNotifications = async function() {
  const now = new Date();
  return this.findAll({
    where: {
      scheduled_for: {
        [sequelize.Op.lte]: now,
      },
      delivery_status: 'pending',
    },
    order: [['scheduled_for', 'ASC']],
  });
};

Notification.findExpiredNotifications = async function() {
  const now = new Date();
  return this.findAll({
    where: {
      expires_at: {
        [sequelize.Op.lt]: now,
      },
      is_read: false,
    },
  });
};

Notification.markAllAsReadByUser = async function(userId) {
  const [updatedCount] = await this.update(
    {
      is_read: true,
      read_at: new Date(),
    },
    {
      where: {
        user_id: userId,
        is_read: false,
      },
    }
  );
  logger.info(`Marked ${updatedCount} notifications as read for user ${userId}`);
  return updatedCount;
};

Notification.deleteOldNotifications = async function(days = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const deletedCount = await this.destroy({
    where: {
      created_at: {
        [sequelize.Op.lt]: cutoffDate,
      },
      is_read: true,
    },
  });

  logger.info(`Deleted ${deletedCount} old notifications`);
  return deletedCount;
};

Notification.getNotificationStats = async function(userId = null) {
  const where = {};
  if (userId) where.user_id = userId;

  const stats = await this.findAll({
    where,
    attributes: [
      'type',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN is_read THEN 1 ELSE 0 END')), 'read_count'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN priority = \'urgent\' THEN 1 ELSE 0 END')), 'urgent_count'],
    ],
    group: ['type'],
    raw: true,
  });

  const result = {
    total: 0,
    unread: 0,
    by_type: {},
    urgent: 0,
  };

  for (const row of stats) {
    const count = parseInt(row.count) || 0;
    const readCount = parseInt(row.read_count) || 0;
    const urgentCount = parseInt(row.urgent_count) || 0;

    result.total += count;
    result.unread += count - readCount;
    result.urgent += urgentCount;

    result.by_type[row.type] = {
      total: count,
      read: readCount,
      unread: count - readCount,
      urgent: urgentCount,
    };
  }

  return result;
};

// Export the model
module.exports = Notification;
