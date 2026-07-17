/**
 * Bet Service - Betting Business Logic
 * CephasGM GameZone
 * 
 * This service handles all betting-related business logic including:
 * - Single, accumulator, and system bets
 * - Bet placement with odds validation
 * - Cash out functionality
 * - Bet settlement and result processing
 * - Live betting support
 * - Bet history and statistics
 * - Odds calculation and validation
 */

const { Op } = require('sequelize');
const { Bet, Match, User, Wallet, Transaction, AuditLog } = require('../models');
const { cache } = require('../config/redis');
const logger = require('../utils/logger');
const { logAudit } = require('../utils/logger');
const walletService = require('./walletService');
const matchService = require('./matchService');

// ============================================
// CONSTANTS & CONFIGURATION
// ============================================

const CACHE_TTL = {
  ACTIVE_BETS: 60, // 1 minute
  BET_HISTORY: 300, // 5 minutes
  STATS: 300, // 5 minutes
};

const BET_TYPES = {
  SINGLE: 'single',
  ACCUMULATOR: 'accumulator',
  SYSTEM: 'system',
};

const BET_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SETTLED: 'settled',
  CANCELLED: 'cancelled',
  CASHED_OUT: 'cashed_out',
  VOID: 'void',
  REFUNDED: 'refunded',
};

const SETTLEMENT_STATUS = {
  PENDING: 'pending',
  WON: 'won',
  LOST: 'lost',
  VOID: 'void',
  PENDING_REVIEW: 'pending_review',
};

// ============================================
// BET PLACEMENT
// ============================================

/**
 * Place a bet
 * @param {string} userId - User ID
 * @param {Object} betData - Bet data
 * @param {Array} betData.selections - Array of selections [{matchId, selection, odds}]
 * @param {number} betData.stake - Bet stake
 * @param {string} betData.betType - Bet type (single, accumulator, system)
 * @param {Object} betData.systemSize - System size (for system bets)
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Placed bet
 */
const placeBet = async (userId, betData, req = null) => {
  const { selections, stake, betType = BET_TYPES.SINGLE, systemSize = null } = betData;

  // Validate selections
  if (!selections || selections.length === 0) {
    throw new Error('At least one selection is required');
  }

  // Validate bet type
  if (!Object.values(BET_TYPES).includes(betType)) {
    throw new Error(`Invalid bet type. Must be one of: ${Object.values(BET_TYPES).join(', ')}`);
  }

  // Validate system bet
  if (betType === BET_TYPES.SYSTEM && !systemSize) {
    throw new Error('System size is required for system bets');
  }

  if (betType === BET_TYPES.SYSTEM && (systemSize < 2 || systemSize > selections.length)) {
    throw new Error('System size must be between 2 and the number of selections');
  }

  // Validate stake
  if (stake <= 0) {
    throw new Error('Stake must be greater than 0');
  }

  // Validate selections
  for (const selection of selections) {
    if (!selection.matchId) {
      throw new Error('Match ID is required for each selection');
    }
    if (!selection.selection) {
      throw new Error('Selection is required for each selection');
    }
    if (!selection.odds || selection.odds <= 0) {
      throw new Error('Valid odds are required for each selection');
    }
  }

  // Get match details for each selection
  const matchIds = selections.map(s => s.matchId);
  const matches = await Match.findAll({
    where: { id: { [Op.in]: matchIds } },
    include: [
      { model: require('../models').Sport, as: 'sport' },
      { model: require('../models').League, as: 'league' },
    ],
  });

  // Validate all matches exist and are betable
  const matchMap = {};
  for (const match of matches) {
    matchMap[match.id] = match;
    if (!match.isBetable()) {
      throw new Error(`Match ${match.id} is not betable`);
    }
  }

  // Validate all matches are found
  for (const selection of selections) {
    if (!matchMap[selection.matchId]) {
      throw new Error(`Match ${selection.matchId} not found`);
    }

    // Validate odds haven't changed
    const currentOdds = getOddsForSelection(matchMap[selection.matchId], selection.selection);
    if (currentOdds && Math.abs(currentOdds - selection.odds) > 0.01) {
      throw new Error(`Odds have changed for selection ${selection.selection} in match ${selection.matchId}`);
    }
  }

  // Calculate total odds
  let totalOdds = 1;
  for (const selection of selections) {
    totalOdds *= selection.odds;
  }

  // Calculate potential win
  const potentialWin = stake * totalOdds;

  // Check user's wallet balance
  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const availableBalance = parseFloat(wallet.balance) + parseFloat(wallet.bonus_balance) - parseFloat(wallet.locked_balance);
  if (availableBalance < stake) {
    throw new Error('Insufficient balance');
  }

  // Lock funds for bet
  const lockResult = await walletService.lockFundsForBet(userId, stake, null, req);

  // Create bet record
  const bet = await Bet.create({
    user_id: userId,
    wallet_id: wallet.id,
    bet_type: betType,
    status: BET_STATUS.PENDING,
    selections: selections,
    stake: stake,
    odds: totalOdds,
    potential_win: potentialWin,
    is_live: selections.some(s => matchMap[s.matchId]?.isLive()),
    system_size: systemSize,
    reference: generateBetReference(),
    ip_address: req?.ip || null,
    user_agent: req?.headers?.['user-agent'] || null,
    placed_at: new Date(),
  });

  // Update bet status to active
  await bet.update({ status: BET_STATUS.ACTIVE });

  // Track bet in wallet
  await walletService.trackBet(userId, stake);

  // Log audit
  await logAudit('BET_PLACED', userId, {
    betId: bet.id,
    stake: stake,
    potentialWin: potentialWin,
    selections: selections.length,
    betType: betType,
  }, req);

  logger.info(`Bet placed: ${bet.id} - ${stake} for user ${userId}`);

  // Clear cache
  await cache.del(`active_bets:${userId}`);

  return {
    success: true,
    bet: bet.toJSON(),
    potentialWin: potentialWin,
    totalOdds: totalOdds,
    selections: selections,
  };
};

