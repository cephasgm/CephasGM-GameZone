/**
 * Session Model - User Session & Token Management
 * CephasGM GameZone
 * 
 * This model manages user sessions including login sessions, JWT refresh
 * tokens, device tracking, session revocation, and session lifecycle
 * management. It provides comprehensive session security and monitoring.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Session Model Definition
 */
const Session = sequelize.define(
  'Session',
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

    // Session Token (JWT Refresh Token / Session ID)
    session_token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    refresh_token: {
      type: DataTypes.STRING(255),
      allowNull: true,
      unique: true,
    },

    // Session Metadata
    session_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: 'My Session',
    },
    session_type: {
      type: DataTypes.ENUM('web', 'mobile', 'api', 'admin', 'device'),
      defaultValue: 'web',
      allowNull: false,
    },

    // Device Information
    device_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    device_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    device_type: {
      type: DataTypes.ENUM('desktop', 'mobile', 'tablet', 'console', 'other'),
      allowNull: true,
    },
    device_os: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    device_os_version: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    device_browser: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    device_browser_version: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    device_model: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    device_vendor: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Network Information
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    ip_country: {
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    ip_region: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ip_city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ip_isp: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    accept_language: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Geolocation (if provided by user or IP)
    location_lat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    location_lng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },
    location_accuracy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Accuracy in meters',
    },

    // Session Status
    status: {
      type: DataTypes.ENUM('active', 'idle', 'expired', 'revoked', 'terminated'),
      defaultValue: 'active',
      allowNull: false,
    },

    // Security
    is_trusted_device: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    is_mfa_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    mfa_verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    mfa_method: {
      type: DataTypes.ENUM('totp', 'sms', 'email', 'backup_code'),
      allowNull: true,
    },

    // Session Lifecycle
    login_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    last_activity_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    logout_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revoked_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // Token Rotation
    token_rotation_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    last_token_refresh_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Activity Metrics
    total_requests: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    last_request_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_request_method: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    last_request_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    // Security Events
    failed_auth_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    suspicious_activity_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    last_suspicious_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Session Data
    session_data: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
      comment: 'Custom session data for application state',
    },

    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },

    // Admin
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    revoked_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
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
    tableName: 'sessions',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['session_token'],
        unique: true,
      },
      {
        fields: ['refresh_token'],
        unique: true,
        where: {
          refresh_token: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        fields: ['status'],
      },
      {
        fields: ['expires_at'],
      },
      {
        fields: ['device_id'],
        where: {
          device_id: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        fields: ['ip_address'],
        where: {
          ip_address: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      // For user session management
      {
        fields: ['user_id', 'status'],
      },
      // For active session queries
      {
        fields: ['user_id', 'status', 'expires_at'],
      },
      // For device tracking
      {
        fields: ['user_id', 'device_id'],
        where: {
          device_id: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      // For token refresh tracking
      {
        fields: ['refresh_token', 'status'],
        where: {
          refresh_token: {
            [sequelize.Op.ne]: null,
          },
        },
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a session, validate expiry
       */
      beforeCreate: (session) => {
        if (!session.expires_at) {
          const defaultExpiry = new Date();
          defaultExpiry.setDate(defaultExpiry.getDate() + 7); // 7 days default
          session.expires_at = defaultExpiry;
        }

        // Set login_at if not set
        if (!session.login_at) {
          session.login_at = new Date();
        }

        // Set last_activity_at if not set
        if (!session.last_activity_at) {
          session.last_activity_at = new Date();
        }

        // Set session type based on user agent if not specified
        if (!session.session_type && session.user_agent) {
          const ua = session.user_agent.toLowerCase();
          if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
            session.session_type = 'mobile';
          } else if (ua.includes('admin')) {
            session.session_type = 'admin';
          } else if (ua.includes('api')) {
            session.session_type = 'api';
          } else {
            session.session_type = 'web';
          }
        }

        // Generate session name if not provided
        if (!session.session_name || session.session_name === 'My Session') {
          const date = new Date();
          const dateStr = date.toLocaleDateString();
          const timeStr = date.toLocaleTimeString();
          const deviceInfo = session.device_name || session.device_type || 'Device';
          session.session_name = `${deviceInfo} - ${dateStr} ${timeStr}`;
        }
      },

      /**
       * Before updating a session, update last_activity and check expiry
       */
      beforeUpdate: (session) => {
        // Update last_activity_at on any change
        if (session.changed() && !session.changed('last_activity_at')) {
          session.last_activity_at = new Date();
        }

        // Auto-expire if past expiry
        if (session.expires_at && session.expires_at < new Date() && session.status === 'active') {
          session.status = 'expired';
        }

        // Handle revocation
        if (session.changed('status') && session.status === 'revoked' && !session.revoked_at) {
          session.revoked_at = new Date();
        }

        // Handle logout
        if (session.changed('status') && session.status === 'terminated' && !session.logout_at) {
          session.logout_at = new Date();
        }
      },

      /**
       * After creating a session, log the event
       */
      afterCreate: async (session) => {
        logger.info(
          `Session created for user ${session.user_id}: ` +
          `${session.session_token.substring(0, 8)}... - ${session.device_type || 'unknown'}`
        );
      },

      /**
       * After updating a session, log status changes
       */
      afterUpdate: async (session) => {
        if (session.changed('status')) {
          logger.info(
            `Session status changed for user ${session.user_id}: ` +
            `${session.previous('status')} → ${session.status} - ` +
            `${session.session_token.substring(0, 8)}...`
          );
        }

        if (session.changed('refresh_token') && session.refresh_token) {
          logger.debug(
            `Refresh token rotated for session ${session.session_token.substring(0, 8)}...`
          );
        }
      },
    },
  }
);

/**
 * Instance methods
 */
Session.prototype = {
  ...Session.prototype,

  /**
   * Check if session is active
   * @returns {boolean} - Whether session is active
   */
  isActive() {
    return (
      this.status === 'active' &&
      this.expires_at &&
      this.expires_at > new Date()
    );
  },

  /**
   * Check if session is expired
   * @returns {boolean} - Whether session is expired
   */
  isExpired() {
    return this.status === 'expired' || (this.expires_at && this.expires_at < new Date());
  },

  /**
   * Check if session is revoked
   * @returns {boolean} - Whether session is revoked
   */
  isRevoked() {
    return this.status === 'revoked';
  },

  /**
   * Check if session is terminated (logged out)
   * @returns {boolean} - Whether session is terminated
   */
  isTerminated() {
    return this.status === 'terminated';
  },

  /**
   * Extend session expiry
   * @param {number} days - Days to extend
   * @returns {Promise<Session>} - Updated session
   */
  async extendExpiry(days = 7) {
    if (!this.isActive()) {
      throw new Error('Cannot extend an inactive session');
    }
    this.expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    await this.save();
    logger.debug(`Session ${this.id} extended by ${days} days`);
    return this;
  },

  /**
   * Revoke the session
   * @param {string} reason - Revocation reason
   * @param {string} revokedBy - User ID of revoker
   * @returns {Promise<Session>} - Updated session
   */
  async revoke(reason = 'Manual revocation', revokedBy = null) {
    this.status = 'revoked';
    this.revoked_at = new Date();
    this.revoked_reason = reason;
    if (revokedBy) {
      this.revoked_by = revokedBy;
    }
    await this.save();
    logger.info(`Session ${this.id} revoked: ${reason}`);
    return this;
  },

  /**
   * Logout/terminate the session
   * @returns {Promise<Session>} - Updated session
   */
  async logout() {
    this.status = 'terminated';
    this.logout_at = new Date();
    await this.save();
    logger.info(`Session ${this.id} logged out`);
    return this;
  },

  /**
   * Rotate the refresh token
   * @param {string} newRefreshToken - New refresh token
   * @returns {Promise<Session>} - Updated session
   */
  async rotateRefreshToken(newRefreshToken) {
    this.refresh_token = newRefreshToken;
    this.token_rotation_count = (this.token_rotation_count || 0) + 1;
    this.last_token_refresh_at = new Date();
    await this.save();
    logger.debug(`Refresh token rotated for session ${this.id}`);
    return this;
  },

  /**
   * Record a request made during this session
   * @param {Object} req - Express request object
   * @returns {Promise<Session>} - Updated session
   */
  async recordRequest(req) {
    this.total_requests = (this.total_requests || 0) + 1;
    this.last_activity_at = new Date();
    this.last_request_at = new Date();
    this.last_request_method = req.method;
    this.last_request_path = req.path || req.url;

    // Only update if the session is active
    if (this.isActive()) {
      await this.save();
    }
    return this;
  },

  /**
   * Increment failed authentication attempts
   * @returns {Promise<Object>} - { attempts, shouldLock }
   */
  async incrementFailedAuth() {
    this.failed_auth_attempts = (this.failed_auth_attempts || 0) + 1;
    await this.save();

    const maxAttempts = 5;
    return {
      attempts: this.failed_auth_attempts,
      shouldLock: this.failed_auth_attempts >= maxAttempts,
    };
  },

  /**
   * Reset failed authentication attempts
   * @returns {Promise<Session>} - Updated session
   */
  async resetFailedAuth() {
    this.failed_auth_attempts = 0;
    await this.save();
    return this;
  },

  /**
   * Report suspicious activity on this session
   * @param {string} reason - Reason for suspicion
   * @param {Object} metadata - Additional metadata
   * @returns {Promise<Session>} - Updated session
   */
  async reportSuspicious(reason, metadata = {}) {
    this.suspicious_activity_count = (this.suspicious_activity_count || 0) + 1;
    this.last_suspicious_at = new Date();

    // Update metadata with suspicious activity details
    const suspiciousEvents = this.metadata?.suspicious_events || [];
    suspiciousEvents.push({
      reason,
      timestamp: new Date(),
      ...metadata,
    });
    this.metadata = {
      ...this.metadata,
      suspicious_events: suspiciousEvents,
    };

    // Auto-revoke if too many suspicious activities
    const maxSuspicious = 3;
    if (this.suspicious_activity_count >= maxSuspicious) {
      await this.revoke(`Auto-revoked after ${this.suspicious_activity_count} suspicious activities`);
    } else {
      await this.save();
    }

    logger.warn(
      `Suspicious activity on session ${this.id}: ${reason} ` +
      `(${this.suspicious_activity_count}/${maxSuspicious})`
    );

    return this;
  },

  /**
   * Get session summary for display
   * @returns {Object} - Session summary
   */
  getSummary() {
    const deviceInfo = this.device_name || this.device_type || 'Unknown Device';
    const locationInfo = this.ip_city || this.ip_country || 'Unknown Location';

    return {
      id: this.id,
      userId: this.user_id,
      sessionName: this.session_name,
      device: deviceInfo,
      deviceType: this.device_type,
      browser: this.device_browser,
      os: this.device_os,
      ip: this.ip_address,
      location: locationInfo,
      status: this.status,
      isActive: this.isActive(),
      isTrusted: this.is_trusted_device,
      isMfaVerified: this.is_mfa_verified,
      loginAt: this.login_at,
      lastActivityAt: this.last_activity_at,
      expiresAt: this.expires_at,
      totalRequests: this.total_requests,
      createdAt: this.created_at,
    };
  },

  /**
   * Get full session data
   * @returns {Object} - Full session data
   */
  getFullData() {
    return {
      ...this.getSummary(),
      sessionToken: this.session_token,
      refreshToken: this.refresh_token,
      sessionType: this.session_type,
      deviceId: this.device_id,
      deviceModel: this.device_model,
      deviceVendor: this.device_vendor,
      ipCountry: this.ip_country,
      ipRegion: this.ip_region,
      ipCity: this.ip_city,
      ipIsp: this.ip_isp,
      userAgent: this.user_agent,
      locationLat: this.location_lat,
      locationLng: this.location_lng,
      mfaVerifiedAt: this.mfa_verified_at,
      mfaMethod: this.mfa_method,
      logoutAt: this.logout_at,
      revokedAt: this.revoked_at,
      revokedReason: this.revoked_reason,
      tokenRotationCount: this.token_rotation_count,
      lastTokenRefreshAt: this.last_token_refresh_at,
      failedAuthAttempts: this.failed_auth_attempts,
      suspiciousActivityCount: this.suspicious_activity_count,
      lastSuspiciousAt: this.last_suspicious_at,
      sessionData: this.session_data,
      metadata: this.metadata,
    };
  },
};

/**
 * Static methods
 */
Session.findByUserId = async function(userId, options = {}) {
  const { limit = 50, offset = 0, active = false, status = null } = options;

  const where = { user_id: userId };
  if (status) where.status = status;
  if (active) {
    where.status = 'active';
    where.expires_at = {
      [sequelize.Op.gt]: new Date(),
    };
  }

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['last_activity_at', 'DESC']],
  });
};

