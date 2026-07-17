/**
 * Match Model - Sports Match Management
 * CephasGM GameZone
 * 
 * This model manages all sports matches including live and pre-match
 * events. It tracks match details, scores, status, odds, and provides
 * real-time updates for live betting functionality.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Match Model Definition
 */
const Match = sequelize.define(
  'Match',
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    // Sport and League Associations
    sport_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'sports',
        key: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },
    league_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'leagues',
        key: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    },

    // Match Teams
    home_team: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    away_team: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    home_team_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    away_team_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // Match Details
    venue: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    match_date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    match_time: {
      type: DataTypes.TIME,
      allowNull: true,
    },

    // Match Status
    status: {
      type: DataTypes.ENUM(
        'scheduled',
        'live',
        'halftime',
        'extra_time',
        'penalties',
        'postponed',
        'cancelled',
        'finished',
        'abandoned'
      ),
      defaultValue: 'scheduled',
      allowNull: false,
    },

    // Live Match Data
    home_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    away_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    home_ht_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    away_ht_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    home_ft_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    away_ft_score: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },

    // Match Timing
    match_minute: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    match_second: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    extra_minute: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    injury_time: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },

    // Match Events (JSON array)
    events: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },

    // Odds Data
    odds: {
      type: DataTypes.JSONB,
      defaultValue: {
        home: 0,
        away: 0,
        draw: 0,
        over: 0,
        under: 0,
        home_double_chance: 0,
        away_double_chance: 0,
        draw_double_chance: 0,
        both_teams_score: { yes: 0, no: 0 },
        total_goals: { over: 0, under: 0 },
        correct_score: {},
        first_goal: {},
        handicap: {},
      },
      allowNull: false,
    },

    // Odds History (track changes for live betting)
    odds_history: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },

    // Statistics (JSON)
    statistics: {
      type: DataTypes.JSONB,
      defaultValue: {
        possession: { home: 0, away: 0 },
        shots: { home: 0, away: 0 },
        shots_on_target: { home: 0, away: 0 },
        corners: { home: 0, away: 0 },
        fouls: { home: 0, away: 0 },
        yellow_cards: { home: 0, away: 0 },
        red_cards: { home: 0, away: 0 },
        offsides: { home: 0, away: 0 },
        passes: { home: 0, away: 0 },
        pass_accuracy: { home: 0, away: 0 },
      },
      allowNull: false,
    },

    // Broadcast/Streaming
    broadcast_channels: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },
    stream_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },

    // External IDs (for third-party providers)
    provider_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    provider_data: {
      type: DataTypes.JSONB,
      allowNull: true,
    },

    // Betting Limits
    max_bet_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 10000,
      allowNull: false,
    },
    min_bet_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.10,
      allowNull: false,
    },

    // Admin fields
    is_featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    is_live_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },

    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
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
    last_odds_update: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    finished_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    // Model options
    tableName: 'matches',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      {
        fields: ['sport_id'],
      },
      {
        fields: ['league_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['match_date'],
      },
      {
        fields: ['is_featured'],
      },
      {
        fields: ['provider_id'],
        where: {
          provider_id: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      {
        // For live betting queries
        fields: ['status', 'match_date'],
      },
      {
        // For featured matches
        fields: ['is_featured', 'status'],
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a match, set default values
       */
      beforeCreate: (match) => {
        // Ensure odds have all required fields
        if (!match.odds) {
          match.odds = {
            home: 0,
            away: 0,
            draw: 0,
          };
        }

        // Initialize statistics if not provided
        if (!match.statistics) {
          match.statistics = {
            possession: { home: 0, away: 0 },
            shots: { home: 0, away: 0 },
            shots_on_target: { home: 0, away: 0 },
            corners: { home: 0, away: 0 },
            fouls: { home: 0, away: 0 },
            yellow_cards: { home: 0, away: 0 },
            red_cards: { home: 0, away: 0 },
          };
        }

        // Initialize events array
        if (!match.events) {
          match.events = [];
        }

        // Initialize odds history
        if (!match.odds_history) {
          match.odds_history = [];
        }

        // If match is live, set started_at
        if (match.status === 'live' && !match.started_at) {
          match.started_at = new Date();
        }
      },

      /**
       * Before updating a match, track changes
       */
      beforeUpdate: async (match) => {
        // Track odds changes
        if (match.changed('odds')) {
          const oldOdds = match.previous('odds');
          const newOdds = match.odds;

          // Add to odds history
          const historyEntry = {
            timestamp: new Date(),
            old_odds: oldOdds,
            new_odds: newOdds,
          };

          const history = match.odds_history || [];
          history.push(historyEntry);

          // Keep only last 100 changes
          if (history.length > 100) {
            history.splice(0, history.length - 100);
          }

          match.odds_history = history;
          match.last_odds_update = new Date();
        }

        // Update match status timestamps
        if (match.changed('status')) {
          const newStatus = match.status;
          if (newStatus === 'live' && !match.started_at) {
            match.started_at = new Date();
          }
          if (newStatus === 'finished' && !match.finished_at) {
            match.finished_at = new Date();
          }
        }
      },
    },
  }
);

/**
 * Instance methods
 */
Match.prototype = {
  ...Match.prototype,

  /**
   * Check if match is live
   * @returns {boolean} - Whether match is live
   */
  isLive() {
    return this.status === 'live' || this.status === 'halftime';
  },

  /**
   * Check if match is finished
   * @returns {boolean} - Whether match is finished
   */
  isFinished() {
    return this.status === 'finished' || this.status === 'abandoned';
  },

  /**
   * Check if match is betable
   * @returns {boolean} - Whether match can be bet on
   */
  isBetable() {
    const nonBetableStatuses = ['finished', 'cancelled', 'abandoned'];
    return !nonBetableStatuses.includes(this.status) && this.match_date <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  },

  /**
   * Get match status display name
   * @returns {string} - Display name
   */
  getStatusDisplay() {
    const statusMap = {
      scheduled: '⏳ Scheduled',
      live: '🟢 Live',
      halftime: '⏸️ Halftime',
      extra_time: '⏱️ Extra Time',
      penalties: '⚽ Penalties',
      postponed: '📅 Postponed',
      cancelled: '❌ Cancelled',
      finished: '🏁 Finished',
      abandoned: '⛔ Abandoned',
    };
    return statusMap[this.status] || this.status;
  },

  /**
   * Get match time display
   * @returns {string} - Time display
   */
  getTimeDisplay() {
    if (this.isLive()) {
      let time = `${this.match_minute}'`;
      if (this.injury_time > 0) {
        time += ` +${this.injury_time}'`;
      }
      return time;
    }
    return this.match_date.toLocaleString();
  },

  /**
   * Get match score display
   * @returns {string} - Score display
   */
  getScoreDisplay() {
    return `${this.home_score} - ${this.away_score}`;
  },

  /**
   * Get match full score display
   * @returns {string} - Full score display
   */
  getFullScoreDisplay() {
    if (this.isFinished()) {
      return `FT ${this.home_ft_score} - ${this.away_ft_score}`;
    }
    if (this.match_minute > 0) {
      return `${this.home_score} - ${this.away_score}`;
    }
    return `${this.home_team} vs ${this.away_team}`;
  },

  /**
   * Update match score
   * @param {number} homeScore - Home team score
   * @param {number} awayScore - Away team score
   * @param {number} minute - Match minute
   * @returns {Promise<Match>} - Updated match
   */
  async updateScore(homeScore, awayScore, minute = null) {
    this.home_score = homeScore;
    this.away_score = awayScore;

    if (minute !== null) {
      this.match_minute = minute;
    }

    // Update half-time scores if needed
    if (this.match_minute === 45 || this.match_minute === 45) {
      this.home_ht_score = homeScore;
      this.away_ht_score = awayScore;
    }

    await this.save();
    logger.info(`Match ${this.id} score updated: ${homeScore}-${awayScore} at ${this.match_minute}'`);
    return this;
  },

  /**
   * Add a match event
   * @param {Object} event - Event data
   * @returns {Promise<Match>} - Updated match
   */
  async addEvent(event) {
    const events = this.events || [];
    events.push({
      ...event,
      timestamp: new Date(),
    });
    this.events = events;
    await this.save();
    return this;
  },

  /**
   * Update match odds
   * @param {Object} odds - New odds data
   * @returns {Promise<Match>} - Updated match
   */
  async updateOdds(odds) {
    this.odds = {
      ...this.odds,
      ...odds,
    };
    await this.save();
    return this;
  },

  /**
   * Update match statistics
   * @param {Object} stats - Statistics data
   * @returns {Promise<Match>} - Updated match
   */
  async updateStatistics(stats) {
    this.statistics = {
      ...this.statistics,
      ...stats,
    };
    await this.save();
    return this;
  },

  /**
   * Get match summary for display
   * @returns {Object} - Match summary
   */
  getSummary() {
    return {
      id: this.id,
      homeTeam: this.home_team,
      awayTeam: this.away_team,
      homeScore: this.home_score,
      awayScore: this.away_score,
      status: this.status,
      statusDisplay: this.getStatusDisplay(),
      timeDisplay: this.getTimeDisplay(),
      scoreDisplay: this.getScoreDisplay(),
      odds: this.odds,
      isLive: this.isLive(),
      isFinished: this.isFinished(),
      isBetable: this.isBetable(),
    };
  },

  /**
   * Get simplified match data for betting slip
   * @returns {Object} - Simplified match data
   */
  getBettingData() {
    return {
      matchId: this.id,
      homeTeam: this.home_team,
      awayTeam: this.away_team,
      status: this.status,
      odds: {
        home: this.odds.home,
        away: this.odds.away,
        draw: this.odds.draw,
      },
      isLive: this.isLive(),
      matchMinute: this.match_minute,
    };
  },
};

/**
 * Static methods
 */
Match.findByLeague = async function(leagueId, options = {}) {
  const { limit = 50, offset = 0, status = null } = options;

  const where = { league_id: leagueId };
  if (status) where.status = status;

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['match_date', 'ASC'],
      ['status', 'ASC'],
    ],
  });
};

