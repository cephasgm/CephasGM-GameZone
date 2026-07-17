/**
 * Message Routes - User Messaging API Routes
 * CephasGM GameZone
 * 
 * This module defines all messaging-related API routes including:
 * - Conversation management (list, create, get)
 * - Message sending and receiving
 * - Message read receipts
 * - Message reactions
 * - Message deletion
 * - Unread message counts
 * - Admin broadcast messages
 * - Conversation participants management
 * 
 * All routes are mounted under /api/v1/messages
 */

const express = require('express');
const router = express.Router();

// Import controllers
const messageController = require('../../controllers/messageController');

// Import middleware
const { authenticate } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../../middleware/admin');
const { messageRateLimit } = require('../../middleware/rateLimit');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// CONVERSATION MANAGEMENT ROUTES
// ============================================

/**
 * @route   GET /api/v1/messages/conversations
 * @desc    Get all conversations for current user
 * @access  Private
 */
router.get(
  '/conversations',
  authenticate,
  messageController.getConversations
);

/**
 * @route   GET /api/v1/messages/conversations/:conversationId
 * @desc    Get conversation by ID
 * @access  Private
 */
router.get(
  '/conversations/:conversationId',
  authenticate,
  validateParams(validationSchemas.idParam),
  messageController.getConversation
);

/**
 * @route   POST /api/v1/messages/conversations
 * @desc    Create a new conversation
 * @access  Private
 */
router.post(
  '/conversations',
  authenticate,
  sanitize({ strategy: 'strict' }),
  messageController.createConversation
);

/**
 * @route   GET /api/v1/messages/conversations/:conversationId/messages
 * @desc    Get conversation messages
 * @access  Private
 */
router.get(
  '/conversations/:conversationId/messages',
  authenticate,
  validateParams(validationSchemas.idParam),
  messageController.getConversationMessages
);

/**
 * @route   PUT /api/v1/messages/conversations/:conversationId/read
 * @desc    Mark conversation as read
 * @access  Private
 */
router.put(
  '/conversations/:conversationId/read',
  authenticate,
  validateParams(validationSchemas.idParam),
  messageController.markConversationRead
);

/**
 * @route   GET /api/v1/messages/conversations/:conversationId/unread-count
 * @desc    Get unread count for conversation
 * @access  Private
 */
router.get(
  '/conversations/:conversationId/unread-count',
  authenticate,
  validateParams(validationSchemas.idParam),
  messageController.getConversationUnreadCount
);

/**
 * @route   DELETE /api/v1/messages/conversations/:conversationId/leave
 * @desc    Leave a conversation
 * @access  Private
 */
router.delete(
  '/conversations/:conversationId/leave',
  authenticate,
  validateParams(validationSchemas.idParam),
  messageController.leaveConversation
);

// ============================================
// CONVERSATION PARTICIPANT ROUTES
// ============================================

/**
 * @route   POST /api/v1/messages/conversations/:conversationId/participants
 * @desc    Add participant to conversation
 * @access  Private
 */
router.post(
  '/conversations/:conversationId/participants',
  authenticate,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  messageController.addParticipant
);

/**
 * @route   DELETE /api/v1/messages/conversations/:conversationId/participants/:userId
 * @desc    Remove participant from conversation
 * @access  Private
 */
router.delete(
  '/conversations/:conversationId/participants/:userId',
  authenticate,
  validateParams(validationSchemas.idParam),
  messageController.removeParticipant
);

// ============================================
// MESSAGE MANAGEMENT ROUTES
// ============================================

/**
 * @route   POST /api/v1/messages
 * @desc    Send a message
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  messageRateLimit('send'),
  sanitize({ strategy: 'strict' }),
  messageController.sendMessage
);

/**
 * @route   GET /api/v1/messages/:messageId
 * @desc    Get message by ID
 * @access  Private
 */
router.get(
  '/:messageId',
  authenticate,
  validateParams(validationSchemas.idParam),
  messageController.getMessage
);

/**
 * @route   PUT /api/v1/messages/:messageId
 * @desc    Edit a message
 * @access  Private
 */
router.put(
  '/:messageId',
  authenticate,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  messageController.editMessage
);

/**
 * @route   DELETE /api/v1/messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
router.delete(
  '/:messageId',
  authenticate,
  validateParams(validationSchemas.idParam),
  messageController.deleteMessage
);

/**
 * @route   PUT /api/v1/messages/:messageId/read
 * @desc    Mark message as read
 * @access  Private
 */
router.put(
  '/:messageId/read',
  authenticate,
  validateParams(validationSchemas.idParam),
  messageController.markMessageRead
);

// ============================================
// MESSAGE REACTION ROUTES
// ============================================

/**
 * @route   POST /api/v1/messages/:messageId/reactions
 * @desc    Add reaction to a message
 * @access  Private
 */
router.post(
  '/:messageId/reactions',
  authenticate,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  messageController.addReaction
);

/**
 * @route   DELETE /api/v1/messages/:messageId/reactions/:emoji
 * @desc    Remove reaction from a message
 * @access  Private
 */
router.delete(
  '/:messageId/reactions/:emoji',
  authenticate,
  validateParams(validationSchemas.idParam),
  messageController.removeReaction
);

// ============================================
// MESSAGE SEARCH & STATISTICS ROUTES
// ============================================

/**
 * @route   GET /api/v1/messages/search
 * @desc    Search messages
 * @access  Private
 */
router.get(
  '/search',
  authenticate,
  messageController.searchMessages
);

/**
 * @route   GET /api/v1/messages/unread/count
 * @desc    Get total unread message count
 * @access  Private
 */
router.get(
  '/unread/count',
  authenticate,
  messageController.getTotalUnreadCount
);

/**
 * @route   GET /api/v1/messages/stats
 * @desc    Get message statistics
 * @access  Private
 */
router.get(
  '/stats',
  authenticate,
  messageController.getMessageStats
);

// ============================================
// ADMIN MESSAGE ROUTES
// ============================================

/**
 * @route   POST /api/v1/messages/admin/broadcast
 * @desc    Broadcast message to all users (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/broadcast',
  authenticate,
  requireAdmin,
  sanitize({ strategy: 'strict' }),
  messageController.broadcastMessage
);

/**
 * @route   GET /api/v1/messages/admin/analytics
 * @desc    Get conversation analytics (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/analytics',
  authenticate,
  requireAdmin,
  messageController.getConversationAnalytics
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
