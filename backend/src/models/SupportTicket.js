/**
 * SupportTicket Model - Customer Support Ticket Management
 * CephasGM GameZone
 * 
 * This model manages all customer support tickets including user inquiries,
 * issue reporting, complaint handling, and support resolution. It supports
 * ticket categorization, priority levels, status tracking, and agent assignment.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * SupportTicket Model Definition
 */
const SupportTicket = sequelize.define(
  'SupportTicket',
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
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },

    // Agent Association (assigned support agent)
    assigned_to: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },

    // Ticket Identification
    ticket_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    reference: {
      type: DataTypes.STRING(50),
      allowNull: true,
      unique: true,
    },

    // Ticket Category
    category: {
      type: DataTypes.ENUM(
        'account',
        'deposit',
        'withdrawal',
        'betting',
        'bonus',
        'promotion',
        'technical',
        'security',
        'kyc',
        'complaint',
        'feedback',
        'general',
        'other'
      ),
      allowNull: false,
      defaultValue: 'general',
    },

    // Sub-category (for more specific categorization)
    sub_category: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Ticket Priority
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high', 'urgent', 'critical'),
      defaultValue: 'normal',
      allowNull: false,
    },

    // Ticket Status
    status: {
      type: DataTypes.ENUM(
        'new',
        'open',
        'pending',
        'in_progress',
        'on_hold',
        'resolved',
        'closed',
        'reopened'
      ),
      defaultValue: 'new',
      allowNull: false,
    },

    // Ticket Content
    subject: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 255],
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 10000],
      },
    },

    // Additional Details (JSON)
    details: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
      comment: 'Additional fields like browser, device, steps to reproduce, etc.',
    },

    // Attachments
    attachments: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
      comment: 'Array of attachment objects with url, name, size, type',
    },

    // Resolution
    resolution: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Closure
    closed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    closed_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    closure_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // Satisfaction
    satisfaction_rating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5,
      },
    },
    satisfaction_feedback: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500],
      },
    },

    // Ticket Metrics
    response_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    agent_response_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    user_response_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    first_response_time: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Time in minutes to first response',
    },
    resolution_time: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Time in minutes to resolution',
    },

    // Escalation
    escalated_to: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    escalated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    escalation_reason: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // Tags (for categorization and search)
    tags: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },

    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },

    // Admin Notes
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    internal_notes: {
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
    escalated_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_activity_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    // Model options
    tableName: 'support_tickets',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['assigned_to'],
      },
      {
        fields: ['ticket_number'],
        unique: true,
      },
      {
        fields: ['reference'],
        unique: true,
        where: {
          reference: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        fields: ['category'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['priority'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['resolved_at'],
        where: {
          resolved_at: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        // For dashboard queries
        fields: ['status', 'priority'],
      },
      {
        // For agent assignment queries
        fields: ['assigned_to', 'status'],
      },
      {
        // For user ticket history
        fields: ['user_id', 'status'],
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a ticket, generate ticket number
       */
      beforeCreate: async (ticket) => {
        if (!ticket.ticket_number) {
          ticket.ticket_number = await generateTicketNumber();
        }
        if (!ticket.reference) {
          ticket.reference = generateTicketReference();
        }
        if (!ticket.last_activity_at) {
          ticket.last_activity_at = new Date();
        }

        // Set priority based on category if not explicitly set
        if (ticket.priority === 'normal') {
          const priorityMap = {
            withdrawal: 'high',
            deposit: 'high',
            security: 'urgent',
            kyc: 'high',
            complaint: 'high',
            technical: 'normal',
            account: 'normal',
            bonus: 'normal',
            promotion: 'normal',
            betting: 'normal',
            feedback: 'low',
            general: 'normal',
            other: 'normal',
          };
          ticket.priority = priorityMap[ticket.category] || 'normal';
        }

        logger.info(
          `Support ticket created: ${ticket.ticket_number} - ${ticket.subject}`
        );
      },

      /**
       * Before updating a ticket, handle status changes
       */
      beforeUpdate: (ticket) => {
        // Handle status changes
        if (ticket.changed('status')) {
          const newStatus = ticket.status;
          if (newStatus === 'resolved' && !ticket.resolved_at) {
            ticket.resolved_at = new Date();
          }
          if (newStatus === 'closed' && !ticket.closed_at) {
            ticket.closed_at = new Date();
          }
          if (newStatus === 'reopened') {
            ticket.resolved_at = null;
            ticket.closed_at = null;
          }
        }

        // Handle escalation
        if (ticket.changed('escalated_to') && ticket.escalated_to && !ticket.escalated_at) {
          ticket.escalated_at = new Date();
        }

        // Update last activity
        ticket.last_activity_at = new Date();
      },

      /**
       * After updating a ticket, log status changes
       */
      afterUpdate: async (ticket) => {
        if (ticket.changed('status')) {
          logger.info(
            `Ticket ${ticket.ticket_number} status changed to ${ticket.status}`
          );
        }
      },
    },
  }
);

/**
 * Generate a unique ticket number
 * @returns {string} - Unique ticket number
 */
const generateTicketNumber = async () => {
  const prefix = 'TKT';
  const year = new Date().getFullYear().toString().slice(-2);
  const month = String(new Date().getMonth() + 1).padStart(2, '0');

  // Find the next sequential number
  const lastTicket = await SupportTicket.findOne({
    order: [['created_at', 'DESC']],
    attributes: ['ticket_number'],
  });

  let sequence = 1;
  if (lastTicket && lastTicket.ticket_number) {
    const parts = lastTicket.ticket_number.split('-');
    if (parts.length === 3) {
      const lastSeq = parseInt(parts[2]);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }
  }

  return `${prefix}-${year}${month}-${String(sequence).padStart(5, '0')}`;
};

/**
 * Generate a ticket reference
 * @returns {string} - Ticket reference
 */
const generateTicketReference = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let ref = '';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `REF-${ref}`;
};

/**
 * Instance methods
 */
SupportTicket.prototype = {
  ...SupportTicket.prototype,

  /**
   * Check if ticket is open
   * @returns {boolean} - Whether ticket is open
   */
  isOpen() {
    return ['new', 'open', 'pending', 'in_progress', 'on_hold', 'reopened'].includes(
      this.status
    );
  },

  /**
   * Check if ticket is closed
   * @returns {boolean} - Whether ticket is closed
   */
  isClosed() {
    return ['resolved', 'closed'].includes(this.status);
  },

  /**
   * Check if ticket is assigned
   * @returns {boolean} - Whether ticket is assigned
   */
  isAssigned() {
    return !!this.assigned_to;
  },

  /**
   * Assign ticket to an agent
   * @param {string} agentId - Agent user ID
   * @returns {Promise<SupportTicket>} - Updated ticket
   */
  async assignTo(agentId) {
    this.assigned_to = agentId;
    if (this.status === 'new') {
      this.status = 'open';
    }
    this.last_activity_at = new Date();
    await this.save();
    logger.info(`Ticket ${this.ticket_number} assigned to agent ${agentId}`);
    return this;
  },

  /**
   * Escalate ticket
   * @param {string} agentId - Escalation agent ID
   * @param {string} reason - Escalation reason
   * @returns {Promise<SupportTicket>} - Updated ticket
   */
  async escalateTo(agentId, reason) {
    this.escalated_to = agentId;
    this.escalation_reason = reason;
    this.escalated_at = new Date();
    this.priority = 'high'; // Automatically escalate priority
    this.status = 'on_hold';
    this.last_activity_at = new Date();
    await this.save();
    logger.info(`Ticket ${this.ticket_number} escalated to agent ${agentId}`);
    return this;
  },

  /**
   * Resolve ticket
   * @param {string} resolution - Resolution details
   * @param {string} agentId - Agent ID resolving the ticket
   * @returns {Promise<SupportTicket>} - Updated ticket
   */
  async resolve(resolution, agentId = null) {
    this.resolution = resolution;
    this.status = 'resolved';
    this.resolved_at = new Date();
    if (agentId) {
      this.closed_by = agentId;
    }
    this.last_activity_at = new Date();

    // Calculate resolution time
    if (this.created_at) {
      const resolutionMinutes = Math.floor(
        (this.resolved_at - this.created_at) / (1000 * 60)
      );
      this.resolution_time = resolutionMinutes;
    }

    await this.save();
    logger.info(`Ticket ${this.ticket_number} resolved`);
    return this;
  },

  /**
   * Close ticket
   * @param {string} reason - Closure reason
   * @param {string} agentId - Agent ID closing the ticket
   * @returns {Promise<SupportTicket>} - Updated ticket
   */
  async close(reason, agentId = null) {
    if (this.status !== 'resolved') {
      throw new Error('Ticket must be resolved before closing');
    }
    this.status = 'closed';
    this.closed_at = new Date();
    this.closure_reason = reason;
    if (agentId) {
      this.closed_by = agentId;
    }
    this.last_activity_at = new Date();
    await this.save();
    logger.info(`Ticket ${this.ticket_number} closed`);
    return this;
  },

  /**
   * Reopen ticket
   * @param {string} reason - Reopen reason
   * @returns {Promise<SupportTicket>} - Updated ticket
   */
  async reopen(reason) {
    if (this.isOpen()) {
      throw new Error('Ticket is already open');
    }
    this.status = 'reopened';
    this.resolved_at = null;
    this.closed_at = null;
    this.resolution = null;
    this.last_activity_at = new Date();
    // Add reopen reason as a tag or note
    const tags = this.tags || [];
    if (!tags.includes('reopened')) {
      tags.push('reopened');
    }
    this.tags = tags;
    await this.save();
    logger.info(`Ticket ${this.ticket_number} reopened: ${reason}`);
    return this;
  },

  /**
   * Add a response to the ticket
   * @param {string} userId - User ID of responder
   * @param {string} message - Response message
   * @param {Object} options - Additional options (isInternal, attachments, etc.)
   * @returns {Promise<Object>} - Response object
   */
  async addResponse(userId, message, options = {}) {
    const { isInternal = false, attachments = [] } = options;

    // Create response record (in a real implementation, this would be a separate model)
    const response = {
      id: `${this.id}_${this.response_count + 1}`,
      userId,
      message,
      isInternal,
      attachments,
      createdAt: new Date(),
    };

    // Update ticket metrics
    this.response_count = (this.response_count || 0) + 1;
    if (userId === this.user_id) {
      this.user_response_count = (this.user_response_count || 0) + 1;
    } else {
      this.agent_response_count = (this.agent_response_count || 0) + 1;
      // Set first response time if not set
      if (!this.first_response_time && this.status !== 'new') {
        const responseMinutes = Math.floor(
          (new Date() - this.created_at) / (1000 * 60)
        );
        this.first_response_time = responseMinutes;
      }
    }

    // Update status
    if (this.status === 'new') {
      this.status = 'open';
    }
    if (this.status === 'resolved' || this.status === 'closed') {
      this.status = 'reopened';
    }

    this.last_activity_at = new Date();
    await this.save();

    logger.debug(
      `Response added to ticket ${this.ticket_number} by user ${userId}`
    );

    return response;
  },

  /**
   * Submit satisfaction rating
   * @param {number} rating - Rating from 1-5
   * @param {string} feedback - Optional feedback
   * @returns {Promise<SupportTicket>} - Updated ticket
   */
  async submitSatisfaction(rating, feedback = '') {
    if (this.status !== 'resolved' && this.status !== 'closed') {
      throw new Error('Satisfaction can only be submitted for resolved or closed tickets');
    }
    this.satisfaction_rating = rating;
    this.satisfaction_feedback = feedback;
    await this.save();
    logger.info(
      `Satisfaction rating ${rating} submitted for ticket ${this.ticket_number}`
    );
    return this;
  },

  /**
   * Get ticket status display name
   * @returns {string} - Display name
   */
  getStatusDisplay() {
    const statusMap = {
      new: '🆕 New',
      open: '📬 Open',
      pending: '⏳ Pending',
      in_progress: '🔄 In Progress',
      on_hold: '⏸️ On Hold',
      resolved: '✅ Resolved',
      closed: '📦 Closed',
      reopened: '🔄 Reopened',
    };
    return statusMap[this.status] || this.status;
  },

  /**
   * Get priority display name
   * @returns {string} - Display name
   */
  getPriorityDisplay() {
    const priorityMap = {
      low: '🟢 Low',
      normal: '🔵 Normal',
      high: '🟡 High',
      urgent: '🟠 Urgent',
      critical: '🔴 Critical',
    };
    return priorityMap[this.priority] || this.priority;
  },

  /**
   * Get category display name
   * @returns {string} - Display name
   */
  getCategoryDisplay() {
    const categoryMap = {
      account: '👤 Account',
      deposit: '💰 Deposit',
      withdrawal: '💳 Withdrawal',
      betting: '⚽ Betting',
      bonus: '🎁 Bonus',
      promotion: '🎯 Promotion',
      technical: '⚙️ Technical',
      security: '🔒 Security',
      kyc: '🛡️ KYC',
      complaint: '📝 Complaint',
      feedback: '💬 Feedback',
      general: '📋 General',
      other: '📦 Other',
    };
    return categoryMap[this.category] || this.category;
  },

  /**
   * Get ticket summary for display
   * @returns {Object} - Ticket summary
   */
  getSummary() {
    return {
      id: this.id,
      ticketNumber: this.ticket_number,
      reference: this.reference,
      subject: this.subject,
      category: this.category,
      categoryDisplay: this.getCategoryDisplay(),
      status: this.status,
      statusDisplay: this.getStatusDisplay(),
      priority: this.priority,
      priorityDisplay: this.getPriorityDisplay(),
      userId: this.user_id,
      assignedTo: this.assigned_to,
      createdAt: this.created_at,
      lastActivityAt: this.last_activity_at,
      responseCount: this.response_count,
      isOpen: this.isOpen(),
      isClosed: this.isClosed(),
    };
  },

  /**
   * Get full ticket data
   * @returns {Object} - Full ticket data
   */
  getFullData() {
    return {
      ...this.getSummary(),
      description: this.description,
      details: this.details,
      attachments: this.attachments,
      resolution: this.resolution,
      resolvedAt: this.resolved_at,
      closedAt: this.closed_at,
      closureReason: this.closure_reason,
      satisfactionRating: this.satisfaction_rating,
      satisfactionFeedback: this.satisfaction_feedback,
      firstResponseTime: this.first_response_time,
      resolutionTime: this.resolution_time,
      escalatedTo: this.escalated_to,
      escalatedAt: this.escalated_at,
      escalationReason: this.escalation_reason,
      tags: this.tags,
      adminNotes: this.admin_notes,
      internalNotes: this.internal_notes,
    };
  },
};

/**
 * Static methods
 */
SupportTicket.findByUser = async function(userId, options = {}) {
  const {
    limit = 50,
    offset = 0,
    status = null,
    category = null,
    startDate = null,
    endDate = null,
  } = options;

  const where = { user_id: userId };
  if (status) where.status = status;
  if (category) where.category = category;
  if (startDate) where.created_at = { [sequelize.Op.gte]: startDate };
  if (endDate) where.created_at = { ...where.created_at, [sequelize.Op.lte]: endDate };

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });
};

