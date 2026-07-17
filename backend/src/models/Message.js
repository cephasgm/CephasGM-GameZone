/**
 * Message Model - User Messaging & Chat Management
 * CephasGM GameZone
 * 
 * This model manages all messaging between users, including direct messages,
 * support chat, group conversations, and admin communications. It supports
 * real-time messaging with read receipts, attachments, and thread management.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Message Model Definition
 */
const Message = sequelize.define(
  'Message',
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    // Conversation Association
    conversation_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'conversations',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },

    // Sender Association
    sender_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },

    // Message Type
    type: {
      type: DataTypes.ENUM(
        'text',
        'image',
        'file',
        'emoji',
        'system',
        'bet_share',
        'bet_alert',
        'support',
        'admin',
        'announcement'
      ),
      defaultValue: 'text',
      allowNull: false,
    },

    // Message Content
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 10000],
      },
    },
    formatted_content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Attachments
    attachments: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
      comment: 'Array of attachment objects with url, type, name, size',
    },

    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
      comment: 'Additional metadata like replied_to, forwarded_from, etc.',
    },

    // Read Receipts
    read_by: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
      comment: 'Array of user IDs who have read this message',
    },
    read_at: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
      comment: 'Map of user ID to timestamp when they read the message',
    },
    is_read_all: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },

    // Delivery Status
    delivered_to: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
      comment: 'Array of user IDs who have received this message',
    },
    delivered_at: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },

    // Reply/Thread
    replied_to: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'messages',
        key: 'id',
      },
    },
    reply_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },

    // Reactions
    reactions: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
      comment: 'Map of emoji to array of user IDs',
    },

    // System Message
    is_system: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    system_type: {
      type: DataTypes.ENUM(
        'user_joined',
        'user_left',
        'conversation_created',
        'bet_placed',
        'bet_won',
        'bet_lost',
        'admin_alert',
        'notification',
        'other'
      ),
      allowNull: true,
    },

    // Deletion
    deleted_by_sender: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    deleted_by_recipient: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    deleted_at: {
      type: DataTypes.DATE,
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
    sent_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false,
    },
    edited_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    // Model options
    tableName: 'messages',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      {
        fields: ['conversation_id'],
      },
      {
        fields: ['sender_id'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['sent_at'],
      },
      {
        fields: ['is_system'],
      },
      {
        fields: ['replied_to'],
        where: {
          replied_to: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        // For conversation message history
        fields: ['conversation_id', 'created_at'],
      },
      {
        // For unread message queries
        fields: ['conversation_id', 'is_read_all'],
      },
      {
        // For recipient queries
        fields: ['conversation_id', 'sender_id'],
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a message, set sent_at and validate
       */
      beforeCreate: (message) => {
        if (!message.sent_at) {
          message.sent_at = new Date();
        }

        // Set formatted content if not provided
        if (!message.formatted_content && message.content) {
          message.formatted_content = message.content;
        }

        // Initialize empty arrays for tracking
        if (!message.read_by) message.read_by = [];
        if (!message.delivered_to) message.delivered_to = [];
        if (!message.reactions) message.reactions = {};
      },

      /**
       * After creating a message, update conversation timestamp
       */
      afterCreate: async (message) => {
        try {
          const Conversation = sequelize.models.Conversation;
          if (Conversation) {
            await Conversation.update(
              {
                last_message_at: message.sent_at || message.created_at,
                last_message_preview: message.content.substring(0, 100),
                last_message_sender_id: message.sender_id,
                updated_at: new Date(),
              },
              {
                where: { id: message.conversation_id },
              }
            );
            logger.debug(
              `Message ${message.id} created in conversation ${message.conversation_id}`
            );
          }
        } catch (error) {
          logger.error('Error updating conversation from message:', error);
        }
      },
    },
  }
);

/**
 * Instance methods
 */
