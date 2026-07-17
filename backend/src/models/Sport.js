/**
 * Sport Model - Sports Category Management
 * CephasGM GameZone
 * 
 * This model manages all sports categories available on the platform,
 * including their metadata, icons, display configurations, and
 * active status for sports betting.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Sport Model Definition
 */
const Sport = sequelize.define(
  'Sport',
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    // Sport Identification
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        len: [2, 50],
      },
    },
    slug: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
        isLowercase: true,
        len: [2, 50],
      },
    },

    // Sport Category
    category: {
      type: DataTypes.ENUM(
        'team_sport',
        'individual_sport',
        'racing',
        'combat_sport',
        'esports',
        'other'
      ),
      defaultValue: 'team_sport',
      allowNull: false,
    },

    // Display Information
    icon: {
      type: DataTypes.STRING(10),
      allowNull: true,
      comment: 'Emoji or icon code for the sport',
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

    // Sport Status
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

    // Betting Configuration
    has_live_betting: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    has_virtual_games: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    has_cashout: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    has_streaming: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },

    // Market Types
    markets: {
      type: DataTypes.JSONB,
      defaultValue: [
        'match_winner',
        'double_chance',
        'total_goals',
        'both_teams_score',
        'correct_score',
        'handicap',
        'first_goal',
        'last_goal',
      ],
      allowNull: false,
    },

    // Special Market Types (sport-specific)
    special_markets: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
    },

    // Provider Configuration
    provider_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    provider_config: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true,
    },

    // Display Settings
    display_settings: {
      type: DataTypes.JSONB,
      defaultValue: {
        show_leagues: true,
        show_teams: true,
        show_player_stats: false,
        show_head_to_head: true,
        show_recent_form: true,
        show_live_score: true,
        show_commentary: false,
      },
      allowNull: false,
    },

    // Metadata
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      validate: {
        len: [0, 500],
      },
    },
    keywords: {
      type: DataTypes.JSONB,
      defaultValue: [],
      allowNull: false,
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
    total_events: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    active_events: {
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
      },
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
  },
  {
    // Model options
    tableName: 'sports',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      {
        fields: ['name'],
        unique: true,
      },
      {
        fields: ['slug'],
        unique: true,
      },
      {
        fields: ['is_active'],
      },
      {
        fields: ['is_featured'],
      },
      {
        fields: ['category'],
      },
      {
        fields: ['popularity_score'],
      },
      {
        fields: ['display_order'],
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a sport, generate slug if not provided
       */
      beforeCreate: (sport) => {
        if (!sport.slug) {
          sport.slug = sport.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        }

        // Set default icon if not provided
        if (!sport.icon) {
          const iconMap = {
            football: '⚽',
            basketball: '🏀',
            tennis: '🎾',
            cricket: '🏏',
            rugby: '🏉',
            volleyball: '🏐',
            netball: '🏐',
            ice_hockey: '🏒',
            baseball: '⚾',
            handball: '🤾',
            american_football: '🏈',
            formula1: '🏎️',
            motogp: '🏍️',
            cycling: '🚴',
            boxing: '🥊',
            mma: '🥊',
            athletics: '🏃',
            horse_racing: '🏇',
            greyhound_racing: '🐕',
            snooker: '🎱',
            darts: '🎯',
            chess: '♟️',
            esports: '🎮',
          };
          sport.icon = iconMap[sport.slug] || '⚽';
        }

        // Set default color if not provided
        if (!sport.color) {
          const colorMap = {
            football: '#0055ff',
            basketball: '#ff6b00',
            tennis: '#00ff64',
            cricket: '#ff0044',
            rugby: '#00b894',
            volleyball: '#ffd700',
            netball: '#6c5ce7',
            ice_hockey: '#00b4d8',
            baseball: '#e63946',
            handball: '#2d3436',
            american_football: '#e67e22',
            formula1: '#e63946',
            motogp: '#2d3436',
            cycling: '#0984e3',
            boxing: '#d63031',
            mma: '#2d3436',
            athletics: '#00b894',
            horse_racing: '#6c5ce7',
            greyhound_racing: '#636e72',
            snooker: '#00b894',
            darts: '#6c5ce7',
            chess: '#2d3436',
            esports: '#6c5ce7',
          };
          sport.color = colorMap[sport.slug] || '#0055ff';
        }
      },

      /**
       * Before updating a sport, handle slug changes
       */
      beforeUpdate: (sport) => {
        if (sport.changed('name') && !sport.changed('slug')) {
          sport.slug = sport.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        }
      },
    },
  }
);

