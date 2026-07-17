/**
 * Bet Controller - Betting HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all betting-related HTTP requests including:
 * - Place single, accumulator, and system bets
 * - Cash out bets
 * - Bet history and filtering
 * - Live bets
 * - Bet details
 * - Bet statistics
 * - Admin bet operations (void, settle)
 * - Bet volume and match bet tracking
 */

const betService = require('../services/betService');
const matchService = require('../services/matchService');
const { catchAsync, createValidationError, createNotFoundError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// BET PLACEMENT
// ============================================

/**
 * Place a bet
 * POST /api/v1/bets/place
 */
const placeBet = catchAsync(async (req, res) => {
  const { selections, stake, betType = 'single', systemSize = null } = req.body;

  // Validate selections
  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    throw createValidationError('At least one selection is required');
  }

  // Validate stake
  if (!stake || stake <= 0) {
    throw createValidationError('Valid stake amount is required');
  }

  // Validate bet type
  if (!['single', 'accumulator', 'system'].includes(betType)) {
    throw createValidationError('Invalid bet type. Must be single, accumulator, or system');
  }

  // Validate system size
  if (betType === 'system' && (!systemSize || systemSize < 2)) {
    throw createValidationError('System size must be at least 2 for system bets');
  }

  const result = await betService.placeBet(req.user.id, {
    selections,
    stake: parseFloat(stake),
    betType,
    systemSize: systemSize ? parseInt(systemSize) : null,
  }, req);

  res.status(201).json({
    success: true,
    message: 'Bet placed successfully',
    data: {
      bet: result.bet,
      potentialWin: result.potentialWin,
      totalOdds: result.totalOdds,
      selections: result.selections,
    },
  });
});

/**
 * Place a bet with validation (pre-check odds)
 * POST /api/v1/bets/place/validate
 */
const validateBet = catchAsync(async (req, res) => {
  const { selections, stake, betType = 'single', systemSize = null } = req.body;

  // Validate selections
  if (!selections || !Array.isArray(selections) || selections.length === 0) {
    throw createValidationError('At least one selection is required');
  }

  // Validate stake
  if (!stake || stake <= 0) {
    throw createValidationError('Valid stake amount is required');
  }

  // Check if odds have changed for each selection
  const oddsChanged = [];
  let totalOdds = 1;
  let isValid = true;

  for (const selection of selections) {
    const match = await matchService.getMatchById(selection.matchId);
    if (!match) {
      throw createNotFoundError('Match', selection.matchId);
    }

    // Get current odds for selection
    const currentOdds = betService.getOddsForSelection(match, selection.selection);
    if (currentOdds && Math.abs(currentOdds - selection.odds) > 0.01) {
      oddsChanged.push({
        matchId: selection.matchId,
        selection: selection.selection,
        oldOdds: selection.odds,
        newOdds: currentOdds,
      });
      isValid = false;
    }
    totalOdds *= currentOdds || selection.odds;
  }

  const potentialWin = stake * totalOdds;

  res.status(200).json({
    success: true,
    data: {
      isValid,
      totalOdds,
      potentialWin,
      oddsChanged,
      message: isValid ? 'All odds are valid' : 'Some odds have changed',
    },
  });
});

// ============================================
// CASH OUT
// ============================================

/**
 * Cash out a bet
 * POST /api/v1/bets/cashout/:betId
 */
const cashOutBet = catchAsync(async (req, res) => {
  const { betId } = req.params;

  const result = await betService.cashOutBet(req.user.id, betId, req);

  res.status(200).json({
    success: true,
    message: 'Bet cashed out successfully',
    data: {
      bet: result.bet,
      cashOutAmount: result.cashOutAmount,
    },
  });
});

/**
 * Get cash out availability for a bet
 * GET /api/v1/bets/:betId/cashout-info
 */
const getCashOutInfo = catchAsync(async (req, res) => {
  const { betId } = req.params;

  const bet = await betService.getBetById(betId, req.user.id);

  const canCashOut = bet.canCashOut();
  let cashOutAmount = 0;

  if (canCashOut) {
    cashOutAmount = await betService.calculateCashOutAmount(bet);
  }

  res.status(200).json({
    success: true,
    data: {
      betId: bet.id,
      canCashOut,
      cashOutAmount,
      stake: bet.stake,
      potentialWin: bet.potential_win,
      status: bet.status,
    },
  });
});

// ============================================
// BET RETRIEVAL
// ============================================

/**
 * Get bet by ID
 * GET /api/v1/bets/:betId
 */
const getBetById = catchAsync(async (req, res) => {
  const { betId } = req.params;

  const bet = await betService.getBetById(betId, req.user.id);

  res.status(200).json({
    success: true,
    data: {
      bet,
    },
  });
});

/**
 * Get bet history
 * GET /api/v1/bets/history
 */
