/**
 * AuditLog Model - Security & Compliance Audit Logging
 * CephasGM GameZone
 * 
 * This model provides comprehensive audit logging for security,
 * compliance, and forensic analysis. It tracks all critical actions
 * including authentication, authorization, data modifications, and
 * administrative activities.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * AuditLog Model Definition
 */
const AuditLog = sequelize.define(
  'AuditLog',
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    // User Association (who performed the action)
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },

    // Actor Information
    actor_email: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    actor_role: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    actor_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    actor_user_agent: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    actor_session_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // Action Details
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM(
        'authentication',
        'authorization',
        'user_management',
        'profile_update',
        'password_change',
        'payment',
        'betting',
        'wallet',
        'bonus',
        'promotion',
        'admin',
        'system',
        'security',
        'kyc',
        'reporting',
        'data_access',
        'configuration',
        'api',
        'other'
      ),
      allowNull: false,
      defaultValue: 'other',
    },

    // Resource Details
    resource_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Type of resource affected (User, Bet, Wallet, etc.)',
    },
    resource_id: {
      type: DataTypes.UUID,
      allowNull: true,
      comment: 'ID of the resource affected',
    },
    resource_identifier: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Human-readable identifier (email, username, etc.)',
    },

    // Request Details
    request_method: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    request_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    request_query: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    request_body: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    request_headers: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Sanitized request headers',
    },

    // Response Details
    response_status: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    response_time: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Response time in milliseconds',
    },

    // Data Changes (before/after)
    changes: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Object containing before/after values of changed fields',
    },
    changes_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // IP and Location
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING(2),
      allowNull: true,
    },
    region: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // Device Information
    device_type: {
      type: DataTypes.ENUM('desktop', 'mobile', 'tablet', 'other'),
      allowNull: true,
    },
    device_os: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    device_browser: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Security Context
    security_events: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Security-related events (failed attempts, suspicious activity, etc.)',
    },
    risk_score: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
    },
    risk_level: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
      allowNull: true,
    },

    // Compliance Metadata
    compliance_tag: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'e.g., GDPR, PCI-DSS, AML, KYC',
    },
    retention_category: {
      type: DataTypes.ENUM('standard', 'high_security', 'regulatory'),
      defaultValue: 'standard',
      allowNull: false,
    },

    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
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
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    // Model options
    tableName: 'audit_logs',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['action'],
      },
      {
        fields: ['category'],
      },
      {
        fields: ['resource_type', 'resource_id'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['ip_address'],
      },
      {
        fields: ['risk_level'],
      },
      {
        fields: ['compliance_tag'],
      },
      {
        fields: ['actor_email'],
      },
      // For fast lookups by actor and time
      {
        fields: ['user_id', 'created_at'],
      },
      // For compliance queries
      {
        fields: ['compliance_tag', 'created_at'],
      },
      // For security dashboards
      {
        fields: ['risk_level', 'created_at'],
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating an audit log, calculate risk score and set expiry
       */
      beforeCreate: (log) => {
        // Calculate risk score based on action and category
        if (!log.risk_score || log.risk_score === 0) {
          log.risk_score = calculateRiskScore(log);
        }

        // Set risk level based on score
        if (!log.risk_level) {
          log.risk_level = getRiskLevel(log.risk_score);
        }

        // Set retention category
        if (!log.retention_category) {
          log.retention_category = getRetentionCategory(log);
        }

        // Set expiry date based on retention category
        if (!log.expires_at) {
          const expiryDays = getRetentionDays(log.retention_category);
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + expiryDays);
          log.expires_at = expiryDate;
        }

        // Sanitize request body (remove sensitive data)
        if (log.request_body) {
          log.request_body = sanitizeRequestBody(log.request_body);
        }
      },

      /**
       * After creating an audit log, log to console in development
       */
      afterCreate: async (log) => {
        if (process.env.NODE_ENV === 'development') {
          logger.debug(
            `[AUDIT] ${log.action} by ${log.actor_email || log.user_id || 'system'} ` +
            `- ${log.category} - ${log.resource_type || 'N/A'}`
          );
        }
      },
    },
  }
);

/**
 * Calculate risk score for an audit log entry
 * @param {Object} log - Audit log instance
 * @returns {number} - Risk score (0-100)
 */
const calculateRiskScore = (log) => {
  let score = 0;

  // Risk by category
  const categoryRisks = {
    authentication: 40,
    security: 60,
    admin: 50,
    payment: 30,
    betting: 20,
    wallet: 25,
    kyc: 35,
    data_access: 45,
    configuration: 30,
    other: 10,
  };
  score += categoryRisks[log.category] || 10;

  // Risk by action
  const actionRisks = {
    'login_failed': 30,
    'password_change': 20,
    'password_reset': 25,
    'two_factor_enable': 30,
    'two_factor_disable': 45,
    'user_suspended': 40,
    'user_banned': 50,
    'withdrawal_requested': 25,
    'withdrawal_approved': 20,
    'deposit_failed': 15,
    'bet_placed_high': 20,
    'admin_action': 35,
    'data_export': 40,
    'api_key_generated': 30,
    'api_key_revoked': 40,
  };
  const actionRisk = actionRisks[log.action] || 0;
  score += actionRisk;

  // Risk by IP (if flagged)
  if (log.security_events && log.security_events.flagged_ip) {
    score += 20;
  }

  // Cap at 100
  return Math.min(score, 100);
};