/**
 * Instance methods
 */
Sport.prototype = {
  ...Sport.prototype,

  /**
   * Get sport display name with icon
   * @returns {string} - Display name with icon
   */
  getDisplayName() {
    return this.icon ? `${this.icon} ${this.name}` : this.name;
  },

  /**
   * Check if sport is active for betting
   * @returns {boolean} - Whether sport is active
   */
  isActive() {
    return this.is_active === true;
  },

  /**
   * Check if sport has live betting
   * @returns {boolean} - Whether live betting is available
   */
  hasLiveBetting() {
    return this.has_live_betting === true;
  },

  /**
   * Check if sport has virtual games
   * @returns {boolean} - Whether virtual games are available
   */
  hasVirtualGames() {
    return this.has_virtual_games === true;
  },

  /**
   * Get sport markets for display
   * @returns {Array} - Markets array
   */
  getMarkets() {
    return this.markets || [];
  },

  /**
   * Get sport summary for display
   * @returns {Object} - Sport summary
   */
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      icon: this.icon,
      color: this.color,
      category: this.category,
      isActive: this.isActive(),
      hasLiveBetting: this.hasLiveBetting(),
      hasVirtualGames: this.hasVirtualGames(),
      activeEvents: this.active_events,
      totalEvents: this.total_events,
      popularityScore: this.popularity_score,
    };
  },

  /**
   * Get full sport data with configuration
   * @returns {Object} - Full sport data
   */
  getFullData() {
    return {
      ...this.getSummary(),
      markets: this.getMarkets(),
      specialMarkets: this.special_markets,
      displaySettings: this.display_settings,
      description: this.description,
      keywords: this.keywords,
      stats: this.stats,
    };
  },

  /**
   * Increment event counter
   * @param {number} amount - Amount to increment
   * @returns {Promise<Sport>} - Updated sport
   */
  async incrementEventCount(amount = 1) {
    this.total_events = (this.total_events || 0) + amount;
    await this.save();
    return this;
  },

  /**
   * Increment active event counter
   * @param {number} amount - Amount to increment
   * @returns {Promise<Sport>} - Updated sport
   */
  async incrementActiveEvents(amount = 1) {
    this.active_events = (this.active_events || 0) + amount;
    await this.save();
    return this;
  },

  /**
   * Update sport stats
   * @param {Object} stats - Stats to update
   * @returns {Promise<Sport>} - Updated sport
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
   * @returns {Promise<Sport>} - Updated sport
   */
  async increasePopularity(amount = 1) {
    this.popularity_score = Math.min((this.popularity_score || 0) + amount, 100);
    await this.save();
    return this;
  },
};

/**
 * Static methods
 */
Sport.findBySlug = async function(slug) {
  return this.findOne({
    where: { slug: slug.toLowerCase() },
  });
};

Sport.findActiveSports = async function() {
  return this.findAll({
    where: { is_active: true },
    order: [
      ['display_order', 'ASC'],
      ['name', 'ASC'],
    ],
  });
};

Sport.findFeaturedSports = async function(limit = 6) {
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
  });
};

Sport.findByCategory = async function(category) {
  return this.findAll({
    where: {
      category: category,
      is_active: true,
    },
    order: [['name', 'ASC']],
  });
};

Sport.getPopularSports = async function(limit = 10) {
  return this.findAll({
    where: { is_active: true },
    order: [
      ['popularity_score', 'DESC'],
      ['display_order', 'ASC'],
    ],
    limit,
  });
};

Sport.searchSports = async function(query, limit = 20) {
  return this.findAll({
    where: {
      is_active: true,
      [sequelize.Op.or]: [
        { name: { [sequelize.Op.iLike]: `%${query}%` } },
        { description: { [sequelize.Op.iLike]: `%${query}%` } },
        { keywords: { [sequelize.Op.contains]: [query.toLowerCase()] } },
      ],
    },
    order: [
      ['popularity_score', 'DESC'],
      ['name', 'ASC'],
    ],
    limit,
  });
};

