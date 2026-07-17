/**
 * Odds Integration - Third-Party Odds Provider
 * CephasGM GameZone
 * 
 * This file integrates with third-party odds providers to fetch
 * real-time odds for sports matches. It supports:
 * - Fetching odds for all matches
 * - Real-time odds updates
 * - Webhook handling for odds changes
 * - Odds mapping to internal match data
 * - Health checks and status monitoring
 * 
 * The integration simulates a real odds provider for demonstration
 * purposes, but can be easily swapped with a real provider like:
 * - OddsAPI
 * - Sportmonks
 * - The Odds API
 * - Betfair
 */

const axios = require('axios');
const logger = require('../utils/logger');
const matchService = require('../services/matchService');

// ============================================
// CONFIGURATION
// ============================================

const config = {
  provider: process.env.ODDS_PROVIDER || 'mock',
  apiKey: process.env.ODDS_API_KEY,
  baseUrl: process.env.ODDS_BASE_URL || 'https://api.oddsprovider.com/v1',
  refreshInterval: parseInt(process.env.ODDS_REFRESH_INTERVAL) || 60000, // 1 minute
  sportIds: (process.env.ODDS_SPORT_IDS || 'football,basketball,tennis').split(','),
  regions: (process.env.ODDS_REGIONS || 'uk,us,eu').split(','),
  markets: (process.env.ODDS_MARKETS || 'h2h,spreads,totals').split(','),
  webhookSecret: process.env.ODDS_WEBHOOK_SECRET || 'webhook_secret',
};

// ============================================
// MOCK ODDS PROVIDER (Fallback)
// ============================================

const mockOddsData = {
  football: {
    matches: [
      {
        id: 'mock_match_1',
        sport: 'football',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        league: 'Premier League',
        status: 'live',
        minute: 67,
        score: { home: 2, away: 1 },
        odds: {
          home: 1.95,
          away: 3.20,
          draw: 3.40,
          over: 1.90,
          under: 1.90,
          both_teams_score: { yes: 1.80, no: 1.90 },
          total_goals: { over_2_5: 1.90, under_2_5: 1.90 },
          correct_score: {
            '2-0': 12.00,
            '1-0': 8.00,
            '2-1': 9.00,
          },
          first_goal: {
            home: 1.80,
            away: 2.00,
          },
          handicap: {
            home: 1.95,
            away: 1.85,
          },
        },
        updates: [
          { type: 'goal', team: 'home', player: 'Saka', minute: 23 },
          { type: 'goal', team: 'home', player: 'Odegaard', minute: 38 },
          { type: 'goal', team: 'away', player: 'Sterling', minute: 42 },
          { type: 'yellow_card', team: 'home', player: 'Partey', minute: 55 },
        ],
      },
      {
        id: 'mock_match_2',
        sport: 'football',
        homeTeam: 'Barcelona',
        awayTeam: 'Real Madrid',
        league: 'La Liga',
        status: 'scheduled',
        scheduledTime: new Date(Date.now() + 3600000).toISOString(),
        odds: {
          home: 2.40,
          away: 2.90,
          draw: 3.20,
          over: 1.85,
          under: 1.95,
          both_teams_score: { yes: 1.70, no: 2.10 },
          total_goals: { over_2_5: 1.85, under_2_5: 1.95 },
        },
      },
      {
        id: 'mock_match_3',
        sport: 'football',
        homeTeam: 'Bayern Munich',
        awayTeam: 'Dortmund',
        league: 'Bundesliga',
        status: 'scheduled',
        scheduledTime: new Date(Date.now() + 7200000).toISOString(),
        odds: {
          home: 1.80,
          away: 4.20,
          draw: 3.60,
          over: 1.80,
          under: 2.00,
          both_teams_score: { yes: 1.65, no: 2.20 },
          total_goals: { over_2_5: 1.80, under_2_5: 2.00 },
        },
      },
    ],
  },
  basketball: {
    matches: [
      {
        id: 'mock_basketball_1',
        sport: 'basketball',
        homeTeam: 'Lakers',
        awayTeam: 'Celtics',
        league: 'NBA',
        status: 'live',
        quarter: 4,
        timeRemaining: '2:34',
        score: { home: 89, away: 85 },
        odds: {
          home: 1.75,
          away: 1.95,
          spread: { home: -5.5, away: 5.5 },
          totals: { over: 1.85, under: 1.85 },
        },
      },
    ],
  },
  tennis: {
    matches: [
      {
        id: 'mock_tennis_1',
        sport: 'tennis',
        homeTeam: 'Djokovic',
        awayTeam: 'Nadal',
        league: 'Wimbledon',
        status: 'live',
        set: 3,
        score: { home: '6-4, 3-6, 4-3', away: '6-4, 3-6, 4-3' },
        odds: {
          home: 1.55,
          away: 2.35,
          set_winner: { home: 1.70, away: 2.10 },
          total_games: { over: 1.85, under: 1.85 },
        },
      },
    ],
  },
};