/**
 * Get odds for a specific selection
 * @param {Object} match - Match object
 * @param {string} selection - Selection type
 * @returns {number|null} - Odds value
 */
const getOddsForSelection = (match, selection) => {
  const odds = match.odds || {};
  const oddsMap = {
    'home': odds.home,
    'away': odds.away,
    'draw': odds.draw,
    'over': odds.over,
    'under': odds.under,
    'home_double_chance': odds.home_double_chance,
    'away_double_chance': odds.away_double_chance,
    'draw_double_chance': odds.draw_double_chance,
    'both_teams_score_yes': odds.both_teams_score?.yes,
    'both_teams_score_no': odds.both_teams_score?.no,
    'total_goals_over': odds.total_goals?.over,
    'total_goals_under': odds.total_goals?.under,
  };

  return oddsMap[selection] || null;
};

/**
 * Generate a bet reference
 * @returns {string} - Bet reference
 */
const generateBetReference = () => {
  const prefix = 'BET';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}${timestamp}${random}`;
};

// ============================================
// CASH OUT
// ============================================

/**
 * Cash out a bet
 * @param {string} userId - User ID
 * @param {string} betId - Bet ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Cash out result
 */
const cashOutBet = async (userId, betId, req = null) => {
  const bet = await Bet.findOne({
    where: {
      id: betId,
      user_id: userId,
    },
  });

  if (!bet) {
    throw new Error('Bet not found');
  }

  if (!bet.canCashOut()) {
    throw new Error('This bet cannot be cashed out');
  }

  // Calculate cash out amount
  const cashOutAmount = await calculateCashOutAmount(bet);

  // Process cash out
  const wallet = await Wallet.findOne({ where: { user_id: userId } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const transaction = await Bet.sequelize.transaction();

  try {
    // Update bet
    await bet.update({
      status: BET_STATUS.CASHED_OUT,
      cash_out_amount: cashOutAmount,
      cash_out_time: new Date(),
    }, { transaction });

    // Unlock remaining locked funds
    const lockedAmount = parseFloat(bet.stake);
    await walletService.unlockFundsForBet(userId, lockedAmount, betId, 'Cash out', req);

    // Credit cash out amount to wallet
    await walletService.processBetWin(userId, cashOutAmount, betId, req);

    // Create cash out transaction
    await Transaction.create({
      user_id: userId,
      wallet_id: wallet.id,
      type: 'bet_cashout',
      category: 'betting',
      amount: cashOutAmount,
      balance_before: parseFloat(wallet.balance),
      balance_after: parseFloat(wallet.balance) + cashOutAmount,
      bonus_before: parseFloat(wallet.bonus_balance),
      bonus_after: parseFloat(wallet.bonus_balance),
      currency: wallet.currency,
      status: 'completed',
      bet_id: betId,
      description: `Cash out for bet ${bet.reference}`,
      completed_at: new Date(),
    }, { transaction });

    await transaction.commit();

    // Log audit
    await logAudit('BET_CASHED_OUT', userId, { betId, cashOutAmount }, req);
    logger.info(`Bet cashed out: ${betId} - ${cashOutAmount} for user ${userId}`);

    return {
      success: true,
      bet: bet.toJSON(),
      cashOutAmount,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Cash out failed for bet ${betId}:`, error);
    throw error;
  }
};

