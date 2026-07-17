/**
 * League Model - Sports League & Tournament Management
 * CephasGM GameZone
 * 
 * This model manages all sports leagues, tournaments, and competitions
 * across different sports. It supports multiple league types, country
 * associations, season tracking, and configuration for betting.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * League Model Definition
 */
const League = sequelize.define(
  'League',
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    // Sport Association
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

    // League Identification
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 100],
      },
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        isLowercase: true,
        len: [2, 100],
      },
    },

    // Country/Region
    country: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    country_code: {
      type: DataTypes.STRING(2),
      allowNull: true,
      validate: {
        len: [2, 2],
        isUppercase: true,
      },
    },
    flag: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Emoji flag for the country',
    },

    // League Type
    type: {
      type: DataTypes.ENUM(
        'domestic_league',
        'domestic_cup',
        'international_league',
        'international_cup',
        'continental_league',
        'continental_cup',
        'friendly',
        'tournament',
        'qualification',
        'other'
      ),
      defaultValue: 'domestic_league',
      allowNull: false,
    },

    // Level (tier)
    level: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      allowNull: false,
      validate: {
        min: 1,
        max: 10,
      },
    },

    // Display Information
    icon: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    icon_url: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    color: {
      type: DataTypes.STRING(7),
      allowNull: true,
      validate: {
        is: /^#[0-9a-fA-F]{6}$/,
      },
    },
    background_color: {
      type: DataTypes.STRING(7),
      allowNull: true,
      validate: {
        is: /^#[0-9a-fA-F]{6}$/,
      },
    },

    // League Status
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    is_featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },

    // Season Management
    current_season: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    current_season_start: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    current_season_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Team Management
    total_teams: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    teams: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
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

    // Betting Configuration
    min_bet_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0.10,
      allowNull: false,
    },
    max_bet_amount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 10000,
      allowNull: false,
    },
    markets: {
      type: DataTypes.JSONB,
      defaultValue: ['match_winner', 'double_chance', 'total_goals'],
      allowNull: false,
    },

    // League Metadata
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 1000],
      },
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    founded_year: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1800,
        max: new Date().getFullYear(),
      },
    },

    // Popularity Metrics
    popularity_score: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0,
        max: 100,
      },
    },
    total_matches: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    active_matches: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },

    // Stats Tracking (for analytics)
    stats: {
      type: DataTypes.JSONB,
      defaultValue: {
        total_bets: 0,
        total_users: 0,
        total_volume: 0,
        avg_odds: 0,
        most_bet_team: null,
      },
      allowNull: false,
    },

    // Admin fields
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    admin_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
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
  },
  {
    // Model options
    tableName: 'leagues',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      {
        fields: ['name'],
      },
      {
        fields: ['slug'],
        unique: true,
      },
      {
        fields: ['sport_id'],
      },
      {
        fields: ['country_code'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['is_featured'],
      },
      {
        fields: ['popularity_score'],
      },
      {
        fields: ['display_order'],
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
        // For featured leagues queries
        fields: ['sport_id', 'is_featured', 'is_active'],
      },
      {
        // For active matches count queries
        fields: ['sport_id', 'is_active', 'active_matches'],
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a league, generate slug and set defaults
       */
      beforeCreate: (league) => {
        if (!league.slug) {
          league.slug = league.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        }

        // Set default icon based on sport
        if (!league.icon) {
          const iconMap = {
            football: '⚽',
            basketball: '🏀',
            tennis: '🎾',
            cricket: '🏏',
            rugby: '🏉',
          };
          league.icon = iconMap[league.slug] || '🏆';
        }

        // Set default color if not provided
        if (!league.color) {
          league.color = '#0055ff';
        }

        // Set flag based on country code
        if (!league.flag && league.country_code) {
          league.flag = getFlagEmoji(league.country_code);
        }
      },

      /**
       * Before updating a league, handle slug changes
       */
      beforeUpdate: (league) => {
        if (league.changed('name') && !league.changed('slug')) {
          league.slug = league.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        }

        if (league.changed('country_code') && !league.changed('flag')) {
          league.flag = getFlagEmoji(league.country_code);
        }
      },
    },
  }
);