// ============================================
// ODDS PROVIDER CLASS
// ============================================

class OddsProvider {
  constructor() {
    this.initialized = false;
    this.provider = config.provider;
    this.intervalId = null;
    this.lastUpdate = null;
    this.oddsCache = new Map();
    this.activeSubscriptions = new Set();
    this.callbacks = [];
  }

  /**
   * Initialize the odds provider
   */
  async initialize() {
    try {
      // For mock provider, we don't need to do anything
      if (this.provider === 'mock') {
        logger.info('📊 Mock odds provider initialized');
        this.initialized = true;
        this.lastUpdate = new Date();
        return { initialized: true, provider: 'mock' };
      }

      // For real provider, validate API key and connection
      if (this.provider === 'real' || this.provider === 'api') {
        if (!config.apiKey) {
          throw new Error('ODDS_API_KEY is required for real provider');
        }
        await this.testConnection();
        logger.info('📊 Real odds provider initialized');
        this.initialized = true;
        this.lastUpdate = new Date();
        return { initialized: true, provider: this.provider };
      }

      throw new Error(`Unknown odds provider: ${this.provider}`);
    } catch (error) {
      logger.error('❌ Odds provider initialization failed:', error.message);
      this.initialized = false;
      return { initialized: false, error: error.message };
    }
  }

