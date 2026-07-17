/**
 * Support Controller - Customer Support HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all support-related HTTP requests including:
 * - Support ticket creation and management
 * - Ticket listing and filtering
 * - Ticket responses and updates
 * - Ticket assignment (admin)
 * - Ticket escalation (admin)
 * - Ticket resolution and closure
 * - Satisfaction surveys
 * - Support analytics (admin)
 */

const supportService = require('../services/supportService');
const { catchAsync, createValidationError, createNotFoundError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// SUPPORT TICKET MANAGEMENT (User)
// ============================================

/**
 * Create a support ticket
 * POST /api/v1/support/tickets
 */
const createTicket = catchAsync(async (req, res) => {
  const {
    subject,
    description,
    category = 'general',
    subCategory = null,
    priority = 'normal',
    attachments = [],
    details = {},
  } = req.body;

  if (!subject) throw createValidationError('Subject is required');
  if (!description) throw createValidationError('Description is required');

  const ticket = await supportService.createTicket({
    userId: req.user.id,
    subject,
    description,
    category,
    subCategory,
    priority,
    attachments,
    details,
  }, req);

  res.status(201).json({
    success: true,
    message: 'Support ticket created successfully',
    data: {
      ticket,
    },
  });
});

/**
 * Get user's support tickets
 * GET /api/v1/support/tickets
 */
const getUserTickets = catchAsync(async (req, res) => {
  const {
    limit = 50,
    offset = 0,
    status = null,
    category = null,
    startDate = null,
    endDate = null,
  } = req.query;

  const result = await supportService.getUserTickets(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    status,
    category,
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: {
      tickets: result.tickets,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get ticket by ID
 * GET /api/v1/support/tickets/:ticketId
 */
const getTicket = catchAsync(async (req, res) => {
  const { ticketId } = req.params;

  const ticket = await supportService.getTicket(ticketId, req.user.id);

  if (!ticket) {
    throw createNotFoundError('Ticket', ticketId);
  }

  res.status(200).json({
    success: true,
    data: {
      ticket,
    },
  });
});

/**
 * Get ticket by ticket number
 * GET /api/v1/support/tickets/number/:ticketNumber
 */
const getTicketByNumber = catchAsync(async (req, res) => {
  const { ticketNumber } = req.params;

  const ticket = await supportService.getTicketByNumber(ticketNumber, req.user.id);

  if (!ticket) {
    throw createNotFoundError('Ticket', ticketNumber);
  }

  res.status(200).json({
    success: true,
    data: {
      ticket,
    },
  });
});

/**
 * Add response to ticket
 * POST /api/v1/support/tickets/:ticketId/response
 */
const addTicketResponse = catchAsync(async (req, res) => {
  const { ticketId } = req.params;
  const { message, attachments = [] } = req.body;

  if (!message) {
    throw createValidationError('Response message is required');
  }

  const response = await supportService.addTicketResponse(
    ticketId,
    req.user.id,
    message,
    {
      attachments,
      isInternal: false,
    },
    req
  );

  res.status(200).json({
    success: true,
    message: 'Response added successfully',
    data: {
      response,
    },
  });
});

/**
 * Resolve a ticket
 * PUT /api/v1/support/tickets/:ticketId/resolve
 */
const resolveTicket = catchAsync(async (req, res) => {
  const { ticketId } = req.params;
  const { resolution } = req.body;

  if (!resolution) {
    throw createValidationError('Resolution details are required');
  }

  const ticket = await supportService.resolveTicket(ticketId, req.user.id, resolution, req);

  res.status(200).json({
    success: true,
    message: 'Ticket resolved successfully',
    data: {
      ticket,
    },
  });
});

/**
 * Reopen a ticket
 * POST /api/v1/support/tickets/:ticketId/reopen
 */
const reopenTicket = catchAsync(async (req, res) => {
  const { ticketId } = req.params;
  const { reason } = req.body;

  if (!reason) {
    throw createValidationError('Reopen reason is required');
  }

  const ticket = await supportService.reopenTicket(ticketId, req.user.id, reason, req);

  res.status(200).json({
    success: true,
    message: 'Ticket reopened successfully',
    data: {
      ticket,
    },
  });
});

/**
 * Submit satisfaction rating
 * POST /api/v1/support/tickets/:ticketId/satisfaction
 */
const submitSatisfaction = catchAsync(async (req, res) => {
  const { ticketId } = req.params;
  const { rating, feedback = '' } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw createValidationError('Rating must be between 1 and 5');
  }

  const ticket = await supportService.submitSatisfaction(ticketId, req.user.id, rating, feedback, req);

  res.status(200).json({
    success: true,
    message: 'Satisfaction rating submitted successfully',
    data: {
      ticket,
    },
  });
});

// ============================================
// ADMIN SUPPORT OPERATIONS
// ============================================

/**
 * Get all tickets (admin only)
 * GET /api/v1/support/admin/tickets
 */
const getAllTickets = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view all tickets');
  }

  const {
    limit = 50,
    offset = 0,
    status = null,
    category = null,
    priority = null,
    assignedTo = null,
    userId = null,
    startDate = null,
    endDate = null,
  } = req.query;

  const result = await supportService.getAllTickets(
    {
      status,
      category,
      priority,
      assignedTo,
      userId,
      startDate,
      endDate,
    },
    {
      limit: parseInt(limit),
      offset: parseInt(offset),
    }
  );

  res.status(200).json({
    success: true,
    data: {
      tickets: result.tickets,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get open tickets (admin only)
 * GET /api/v1/support/admin/tickets/open
 */
const getOpenTickets = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view open tickets');
  }

  const { limit = 100, offset = 0, assignedTo = null, priority = null } = req.query;

  const result = await supportService.getOpenTickets({
    limit: parseInt(limit),
    offset: parseInt(offset),
    assignedTo,
    priority,
  });

  res.status(200).json({
    success: true,
    data: {
      tickets: result.tickets,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get unassigned tickets (admin only)
 * GET /api/v1/support/admin/tickets/unassigned
 */
const getUnassignedTickets = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view unassigned tickets');
  }

  const { limit = 50 } = req.query;

  const tickets = await supportService.getUnassignedTickets(parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      tickets,
      count: tickets.length,
    },
  });
});

/**
 * Assign ticket to agent (admin only)
 * PUT /api/v1/support/admin/tickets/:ticketId/assign
 */
const assignTicket = catchAsync(async (req, res) => {
  const { ticketId } = req.params;
  const { agentId } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can assign tickets');
  }

  if (!agentId) {
    throw createValidationError('Agent ID is required');
  }

  const ticket = await supportService.assignTicket(ticketId, agentId, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Ticket assigned successfully',
    data: {
      ticket,
    },
  });
});

/**
 * Escalate ticket (admin only)
 * PUT /api/v1/support/admin/tickets/:ticketId/escalate
 */
const escalateTicket = catchAsync(async (req, res) => {
  const { ticketId } = req.params;
  const { agentId, reason } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can escalate tickets');
  }

  if (!agentId) {
    throw createValidationError('Agent ID is required');
  }

  if (!reason) {
    throw createValidationError('Escalation reason is required');
  }

  const ticket = await supportService.escalateTicket(ticketId, agentId, reason, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Ticket escalated successfully',
    data: {
      ticket,
    },
  });
});