Message.prototype = {
  ...Message.prototype,

  /**
   * Mark message as read by a user
   * @param {string} userId - User ID who read the message
   * @returns {Promise<Message>} - Updated message
   */
  async markAsRead(userId) {
    if (!userId) return this;

    const readBy = this.read_by || [];
    const readAtMap = this.read_at || {};

    if (!readBy.includes(userId)) {
      readBy.push(userId);
      readAtMap[userId] = new Date();
      this.read_by = readBy;
      this.read_at = readAtMap;

      // Check if all participants have read it
      const Conversation = sequelize.models.Conversation;
      if (Conversation) {
        const conversation = await Conversation.findByPk(this.conversation_id, {
          attributes: ['participants'],
        });
        if (conversation && conversation.participants) {
          const participants = conversation.participants.filter(
            (p) => p !== this.sender_id
          );
          const allRead = participants.every((p) => readBy.includes(p));
          this.is_read_all = allRead;
        }
      }

      await this.save();
    }
    return this;
  },

  /**
   * Mark message as delivered to a user
   * @param {string} userId - User ID who received the message
   * @returns {Promise<Message>} - Updated message
   */
  async markAsDelivered(userId) {
    if (!userId) return this;

    const deliveredTo = this.delivered_to || [];
    const deliveredAtMap = this.delivered_at || {};

    if (!deliveredTo.includes(userId)) {
      deliveredTo.push(userId);
      deliveredAtMap[userId] = new Date();
      this.delivered_to = deliveredTo;
      this.delivered_at = deliveredAtMap;
      await this.save();
    }
    return this;
  },

  /**
   * Add a reaction to the message
   * @param {string} emoji - Emoji reaction
   * @param {string} userId - User ID adding the reaction
   * @returns {Promise<Message>} - Updated message
   */
  async addReaction(emoji, userId) {
    const reactions = this.reactions || {};
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }
    if (!reactions[emoji].includes(userId)) {
      reactions[emoji].push(userId);
      this.reactions = reactions;
      await this.save();
    }
    return this;
  },

  /**
   * Remove a reaction from the message
   * @param {string} emoji - Emoji reaction
   * @param {string} userId - User ID removing the reaction
   * @returns {Promise<Message>} - Updated message
   */
  async removeReaction(emoji, userId) {
    const reactions = this.reactions || {};
    if (reactions[emoji]) {
      reactions[emoji] = reactions[emoji].filter((id) => id !== userId);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
      this.reactions = reactions;
      await this.save();
    }
    return this;
  },

  /**
   * Edit message content
   * @param {string} newContent - New message content
   * @returns {Promise<Message>} - Updated message
   */
  async editContent(newContent) {
    if (this.is_system) {
      throw new Error('System messages cannot be edited');
    }

    this.content = newContent;
    this.formatted_content = newContent;
    this.edited_at = new Date();
    await this.save();
    return this;
  },

  /**
   * Soft delete the message
   * @param {string} userId - User ID requesting deletion
   * @returns {Promise<Message>} - Updated message
   */
  async softDelete(userId) {
    if (userId === this.sender_id) {
      this.deleted_by_sender = true;
    } else {
      this.deleted_by_recipient = true;
    }
    this.deleted_at = new Date();
    await this.save();
    return this;
  },

  /**
   * Check if message was sent by a user
   * @param {string} userId - User ID to check
   * @returns {boolean} - Whether user is the sender
   */
  isSentBy(userId) {
    return this.sender_id === userId;
  },

  /**
   * Check if message was read by a user
   * @param {string} userId - User ID to check
   * @returns {boolean} - Whether user has read the message
   */
  isReadBy(userId) {
    const readBy = this.read_by || [];
    return readBy.includes(userId);
  },

  /**
   * Get message preview (truncated content)
   * @param {number} length - Maximum length of preview
   * @returns {string} - Message preview
   */
  getPreview(length = 50) {
    if (!this.content) return '';
    if (this.content.length <= length) return this.content;
    return this.content.substring(0, length) + '...';
  },

  /**
   * Get formatted content with emojis and links
   * @returns {string} - Formatted content
   */
  getFormattedContent() {
    if (this.formatted_content) return this.formatted_content;
    return this.content;
  },

  /**
   * Get message summary for display
   * @returns {Object} - Message summary
   */
  getSummary() {
    return {
      id: this.id,
      conversationId: this.conversation_id,
      senderId: this.sender_id,
      type: this.type,
      content: this.content,
      preview: this.getPreview(),
      isSystem: this.is_system,
      systemType: this.system_type,
      readBy: this.read_by || [],
      isReadAll: this.is_read_all,
      reactions: this.reactions || {},
      attachments: this.attachments || [],
      sentAt: this.sent_at,
      editedAt: this.edited_at,
      createdAt: this.created_at,
    };
  },

  /**
   * Get full message data
   * @returns {Object} - Full message data
   */
  getFullData() {
    return {
      ...this.getSummary(),
      formattedContent: this.getFormattedContent(),
      deliveredTo: this.delivered_to || [],
      replyCount: this.reply_count,
      repliedTo: this.replied_to,
      metadata: this.metadata || {},
      deletedBySender: this.deleted_by_sender,
      deletedByRecipient: this.deleted_by_recipient,
      deletedAt: this.deleted_at,
    };
  },

  /**
   * Create a reply to this message
   * @param {Object} replyData - Reply message data
   * @returns {Promise<Message>} - Reply message
   */
  async createReply(replyData) {
    const reply = await Message.create({
      ...replyData,
      replied_to: this.id,
      conversation_id: this.conversation_id,
    });

    // Increment reply count
    this.reply_count = (this.reply_count || 0) + 1;
    await this.save();

    return reply;
  },
};

/**
 * Static methods
 */
Message.findByConversation = async function(conversationId, options = {}) {
  const { limit = 50, offset = 0, before = null, after = null, type = null } = options;

  const where = { conversation_id: conversationId };

  if (type) where.type = type;
  if (before) {
    where.sent_at = { [sequelize.Op.lt]: before };
  }
  if (after) {
    where.sent_at = { [sequelize.Op.gt]: after };
  }

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['sent_at', 'DESC']],
    include: [
      {
        model: sequelize.models.User,
        as: 'sender',
        attributes: ['id', 'first_name', 'last_name', 'email', 'username', 'avatar_url', 'vip_tier'],
      },
    ],
  });
};

