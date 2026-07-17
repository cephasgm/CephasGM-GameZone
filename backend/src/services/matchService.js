/**
 * Match Service - Match & Odds Management Business Logic
 * CephasGM GameZone
 * 
 * This service handles all match and odds-related business logic including:
 * - Match management (create, update, delete)
 * - Live match updates (scores, statistics, events)
 * - Odds management and updates
 * - Match scheduling and status management
 * - Match search and filtering
 * - Live match broadcasting via WebSocket
 * - Featured and popular match selection
 */

const { Op } = require('sequelize');
const { Match, Sport, League, Bet, User, AuditLog } = require('../models');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const { logAudit } = require('../utils/logger');
const { emit } = require('../config/socket');

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const CACHE_TTL = {
  MATCH_LIST: 60, // 1 minute
  MATCH_DETAILS: 120, // 2 minutes
  LIVE_MATCHES: 10, // 10 seconds
  FEATURED_MATCHES: 300, // 5 minutes
  ODDS: 5, // 5 seconds
  STATISTICS: 30, // 30 seconds
};

const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  HALFTIME: 'halftime',
  EXTRA_TIME: 'extra_time',
  PENALTIES: 'penalties',
  POSTPONED: 'postponed',
  CANCELLED: 'cancelled',
  FINISHED: 'finished',
  ABANDONED: 'abandoned',
};

const MATCH_EVENTS = {
  GOAL: 'goal',
  YELLOW_CARD: 'yellow_card',
  RED_CARD: 'red_card',
  SUBSTITUTION: 'substitution',
  PENALTY: 'penalty',
  PENALTY_GOAL: 'penalty_goal',
  PENALTY_MISSED: 'penalty_missed',
  VAR_DECISION: 'var_decision',
  OFFSIDE: 'offside',
  FOUL: 'foul',
  FREE_KICK: 'free_kick',
  CORNER: 'corner',
  SHOT: 'shot',
  SHOT_ON_TARGET: 'shot_on_target',
  SAVE: 'save',
  INJURY: 'injury',
  EXTRA_TIME_START: 'extra_time_start',
  EXTRA_TIME_END: 'extra_time_end',
  HALFTIME_START: 'halftime_start',
  HALFTIME_END: 'halftime_end',
  FULLTIME: 'fulltime',
};

// ============================================
// MATCH MANAGEMENT
// ============================================

/**
 * Create a new match
 * @param {Object} matchData - Match data
 * @param {string} matchData.sportId - Sport ID
 * @param {string} matchData.leagueId - League ID
 * @param {string} matchData.homeTeam - Home team name
 * @param {string} matchData.awayTeam - Away team name
 * @param {Date} matchData.matchDate - Match date
 * @param {string} matchData.venue - Venue
 * @param {Object} matchData.odds - Initial odds
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Created match
 */
const createMatch = async (matchData, req = null) => {
  const {
    sportId,
    leagueId,
    homeTeam,
    awayTeam,
    matchDate,
    venue,
    odds = {},
    homeTeamId = null,
    awayTeamId = null,
    providerId = null,
    isFeatured = false,
    priority = 0,
  } = matchData;

  // Validate sport exists
  const sport = await Sport.findByPk(sportId);
  if (!sport) {
    throw new Error('Sport not found');
  }

  // Validate league exists
  const league = await League.findByPk(leagueId);
  if (!league) {
    throw new Error('League not found');
  }

  // Validate teams
  if (!homeTeam || !awayTeam) {
    throw new Error('Home team and away team are required');
  }

  // Validate match date
  if (!matchDate) {
    throw new Error('Match date is required');
  }

  // Set default odds if not provided
  const defaultOdds = {
    home: 2.00,
    away: 2.00,
    draw: 3.00,
    over: 1.90,
    under: 1.90,
    home_double_chance: 1.50,
    away_double_chance: 1.50,
    draw_double_chance: 1.50,
    both_teams_score: { yes: 1.80, no: 1.90 },
    total_goals: { over: 1.90, under: 1.90 },
    correct_score: {},
    first_goal: {},
    handicap: {},
  };

  const finalOdds = { ...defaultOdds, ...odds };

  // Create match
  const match = await Match.create({
    sport_id: sportId,
    league_id: leagueId,
    home_team: homeTeam,
    away_team: awayTeam,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    venue: venue || null,
    match_date: matchDate,
    status: MATCH_STATUS.SCHEDULED,
    odds: finalOdds,
    is_featured: isFeatured || false,
    priority: priority || 0,
    provider_id: providerId || null,
    metadata: {},
  });

  // Update sport and league counts
  await Sport.increment('total_events', { by: 1, where: { id: sportId } });
  await Sport.increment('active_events', { by: 1, where: { id: sportId } });
  await League.increment('total_matches', { by: 1, where: { id: leagueId } });
  await League.increment('active_matches', { by: 1, where: { id: leagueId } });

  // Clear cache
  await clearMatchCache();

  // Log audit
  await logAudit('MATCH_CREATED', null, {
    matchId: match.id,
    homeTeam,
    awayTeam,
    sport: sport.name,
    league: league.name,
  }, req);

  logger.info(`Match created: ${homeTeam} vs ${awayTeam} (${match.id})`);

  return match;
};

