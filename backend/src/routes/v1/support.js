/**
 * Support Routes - Customer Support API Routes
 * CephasGM GameZone
 * 
 * This module defines all support-related API routes including:
 * - Support ticket creation and management
 * - Ticket listing and filtering
 * - Ticket responses and updates
 * - Ticket assignment (admin)
 * - Ticket escalation (admin)
 * - Ticket resolution and closure
 * - Satisfaction surveys
 * - Support analytics (admin)
 * 
 * All routes are mounted under /api/v1/support
 */

const express = require('express');
const router = express.Router();

// Import controllers
const supportController = require('../../controllers/supportController');

// Import middleware
const { authenticate } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin } = require('../../middleware/admin');
const { supportRateLimit } = require('../../middleware/rateLimit');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// USER SUPPORT ROUTES
// ============================================

/**
 * @route   POST /api/v1/support/tickets
 * @desc    Create a support ticket
 * @access  Private
 */
router.post(
  '/tickets',
  authenticate,
  supportRateLimit('create'),
  sanitize({ strategy: 'strict' }),
  supportController.createTicket
);

/**
 * @route   GET /api/v1/support/tickets
 * @desc    Get user's support tickets
 * @access  Private
 */
router.get(
  '/tickets',
  authenticate,
  supportController.getUserTickets
);

/**
 * @route   GET /api/v1/support/tickets/:ticketId
 * @desc    Get ticket by ID
 * @access  Private
 */
router.get(
  '/tickets/:ticketId',
  authenticate,
  validateParams(validationSchemas.idParam),
  supportController.getTicket
);

/**
 * @route   GET /api/v1/support/tickets/number/:ticketNumber
 * @desc    Get ticket by ticket number
 * @access  Private
 */
router.get(
  '/tickets/number/:ticketNumber',
  authenticate,
  supportController.getTicketByNumber
);

/**
 * @route   POST /api/v1/support/tickets/:ticketId/response
 * @desc    Add response to ticket
 * @access  Private
 */
router.post(
  '/tickets/:ticketId/response',
  authenticate,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  supportController.addTicketResponse
);

/**
 * @route   PUT /api/v1/support/tickets/:ticketId/resolve
 * @desc    Resolve a ticket
 * @access  Private
 */
router.put(
  '/tickets/:ticketId/resolve',
  authenticate,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  supportController.resolveTicket
);

/**
 * @route   POST /api/v1/support/tickets/:ticketId/reopen
 * @desc    Reopen a ticket
 * @access  Private
 */
router.post(
  '/tickets/:ticketId/reopen',
  authenticate,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  supportController.reopenTicket
);

/**
 * @route   POST /api/v1/support/tickets/:ticketId/satisfaction
 * @desc    Submit satisfaction rating
 * @access  Private
 */
router.post(
  '/tickets/:ticketId/satisfaction',
  authenticate,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  supportController.submitSatisfaction
);

// ============================================
// ADMIN SUPPORT ROUTES
// ============================================

/**
 * @route   GET /api/v1/support/admin/tickets
 * @desc    Get all tickets (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/tickets',
  authenticate,
  requireAdmin,
  supportController.getAllTickets
);

/**
 * @route   GET /api/v1/support/admin/tickets/open
 * @desc    Get open tickets (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/tickets/open',
  authenticate,
  requireAdmin,
  supportController.getOpenTickets
);

/**
 * @route   GET /api/v1/support/admin/tickets/unassigned
 * @desc    Get unassigned tickets (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/tickets/unassigned',
  authenticate,
  requireAdmin,
  supportController.getUnassignedTickets
);

/**
 * @route   PUT /api/v1/support/admin/tickets/:ticketId/assign
 * @desc    Assign ticket to agent (admin only)
 * @access  Private/Admin
 */
router.put(
  '/admin/tickets/:ticketId/assign',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  supportController.assignTicket
);

/**
 * @route   PUT /api/v1/support/admin/tickets/:ticketId/escalate
 * @desc    Escalate ticket (admin only)
 * @access  Private/Admin
 */
router.put(
  '/admin/tickets/:ticketId/escalate',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  supportController.escalateTicket
);

/**
 * @route   POST /api/v1/support/admin/tickets/:ticketId/note
 * @desc    Add internal note to ticket (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/tickets/:ticketId/note',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  supportController.addInternalNote
);

/**
 * @route   PUT /api/v1/support/admin/tickets/:ticketId/close
 * @desc    Close ticket (admin only)
 * @access  Private/Admin
 */
router.put(
  '/admin/tickets/:ticketId/close',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  supportController.closeTicket
);

// ============================================
// SUPPORT STATISTICS ROUTES (Admin)
// ============================================

/**
 * @route   GET /api/v1/support/admin/stats
 * @desc    Get support statistics (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/stats',
  authenticate,
  requireAdmin,
  supportController.getSupportStats
);

/**
 * @route   GET /api/v1/support/admin/categories
 * @desc    Get ticket categories breakdown (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/categories',
  authenticate,
  requireAdmin,
  supportController.getTicketCategories
);

/**
 * @route   GET /api/v1/support/admin/volume
 * @desc    Get ticket volume over time (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/volume',
  authenticate,
  requireAdmin,
  supportController.getTicketVolume
);

/**
 * @route   GET /api/v1/support/admin/agents/performance
 * @desc    Get agent performance (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/agents/performance',
  authenticate,
  requireAdmin,
  supportController.getAgentPerformance
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