Match.findBySport = async function(sportId, options = {}) {
  const { limit = 50, offset = 0, status = null, date = null } = options;

  const where = { sport_id: sportId };
  if (status) where.status = status;
  if (date) {
    const startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);
    where.match_date = {
      [sequelize.Op.between]: [startDate, endDate],
    };
  }

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['status', 'ASC'],
      ['match_date', 'ASC'],
    ],
  });
};

Match.findLiveMatches = async function(sportId = null) {
  const where = {
    status: ['live', 'halftime', 'extra_time', 'penalties'],
  };
  if (sportId) where.sport_id = sportId;

  return this.findAll({
    where,
    order: [
      ['priority', 'DESC'],
      ['match_minute', 'ASC'],
    ],
  });
};

Match.findFeaturedMatches = async function(limit = 6) {
  return this.findAll({
    where: {
      is_featured: true,
      status: ['scheduled', 'live', 'halftime'],
    },
    order: [
      ['priority', 'DESC'],
      ['match_date', 'ASC'],
    ],
    limit,
  });
};

Match.findUpcomingMatches = async function(days = 7, limit = 20) {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  return this.findAll({
    where: {
      status: 'scheduled',
      match_date: {
        [sequelize.Op.between]: [startDate, endDate],
      },
    },
    order: [['match_date', 'ASC']],
    limit,
  });
};

