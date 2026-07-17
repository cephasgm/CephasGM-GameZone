/**
 * Database Configuration - PostgreSQL
 * CephasGM GameZone
 * 
 * This module manages the PostgreSQL database connection using Sequelize ORM.
 * It supports multiple environments (development, test, production) with
 * connection pooling, logging, and SSL configuration.
 */

const { Sequelize } = require('sequelize');
const logger = require('../utils/logger');

// Environment variables
const env = process.env.NODE_ENV || 'development';

// Database configuration object
const config = {
  development: {
    username: process.env.DB_USER || 'cephasgm_user',
    password: process.env.DB_PASSWORD || 'secure_password_123',
    database: process.env.DB_NAME || 'cephasgm_gamezone_dev',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: (msg) => logger.debug(msg),
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true, // Soft deletes
    },
  },
  test: {
    username: process.env.DB_USER || 'cephasgm_user',
    password: process.env.DB_PASSWORD || 'secure_password_123',
    database: process.env.DB_NAME || 'cephasgm_gamezone_test',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
    },
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 20,
      min: 2,
      acquire: 60000,
      idle: 10000,
    },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
    define: {
      timestamps: true,
      underscored: true,
      paranoid: true,
    },
  },
};

// Get configuration for current environment
const envConfig = config[env];

/**
 * Initialize Sequelize instance
 */
const sequelize = new Sequelize(
  envConfig.database,
  envConfig.username,
  envConfig.password,
  {
    host: envConfig.host,
    port: envConfig.port,
    dialect: envConfig.dialect,
    logging: envConfig.logging,
    pool: envConfig.pool,
    dialectOptions: envConfig.dialectOptions,
    define: envConfig.define,
    timezone: '+00:00',
  }
);

/**
 * Test database connection
 */
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ PostgreSQL connection established successfully.');
    return true;
  } catch (error) {
    logger.error('❌ Unable to connect to PostgreSQL database:', error.message);
    throw error;
  }
};

/**
 * Sync database schema
 * @param {Object} options - Sync options
 * @param {boolean} options.force - Drop tables before sync (development only)
 * @param {boolean} options.alter - Alter tables to match models
 */
const syncDatabase = async (options = {}) => {
  const { force = false, alter = false } = options;

  // Prevent force sync in production
  if (force && env === 'production') {
    logger.error('❌ Force sync is not allowed in production environment.');
    throw new Error('Force sync not allowed in production');
  }

  try {
    await sequelize.sync({ force, alter });
    logger.info(`✅ Database synced successfully. Force: ${force}, Alter: ${alter}`);
  } catch (error) {
    logger.error('❌ Failed to sync database:', error.message);
    throw error;
  }
};

/**
 * Close database connection
 */
const closeConnection = async () => {
  try {
    await sequelize.close();
    logger.info('✅ Database connection closed.');
  } catch (error) {
    logger.error('❌ Error closing database connection:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  Sequelize,
  testConnection,
  syncDatabase,
  closeConnection,
  env,
  config: envConfig,
};