/**
 * Get flag emoji from country code
 * @param {string} countryCode - ISO 3166-1 alpha-2 country code
 * @returns {string} - Flag emoji
 */
const getFlagEmoji = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return '🏳️';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

/**
 * Instance methods
 */
League.prototype = {
  ...League.prototype,

  /**
   * Get display name with country flag
   * @returns {string} - Display name with flag
   */
  getDisplayName() {
    if (this.flag) {
      return `${this.flag} ${this.name}`;
    }
    return this.name;
  },

  /**
   * Get full display name with country and icon
   * @returns {string} - Full display name
   */
  getFullDisplayName() {
    let parts = [];
    if (this.icon) parts.push(this.icon);
    if (this.flag) parts.push(this.flag);
    parts.push(this.name);
    return parts.join(' ');
  },

  /**
   * Check if league is active
   * @returns {boolean} - Whether league is active
   */
  isActive() {
    return this.is_active === true;
  },

  /**
   * Check if league has current season
   * @returns {boolean} - Whether league has current season
   */
  hasCurrentSeason() {
    return !!this.current_season;
  },

  /**
   * Get current season display
   * @returns {string} - Current season display
   */
  getSeasonDisplay() {
    if (this.current_season) {
      return `Season ${this.current_season}`;
    }
    return 'No current season';
  },

  /**
   * Check if a team exists in the league
   * @param {string} teamId - Team ID to check
   * @returns {boolean} - Whether team exists
   */
  hasTeam(teamId) {
    return this.teams.some(team => team.id === teamId || team === teamId);
  },

  /**
   * Add a team to the league
   * @param {Object|string} team - Team data or team ID
   * @returns {Promise<League>} - Updated league
   */
  async addTeam(team) {
    const teams = this.teams || [];
    const teamId = typeof team === 'string' ? team : team.id;
    
    if (!this.hasTeam(teamId)) {
      teams.push(team);
      this.teams = teams;
      this.total_teams = teams.length;
      await this.save();
      logger.info(`Team ${teamId} added to league ${this.id}`);
    }
    return this;
  },

  /**
   * Remove a team from the league
   * @param {string} teamId - Team ID to remove
   * @returns {Promise<League>} - Updated league
   */
  async removeTeam(teamId) {
    const teams = (this.teams || []).filter(
      team => (typeof team === 'string' ? team !== teamId : team.id !== teamId)
    );
    this.teams = teams;
    this.total_teams = teams.length;
    await this.save();
    logger.info(`Team ${teamId} removed from league ${this.id}`);
    return this;
  },

  /**
   * Increment match counter
   * @param {number} amount - Amount to increment
   * @returns {Promise<League>} - Updated league
   */
  async incrementMatchCount(amount = 1) {
    this.total_matches = (this.total_matches || 0) + amount;
    await this.save();
    return this;
  },

  /**
   * Increment active match counter
   * @param {number} amount - Amount to increment
   * @returns {Promise<League>} - Updated league
   */
  async incrementActiveMatches(amount = 1) {
    this.active_matches = (this.active_matches || 0) + amount;
    await this.save();
    return this;
  },

  /**
   * Update league stats
   * @param {Object} stats - Stats to update
   * @returns {Promise<League>} - Updated league
   */
  async updateStats(stats) {
    this.stats = {
      ...this.stats,
      ...stats,
    };
    await this.save();
    return this;
  },

  /**
   * Increment popularity score
   * @param {number} amount - Amount to increment
   * @returns {Promise<League>} - Updated league
   */
  async increasePopularity(amount = 1) {
    this.popularity_score = Math.min((this.popularity_score || 0) + amount, 100);
    await this.save();
    return this;
  },

  /**
   * Get league summary for display
   * @returns {Object} - League summary
   */
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      displayName: this.getDisplayName(),
      fullDisplayName: this.getFullDisplayName(),
      country: this.country,
      countryCode: this.country_code,
      flag: this.flag,
      type: this.type,
      level: this.level,
      icon: this.icon,
      color: this.color,
      isActive: this.isActive(),
      isFeatured: this.is_featured,
      currentSeason: this.current_season,
      totalTeams: this.total_teams,
      totalMatches: this.total_matches,
      activeMatches: this.active_matches,
      popularityScore: this.popularity_score,
    };
  },

  /**
   * Get full league data
   * @returns {Object} - Full league data
   */
  getFullData() {
    return {
      ...this.getSummary(),
      description: this.description,
      website: this.website,
      foundedYear: this.founded_year,
      markets: this.markets,
      minBetAmount: parseFloat(this.min_bet_amount),
      maxBetAmount: parseFloat(this.max_bet_amount),
      stats: this.stats,
      teams: this.teams,
    };
  },
};