/**
 * Calculate cash out amount for a bet
 * @param {Object} bet - Bet object
 * @returns {Promise<number>} - Cash out amount
 */
const calculateCashOutAmount = async (bet) => {
  // Get current match status for all selections
  const selections = bet.selections || [];
  let cashOutFactor = 1;

  for (const selection of selections) {
    const match = await Match.findByPk(selection.matchId);
    if (!match || match.isFinished()) {
      // If match is finished, cash out may not be available
      return parseFloat(bet.stake) * 0.1; // Minimum return
    }

    // Calculate factor based on match progress
    if (match.isLive()) {
      // Live match - factor based on current score and time
      const progress = match.match_minute / 90;
      const scoreDiff = Math.abs(match.home_score - match.away_score);
      const factor = 1 - (progress * 0.5) - (scoreDiff * 0.05);
      cashOutFactor *= Math.max(0.1, Math.min(1, factor));
    } else {
      // Pre-match
      const timeToStart = (new Date(match.match_date) - new Date()) / (1000 * 60 * 60);
      if (timeToStart < 1) {
        cashOutFactor *= 0.9;
      } else if (timeToStart < 6) {
        cashOutFactor *= 0.95;
      }
    }
  }

  // Calculate cash out amount
  const potentialWin = parseFloat(bet.potential_win);
  const stake = parseFloat(bet.stake);
  const baseAmount = (stake + potentialWin) / 2;
  const cashOutAmount = baseAmount * cashOutFactor;

  // Ensure minimum return
  const minReturn = stake * 0.1;
  const maxReturn = potentialWin * 0.95;

  return Math.max(minReturn, Math.min(maxReturn, cashOutAmount));
};

// ============================================
// BET SETTLEMENT
// ============================================

/**
 * Settle a bet after match completion
 * @param {string} betId - Bet ID
 * @param {Object} results - Match results
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Settlement result
 */
