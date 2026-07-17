/**
 * Message Controller - User Messaging HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all messaging-related HTTP requests including:
 * - Conversation management (list, create, get)
 * - Message sending and receiving
 * - Message read receipts
 * - Message reactions
 * - Message deletion
 * - Unread message counts
 * - Admin broadcast messages
 * - Conversation participants management
 */

const messageService = require('../services/messageService');
const { catchAsync, createValidationError, createNotFoundError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// CONVERSATION MANAGEMENT
// ============================================

/**
 * Get all conversations for current user
 * GET /api/v1/messages/conversations
 */
const getConversations = catchAsync(async (req, res) => {
  const { limit = 50, offset = 0 } = req.query;

  const result = await messageService.getUserConversations(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      conversations: result.conversations,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get conversation by ID
 * GET /api/v1/messages/conversations/:conversationId
 */
const getConversation = catchAsync(async (req, res) => {
  const { conversationId } = req.params;

  const conversation = await messageService.getConversation(conversationId, req.user.id);

  if (!conversation) {
    throw createNotFoundError('Conversation', conversationId);
  }

  res.status(200).json({
    success: true,
    data: {
      conversation,
    },
  });
});

/**
 * Create a new conversation
 * POST /api/v1/messages/conversations
 */
const createConversation = catchAsync(async (req, res) => {
  const { participants, name = null, isGroup = false } = req.body;

  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    throw createValidationError('At least one participant is required');
  }

  // Add current user as participant if not already included
  if (!participants.includes(req.user.id)) {
    participants.push(req.user.id);
  }

  const conversation = await messageService.createConversation({
    participants,
    name,
    isGroup,
    createdBy: req.user.id,
  }, req);

  res.status(201).json({
    success: true,
    message: 'Conversation created successfully',
    data: {
      conversation,
    },
  });
});

/**
 * Get conversation messages
 * GET /api/v1/messages/conversations/:conversationId/messages
 */
const getConversationMessages = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const { limit = 50, offset = 0, before = null, after = null } = req.query;

  const result = await messageService.getConversationMessages(conversationId, req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    before,
    after,
  });

  res.status(200).json({
    success: true,
    data: {
      messages: result.messages,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Mark conversation as read
 * PUT /api/v1/messages/conversations/:conversationId/read
 */
const markConversationRead = catchAsync(async (req, res) => {
  const { conversationId } = req.params;

  const count = await messageService.markConversationRead(conversationId, req.user.id);

  res.status(200).json({
    success: true,
    message: `${count} messages marked as read`,
    data: {
      count,
    },
  });
});

/**
 * Get unread count for conversation
 * GET /api/v1/messages/conversations/:conversationId/unread-count
 */
const getConversationUnreadCount = catchAsync(async (req, res) => {
  const { conversationId } = req.params;

  const count = await messageService.getConversationUnreadCount(conversationId, req.user.id);

  res.status(200).json({
    success: true,
    data: {
      count,
    },
  });
});

/**
 * Leave a conversation
 * DELETE /api/v1/messages/conversations/:conversationId/leave
 */
const leaveConversation = catchAsync(async (req, res) => {
  const { conversationId } = req.params;

  await messageService.leaveConversation(conversationId, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Left conversation successfully',
  });
});

/**
 * Add participant to conversation
 * POST /api/v1/messages/conversations/:conversationId/participants
 */
const addParticipant = catchAsync(async (req, res) => {
  const { conversationId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    throw createValidationError('User ID is required');
  }

  const conversation = await messageService.addParticipant(conversationId, userId, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Participant added successfully',
    data: {
      conversation,
    },
  });
});

/**
 * Remove participant from conversation
 * DELETE /api/v1/messages/conversations/:conversationId/participants/:userId
 */
const removeParticipant = catchAsync(async (req, res) => {
  const { conversationId, userId } = req.params;

  const conversation = await messageService.removeParticipant(conversationId, userId, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Participant removed successfully',
    data: {
      conversation,
    },
  });
});

// ============================================
// MESSAGE MANAGEMENT
// ============================================

/**
 * Send a message
 * POST /api/v1/messages
 */
const sendMessage = catchAsync(async (req, res) => {
  const { conversationId, content, type = 'text', attachments = [], metadata = {} } = req.body;

  if (!conversationId) {
    throw createValidationError('Conversation ID is required');
  }

  if (!content) {
    throw createValidationError('Message content is required');
  }

  const message = await messageService.sendMessage({
    conversationId,
    senderId: req.user.id,
    content,
    type,
    attachments,
    metadata,
  }, req);

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: {
      message,
    },
  });
});

/**
 * Get message by ID
 * GET /api/v1/messages/:messageId
 */