/**
 * Static methods
 */
League.findBySlug = async function(slug) {
  return this.findOne({
    where: { slug: slug.toLowerCase() },
    include: [
      {
        model: sequelize.models.Sport,
        attributes: ['id', 'name', 'slug', 'icon', 'color'],
      },
    ],
  });
};

League.findBySport = async function(sportId, options = {}) {
  const { limit = 50, offset = 0, active = true, featured = false } = options;

  const where = { sport_id: sportId };
  if (active) where.is_active = true;
  if (featured) where.is_featured = true;

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['display_order', 'ASC'],
      ['popularity_score', 'DESC'],
      ['name', 'ASC'],
    ],
  });
};

League.findActiveLeagues = async function(options = {}) {
  const { sportId = null, limit = 100, offset = 0 } = options;

  const where = { is_active: true };
  if (sportId) where.sport_id = sportId;

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ['display_order', 'ASC'],
      ['popularity_score', 'DESC'],
      ['name', 'ASC'],
    ],
    include: [
      {
        model: sequelize.models.Sport,
        attributes: ['id', 'name', 'icon', 'color'],
      },
    ],
  });
};

League.findFeaturedLeagues = async function(limit = 10) {
  return this.findAll({
    where: {
      is_active: true,
      is_featured: true,
    },
    order: [
      ['display_order', 'ASC'],
      ['popularity_score', 'DESC'],
    ],
    limit,
    include: [
      {
        model: sequelize.models.Sport,
        attributes: ['id', 'name', 'icon', 'color'],
      },
    ],
  });
};

League.findByCountry = async function(countryCode, options = {}) {
  const { sportId = null, active = true } = options;

  const where = { country_code: countryCode.toUpperCase() };
  if (sportId) where.sport_id = sportId;
  if (active) where.is_active = true;

  return this.findAll({
    where,
    order: [
      ['display_order', 'ASC'],
      ['name', 'ASC'],
    ],
  });
};

League.findByType = async function(type, options = {}) {
  const { sportId = null, active = true } = options;

  const where = { type: type };
  if (sportId) where.sport_id = sportId;
  if (active) where.is_active = true;

  return this.findAll({
    where,
    order: [
      ['display_order', 'ASC'],
      ['popularity_score', 'DESC'],
    ],
  });
};

League.searchLeagues = async function(query, limit = 20) {
  return this.findAll({
    where: {
      is_active: true,
      [sequelize.Op.or]: [
        { name: { [sequelize.Op.iLike]: `%${query}%` } },
        { country: { [sequelize.Op.iLike]: `%${query}%` } },
        { description: { [sequelize.Op.iLike]: `%${query}%` } },
      ],
    },
    order: [
      ['popularity_score', 'DESC'],
      ['name', 'ASC'],
    ],
    limit,
    include: [
      {
        model: sequelize.models.Sport,
        attributes: ['id', 'name', 'icon', 'color'],
      },
    ],
  });
};

League.getLeaguesWithActiveMatches = async function() {
  return this.findAll({
    where: {
      is_active: true,
      active_matches: {
        [sequelize.Op.gt]: 0,
      },
    },
    order: [
      ['active_matches', 'DESC'],
      ['display_order', 'ASC'],
    ],
    include: [
      {
        model: sequelize.models.Sport,
        attributes: ['id', 'name', 'icon', 'color'],
      },
    ],
  });
};

League.getTopLeagues = async function(limit = 20) {
  return this.findAll({
    where: { is_active: true },
    order: [
      ['popularity_score', 'DESC'],
      ['display_order', 'ASC'],
      ['name', 'ASC'],
    ],
    limit,
    include: [
      {
        model: sequelize.models.Sport,
        attributes: ['id', 'name', 'icon', 'color'],
      },
    ],
  });
};