Match.findMatchesByDate = async function(date, options = {}) {
  const { sportId = null, leagueId = null } = options;

  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const where = {
    match_date: {
      [sequelize.Op.between]: [startDate, endDate],
    },
  };
  if (sportId) where.sport_id = sportId;
  if (leagueId) where.league_id = leagueId;

  return this.findAll({
    where,
    order: [
      ['status', 'ASC'],
      ['match_date', 'ASC'],
    ],
  });
};

Match.findByProviderId = async function(providerId) {
  return this.findOne({
    where: { provider_id: providerId },
  });
};

Match.getTodayMatches = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.findAll({
    where: {
      match_date: {
        [sequelize.Op.between]: [today, tomorrow],
      },
    },
    order: [
      ['status', 'ASC'],
      ['match_date', 'ASC'],
    ],
    include: [
      {
        model: sequelize.models.Sport,
        attributes: ['id', 'name', 'icon'],
      },
      {
        model: sequelize.models.League,
        attributes: ['id', 'name', 'country', 'flag'],
      },
    ],
  });
};

Match.getLiveStatistics = async function() {
  const liveMatches = await this.findLiveMatches();

  const stats = {
    total: liveMatches.length,
    bySport: {},
    byLeague: {},
  };

  for (const match of liveMatches) {
    // Group by sport
    if (match.sport_id) {
      stats.bySport[match.sport_id] = (stats.bySport[match.sport_id] || 0) + 1;
    }
    // Group by league
    if (match.league_id) {
      stats.byLeague[match.league_id] = (stats.byLeague[match.league_id] || 0) + 1;
    }
  }

  return stats;
};

// Export the model
module.exports = Match;
