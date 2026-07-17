/**
 * Match Controller - Match & Odds HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all match-related HTTP requests including:
 * - Match listings (live, upcoming, featured, by date)
 * - Match details
 * - Match odds (get, update)
 * - Live match updates (scores, events, statistics)
 * - Match search
 * - Match management (create, update, delete) - Admin
 * - Live match status management - Admin
 */

const matchService = require('../services/matchService');
const { catchAsync, createValidationError, createNotFoundError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// MATCH RETRIEVAL
// ============================================

/**
 * Get live matches
 * GET /api/v1/matches/live
 */
const getLiveMatches = catchAsync(async (req, res) => {
  const { sportId = null, limit = 50, offset = 0 } = req.query;

  const result = await matchService.getLiveMatches({
    sportId,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      matches: result.matches,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get upcoming matches
 * GET /api/v1/matches/upcoming
 */
const getUpcomingMatches = catchAsync(async (req, res) => {
  const { sportId = null, leagueId = null, days = 7, limit = 50, offset = 0 } = req.query;

  const result = await matchService.getUpcomingMatches({
    sportId,
    leagueId,
    days: parseInt(days),
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      matches: result.matches,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get matches by date
 * GET /api/v1/matches/date
 */
const getMatchesByDate = catchAsync(async (req, res) => {
  const { date, sportId = null, leagueId = null } = req.query;

  if (!date) {
    throw createValidationError('Date is required');
  }

  const matches = await matchService.getMatchesByDate(new Date(date), {
    sportId,
    leagueId,
  });

  res.status(200).json({
    success: true,
    data: {
      matches,
      count: matches.length,
    },
  });
});

/**
 * Get featured matches
 * GET /api/v1/matches/featured
 */
const getFeaturedMatches = catchAsync(async (req, res) => {
  const { limit = 6 } = req.query;

  const matches = await matchService.getFeaturedMatches(parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      matches,
      count: matches.length,
    },
  });
});

/**
 * Get match by ID
 * GET /api/v1/matches/:matchId
 */
const getMatchById = catchAsync(async (req, res) => {
  const { matchId } = req.params;
  const { includeDetails = false } = req.query;

  const match = await matchService.getMatchById(matchId, {
    includeDetails: includeDetails === 'true',
  });

  res.status(200).json({
    success: true,
    data: {
      match,
    },
  });
});

/**
 * Get match odds
 * GET /api/v1/matches/:matchId/odds
 */
const getMatchOdds = catchAsync(async (req, res) => {
  const { matchId } = req.params;

  const odds = await matchService.getMatchOdds(matchId);

  res.status(200).json({
    success: true,
    data: {
      odds,
    },
  });
});

/**
 * Search matches
 * GET /api/v1/matches/search
 */
const searchMatches = catchAsync(async (req, res) => {
  const { q, sportId = null, status = null, limit = 20, offset = 0 } = req.query;

  if (!q || q.length < 2) {
    throw createValidationError('Search query must be at least 2 characters');
  }

  const result = await matchService.searchMatches(q, {
    sportId,
    status,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      matches: result.matches,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get match statistics
 * GET /api/v1/matches/:matchId/statistics
 */
const getMatchStatistics = catchAsync(async (req, res) => {
  const { matchId } = req.params;

  const statistics = await matchService.getMatchStatistics(matchId);

  res.status(200).json({
    success: true,
    data: {
      statistics,
    },
  });
});

/**
 * Get match events
 * GET /api/v1/matches/:matchId/events
 */
const getMatchEvents = catchAsync(async (req, res) => {
  const { matchId } = req.params;
  const { limit = 50 } = req.query;

  const events = await matchService.getMatchEvents(matchId, parseInt(limit));

  res.status(200).json({
    success: true,
    data: {
      events,
      count: events.length,
    },
  });
});

// ============================================
// LIVE MATCH UPDATES (Public)
// ============================================

/**
 * Get live match updates (SSE or polling)
 * GET /api/v1/matches/live/updates
 */
const getLiveUpdates = catchAsync(async (req, res) => {
  const { matchIds = [] } = req.query;

  // For now, return all live matches
  const result = await matchService.getLiveMatches({ limit: 100 });

  res.status(200).json({
    success: true,
    data: {
      matches: result.matches,
      timestamp: new Date().toISOString(),
    },
  });
});

// ============================================
// ADMIN MATCH MANAGEMENT
// ============================================

/**
 * Create a match (admin only)
 * POST /api/v1/matches
 */
const createMatch = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can create matches');
  }

  const {
    sportId,
    leagueId,
    homeTeam,
    awayTeam,
    matchDate,
    venue,
    odds,
    homeTeamId,
    awayTeamId,
    providerId,
    isFeatured,
    priority,
  } = req.body;

  // Validate required fields
  if (!sportId) throw createValidationError('Sport ID is required');
  if (!leagueId) throw createValidationError('League ID is required');
  if (!homeTeam) throw createValidationError('Home team is required');
  if (!awayTeam) throw createValidationError('Away team is required');
  if (!matchDate) throw createValidationError('Match date is required');

  const match = await matchService.createMatch({
    sportId,
    leagueId,
    homeTeam,
    awayTeam,
    matchDate: new Date(matchDate),
    venue,
    odds,
    homeTeamId,
    awayTeamId,
    providerId,
    isFeatured,
    priority,
  }, req);

  res.status(201).json({
    success: true,
    message: 'Match created successfully',
    data: {
      match,
    },
  });
});

/**
 * Update a match (admin only)
 * PUT /api/v1/matches/:matchId
 */
const updateMatch = catchAsync(async (req, res) => {
  const { matchId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can update matches');
  }

  const {
    homeTeam,
    awayTeam,
    venue,
    matchDate,
    status,
    odds,
    isFeatured,
    priority,
    maxBetAmount,
    minBetAmount,
    isLiveAvailable,
    streamUrl,
    broadcastChannels,
  } = req.body;

  const updates = {};
  if (homeTeam !== undefined) updates.home_team = homeTeam;
  if (awayTeam !== undefined) updates.away_team = awayTeam;
  if (venue !== undefined) updates.venue = venue;
  if (matchDate !== undefined) updates.match_date = new Date(matchDate);
  if (status !== undefined) updates.status = status;
  if (odds !== undefined) updates.odds = odds;
  if (isFeatured !== undefined) updates.is_featured = isFeatured;
  if (priority !== undefined) updates.priority = priority;
  if (maxBetAmount !== undefined) updates.max_bet_amount = maxBetAmount;
  if (minBetAmount !== undefined) updates.min_bet_amount = minBetAmount;
  if (isLiveAvailable !== undefined) updates.is_live_available = isLiveAvailable;
  if (streamUrl !== undefined) updates.stream_url = streamUrl;
  if (broadcastChannels !== undefined) updates.broadcast_channels = broadcastChannels;

  const match = await matchService.updateMatch(matchId, updates, req);

  res.status(200).json({
    success: true,
    message: 'Match updated successfully',
    data: {
      match,
    },
  });
});

/**
 * Delete a match (admin only)
 * DELETE /api/v1/matches/:matchId
 */
const deleteMatch = catchAsync(async (req, res) => {
  const { matchId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can delete matches');
  }

  await matchService.deleteMatch(matchId, req);

  res.status(200).json({
    success: true,
    message: 'Match deleted successfully',
  });
});

/**
 * Update match odds (admin only)
 * PUT /api/v1/matches/:matchId/odds
 */
const updateMatchOdds = catchAsync(async (req, res) => {
  const { matchId } = req.params;
  const { odds } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can update odds');
  }

  if (!odds || typeof odds !== 'object') {
    throw createValidationError('Valid odds object is required');
  }

  const match = await matchService.updateMatchOdds(matchId, odds, req);

  res.status(200).json({
    success: true,
    message: 'Odds updated successfully',
    data: {
      match,
    },
  });
});

/**
 * Batch update odds (admin only)
 * POST /api/v1/matches/odds/batch
 */
const batchUpdateOdds = catchAsync(async (req, res) => {
  const { updates } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can batch update odds');
  }

  if (!updates || !Array.isArray(updates) || updates.length === 0) {
    throw createValidationError('Valid updates array is required');
  }

  const results = await matchService.batchUpdateOdds(updates, req);

  res.status(200).json({
    success: true,
    message: 'Batch odds update completed',
    data: {
      results,
      successCount: results.filter(r => r.success).length,
      failCount: results.filter(r => !r.success).length,
    },
  });
});

/**
 * Start a match (admin only)
 * POST /api/v1/matches/:matchId/start
 */
const startMatch = catchAsync(async (req, res) => {
  const { matchId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can start matches');
  }

  const match = await matchService.startMatch(matchId, req);

  res.status(200).json({
    success: true,
    message: 'Match started successfully',
    data: {
      match,
    },
  });
});

/**
 * End a match (admin only)
 * POST /api/v1/matches/:matchId/end
 */
const endMatch = catchAsync(async (req, res) => {
  const { matchId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can end matches');
  }

  const match = await matchService.endMatch(matchId, req);

  res.status(200).json({
    success: true,
    message: 'Match ended successfully',
    data: {
      match,
    },
  });
});

/**
 * Update live score (admin only)
 * PUT /api/v1/matches/:matchId/score
 */
const updateLiveScore = catchAsync(async (req, res) => {
  const { matchId } = req.params;
  const { homeScore, awayScore, minute } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can update live scores');
  }

  if (homeScore === undefined || awayScore === undefined) {
    throw createValidationError('Home score and away score are required');
  }

  const match = await matchService.updateLiveScore(
    matchId,
    parseInt(homeScore),
    parseInt(awayScore),
    minute ? parseInt(minute) : null,
    req
  );

  res.status(200).json({
    success: true,
    message: 'Live score updated successfully',
    data: {
      match,
    },
  });
});

/**
 * Add match event (admin only)
 * POST /api/v1/matches/:matchId/events
 */
const addMatchEvent = catchAsync(async (req, res) => {
  const { matchId } = req.params;
  const { type, team, player, minute, description, metadata } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can add match events');
  }

  if (!type) {
    throw createValidationError('Event type is required');
  }

  const event = {
    type,
    team,
    player,
    minute: minute || 0,
    description,
    metadata,
  };

  const match = await matchService.addMatchEvent(matchId, event, req);

  res.status(200).json({
    success: true,
    message: 'Match event added successfully',
    data: {
      match,
    },
  });
});

/**
 * Update match statistics (admin only)
 * PUT /api/v1/matches/:matchId/statistics
 */
const updateMatchStatistics = catchAsync(async (req, res) => {
  const { matchId } = req.params;
  const { statistics } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can update match statistics');
  }

  if (!statistics || typeof statistics !== 'object') {
    throw createValidationError('Valid statistics object is required');
  }

  const match = await matchService.updateMatchStatistics(matchId, statistics, req);

  res.status(200).json({
    success: true,
    message: 'Match statistics updated successfully',
    data: {
      match,
    },
  });
});

// Export all controller methods
module.exports = {
  // Match Retrieval
  getLiveMatches,
  getUpcomingMatches,
  getMatchesByDate,
  getFeaturedMatches,
  getMatchById,
  getMatchOdds,
  searchMatches,
  getMatchStatistics,
  getMatchEvents,

  // Live Updates
  getLiveUpdates,

  // Admin Match Management
  createMatch,
  updateMatch,
  deleteMatch,
  updateMatchOdds,
  batchUpdateOdds,
  startMatch,
  endMatch,
  updateLiveScore,
  addMatchEvent,
  updateMatchStatistics,
};