/**
 * Add internal note to ticket (admin only)
 * POST /api/v1/support/admin/tickets/:ticketId/note
 */
const addInternalNote = catchAsync(async (req, res) => {
  const { ticketId } = req.params;
  const { note } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can add internal notes');
  }

  if (!note) {
    throw createValidationError('Note content is required');
  }

  const response = await supportService.addTicketResponse(
    ticketId,
    req.user.id,
    note,
    {
      attachments: [],
      isInternal: true,
    },
    req
  );

  res.status(200).json({
    success: true,
    message: 'Internal note added successfully',
    data: {
      response,
    },
  });
});

/**
 * Close ticket (admin only)
 * PUT /api/v1/support/admin/tickets/:ticketId/close
 */
const closeTicket = catchAsync(async (req, res) => {
  const { ticketId } = req.params;
  const { reason } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can close tickets');
  }

  if (!reason) {
    throw createValidationError('Closure reason is required');
  }

  const ticket = await supportService.closeTicket(ticketId, req.user.id, reason, req);

  res.status(200).json({
    success: true,
    message: 'Ticket closed successfully',
    data: {
      ticket,
    },
  });
});

// ============================================
// SUPPORT STATISTICS (Admin)
// ============================================

/**
 * Get support statistics (admin only)
 * GET /api/v1/support/admin/stats
 */
const getSupportStats = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view support statistics');
  }

  const stats = await supportService.getSupportStats();

  res.status(200).json({
    success: true,
    data: {
      stats,
    },
  });
});

/**
 * Get ticket categories breakdown (admin only)
 * GET /api/v1/support/admin/categories
 */
const getTicketCategories = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view ticket categories');
  }

  const categories = await supportService.getTicketCategories();

  res.status(200).json({
    success: true,
    data: {
      categories,
    },
  });
});

/**
 * Get ticket volume over time (admin only)
 * GET /api/v1/support/admin/volume
 */
const getTicketVolume = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view ticket volume');
  }

  const { days = 30 } = req.query;

  const volume = await supportService.getTicketVolume(parseInt(days));

  res.status(200).json({
    success: true,
    data: {
      volume,
    },
  });
});

/**
 * Get agent performance (admin only)
 * GET /api/v1/support/admin/agents/performance
 */
const getAgentPerformance = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view agent performance');
  }

  const { startDate = null, endDate = null } = req.query;

  const performance = await supportService.getAgentPerformance({
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: {
      performance,
    },
  });
});

// Export all controller methods
module.exports = {
  // User
  createTicket,
  getUserTickets,
  getTicket,
  getTicketByNumber,
  addTicketResponse,
  resolveTicket,
  reopenTicket,
  submitSatisfaction,

  // Admin
  getAllTickets,
  getOpenTickets,
  getUnassignedTickets,
  assignTicket,
  escalateTicket,
  addInternalNote,
  closeTicket,

  // Statistics
  getSupportStats,
  getTicketCategories,
  getTicketVolume,
  getAgentPerformance,
};