const getBetHistory = catchAsync(async (req, res) => {
  const {
    limit = 50,
    offset = 0,
    status = null,
    betType = null,
    startDate = null,
    endDate = null,
    minStake = null,
    maxStake = null,
  } = req.query;

  const result = await betService.getBetHistory(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    status,
    betType,
    startDate,
    endDate,
    minStake: minStake ? parseFloat(minStake) : null,
    maxStake: maxStake ? parseFloat(maxStake) : null,
  });

  res.status(200).json({
    success: true,
    data: {
      bets: result.bets,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get active bets
 * GET /api/v1/bets/active
 */
const getActiveBets = catchAsync(async (req, res) => {
  const bets = await betService.getActiveBets(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      bets,
      count: bets.length,
    },
  });
});

/**
 * Get live bets
 * GET /api/v1/bets/live
 */
const getLiveBets = catchAsync(async (req, res) => {
  const bets = await betService.getLiveBets(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      bets,
      count: bets.length,
    },
  });
});

/**
 * Get settled bets
 * GET /api/v1/bets/settled
 */
const getSettledBets = catchAsync(async (req, res) => {
  const {
    limit = 50,
    offset = 0,
    startDate = null,
    endDate = null,
  } = req.query;

  const result = await betService.getBetHistory(req.user.id, {
    limit: parseInt(limit),
    offset: parseInt(offset),
    status: 'settled',
    startDate,
    endDate,
  });

  res.status(200).json({
    success: true,
    data: {
      bets: result.bets,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

// ============================================
// BET STATISTICS
// ============================================

/**
 * Get bet statistics
 * GET /api/v1/bets/stats
 */
const getBetStats = catchAsync(async (req, res) => {
  const { period = 'all' } = req.query;

  const stats = await betService.getBetStats(req.user.id, { period });

  res.status(200).json({
    success: true,
    data: {
      stats,
    },
  });
});

/**
 * Get bet summary for current user
 * GET /api/v1/bets/summary
 */
const getBetSummary = catchAsync(async (req, res) => {
  const stats = await betService.getBetStats(req.user.id, { period: 'all' });

  const summary = {
    totalBets: stats.totalBets,
    totalStake: stats.totalStake,
    totalWins: stats.totalWins,
    totalLosses: stats.totalLosses,
    netProfit: stats.netProfit,
    winRate: stats.winRate,
    cashOutRate: stats.cashOutRate,
    activeBets: (await betService.getActiveBets(req.user.id)).length,
  };

  res.status(200).json({
    success: true,
    data: {
      summary,
    },
  });
});

// ============================================
// ADMIN BET OPERATIONS
// ============================================

/**
 * Void a bet (admin only)
 * POST /api/v1/bets/void/:betId
 */
const voidBet = catchAsync(async (req, res) => {
  const { betId } = req.params;
  const { reason } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can void bets');
  }

  if (!reason) {
    throw createValidationError('Void reason is required');
  }

  const result = await betService.voidBet(betId, reason, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'Bet voided successfully',
    data: {
      bet: result.bet,
      refundedAmount: result.refundedAmount,
    },
  });
});

/**
 * Settle a bet (admin only)
 * POST /api/v1/bets/settle/:betId
 */
const settleBet = catchAsync(async (req, res) => {
  const { betId } = req.params;
  const { results } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can settle bets');
  }

  if (!results || typeof results !== 'object') {
    throw createValidationError('Match results are required for settlement');
  }

  const result = await betService.settleBet(betId, results, req);

  res.status(200).json({
    success: true,
    message: `Bet settled successfully - ${result.won ? 'WON' : 'LOST'}`,
    data: {
      bet: result.bet,
      won: result.won,
      amount: result.amount,
    },
  });
});

/**
 * Get bets by match (admin only)
 * GET /api/v1/bets/match/:matchId
 */
const getBetsByMatch = catchAsync(async (req, res) => {
  const { matchId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view bets by match');
  }

  const bets = await betService.getBetsByMatch(matchId);

  res.status(200).json({
    success: true,
    data: {
      bets,
      count: bets.length,
    },
  });
});

/**
 * Get bet volume for a match (admin only)
 * GET /api/v1/bets/match/:matchId/volume
 */
const getMatchBetVolume = catchAsync(async (req, res) => {
  const { matchId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view bet volume');
  }

  const volume = await betService.getBetVolumeForMatch(matchId);

  res.status(200).json({
    success: true,
    data: {
      volume,
    },
  });
});

/**
 * Get bets by match and selection (admin only)
 * GET /api/v1/bets/match/:matchId/selection/:selection
 */
const getBetsByMatchAndSelection = catchAsync(async (req, res) => {
  const { matchId, selection } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Only admins can view bets by selection');
  }

  const bets = await betService.getBetsByMatchAndSelection(matchId, selection);

  res.status(200).json({
    success: true,
    data: {
      bets,
      count: bets.length,
    },
  });
});

// Export all controller methods
module.exports = {
  // Bet Placement
  placeBet,
  validateBet,

  // Cash Out
  cashOutBet,
  getCashOutInfo,

  // Bet Retrieval
  getBetById,
  getBetHistory,
  getActiveBets,
  getLiveBets,
  getSettledBets,

  // Bet Statistics
  getBetStats,
  getBetSummary,

  // Admin
  voidBet,
  settleBet,
  getBetsByMatch,
  getMatchBetVolume,
  getBetsByMatchAndSelection,
};