League.getLeagueStats = async function() {
  const results = await this.findAll({
    attributes: [
      'type',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('total_matches')), 'total_matches'],
      [sequelize.fn('SUM', sequelize.col('active_matches')), 'total_active_matches'],
      [sequelize.fn('SUM', sequelize.col('total_teams')), 'total_teams'],
    ],
    group: ['type'],
    raw: true,
  });

  const stats = {
    total_leagues: await this.count(),
    active_leagues: await this.count({ where: { is_active: true } }),
    featured_leagues: await this.count({ where: { is_featured: true } }),
    by_type: {},
    total_active_matches: 0,
    total_teams: 0,
  };

  for (const result of results) {
    stats.by_type[result.type] = {
      count: parseInt(result.count),
      total_matches: parseInt(result.total_matches) || 0,
      active_matches: parseInt(result.total_active_matches) || 0,
      total_teams: parseInt(result.total_teams) || 0,
    };
    stats.total_active_matches += parseInt(result.total_active_matches) || 0;
    stats.total_teams += parseInt(result.total_teams) || 0;
  }

  return stats;
};

League.getTotalActiveMatches = async function() {
  const result = await this.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.col('active_matches')), 'total_active_matches'],
    ],
    where: { is_active: true },
    raw: true,
  });
  return parseInt(result.total_active_matches) || 0;
};

League.seedDefaultLeagues = async function(sportId) {
  const defaultLeagues = [
    {
      name: 'Premier League',
      slug: 'premier-league',
      country: 'England',
      country_code: 'GB',
      type: 'domestic_league',
      level: 1,
      icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
      color: '#0055ff',
      is_featured: true,
      display_order: 1,
      popularity_score: 95,
    },
    {
      name: 'La Liga',
      slug: 'la-liga',
      country: 'Spain',
      country_code: 'ES',
      type: 'domestic_league',
      level: 1,
      icon: '🇪🇸',
      color: '#ff0044',
      is_featured: true,
      display_order: 2,
      popularity_score: 90,
    },
    {
      name: 'Bundesliga',
      slug: 'bundesliga',
      country: 'Germany',
      country_code: 'DE',
      type: 'domestic_league',
      level: 1,
      icon: '🇩🇪',
      color: '#ffd700',
      is_featured: false,
      display_order: 3,
      popularity_score: 85,
    },
    {
      name: 'Serie A',
      slug: 'serie-a',
      country: 'Italy',
      country_code: 'IT',
      type: 'domestic_league',
      level: 1,
      icon: '🇮🇹',
      color: '#0066cc',
      is_featured: false,
      display_order: 4,
      popularity_score: 80,
    },
    {
      name: 'Ligue 1',
      slug: 'ligue-1',
      country: 'France',
      country_code: 'FR',
      type: 'domestic_league',
      level: 1,
      icon: '🇫🇷',
      color: '#0055ff',
      is_featured: false,
      display_order: 5,
      popularity_score: 75,
    },
    {
      name: 'NBA',
      slug: 'nba',
      country: 'USA',
      country_code: 'US',
      type: 'domestic_league',
      level: 1,
      icon: '🇺🇸',
      color: '#ff6b00',
      is_featured: true,
      display_order: 6,
      popularity_score: 90,
    },
    {
      name: 'UEFA Champions League',
      slug: 'uefa-champions-league',
      country: 'Europe',
      country_code: 'EU',
      type: 'continental_league',
      level: 1,
      icon: '🇪🇺',
      color: '#0055ff',
      is_featured: true,
      display_order: 7,
      popularity_score: 98,
    },
    {
      name: 'Wimbledon',
      slug: 'wimbledon',
      country: 'UK',
      country_code: 'GB',
      type: 'international_league',
      level: 1,
      icon: '🇬🇧',
      color: '#00ff64',
      is_featured: true,
      display_order: 8,
      popularity_score: 85,
    },
  ];

  let created = 0;
  for (const leagueData of defaultLeagues) {
    if (sportId) leagueData.sport_id = sportId;
    const [league, createdFlag] = await this.findOrCreate({
      where: { slug: leagueData.slug },
      defaults: leagueData,
    });
    if (createdFlag) created++;
  }

  logger.info(`Seeded ${created} new leagues`);
  return created;
};

// Export the model
module.exports = League;