/**
 * Get risk level based on risk score
 * @param {number} score - Risk score
 * @returns {string} - Risk level
 */
const getRiskLevel = (score) => {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
};

/**
 * Get retention category based on audit log properties
 * @param {Object} log - Audit log instance
 * @returns {string} - Retention category
 */
const getRetentionCategory = (log) => {
  const highSecurityActions = [
    'login_failed',
    'password_change',
    'two_factor_enable',
    'two_factor_disable',
    'user_suspended',
    'user_banned',
    'admin_action',
    'data_export',
    'withdrawal_approved',
    'kyc_verified',
    'kyc_rejected',
  ];
  const regulatoryActions = [
    'payment',
    'withdrawal',
    'deposit',
    'kyc',
    'aml_check',
    'fraud_check',
  ];

  if (regulatoryActions.includes(log.category) || 
      regulatoryActions.some(term => log.action.includes(term))) {
    return 'regulatory';
  }
  if (highSecurityActions.includes(log.action)) {
    return 'high_security';
  }
  return 'standard';
};

/**
 * Get retention days based on retention category
 * @param {string} category - Retention category
 * @returns {number} - Retention days
 */
const getRetentionDays = (category) => {
  const retention = {
    standard: 90, // 3 months
    high_security: 365, // 1 year
    regulatory: 2190, // 6 years (for GDPR/AML compliance)
  };
  return retention[category] || 90;
};

/**
 * Sanitize request body to remove sensitive data
 * @param {string} body - Request body
 * @returns {string} - Sanitized body
 */
const sanitizeRequestBody = (body) => {
  if (!body) return body;
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    const sensitiveFields = [
      'password', 'password_hash', 'salt', 'token', 'secret',
      'card_number', 'cvv', 'cvc', 'expiry', 'pin',
      'private_key', 'api_key', 'access_key',
    ];
    const sanitizeObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      const result = { ...obj };
      for (const key of Object.keys(result)) {
        if (sensitiveFields.includes(key.toLowerCase())) {
          result[key] = '[REDACTED]';
        } else if (typeof result[key] === 'object') {
          result[key] = sanitizeObject(result[key]);
        }
      }
      return result;
    };
    const sanitized = sanitizeObject(parsed);
    return typeof body === 'string' ? JSON.stringify(sanitized) : sanitized;
  } catch {
    // If parsing fails, return as is (but truncate if too long)
    return typeof body === 'string' && body.length > 1000 ? body.substring(0, 1000) + '...' : body;
  }
};

/**
 * Instance methods
 */
AuditLog.prototype = {
  ...AuditLog.prototype,

  /**
   * Get log summary for display
   * @returns {Object} - Log summary
   */
  getSummary() {
    return {
      id: this.id,
      action: this.action,
      category: this.category,
      actorEmail: this.actor_email,
      actorRole: this.actor_role,
      actorIp: this.actor_ip,
      resourceType: this.resource_type,
      resourceIdentifier: this.resource_identifier,
      requestMethod: this.request_method,
      requestPath: this.request_path,
      responseStatus: this.response_status,
      riskScore: this.risk_score,
      riskLevel: this.risk_level,
      createdAt: this.created_at,
    };
  },

  /**
   * Get full log data for compliance reporting
   * @returns {Object} - Full log data
   */
  getFullData() {
    return {
      ...this.getSummary(),
      userId: this.user_id,
      requestQuery: this.request_query,
      requestBody: this.request_body,
      requestHeaders: this.request_headers,
      responseTime: this.response_time,
      changes: this.changes,
      changesSummary: this.changes_summary,
      country: this.country,
      region: this.region,
      city: this.city,
      deviceType: this.device_type,
      deviceOS: this.device_os,
      deviceBrowser: this.device_browser,
      securityEvents: this.security_events,
      complianceTag: this.compliance_tag,
      retentionCategory: this.retention_category,
      metadata: this.metadata,
      adminNotes: this.admin_notes,
      expiresAt: this.expires_at,
    };
  },

  /**
   * Get risk assessment summary
   * @returns {Object} - Risk assessment
   */
  getRiskAssessment() {
    return {
      score: this.risk_score,
      level: this.risk_level,
      action: this.action,
      category: this.category,
      recommendation: this.risk_score >= 70
        ? 'Immediate investigation required'
        : this.risk_score >= 50
        ? 'Review and follow up'
        : this.risk_score >= 30
        ? 'Monitor closely'
        : 'Routine monitoring',
    };
  },

  /**
   * Check if log entry is high risk
   * @returns {boolean} - Whether log is high risk
   */
  isHighRisk() {
    return this.risk_level === 'high' || this.risk_level === 'critical';
  },

  /**
   * Check if log entry is expired
   * @returns {boolean} - Whether log is expired
   */
  isExpired() {
    return this.expires_at && this.expires_at < new Date();
  },
};