  /**
   * Test connection to the odds provider
   */
  async testConnection() {
    try {
      const response = await axios.get(`${config.baseUrl}/health`, {
        params: { apiKey: config.apiKey },
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }
  }

  /**
   * Get status of the odds provider
   */
  getStatus() {
    return {
      initialized: this.initialized,
      provider: this.provider,
      lastUpdate: this.lastUpdate,
      cacheSize: this.oddsCache.size,
      subscriptions: this.activeSubscriptions.size,
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, reason: 'Not initialized' };
    }

    try {
      if (this.provider === 'mock') {
        return { healthy: true };
      }
      await this.testConnection();
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Fetch odds for all matches
   */
  async fetchOdds(options = {}) {
    const { sportIds = config.sportIds, regions = config.regions, markets = config.markets } = options;

    try {
      let data;

      if (this.provider === 'mock') {
        // Return mock data
        data = this.generateMockOdds(sportIds);
      } else {
        // Fetch from real API
        const response = await axios.get(`${config.baseUrl}/odds`, {
          params: {
            apiKey: config.apiKey,
            sportIds: sportIds.join(','),
            regions: regions.join(','),
            markets: markets.join(','),
          },
          timeout: 10000,
        });
        data = response.data;
      }

      // Update cache
      this.updateCache(data);
      this.lastUpdate = new Date();

      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
        provider: this.provider,
      };
    } catch (error) {
      logger.error('❌ Fetch odds failed:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate mock odds data
   */
  generateMockOdds(sportIds = ['football']) {
    const result = {};

    for (const sportId of sportIds) {
      const sportData = mockOddsData[sportId];
      if (sportData) {
        // Add some randomization to odds
        const matches = sportData.matches.map(match => {
          const odds = match.odds;
          const randomizedOdds = {};
          for (const [key, value] of Object.entries(odds)) {
            if (typeof value === 'number') {
              const randomFactor = 1 + (Math.random() - 0.5) * 0.1;
              randomizedOdds[key] = Math.round(value * randomFactor * 100) / 100;
            } else if (typeof value === 'object' && value !== null) {
              randomizedOdds[key] = {};
              for (const [subKey, subValue] of Object.entries(value)) {
                if (typeof subValue === 'number') {
                  const randomFactor = 1 + (Math.random() - 0.5) * 0.1;
                  randomizedOdds[key][subKey] = Math.round(subValue * randomFactor * 100) / 100;
                } else {
                  randomizedOdds[key][subKey] = subValue;
                }
              }
            } else {
              randomizedOdds[key] = value;
            }
          }

          return {
            ...match,
            odds: randomizedOdds,
            lastUpdated: new Date().toISOString(),
          };
        });

        result[sportId] = {
          matches,
          count: matches.length,
          updatedAt: new Date().toISOString(),
        };
      } else {
        result[sportId] = {
          matches: [],
          count: 0,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    return result;
  }

  /**
   * Update the odds cache
   */
  updateCache(data) {
    // Store in cache for quick access
    for (const [sportId, sportData] of Object.entries(data)) {
      if (sportData.matches) {
        for (const match of sportData.matches) {
          this.oddsCache.set(match.id, {
            ...match,
            cachedAt: new Date().toISOString(),
            sport: sportId,
          });
        }
      }
    }
  }

  /**
   * Get odds for a specific match
   */
  async getMatchOdds(matchId) {
    // Check cache first
    if (this.oddsCache.has(matchId)) {
      return { success: true, data: this.oddsCache.get(matchId) };
    }

    // Fetch from provider if not in cache
    try {
      let data;
      if (this.provider === 'mock') {
        // Search in mock data
        const allData = this.generateMockOdds();
        for (const sportData of Object.values(allData)) {
          const match = sportData.matches?.find(m => m.id === matchId);
          if (match) {
            data = match;
            break;
          }
        }
      } else {
        const response = await axios.get(`${config.baseUrl}/odds/${matchId}`, {
          params: { apiKey: config.apiKey },
          timeout: 5000,
        });
        data = response.data;
      }

      if (data) {
        this.oddsCache.set(matchId, data);
        return { success: true, data };
      }

      return { success: false, error: 'Match not found' };
    } catch (error) {
      logger.error(`❌ Failed to get odds for match ${matchId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update odds for a specific match
   */
  async updateMatchOdds(matchId, newOdds) {
    try {
      const currentData = this.oddsCache.get(matchId);
      if (!currentData) {
        return { success: false, error: 'Match not found in cache' };
      }

      // Update the odds in cache
      const updatedData = {
        ...currentData,
        odds: {
          ...currentData.odds,
          ...newOdds,
        },
        lastUpdated: new Date().toISOString(),
      };

      this.oddsCache.set(matchId, updatedData);

      // In production, this would also update the provider's database
      // via API call if needed

      return {
        success: true,
        data: updatedData,
      };
    } catch (error) {
      logger.error(`❌ Failed to update odds for match ${matchId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Subscribe to real-time odds updates
   */
  subscribeToUpdates(matchId, callback) {
    this.activeSubscriptions.add(matchId);
    this.callbacks.push({ matchId, callback });
    logger.debug(`📊 Subscribed to odds updates for match ${matchId}`);
  }

  /**
   * Unsubscribe from real-time odds updates
   */
  unsubscribeFromUpdates(matchId) {
    this.activeSubscriptions.delete(matchId);
    this.callbacks = this.callbacks.filter(cb => cb.matchId !== matchId);
    logger.debug(`📊 Unsubscribed from odds updates for match ${matchId}`);
  }

  /**
   * Start real-time updates (simulated)
   */
  startRealtimeUpdates(interval = config.refreshInterval) {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    logger.info(`📊 Starting real-time odds updates (interval: ${interval}ms)`);

    this.intervalId = setInterval(async () => {
      try {
        if (this.activeSubscriptions.size === 0) {
          return;
        }

        // Fetch updated odds for subscribed matches
        const updates = await this.fetchOdds();

        if (updates.success && updates.data) {
          // Process updates for subscribed matches
          for (const [sportId, sportData] of Object.entries(updates.data)) {
            if (sportData.matches) {
              for (const match of sportData.matches) {
                if (this.activeSubscriptions.has(match.id)) {
                  // Notify subscribers
                  this.callbacks
                    .filter(cb => cb.matchId === match.id)
                    .forEach(cb => {
                      try {
                        cb.callback(match);
                      } catch (error) {
                        logger.error('Error in odds callback:', error);
                      }
                    });
                }
              }
            }
          }
        }
      } catch (error) {
        logger.error('Error in real-time odds update:', error);
      }
    }, interval);
  }

  /**
   * Stop real-time updates
   */
  stopRealtimeUpdates() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('📊 Stopped real-time odds updates');
    }
  }

  /**
   * Handle webhook from odds provider
   */
  async handleWebhook(payload, headers) {
    // Verify webhook signature
    const signature = headers['x-webhook-signature'] || headers['X-Webhook-Signature'];
    if (signature && !this.verifyWebhookSignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const event = payload.event || payload.type;
    const data = payload.data || payload;

    // Process event based on type
    switch (event) {
      case 'odds.updated':
        return await this.handleOddsUpdated(data);
      case 'match.started':
        return await this.handleMatchStarted(data);
      case 'match.finished':
        return await this.handleMatchFinished(data);
      default:
        logger.info(`Unhandled webhook event: ${event}`);
        return { event, handled: false };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    // Simple HMAC verification
    const computed = crypto.createHmac('sha256', config.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  }

  /**
   * Handle odds updated webhook
   */
  async handleOddsUpdated(data) {
    const { matchId, odds, match } = data;

    // Update cache
    const updated = await this.updateMatchOdds(matchId, odds);

    // Notify subscribers
    if (updated.success) {
      this.callbacks
        .filter(cb => cb.matchId === matchId)
        .forEach(cb => {
          try {
            cb.callback(updated.data);
          } catch (error) {
            logger.error('Error in odds callback:', error);
          }
        });

      // Also update match in database via service
      try {
        await matchService.updateMatchOdds(matchId, odds);
      } catch (error) {
        logger.error('Failed to update match odds in database:', error);
      }
    }

    return {
      event: 'odds.updated',
      matchId,
      updated: updated.success,
      data: updated.data,
    };
  }

  /**
   * Handle match started webhook
   */
  async handleMatchStarted(data) {
    const { matchId, match } = data;

    try {
      await matchService.startMatch(matchId);
      logger.info(`Match ${matchId} started via webhook`);
    } catch (error) {
      logger.error(`Failed to start match ${matchId}:`, error);
    }

    return {
      event: 'match.started',
      matchId,
      handled: true,
    };
  }

  /**
   * Handle match finished webhook
   */
  async handleMatchFinished(data) {
    const { matchId, match, result } = data;

    try {
      await matchService.endMatch(matchId);
      logger.info(`Match ${matchId} finished via webhook`);
    } catch (error) {
      logger.error(`Failed to end match ${matchId}:`, error);
    }

    return {
      event: 'match.finished',
      matchId,
      handled: true,
    };
  }

  /**
   * Map odds from provider format to internal format
   */
  mapOddsToInternal(providerOdds) {
    // This maps provider-specific odds format to the internal format
    // used by the match service
    const internalOdds = {};

    // Handle different provider formats
    if (providerOdds.home !== undefined) {
      internalOdds.home = providerOdds.home;
    }
    if (providerOdds.away !== undefined) {
      internalOdds.away = providerOdds.away;
    }
    if (providerOdds.draw !== undefined) {
      internalOdds.draw = providerOdds.draw;
    }
    if (providerOdds.over !== undefined) {
      internalOdds.over = providerOdds.over;
    }
    if (providerOdds.under !== undefined) {
      internalOdds.under = providerOdds.under;
    }

    // Double chance
    if (providerOdds.home_draw !== undefined) {
      internalOdds.home_double_chance = providerOdds.home_draw;
    }
    if (providerOdds.away_draw !== undefined) {
      internalOdds.away_double_chance = providerOdds.away_draw;
    }

    // Both teams to score
    if (providerOdds.btts_yes !== undefined) {
      internalOdds.both_teams_score = {
        yes: providerOdds.btts_yes,
        no: providerOdds.btts_no || 1.90,
      };
    }

    // Total goals
    if (providerOdds.over_2_5 !== undefined) {
      internalOdds.total_goals = {
        over: providerOdds.over_2_5,
        under: providerOdds.under_2_5 || 1.90,
      };
    }

    return internalOdds;
  }

  /**
   * Map match from provider format to internal format
   */
  mapMatchToInternal(providerMatch) {
    return {
      homeTeam: providerMatch.homeTeam || providerMatch.home,
      awayTeam: providerMatch.awayTeam || providerMatch.away,
      league: providerMatch.league,
      status: this.mapStatus(providerMatch.status),
      homeScore: providerMatch.score?.home || 0,
      awayScore: providerMatch.score?.away || 0,
      matchMinute: providerMatch.minute || providerMatch.time || 0,
      odds: this.mapOddsToInternal(providerMatch.odds),
      providerId: providerMatch.id,
      metadata: providerMatch.metadata || {},
    };
  }

  /**
   * Map provider status to internal status
   */
  mapStatus(providerStatus) {
    const statusMap = {
      scheduled: 'scheduled',
      pending: 'scheduled',
      live: 'live',
      in_progress: 'live',
      halftime: 'halftime',
      extra_time: 'extra_time',
      penalties: 'penalties',
      finished: 'finished',
      ended: 'finished',
      postponed: 'postponed',
      cancelled: 'cancelled',
      abandoned: 'abandoned',
    };
    return statusMap[providerStatus] || 'scheduled';
  }

  /**
   * Sync odds with internal database
   */
  async syncOdds() {
    try {
      const result = await this.fetchOdds();
      if (!result.success) {
        logger.error('Failed to sync odds:', result.error);
        return { success: false, error: result.error };
      }

      let syncedCount = 0;
      for (const [sportId, sportData] of Object.entries(result.data)) {
        if (sportData.matches) {
          for (const match of sportData.matches) {
            try {
              const internalMatch = this.mapMatchToInternal(match);
              // Update match in database
              await matchService.updateMatch(match.id, {
                home_team: internalMatch.homeTeam,
                away_team: internalMatch.awayTeam,
                status: internalMatch.status,
                home_score: internalMatch.homeScore,
                away_score: internalMatch.awayScore,
                match_minute: internalMatch.matchMinute,
                odds: internalMatch.odds,
                provider_id: match.id,
              });
              syncedCount++;
            } catch (error) {
              logger.error(`Failed to sync match ${match.id}:`, error);
            }
          }
        }
      }

      logger.info(`✅ Synced ${syncedCount} matches from odds provider`);
      return { success: true, syncedCount };
    } catch (error) {
      logger.error('Sync failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// ============================================
// EXPORTS
// ============================================

// Create singleton instance
const oddsProvider = new OddsProvider();

module.exports = {
  OddsProvider,
  oddsProvider,
  config,
  // Convenience functions
  initialize: () => oddsProvider.initialize(),
  getStatus: () => oddsProvider.getStatus(),
  healthCheck: () => oddsProvider.healthCheck(),
  fetchOdds: (options) => oddsProvider.fetchOdds(options),
  getMatchOdds: (matchId) => oddsProvider.getMatchOdds(matchId),
  updateMatchOdds: (matchId, odds) => oddsProvider.updateMatchOdds(matchId, odds),
  subscribeToUpdates: (matchId, callback) => oddsProvider.subscribeToUpdates(matchId, callback),
  unsubscribeFromUpdates: (matchId) => oddsProvider.unsubscribeFromUpdates(matchId),
  startRealtimeUpdates: (interval) => oddsProvider.startRealtimeUpdates(interval),
  stopRealtimeUpdates: () => oddsProvider.stopRealtimeUpdates(),
  handleWebhook: (payload, headers) => oddsProvider.handleWebhook(payload, headers),
  syncOdds: () => oddsProvider.syncOdds(),
  mapOddsToInternal: (odds) => oddsProvider.mapOddsToInternal(odds),
  mapMatchToInternal: (match) => oddsProvider.mapMatchToInternal(match),
};