const getMessage = catchAsync(async (req, res) => {
  const { messageId } = req.params;

  const message = await messageService.getMessage(messageId, req.user.id);

  if (!message) {
    throw createNotFoundError('Message', messageId);
  }

  res.status(200).json({
    success: true,
    data: {
      message,
    },
  });
});

/**
 * Edit a message
 * PUT /api/v1/messages/:messageId
 */
const editMessage = catchAsync(async (req, res) => {
  const { messageId } = req.params;
  const { content } = req.body;

  if (!content) {
    throw createValidationError('Message content is required');
  }

  const message = await messageService.editMessage(messageId, req.user.id, content, req);

  res.status(200).json({
    success: true,
    message: 'Message edited successfully',
    data: {
      message,
    },
  });
});

/**
 * Delete a message
 * DELETE /api/v1/messages/:messageId
 */
const deleteMessage = catchAsync(async (req, res) => {
  const { messageId } = req.params;

  await messageService.deleteMessage(messageId, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Message deleted successfully',
  });
});

/**
 * Mark message as read
 * PUT /api/v1/messages/:messageId/read
 */
const markMessageRead = catchAsync(async (req, res) => {
  const { messageId } = req.params;

  const message = await messageService.markMessageRead(messageId, req.user.id);

  res.status(200).json({
    success: true,
    message: 'Message marked as read',
    data: {
      message,
    },
  });
});

// ============================================
// MESSAGE REACTIONS
// ============================================

/**
 * Add reaction to a message
 * POST /api/v1/messages/:messageId/reactions
 */
const addReaction = catchAsync(async (req, res) => {
  const { messageId } = req.params;
  const { emoji } = req.body;

  if (!emoji) {
    throw createValidationError('Emoji is required');
  }

  const message = await messageService.addReaction(messageId, req.user.id, emoji);

  res.status(200).json({
    success: true,
    message: 'Reaction added successfully',
    data: {
      message,
    },
  });
});

/**
 * Remove reaction from a message
 * DELETE /api/v1/messages/:messageId/reactions/:emoji
 */
const removeReaction = catchAsync(async (req, res) => {
  const { messageId, emoji } = req.params;

  const message = await messageService.removeReaction(messageId, req.user.id, emoji);

  res.status(200).json({
    success: true,
    message: 'Reaction removed successfully',
    data: {
      message,
    },
  });
});

// ============================================
// MESSAGE SEARCH & STATISTICS
// ============================================

/**
 * Search messages
 * GET /api/v1/messages/search
 */
const searchMessages = catchAsync(async (req, res) => {
  const { q, limit = 50, offset = 0 } = req.query;

  if (!q || q.length < 2) {
    throw createValidationError('Search query must be at least 2 characters');
  }

  const result = await messageService.searchMessages(req.user.id, q, {
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      messages: result.messages,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get total unread message count
 * GET /api/v1/messages/unread/count
 */
const getTotalUnreadCount = catchAsync(async (req, res) => {
  const count = await messageService.getTotalUnreadCount(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      count,
    },
  });
});

/**
 * Get message statistics
 * GET /api/v1/messages/stats
 */
const getMessageStats = catchAsync(async (req, res) => {
  const stats = await messageService.getMessageStats(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      stats,
    },
  });
});

// ============================================
// ADMIN MESSAGE OPERATIONS
// ============================================

/**
 * Broadcast message to all users (admin only)
 * POST /api/v1/messages/admin/broadcast
 */
const broadcastMessage = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can broadcast messages');
  }

  const { content, type = 'text', attachments = [], metadata = {} } = req.body;

  if (!content) {
    throw createValidationError('Message content is required');
  }

  const result = await messageService.broadcastMessage({
    senderId: req.user.id,
    content,
    type,
    attachments,
    metadata,
  }, req);

  res.status(201).json({
    success: true,
    message: `Broadcast message sent to ${result.totalUsers} users`,
    data: {
      result,
    },
  });
});

/**
 * Get conversation analytics (admin only)
 * GET /api/v1/messages/admin/analytics
 */
const getConversationAnalytics = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view conversation analytics');
  }

  const { startDate = null, endDate = null } = req.query;

  const analytics = await messageService.getConversationAnalytics({
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: {
      analytics,
    },
  });
});

// Export all controller methods
module.exports = {
  // Conversation Management
  getConversations,
  getConversation,
  createConversation,
  getConversationMessages,
  markConversationRead,
  getConversationUnreadCount,
  leaveConversation,
  addParticipant,
  removeParticipant,

  // Message Management
  sendMessage,
  getMessage,
  editMessage,
  deleteMessage,
  markMessageRead,

  // Reactions
  addReaction,
  removeReaction,

  // Search & Statistics
  searchMessages,
  getTotalUnreadCount,
  getMessageStats,

  // Admin
  broadcastMessage,
  getConversationAnalytics,
};