/**
 * Update a match
 * @param {string} matchId - Match ID
 * @param {Object} updateData - Update data
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated match
 */
const updateMatch = async (matchId, updateData, req = null) => {
  const match = await Match.findByPk(matchId, {
    include: [
      { model: Sport, as: 'sport' },
      { model: League, as: 'league' },
    ],
  });

  if (!match) {
    throw new Error('Match not found');
  }

  // Allowed update fields
  const allowedFields = [
    'home_team',
    'away_team',
    'home_team_id',
    'away_team_id',
    'venue',
    'match_date',
    'status',
    'odds',
    'is_featured',
    'priority',
    'max_bet_amount',
    'min_bet_amount',
    'is_live_available',
    'stream_url',
    'broadcast_channels',
    'metadata',
  ];

  const finalUpdateData = {};
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      finalUpdateData[field] = updateData[field];
    }
  }

  // Handle status changes
  if (updateData.status && updateData.status !== match.status) {
    const oldStatus = match.status;
    const newStatus = updateData.status;

    // Update timestamps based on status
    if (newStatus === MATCH_STATUS.LIVE && !match.started_at) {
      finalUpdateData.started_at = new Date();
    }
    if (newStatus === MATCH_STATUS.FINISHED && !match.finished_at) {
      finalUpdateData.finished_at = new Date();
    }

    // Update sport and league active events
    if (oldStatus === MATCH_STATUS.LIVE && newStatus !== MATCH_STATUS.LIVE) {
      await Sport.decrement('active_events', { by: 1, where: { id: match.sport_id } });
      await League.decrement('active_matches', { by: 1, where: { id: match.league_id } });
    }
    if (oldStatus !== MATCH_STATUS.LIVE && newStatus === MATCH_STATUS.LIVE) {
      await Sport.increment('active_events', { by: 1, where: { id: match.sport_id } });
      await League.increment('active_matches', { by: 1, where: { id: match.league_id } });
    }
  }

  // Update match
  await match.update(finalUpdateData);

  // Broadcast updates via WebSocket
  if (match.isLive()) {
    emit.matchUpdate(global.io, matchId, match.getSummary());
  }

  // Clear cache
  await clearMatchCache(matchId);

  // Log audit
  await logAudit('MATCH_UPDATED', null, {
    matchId: match.id,
    updates: Object.keys(finalUpdateData),
  }, req);

  logger.info(`Match updated: ${match.home_team} vs ${match.away_team} (${match.id})`);

  return match;
};

/**
 * Delete a match
 * @param {string} matchId - Match ID
 * @param {Object} req - Express request object
 * @returns {Promise<void>}
 */