SupportTicket.findByTicketNumber = async function(ticketNumber) {
  return this.findOne({
    where: { ticket_number: ticketNumber },
  });
};

SupportTicket.findByReference = async function(reference) {
  return this.findOne({
    where: { reference: reference },
  });
};

SupportTicket.findOpenTickets = async function(options = {}) {
  const { limit = 100, offset = 0, assignedTo = null, priority = null } = options;

  const where = {
    status: {
      [sequelize.Op.in]: ['new', 'open', 'pending', 'in_progress', 'on_hold', 'reopened'],
    },
  };
  if (assignedTo) where.assigned_to = assignedTo;
  if (priority) where.priority = priority;

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['priority', 'DESC'],
      ['created_at', 'ASC'],
    ],
  });
};

SupportTicket.findUnassignedTickets = async function(limit = 50) {
  return this.findAll({
    where: {
      status: {
        [sequelize.Op.in]: ['new', 'open', 'pending'],
      },
      assigned_to: null,
    },
    order: [
      ['priority', 'DESC'],
      ['created_at', 'ASC'],
    ],
    limit,
  });
};

SupportTicket.findTicketsByAgent = async function(agentId, options = {}) {
  const { limit = 50, offset = 0, status = null } = options;

  const where = { assigned_to: agentId };
  if (status) where.status = status;

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['priority', 'DESC'],
      ['created_at', 'ASC'],
    ],
  });
};