Sport.getSportStats = async function() {
  const results = await this.findAll({
    attributes: [
      'category',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
      [sequelize.fn('SUM', sequelize.col('active_events')), 'total_active_events'],
      [sequelize.fn('SUM', sequelize.col('total_events')), 'total_events'],
    ],
    group: ['category'],
    raw: true,
  });

  const stats = {
    total_sports: await this.count(),
    active_sports: await this.count({ where: { is_active: true } }),
    featured_sports: await this.count({ where: { is_featured: true } }),
    by_category: {},
  };

  for (const result of results) {
    stats.by_category[result.category] = {
      count: parseInt(result.count),
      active_events: parseInt(result.total_active_events) || 0,
      total_events: parseInt(result.total_events) || 0,
    };
  }

  return stats;
};

Sport.getTotalActiveEvents = async function() {
  const result = await this.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.col('active_events')), 'total_active_events'],
    ],
    where: { is_active: true },
    raw: true,
  });
  return parseInt(result.total_active_events) || 0;
};

Sport.seedDefaultSports = async function() {
  const defaultSports = [
    {
      name: 'Football',
      slug: 'football',
      category: 'team_sport',
      icon: '⚽',
      color: '#0055ff',
      is_featured: true,
      has_live_betting: true,
      has_virtual_games: true,
      display_order: 1,
      popularity_score: 98,
    },
    {
      name: 'Basketball',
      slug: 'basketball',
      category: 'team_sport',
      icon: '🏀',
      color: '#ff6b00',
      is_featured: true,
      has_live_betting: true,
      has_virtual_games: false,
      display_order: 2,
      popularity_score: 85,
    },
    {
      name: 'Tennis',
      slug: 'tennis',
      category: 'individual_sport',
      icon: '🎾',
      color: '#00ff64',
      is_featured: true,
      has_live_betting: true,
      has_virtual_games: false,
      display_order: 3,
      popularity_score: 75,
    },
    {
      name: 'Cricket',
      slug: 'cricket',
      category: 'team_sport',
      icon: '🏏',
      color: '#ff0044',
      is_featured: false,
      has_live_betting: true,
      has_virtual_games: false,
      display_order: 4,
      popularity_score: 65,
    },
    {
      name: 'Rugby',
      slug: 'rugby',
      category: 'team_sport',
      icon: '🏉',
      color: '#00b894',
      is_featured: false,
      has_live_betting: true,
      has_virtual_games: false,
      display_order: 5,
      popularity_score: 45,
    },
    {
      name: 'Volleyball',
      slug: 'volleyball',
      category: 'team_sport',
      icon: '🏐',
      color: '#ffd700',
      is_featured: false,
      has_live_betting: true,
      has_virtual_games: false,
      display_order: 6,
      popularity_score: 40,
    },
    {
      name: 'Ice Hockey',
      slug: 'ice_hockey',
      category: 'team_sport',
      icon: '🏒',
      color: '#00b4d8',
      is_featured: false,
      has_live_betting: true,
      has_virtual_games: false,
      display_order: 7,
      popularity_score: 35,
    },
    {
      name: 'Horse Racing',
      slug: 'horse_racing',
      category: 'racing',
      icon: '🏇',
      color: '#6c5ce7',
      is_featured: false,
      has_live_betting: true,
      has_virtual_games: true,
      display_order: 8,
      popularity_score: 55,
    },
    {
      name: 'Esports',
      slug: 'esports',
      category: 'esports',
      icon: '🎮',
      color: '#6c5ce7',
      is_featured: true,
      has_live_betting: true,
      has_virtual_games: false,
      display_order: 9,
      popularity_score: 70,
    },
    {
      name: 'Boxing',
      slug: 'boxing',
      category: 'combat_sport',
      icon: '🥊',
      color: '#d63031',
      is_featured: false,
      has_live_betting: true,
      has_virtual_games: false,
      display_order: 10,
      popularity_score: 40,
    },
    {
      name: 'Formula 1',
      slug: 'formula1',
      category: 'racing',
      icon: '🏎️',
      color: '#e63946',
      is_featured: false,
      has_live_betting: true,
      has_virtual_games: false,
      display_order: 11,
      popularity_score: 45,
    },
    {
      name: 'Snooker',
      slug: 'snooker',
      category: 'individual_sport',
      icon: '🎱',
      color: '#00b894',
      is_featured: false,
      has_live_betting: true,
      has_virtual_games: false,
      display_order: 12,
      popularity_score: 25,
    },
  ];

  let created = 0;
  for (const sportData of defaultSports) {
    const [sport, createdFlag] = await this.findOrCreate({
      where: { slug: sportData.slug },
      defaults: sportData,
    });
    if (createdFlag) created++;
  }

  logger.info(`Seeded ${created} new sports`);
  return created;
};

// Export the model
module.exports = Sport;