const settleBet = async (betId, results, req = null) => {
  const bet = await Bet.findByPk(betId);
  if (!bet) {
    throw new Error('Bet not found');
  }

  if (bet.status !== BET_STATUS.ACTIVE && bet.status !== BET_STATUS.PENDING) {
    throw new Error('Bet cannot be settled');
  }

  // Determine if bet won
  const won = await determineBetResult(bet, results);

  // Process settlement
  const wallet = await Wallet.findOne({ where: { user_id: bet.user_id } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const transaction = await Bet.sequelize.transaction();

  try {
    if (won) {
      const winAmount = parseFloat(bet.potential_win);
      await walletService.processBetWin(bet.user_id, winAmount, betId, req);
      await bet.update({
        status: BET_STATUS.SETTLED,
        actual_win: winAmount,
        settlement_status: SETTLEMENT_STATUS.WON,
        settled_at: new Date(),
      }, { transaction });
    } else {
      const lossAmount = parseFloat(bet.stake);
      await walletService.processBetLoss(bet.user_id, lossAmount, betId, req);
      await bet.update({
        status: BET_STATUS.SETTLED,
        actual_loss: lossAmount,
        settlement_status: SETTLEMENT_STATUS.LOST,
        settled_at: new Date(),
      }, { transaction });
    }

    await transaction.commit();

    await logAudit('BET_SETTLED', bet.user_id, { betId, won, amount: won ? bet.potential_win : bet.stake }, req);
    logger.info(`Bet settled: ${betId} - ${won ? 'WON' : 'LOST'} for user ${bet.user_id}`);

    return {
      success: true,
      bet: bet.toJSON(),
      won,
      amount: won ? bet.potential_win : bet.stake,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Bet settlement failed for ${betId}:`, error);
    throw error;
  }
};

/**
 * Determine if a bet won based on results
 * @param {Object} bet - Bet object
 * @param {Object} results - Match results
 * @returns {Promise<boolean>} - Whether bet won
 */
const determineBetResult = async (bet, results) => {
  const selections = bet.selections || [];
  let allWon = true;

  for (const selection of selections) {
    const matchResult = results[selection.matchId];
    if (!matchResult) {
      // If match result is unknown, bet remains pending
      return false;
    }

    const selectionWon = checkSelectionResult(selection, matchResult);
    if (!selectionWon) {
      allWon = false;
      break;
    }
  }

  return allWon;
};

/**
 * Check if a specific selection won
 * @param {Object} selection - Selection object
 * @param {Object} matchResult - Match result
 * @returns {boolean} - Whether selection won
 */
const checkSelectionResult = (selection, matchResult) => {
  const { selection: selectionType, odds } = selection;
  const { homeScore, awayScore, homeTeam, awayTeam } = matchResult;

  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;
  const draw = homeScore === awayScore;
  const totalGoals = homeScore + awayScore;

  switch (selectionType) {
    case 'home':
      return homeWon;
    case 'away':
      return awayWon;
    case 'draw':
      return draw;
    case 'over':
      return totalGoals > odds;
    case 'under':
      return totalGoals < odds;
    case 'home_double_chance':
      return homeWon || draw;
    case 'away_double_chance':
      return awayWon || draw;
    case 'draw_double_chance':
      return homeWon || awayWon;
    case 'both_teams_score_yes':
      return homeScore > 0 && awayScore > 0;
    case 'both_teams_score_no':
      return homeScore === 0 || awayScore === 0;
    case 'total_goals_over':
      return totalGoals > odds;
    case 'total_goals_under':
      return totalGoals < odds;
    default:
      return false;
  }
};

// ============================================
// BET RETRIEVAL
// ============================================

/**
 * Get bet by ID
 * @param {string} betId - Bet ID
 * @param {string} userId - User ID (for authorization)
 * @returns {Promise<Object>} - Bet
 */
const getBetById = async (betId, userId) => {
  const bet = await Bet.findOne({
    where: {
      id: betId,
      user_id: userId,
    },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email', 'username'],
      },
    ],
  });

  if (!bet) {
    throw new Error('Bet not found');
  }

  return bet;
};

/**
 * Get bet history for a user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Bet history
 */
const getBetHistory = async (userId, options = {}) => {
  const {
    limit = 50,
    offset = 0,
    status = null,
    betType = null,
    startDate = null,
    endDate = null,
    minStake = null,
    maxStake = null,
  } = options;

  const where = { user_id: userId };
  if (status) where.status = status;
  if (betType) where.bet_type = betType;
  if (startDate) where.placed_at = { [Op.gte]: new Date(startDate) };
  if (endDate) where.placed_at = { ...where.placed_at, [Op.lte]: new Date(endDate) };
  if (minStake) where.stake = { [Op.gte]: minStake };
  if (maxStake) where.stake = { ...where.stake, [Op.lte]: maxStake };

  const { count, rows } = await Bet.findAndCountAll({
    where,
    limit,
    offset,
    order: [['placed_at', 'DESC']],
  });

  return {
    bets: rows,
    total: count,
    limit,
    offset,
    hasMore: offset + rows.length < count,
  };
};

/**
 * Get active bets for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Active bets
 */
const getActiveBets = async (userId) => {
  // Check cache
  const cacheKey = `active_bets:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Invalid cache, continue
    }
  }

  const bets = await Bet.findAll({
    where: {
      user_id: userId,
      status: {
        [Op.in]: [BET_STATUS.ACTIVE, BET_STATUS.PENDING],
      },
    },
    order: [['placed_at', 'DESC']],
  });

  await cache.set(cacheKey, JSON.stringify(bets), CACHE_TTL.ACTIVE_BETS);

  return bets;
};

/**
 * Get live bets for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Live bets
 */
const getLiveBets = async (userId) => {
  return Bet.findAll({
    where: {
      user_id: userId,
      is_live: true,
      status: {
        [Op.in]: [BET_STATUS.ACTIVE, BET_STATUS.PENDING],
      },
    },
    order: [['placed_at', 'DESC']],
  });
};

// ============================================
// BET STATISTICS
// ============================================

/**
 * Get bet statistics for a user
 * @param {string} userId - User ID
 * @param {Object} options - Options (period)
 * @returns {Promise<Object>} - Bet statistics
 */
const getBetStats = async (userId, options = {}) => {
  const { period = 'all' } = options;

  // Check cache
  const cacheKey = `bet_stats:${userId}:${period}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      // Invalid cache, continue
    }
  }

  let dateFilter = {};
  if (period !== 'all') {
    const now = new Date();
    if (period === 'today') {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      dateFilter = { placed_at: { [Op.gte]: start } };
    } else if (period === 'week') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      dateFilter = { placed_at: { [Op.gte]: start } };
    } else if (period === 'month') {
      const start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      dateFilter = { placed_at: { [Op.gte]: start } };
    } else if (period === 'year') {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      dateFilter = { placed_at: { [Op.gte]: start } };
    }
  }

  const where = { user_id: userId, ...dateFilter };

  const stats = await Bet.findOne({
    where,
    attributes: [
      [Bet.sequelize.fn('COUNT', Bet.sequelize.col('id')), 'total_bets'],
      [Bet.sequelize.fn('SUM', Bet.sequelize.col('stake')), 'total_stake'],
      [Bet.sequelize.fn('SUM', Bet.sequelize.literal('CASE WHEN status = \'settled\' AND settlement_status = \'won\' THEN actual_win ELSE 0 END')), 'total_wins'],
      [Bet.sequelize.fn('SUM', Bet.sequelize.literal('CASE WHEN status = \'settled\' AND settlement_status = \'lost\' THEN actual_loss ELSE 0 END')), 'total_losses'],
      [Bet.sequelize.fn('COUNT', Bet.sequelize.literal('CASE WHEN status = \'settled\' AND settlement_status = \'won\' THEN 1 END')), 'win_count'],
      [Bet.sequelize.fn('COUNT', Bet.sequelize.literal('CASE WHEN status = \'settled\' AND settlement_status = \'lost\' THEN 1 END')), 'loss_count'],
      [Bet.sequelize.fn('COUNT', Bet.sequelize.literal('CASE WHEN status = \'cashed_out\' THEN 1 END')), 'cashed_out_count'],
      [Bet.sequelize.fn('SUM', Bet.sequelize.literal('CASE WHEN status = \'cashed_out\' THEN cash_out_amount ELSE 0 END')), 'total_cash_out'],
    ],
    raw: true,
  });

  const totalBets = parseInt(stats?.total_bets || 0);
  const winCount = parseInt(stats?.win_count || 0);
  const lossCount = parseInt(stats?.loss_count || 0);
  const cashOutCount = parseInt(stats?.cashed_out_count || 0);

  const result = {
    totalBets,
    totalStake: parseFloat(stats?.total_stake || 0),
    totalWins: parseFloat(stats?.total_wins || 0),
    totalLosses: parseFloat(stats?.total_losses || 0),
    winCount,
    lossCount,
    cashOutCount,
    totalCashOut: parseFloat(stats?.total_cash_out || 0),
    netProfit: parseFloat(stats?.total_wins || 0) - parseFloat(stats?.total_losses || 0) + parseFloat(stats?.total_cash_out || 0),
    winRate: (winCount + lossCount) > 0 ? (winCount / (winCount + lossCount)) * 100 : 0,
    cashOutRate: totalBets > 0 ? (cashOutCount / totalBets) * 100 : 0,
  };

  await cache.set(cacheKey, JSON.stringify(result), CACHE_TTL.STATS);

  return result;
};

// ============================================
// ADMIN OPERATIONS
// ============================================

/**
 * Void a bet (admin)
 * @param {string} betId - Bet ID
 * @param {string} reason - Void reason
 * @param {string} adminId - Admin user ID
 * @param {Object} req - Express request object
 * @returns {Promise<Object>} - Void result
 */
const voidBet = async (betId, reason, adminId, req = null) => {
  const bet = await Bet.findByPk(betId);
  if (!bet) {
    throw new Error('Bet not found');
  }

  if (bet.status === BET_STATUS.SETTLED || bet.status === BET_STATUS.CASHED_OUT) {
    throw new Error('Cannot void a settled or cashed out bet');
  }

  const wallet = await Wallet.findOne({ where: { user_id: bet.user_id } });
  if (!wallet) {
    throw new Error('Wallet not found');
  }

  const transaction = await Bet.sequelize.transaction();

  try {
    // Refund stake
    const stake = parseFloat(bet.stake);
    await walletService.unlockFundsForBet(bet.user_id, stake, betId, 'Bet voided', req);

    // Update bet
    await bet.update({
      status: BET_STATUS.VOID,
      void_reason: reason,
    }, { transaction });

    // Create refund transaction
    await Transaction.create({
      user_id: bet.user_id,
      wallet_id: wallet.id,
      type: 'refund',
      category: 'adjustment',
      amount: stake,
      balance_before: parseFloat(wallet.balance),
      balance_after: parseFloat(wallet.balance) + stake,
      bonus_before: parseFloat(wallet.bonus_balance),
      bonus_after: parseFloat(wallet.bonus_balance),
      currency: wallet.currency,
      status: 'completed',
      bet_id: betId,
      description: `Bet voided: ${reason}`,
      admin_notes: `Voided by admin ${adminId}: ${reason}`,
      completed_at: new Date(),
    }, { transaction });

    await transaction.commit();

    await logAudit('BET_VOIDED', bet.user_id, { betId, reason, adminId }, req);
    logger.info(`Bet voided: ${betId} by admin ${adminId}`);

    return {
      success: true,
      bet: bet.toJSON(),
      refundedAmount: stake,
    };

  } catch (error) {
    await transaction.rollback();
    logger.error(`Failed to void bet ${betId}:`, error);
    throw error;
  }
};

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Get all bets for a match
 * @param {string} matchId - Match ID
 * @returns {Promise<Array>} - Bets
 */
const getBetsByMatch = async (matchId) => {
  // Find bets where matchId is in selections (JSONB query for PostgreSQL)
  const bets = await Bet.findAll({
    where: {
      selections: {
        [Op.contains]: [{ match_id: matchId }],
      },
      status: {
        [Op.in]: [BET_STATUS.ACTIVE, BET_STATUS.PENDING],
      },
    },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'first_name', 'last_name', 'email', 'username'],
      },
    ],
  });

  return bets;
};

/**
 * Get bets by match and selection
 * @param {string} matchId - Match ID
 * @param {string} selection - Selection type
 * @returns {Promise<Array>} - Bets
 */
const getBetsByMatchAndSelection = async (matchId, selection) => {
  const bets = await Bet.findAll({
    where: {
      selections: {
        [Op.contains]: [{ match_id: matchId, selection: selection }],
      },
      status: {
        [Op.in]: [BET_STATUS.ACTIVE, BET_STATUS.PENDING],
      },
    },
  });

  return bets;
};

/**
 * Get bet volume for a match
 * @param {string} matchId - Match ID
 * @returns {Promise<Object>} - Bet volume
 */
const getBetVolumeForMatch = async (matchId) => {
  const bets = await Bet.findAll({
    where: {
      selections: {
        [Op.contains]: [{ match_id: matchId }],
      },
      status: {
        [Op.in]: [BET_STATUS.ACTIVE, BET_STATUS.PENDING, BET_STATUS.SETTLED],
      },
    },
    attributes: ['stake', 'status', 'settlement_status', 'actual_win', 'actual_loss'],
  });

  const volume = {
    totalStake: 0,
    totalWins: 0,
    totalLosses: 0,
    totalBets: bets.length,
    settledBets: 0,
    pendingBets: 0,
  };

  for (const bet of bets) {
    volume.totalStake += parseFloat(bet.stake);
    if (bet.status === BET_STATUS.SETTLED) {
      volume.settledBets++;
      if (bet.settlement_status === SETTLEMENT_STATUS.WON) {
        volume.totalWins += parseFloat(bet.actual_win || 0);
      } else if (bet.settlement_status === SETTLEMENT_STATUS.LOST) {
        volume.totalLosses += parseFloat(bet.actual_loss || 0);
      }
    } else {
      volume.pendingBets++;
    }
  }

  return volume;
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Bet Placement
  placeBet,

  // Cash Out
  cashOutBet,
  calculateCashOutAmount,

  // Bet Settlement
  settleBet,
  determineBetResult,

  // Bet Retrieval
  getBetById,
  getBetHistory,
  getActiveBets,
  getLiveBets,

  // Bet Statistics
  getBetStats,

  // Admin Operations
  voidBet,

  // Bulk Operations
  getBetsByMatch,
  getBetsByMatchAndSelection,
  getBetVolumeForMatch,

  // Constants
  BET_TYPES,
  BET_STATUS,
  SETTLEMENT_STATUS,
  CACHE_TTL,
};