/**
 * Static methods
 */
AuditLog.findByUser = async function(userId, options = {}) {
  const { limit = 50, offset = 0, category = null, action = null, startDate = null, endDate = null } = options;

  const where = { user_id: userId };
  if (category) where.category = category;
  if (action) where.action = action;
  if (startDate) where.created_at = { [sequelize.Op.gte]: startDate };
  if (endDate) where.created_at = { ...where.created_at, [sequelize.Op.lte]: endDate };

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });
};

AuditLog.findByAction = async function(action, options = {}) {
  const { limit = 50, offset = 0, userId = null, category = null } = options;

  const where = { action };
  if (userId) where.user_id = userId;
  if (category) where.category = category;

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });
};

AuditLog.findByResource = async function(resourceType, resourceId, options = {}) {
  const { limit = 50, offset = 0 } = options;

  return this.findAndCountAll({
    where: {
      resource_type: resourceType,
      resource_id: resourceId,
    },
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });
};

AuditLog.findRecentHighRisk = async function(limit = 100) {
  return this.findAll({
    where: {
      risk_level: {
        [sequelize.Op.in]: ['high', 'critical'],
      },
      created_at: {
        [sequelize.Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
    order: [
      ['risk_score', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit,
  });
};

AuditLog.findByCategory = async function(category, options = {}) {
  const { limit = 100, offset = 0, startDate = null, endDate = null } = options;

  const where = { category };
  if (startDate) where.created_at = { [sequelize.Op.gte]: startDate };
  if (endDate) where.created_at = { ...where.created_at, [sequelize.Op.lte]: endDate };

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });
};

AuditLog.findByIpAddress = async function(ipAddress, options = {}) {
  const { limit = 50, offset = 0 } = options;

  return this.findAndCountAll({
    where: {
      ip_address: ipAddress,
    },
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });
};

AuditLog.getStatistics = async function(options = {}) {
  const { startDate = null, endDate = null } = options;

  const where = {};
  if (startDate) where.created_at = { [sequelize.Op.gte]: startDate };
  if (endDate) where.created_at = { ...where.created_at, [sequelize.Op.lte]: endDate };

  const stats = await this.findAll({
    where,
    attributes: [
      'category',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('AVG', sequelize.col('risk_score')), 'avg_risk_score'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN risk_level IN (\'high\', \'critical\') THEN 1 END')), 'high_risk_count'],
    ],
    group: ['category'],
    raw: true,
  });

  const result = {
    total: 0,
    high_risk_total: 0,
    avg_risk_score: 0,
    by_category: {},
  };

  let totalScore = 0;
  let totalCount = 0;

  for (const row of stats) {
    const count = parseInt(row.count) || 0;
    const highRisk = parseInt(row.high_risk_count) || 0;
    const avgScore = parseFloat(row.avg_risk_score) || 0;

    result.total += count;
    result.high_risk_total += highRisk;
    result.by_category[row.category] = {
      count,
      high_risk: highRisk,
      avg_risk_score: avgScore,
    };

    totalScore += avgScore * count;
    totalCount += count;
  }

  result.avg_risk_score = totalCount > 0 ? totalScore / totalCount : 0;

  return result;
};

AuditLog.getActivityTimeline = async function(options = {}) {
  const { userId = null, category = null, days = 30 } = options;

  const where = {};
  if (userId) where.user_id = userId;
  if (category) where.category = category;
  where.created_at = {
    [sequelize.Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
  };

  const logs = await this.findAll({
    where,
    attributes: [
      [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN risk_level IN (\'high\', \'critical\') THEN 1 ELSE 0 END')), 'high_risk_count'],
    ],
    group: [sequelize.fn('DATE', sequelize.col('created_at'))],
    order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
    raw: true,
  });

  const timeline = {};
  for (const row of logs) {
    timeline[row.date] = {
      count: parseInt(row.count) || 0,
      high_risk: parseInt(row.high_risk_count) || 0,
    };
  }
  return timeline;
};

AuditLog.deleteExpiredLogs = async function() {
  const deletedCount = await this.destroy({
    where: {
      expires_at: {
        [sequelize.Op.lt]: new Date(),
      },
    },
  });
  logger.info(`Deleted ${deletedCount} expired audit logs`);
  return deletedCount;
};

// Export the model
module.exports = AuditLog;