Session.findBySessionToken = async function(sessionToken) {
  return this.findOne({
    where: { session_token: sessionToken },
  });
};

Session.findByRefreshToken = async function(refreshToken) {
  return this.findOne({
    where: { refresh_token: refreshToken },
  });
};

Session.findActiveSessions = async function(options = {}) {
  const { userId = null, limit = 100 } = options;

  const where = {
    status: 'active',
    expires_at: {
      [sequelize.Op.gt]: new Date(),
    },
  };
  if (userId) where.user_id = userId;

  return this.findAll({
    where,
    limit,
    order: [['last_activity_at', 'DESC']],
  });
};

Session.findExpiredSessions = async function() {
  const now = new Date();
  return this.findAll({
    where: {
      status: ['active', 'idle'],
      expires_at: {
        [sequelize.Op.lt]: now,
      },
    },
  });
};

Session.findSessionsByDevice = async function(userId, deviceId) {
  return this.findAll({
    where: {
      user_id: userId,
      device_id: deviceId,
    },
    order: [['last_activity_at', 'DESC']],
  });
};

Session.getUserSessionStats = async function(userId) {
  const stats = await this.findOne({
    where: { user_id: userId },
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'total_sessions'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN status = \'active\' THEN 1 END')), 'active_sessions'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_trusted_device THEN 1 END')), 'trusted_devices'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_mfa_verified THEN 1 END')), 'mfa_verified_sessions'],
      [sequelize.fn('MAX', sequelize.col('last_activity_at')), 'last_session_activity'],
    ],
    raw: true,
  });

  return {
    total_sessions: parseInt(stats.total_sessions) || 0,
    active_sessions: parseInt(stats.active_sessions) || 0,
    trusted_devices: parseInt(stats.trusted_devices) || 0,
    mfa_verified_sessions: parseInt(stats.mfa_verified_sessions) || 0,
    last_session_activity: stats.last_session_activity,
  };
};

Session.revokeAllUserSessions = async function(userId, reason = 'Manual revocation', revokedBy = null) {
  const sessions = await this.findAll({
    where: {
      user_id: userId,
      status: ['active', 'idle'],
    },
  });

  let revokedCount = 0;
  for (const session of sessions) {
    await session.revoke(reason, revokedBy);
    revokedCount++;
  }

  logger.info(`Revoked ${revokedCount} sessions for user ${userId}`);
  return revokedCount;
};

Session.expireOldSessions = async function(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const expiredCount = await this.update(
    { status: 'expired' },
    {
      where: {
        status: ['active', 'idle'],
        last_activity_at: {
          [sequelize.Op.lt]: cutoffDate,
        },
      },
    }
  );

  logger.info(`Expired ${expiredCount[0]} old sessions`);
  return expiredCount[0];
};

Session.cleanupExpiredSessions = async function() {
  const deletedCount = await this.destroy({
    where: {
      status: ['expired', 'terminated', 'revoked'],
      expires_at: {
        [sequelize.Op.lt]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  logger.info(`Cleaned up ${deletedCount} expired sessions`);
  return deletedCount;
};

// Export the model
module.exports = Session;