const deleteMatch = async (matchId, req = null) => {
  const match = await Match.findByPk(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  // Check if there are active bets on this match
  const activeBets = await Bet.count({
    where: {
      selections: {
        [Op.contains]: [{ match_id: matchId }],
      },
      status: {
        [Op.in]: ['pending', 'active'],
      },
    },
  });

  if (activeBets > 0) {
    throw new Error('Cannot delete match with active bets');
  }

  // Update sport and league counts
  if (match.isLive()) {
    await Sport.decrement('active_events', { by: 1, where: { id: match.sport_id } });
    await League.decrement('active_matches', { by: 1, where: { id: match.league_id } });
  }
  await Sport.decrement('total_events', { by: 1, where: { id: match.sport_id } });
  await League.decrement('total_matches', { by: 1, where: { id: match.league_id } });

  // Delete match
  await match.destroy();

  // Clear cache
  await clearMatchCache(matchId);

  // Log audit
  await logAudit('MATCH_DELETED', null, {
    matchId: match.id,
    homeTeam: match.home_team,
    awayTeam: match.away_team,
  }, req);

  logger.info(`Match deleted: ${match.home_team} vs ${match.away_team} (${match.id})`);
};

// ============================================
// LIVE MATCH UPDATES
// ============================================

/**
 * Update live match score
 * @param {string} matchId - Match ID
 * @param {number} homeScore - Home team score
 * @param {number} awayScore - Away team score
 * @param {number} minute - Match minute
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated match
 */
const updateLiveScore = async (matchId, homeScore, awayScore, minute = null, req = null) => {
  const match = await Match.findByPk(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  if (!match.isLive()) {
    throw new Error('Match is not live');
  }

  // Update score
  await match.update({
    home_score: homeScore,
    away_score: awayScore,
    match_minute: minute || match.match_minute,
  });

  // Update half-time scores if needed
  if (match.match_minute === 45 || match.match_minute === 45) {
    await match.update({
      home_ht_score: homeScore,
      away_ht_score: awayScore,
    });
  }

  // Broadcast update via WebSocket
  emit.matchUpdate(global.io, matchId, {
    score: match.getScoreDisplay(),
    homeScore,
    awayScore,
    minute: match.match_minute,
  });

  // Clear cache
  await clearMatchCache(matchId);

  // Log update
  logger.info(`Live score updated: ${matchId} - ${homeScore}:${awayScore} (${match.match_minute}')`);

  return match;
};

/**
 * Add a match event
 * @param {string} matchId - Match ID
 * @param {Object} event - Event data
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated match
 */
const addMatchEvent = async (matchId, event, req = null) => {
  const match = await Match.findByPk(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  const events = match.events || [];

  const newEvent = {
    id: `${matchId}_${Date.now()}`,
    timestamp: new Date().toISOString(),
    minute: match.match_minute,
    ...event,
  };

  events.push(newEvent);

  await match.update({
    events: events,
  });

  // Broadcast event via WebSocket
  emit.matchUpdate(global.io, matchId, {
    event: newEvent,
    type: 'event_added',
  });

  // Clear cache
  await clearMatchCache(matchId);

  logger.info(`Event added to match ${matchId}: ${event.type} at ${match.match_minute}'`);

  return match;
};

/**
 * Update match statistics
 * @param {string} matchId - Match ID
 * @param {Object} statistics - Statistics data
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated match
 */
const updateMatchStatistics = async (matchId, statistics, req = null) => {
  const match = await Match.findByPk(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  const currentStats = match.statistics || {};
  const updatedStats = {
    ...currentStats,
    ...statistics,
  };

  await match.update({
    statistics: updatedStats,
  });

  // Broadcast statistics via WebSocket
  emit.matchUpdate(global.io, matchId, {
    statistics: updatedStats,
    type: 'statistics_updated',
  });

  // Clear cache
  await clearMatchCache(matchId);

  logger.info(`Statistics updated for match ${matchId}`);

  return match;
};

/**
 * Start a match (change status to live)
 * @param {string} matchId - Match ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated match
 */
const startMatch = async (matchId, req = null) => {
  const match = await Match.findByPk(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  if (match.status !== MATCH_STATUS.SCHEDULED) {
    throw new Error(`Match cannot be started from status: ${match.status}`);
  }

  await match.update({
    status: MATCH_STATUS.LIVE,
    started_at: new Date(),
  });

  // Update sport and league active events
  await Sport.increment('active_events', { by: 1, where: { id: match.sport_id } });
  await League.increment('active_matches', { by: 1, where: { id: match.league_id } });

  // Broadcast match start via WebSocket
  emit.matchUpdate(global.io, matchId, {
    status: MATCH_STATUS.LIVE,
    type: 'match_started',
  });

  // Clear cache
  await clearMatchCache(matchId);

  await logAudit('MATCH_STARTED', null, { matchId, homeTeam: match.home_team, awayTeam: match.away_team }, req);
  logger.info(`Match started: ${match.home_team} vs ${match.away_team} (${matchId})`);

  return match;
};

/**
 * End a match (change status to finished)
 * @param {string} matchId - Match ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated match
 */
const endMatch = async (matchId, req = null) => {
  const match = await Match.findByPk(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  if (match.status !== MATCH_STATUS.LIVE && match.status !== MATCH_STATUS.HALFTIME) {
    throw new Error(`Match cannot be ended from status: ${match.status}`);
  }

  await match.update({
    status: MATCH_STATUS.FINISHED,
    finished_at: new Date(),
    match_minute: 90,
  });

  // Update final scores
  await match.update({
    home_ft_score: match.home_score,
    away_ft_score: match.away_score,
  });

  // Update sport and league active events
  await Sport.decrement('active_events', { by: 1, where: { id: match.sport_id } });
  await League.decrement('active_matches', { by: 1, where: { id: match.league_id } });

  // Broadcast match end via WebSocket
  emit.matchUpdate(global.io, matchId, {
    status: MATCH_STATUS.FINISHED,
    type: 'match_ended',
    finalScore: `${match.home_score}:${match.away_score}`,
  });

  // Clear cache
  await clearMatchCache(matchId);

  await logAudit('MATCH_ENDED', null, { matchId, homeTeam: match.home_team, awayTeam: match.away_team }, req);
  logger.info(`Match ended: ${match.home_team} vs ${match.away_team} (${matchId})`);

  return match;
};

// ============================================
// ODDS MANAGEMENT
// ============================================

/**
 * Update match odds
 * @param {string} matchId - Match ID
 * @param {Object} odds - New odds data
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Updated match
 */
const updateMatchOdds = async (matchId, odds, req = null) => {
  const match = await Match.findByPk(matchId);
  if (!match) {
    throw new Error('Match not found');
  }

  const currentOdds = match.odds || {};
  const updatedOdds = {
    ...currentOdds,
    ...odds,
  };

  await match.update({
    odds: updatedOdds,
    last_odds_update: new Date(),
  });

  // Broadcast odds update via WebSocket
  emit.oddsUpdate(global.io, matchId, updatedOdds);

  // Clear cache
  await clearMatchCache(matchId);
  await cache.del(`odds:${matchId}`);

  logger.info(`Odds updated for match ${matchId}`);

  return match;
};

/**
 * Get current odds for a match
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Odds data
 */
const getMatchOdds = async (matchId) => {
  // Check cache
  const cacheKey = `odds:${matchId}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Invalid cache, continue
    }
  }

  const match = await Match.findByPk(matchId, {
    attributes: ['id', 'odds', 'last_odds_update', 'status'],
  });

  if (!match) {
    throw new Error('Match not found');
  }

  const oddsData = {
    matchId: match.id,
    odds: match.odds || {},
    lastUpdated: match.last_odds_update,
    status: match.status,
  };

  await cache.set(cacheKey, JSON.stringify(oddsData), CACHE_TTL.ODDS);

  return oddsData;
};

/**
 * Batch update odds for multiple matches
 * @param {Array} updates - Array of {matchId, odds} objects
 * @param {Object} req - Express request object
 * @returns {Promise<Array>} - Updated matches
 */
const batchUpdateOdds = async (updates, req = null) => {
  const results = [];

  for (const update of updates) {
    try {
      const match = await updateMatchOdds(update.matchId, update.odds, req);
      results.push({
        matchId: update.matchId,
        success: true,
        match,
      });
    } catch (error) {
      results.push({
        matchId: update.matchId,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
};

// ============================================
// MATCH RETRIEVAL
// ============================================

/**
 * Get match by ID
 * @param {string} matchId - Match ID
 * @param {Object} options - Options (include details)
 * @returns {Promise<Object>} - Match
 */
const getMatchById = async (matchId, options = {}) => {
  const { includeDetails = false } = options;

  // Check cache
  const cacheKey = `match:${matchId}:${includeDetails}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Invalid cache, continue
    }
  }

  const include = [
    { model: Sport, as: 'sport' },
    { model: League, as: 'league' },
  ];

  const match = await Match.findByPk(matchId, {
    include,
    attributes: {
      exclude: includeDetails ? [] : ['provider_data', 'metadata'],
    },
  });

  if (!match) {
    throw new Error('Match not found');
  }

  const matchData = match.toJSON();

  // Add computed fields
  matchData.statusDisplay = match.getStatusDisplay();
  matchData.timeDisplay = match.getTimeDisplay();
  matchData.scoreDisplay = match.getScoreDisplay();
  matchData.isLive = match.isLive();
  matchData.isFinished = match.isFinished();
  matchData.isBetable = match.isBetable();

  // Include betting data if requested
  if (includeDetails) {
    matchData.bettingData = match.getBettingData();
  }

  await cache.set(cacheKey, JSON.stringify(matchData), CACHE_TTL.MATCH_DETAILS);

  return matchData;
};

/**
 * Get live matches
 * @param {Object} options - Options
 * @returns {Promise<Array>} - Live matches
 */
const getLiveMatches = async (options = {}) => {
  const { sportId = null, limit = 50, offset = 0 } = options;

  // Check cache
  const cacheKey = `live_matches:${sportId || 'all'}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      // Apply pagination to cached data
      const sliced = parsed.slice(offset, offset + limit);
      return {
        matches: sliced,
        total: parsed.length,
        limit,
        offset,
        hasMore: offset + sliced.length < parsed.length,
      };
    } catch (error) {
      // Invalid cache, continue
    }
  }

  const where = {
    status: {
      [Op.in]: [MATCH_STATUS.LIVE, MATCH_STATUS.HALFTIME, MATCH_STATUS.EXTRA_TIME, MATCH_STATUS.PENALTIES],
    },
  };
  if (sportId) where.sport_id = sportId;

  const { count, rows } = await Match.findAndCountAll({
    where,
    limit: 100, // Cache up to 100 matches
    order: [
      ['priority', 'DESC'],
      ['match_minute', 'ASC'],
    ],
    include: [
      { model: Sport, as: 'sport' },
      { model: League, as: 'league' },
    ],
  });

  const matches = rows.map(match => {
    const data = match.toJSON();
    data.statusDisplay = match.getStatusDisplay();
    data.timeDisplay = match.getTimeDisplay();
    data.scoreDisplay = match.getScoreDisplay();
    data.isLive = match.isLive();
    data.isFinished = match.isFinished();
    return data;
  });

  await cache.set(cacheKey, JSON.stringify(matches), CACHE_TTL.LIVE_MATCHES);

  const sliced = matches.slice(offset, offset + limit);
  return {
    matches: sliced,
    total: matches.length,
    limit,
    offset,
    hasMore: offset + sliced.length < matches.length,
  };
};

/**
 * Get upcoming matches
 * @param {Object} options - Options
 * @returns {Promise<Object>} - Upcoming matches
 */
const getUpcomingMatches = async (options = {}) => {
  const {
    sportId = null,
    leagueId = null,
    days = 7,
    limit = 50,
    offset = 0,
  } = options;

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const where = {
    status: MATCH_STATUS.SCHEDULED,
    match_date: {
      [Op.between]: [startDate, endDate],
    },
  };
  if (sportId) where.sport_id = sportId;
  if (leagueId) where.league_id = leagueId;

  const { count, rows } = await Match.findAndCountAll({
    where,
    limit,
    offset,
    order: [['match_date', 'ASC']],
    include: [
      { model: Sport, as: 'sport' },
      { model: League, as: 'league' },
    ],
  });

  const matches = rows.map(match => {
    const data = match.toJSON();
    data.statusDisplay = match.getStatusDisplay();
    data.timeDisplay = match.getTimeDisplay();
    data.isBetable = match.isBetable();
    return data;
  });

  return {
    matches,
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
  };
};

/**
 * Get matches by date
 * @param {Date} date - Date
 * @param {Object} options - Options
 * @returns {Promise<Array>} - Matches
 */
const getMatchesByDate = async (date, options = {}) => {
  const { sportId = null, leagueId = null } = options;

  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const where = {
    match_date: {
      [Op.between]: [startDate, endDate],
    },
  };
  if (sportId) where.sport_id = sportId;
  if (leagueId) where.league_id = leagueId;

  const matches = await Match.findAll({
    where,
    order: [
      ['status', 'ASC'],
      ['match_date', 'ASC'],
    ],
    include: [
      { model: Sport, as: 'sport' },
      { model: League, as: 'league' },
    ],
  });

  return matches.map(match => {
    const data = match.toJSON();
    data.statusDisplay = match.getStatusDisplay();
    data.timeDisplay = match.getTimeDisplay();
    data.scoreDisplay = match.getScoreDisplay();
    data.isLive = match.isLive();
    data.isFinished = match.isFinished();
    data.isBetable = match.isBetable();
    return data;
  });
};

/**
 * Get featured matches
 * @param {number} limit - Limit
 * @returns {Promise<Array>} - Featured matches
 */
const getFeaturedMatches = async (limit = 6) => {
  // Check cache
  const cacheKey = `featured_matches`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return parsed.slice(0, limit);
    } catch (error) {
      // Invalid cache, continue
    }
  }

  const matches = await Match.findAll({
    where: {
      is_featured: true,
      status: {
        [Op.in]: [MATCH_STATUS.SCHEDULED, MATCH_STATUS.LIVE, MATCH_STATUS.HALFTIME],
      },
    },
    order: [
      ['priority', 'DESC'],
      ['match_date', 'ASC'],
    ],
    limit: 20,
    include: [
      { model: Sport, as: 'sport' },
      { model: League, as: 'league' },
    ],
  });

  const formatted = matches.map(match => {
    const data = match.toJSON();
    data.statusDisplay = match.getStatusDisplay();
    data.timeDisplay = match.getTimeDisplay();
    data.scoreDisplay = match.getScoreDisplay();
    data.isLive = match.isLive();
    data.isFinished = match.isFinished();
    data.isBetable = match.isBetable();
    return data;
  });

  await cache.set(cacheKey, JSON.stringify(formatted), CACHE_TTL.FEATURED_MATCHES);

  return formatted.slice(0, limit);
};

/**
 * Search matches
 * @param {string} query - Search query
 * @param {Object} options - Options
 * @returns {Promise<Object>} - Search results
 */
const searchMatches = async (query, options = {}) => {
  const { limit = 20, offset = 0, sportId = null, status = null } = options;

  const where = {
    [Op.or]: [
      { home_team: { [Op.iLike]: `%${query}%` } },
      { away_team: { [Op.iLike]: `%${query}%` } },
      { venue: { [Op.iLike]: `%${query}%` } },
    ],
  };
  if (sportId) where.sport_id = sportId;
  if (status) where.status = status;

  const { count, rows } = await Match.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['status', 'ASC'],
      ['match_date', 'ASC'],
    ],
    include: [
      { model: Sport, as: 'sport' },
      { model: League, as: 'league' },
    ],
  });

  const matches = rows.map(match => {
    const data = match.toJSON();
    data.statusDisplay = match.getStatusDisplay();
    data.timeDisplay = match.getTimeDisplay();
    data.scoreDisplay = match.getScoreDisplay();
    data.isLive = match.isLive();
    data.isFinished = match.isFinished();
    data.isBetable = match.isBetable();
    return data;
  });

  return {
    matches,
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
  };
};

// ============================================
// MATCH STATISTICS
// ============================================

/**
 * Get match statistics summary
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Statistics
 */
const getMatchStatistics = async (matchId) => {
  const match = await Match.findByPk(matchId, {
    attributes: ['id', 'statistics', 'status', 'match_minute'],
  });

  if (!match) {
    throw new Error('Match not found');
  }

  return {
    matchId: match.id,
    status: match.status,
    minute: match.match_minute,
    statistics: match.statistics || {},
  };
};

/**
 * Get match event timeline
 * @param {string} matchId - Match ID
 * @param {number} limit - Limit
 * @returns {Promise<Array>} - Events
 */
const getMatchEvents = async (matchId, limit = 50) => {
  const match = await Match.findByPk(matchId, {
    attributes: ['id', 'events'],
  });

  if (!match) {
    throw new Error('Match not found');
  }

  const events = match.events || [];
  const sorted = events.sort((a, b) => {
    return (a.minute || 0) - (b.minute || 0);
  });

  return sorted.slice(-limit);
};

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Clear match cache
 * @param {string} matchId - Match ID (optional)
 * @returns {Promise<void>}
 */
const clearMatchCache = async (matchId = null) => {
  const keys = [
    'live_matches:*',
    'featured_matches',
    'upcoming_matches:*',
    'matches_by_date:*',
  ];

  if (matchId) {
    keys.push(`match:${matchId}:*`);
    keys.push(`odds:${matchId}`);
  }

  for (const pattern of keys) {
    try {
      await cache.deleteCachePattern(pattern);
    } catch (error) {
      logger.error(`Failed to delete cache pattern ${pattern}:`, error);
    }
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Match Management
  createMatch,
  updateMatch,
  deleteMatch,

  // Live Match Updates
  updateLiveScore,
  addMatchEvent,
  updateMatchStatistics,
  startMatch,
  endMatch,

  // Odds Management
  updateMatchOdds,
  getMatchOdds,
  batchUpdateOdds,

  // Match Retrieval
  getMatchById,
  getLiveMatches,
  getUpcomingMatches,
  getMatchesByDate,
  getFeaturedMatches,
  searchMatches,

  // Match Statistics
  getMatchStatistics,
  getMatchEvents,

  // Cache Management
  clearMatchCache,

  // Constants
  MATCH_STATUS,
  MATCH_EVENTS,
  CACHE_TTL,
};