Message.findUnreadByUser = async function(userId, conversationId = null) {
  const where = {
    [sequelize.Op.and]: [
      sequelize.literal(`NOT (read_by @> ARRAY['${userId}']::uuid[])`),
      { sender_id: { [sequelize.Op.ne]: userId } },
    ],
  };

  if (conversationId) {
    where.conversation_id = conversationId;
  }

  return this.findAll({
    where,
    include: [
      {
        model: sequelize.models.Conversation,
        attributes: ['id', 'participants'],
      },
    ],
    order: [['sent_at', 'ASC']],
  });
};

Message.findUnreadCountByUser = async function(userId) {
  const count = await this.count({
    where: {
      [sequelize.Op.and]: [
        sequelize.literal(`NOT (read_by @> ARRAY['${userId}']::uuid[])`),
        { sender_id: { [sequelize.Op.ne]: userId } },
      ],
    },
  });
  return count;
};

Message.findRecentByUser = async function(userId, limit = 50) {
  // Find messages in conversations where the user is a participant
  const Conversation = sequelize.models.Conversation;
  const conversations = await Conversation.findAll({
    where: {
      participants: {
        [sequelize.Op.contains]: [userId],
      },
    },
    attributes: ['id'],
  });

  const conversationIds = conversations.map((c) => c.id);

  if (conversationIds.length === 0) {
    return [];
  }

  return this.findAll({
    where: {
      conversation_id: {
        [sequelize.Op.in]: conversationIds,
      },
    },
    order: [['sent_at', 'DESC']],
    limit,
    include: [
      {
        model: sequelize.models.User,
        as: 'sender',
        attributes: ['id', 'first_name', 'last_name', 'email', 'username', 'avatar_url'],
      },
    ],
  });
};

Message.findBySender = async function(senderId, options = {}) {
  const { limit = 50, offset = 0 } = options;

  return this.findAndCountAll({
    where: { sender_id: senderId },
    limit,
    offset,
    order: [['sent_at', 'DESC']],
  });
};

Message.searchMessages = async function(query, userId, limit = 50) {
  const Conversation = sequelize.models.Conversation;

  const conversations = await Conversation.findAll({
    where: {
      participants: {
        [sequelize.Op.contains]: [userId],
      },
    },
    attributes: ['id'],
  });

  const conversationIds = conversations.map((c) => c.id);

  if (conversationIds.length === 0) {
    return [];
  }

  return this.findAll({
    where: {
      conversation_id: {
        [sequelize.Op.in]: conversationIds,
      },
      content: {
        [sequelize.Op.iLike]: `%${query}%`,
      },
    },
    order: [['sent_at', 'DESC']],
    limit,
    include: [
      {
        model: sequelize.models.User,
        as: 'sender',
        attributes: ['id', 'first_name', 'last_name', 'email', 'username', 'avatar_url'],
      },
    ],
  });
};

Message.markAllAsReadInConversation = async function(conversationId, userId) {
  const messages = await this.findAll({
    where: {
      conversation_id: conversationId,
      sender_id: { [sequelize.Op.ne]: userId },
      [sequelize.Op.and]: [
        sequelize.literal(`NOT (read_by @> ARRAY['${userId}']::uuid[])`),
      ],
    },
  });

  let updatedCount = 0;
  for (const message of messages) {
    await message.markAsRead(userId);
    updatedCount++;
  }

  return updatedCount;
};

Message.deleteOldMessages = async function(days = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const deletedCount = await this.destroy({
    where: {
      created_at: {
        [sequelize.Op.lt]: cutoffDate,
      },
    },
  });

  logger.info(`Deleted ${deletedCount} old messages older than ${days} days`);
  return deletedCount;
};

Message.getConversationStats = async function(conversationId) {
  const stats = await this.findOne({
    where: { conversation_id: conversationId },
    attributes: [
      [sequelize.fn('COUNT', sequelize.col('id')), 'total_messages'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_system THEN 1 END')), 'system_messages'],
      [sequelize.fn('COUNT', sequelize.literal('CASE WHEN NOT is_system THEN 1 END')), 'user_messages'],
      [sequelize.fn('MAX', sequelize.col('sent_at')), 'last_message_at'],
      [sequelize.fn('MIN', sequelize.col('sent_at')), 'first_message_at'],
    ],
    raw: true,
  });

  return {
    total_messages: parseInt(stats.total_messages) || 0,
    system_messages: parseInt(stats.system_messages) || 0,
    user_messages: parseInt(stats.user_messages) || 0,
    last_message_at: stats.last_message_at,
    first_message_at: stats.first_message_at,
  };
};

// Export the model
module.exports = Message;