SupportTicket.getTicketStats = async function() {
  const stats = await this.findAll({
    attributes: [
      'status',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('AVG', sequelize.col('resolution_time')), 'avg_resolution_time'],
      [sequelize.fn('AVG', sequelize.col('first_response_time')), 'avg_first_response_time'],
    ],
    group: ['status'],
    raw: true,
  });

  const result = {
    total: 0,
    open: 0,
    resolved: 0,
    closed: 0,
    avg_resolution_time: 0,
    avg_first_response_time: 0,
    by_status: {},
  };

  let totalResolutionTime = 0;
  let totalResolutionCount = 0;
  let totalFirstResponseTime = 0;
  let totalFirstResponseCount = 0;

  for (const row of stats) {
    const count = parseInt(row.count) || 0;
    result.total += count;
    if (row.status === 'new' || row.status === 'open' || row.status === 'pending' ||
        row.status === 'in_progress' || row.status === 'on_hold' || row.status === 'reopened') {
      result.open += count;
    } else if (row.status === 'resolved') {
      result.resolved += count;
    } else if (row.status === 'closed') {
      result.closed += count;
    }

    result.by_status[row.status] = {
      count,
      avg_resolution_time: parseFloat(row.avg_resolution_time) || 0,
      avg_first_response_time: parseFloat(row.avg_first_response_time) || 0,
    };

    if (row.avg_resolution_time) {
      totalResolutionTime += parseFloat(row.avg_resolution_time) * count;
      totalResolutionCount += count;
    }
    if (row.avg_first_response_time) {
      totalFirstResponseTime += parseFloat(row.avg_first_response_time) * count;
      totalFirstResponseCount += count;
    }
  }

  result.avg_resolution_time =
    totalResolutionCount > 0 ? totalResolutionTime / totalResolutionCount : 0;
  result.avg_first_response_time =
    totalFirstResponseCount > 0 ? totalFirstResponseTime / totalFirstResponseCount : 0;

  return result;
};

SupportTicket.getTicketsByCategory = async function() {
  const stats = await this.findAll({
    attributes: [
      'category',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.literal('CASE WHEN status IN (\'new\', \'open\', \'pending\', \'in_progress\', \'on_hold\', \'reopened\') THEN 1 ELSE 0 END')), 'open_count'],
    ],
    group: ['category'],
    raw: true,
  });

  const result = {};
  for (const row of stats) {
    result[row.category] = {
      total: parseInt(row.count) || 0,
      open: parseInt(row.open_count) || 0,
    };
  }
  return result;
};

SupportTicket.getTicketVolumeByDate = async function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await this.findAll({
    attributes: [
      [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    where: {
      created_at: {
        [sequelize.Op.gte]: startDate,
      },
    },
    group: [sequelize.fn('DATE', sequelize.col('created_at'))],
    order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
    raw: true,
  });

  const result = {};
  for (const row of stats) {
    result[row.date] = parseInt(row.count) || 0;
  }
  return result;
};

// Export the model
module.exports = SupportTicket;
