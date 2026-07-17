/**
 * Application Entry Point - Express Server Initialization
 * CephasGM GameZone
 * 
 * This file serves as the main entry point for the backend application.
 * It initializes Express, connects to databases, sets up middleware,
 * registers routes, and starts the HTTP server with WebSocket support.
 * 
 * The application follows a modular architecture with:
 * - Dependency injection for services
 * - Centralized error handling
 * - Environment-based configuration
 * - Graceful shutdown
 * - Health check endpoints
 */

const express = require('express');
const http = require('http');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const passport = require('passport');

// Load environment variables
require('dotenv').config();

// Import configurations
const { sequelize, testConnection, syncDatabase } = require('./config/database');
const { redisClient, testConnection: testRedis } = require('./config/redis');
const { corsMiddleware } = require('./config/cors');
const { passport } = require('./config/passport');
const { createSocketServer, setupSocketHandlers } = require('./config/socket');

// Import middleware
const { errorHandler, handleUnhandledRejection, handleUncaughtException } = require('./middleware/errorHandler');
const { requestLogger, performanceLogger, requestIdGenerator } = require('./middleware/logger');
const { sanitize } = require('./middleware/sanitize');
const { globalRateLimit } = require('./middleware/rateLimit');
const { authenticate } = require('./middleware/auth');

// Import routes
const v1Routes = require('./routes/v1');

// Import services
const logger = require('./utils/logger');

// ============================================
// INITIALIZE EXPRESS APP
// ============================================

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';

// ============================================
// WEBSOCKET SETUP
// ============================================

// Create Socket.IO server
const io = createSocketServer(server);
// Make io available globally for services
global.io = io;
// Setup socket handlers
setupSocketHandlers(io);

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

// --- Security Headers ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.tailwindcss.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://secure.gravatar.com"],
      connectSrc: ["'self'", "wss://api.cephasgm.com", "https://api.cephasgm.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// --- Compression ---
app.use(compression({
  threshold: 1024,
  level: 6,
  memLevel: 8,
}));

// --- CORS ---
app.use(corsMiddleware);

// --- Request ID ---
app.use(requestIdGenerator);

// --- Logging ---
app.use(morgan('combined', { stream: require('./utils/logger').stream }));
app.use(requestLogger);
app.use(performanceLogger);

// --- Body Parsers ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// --- Rate Limiting (Global) ---
app.use(globalRateLimit);

// --- Sanitization (Global) ---
app.use(sanitize({ strategy: 'strict', exclude: ['password', 'confirmPassword', 'currentPassword', 'newPassword'] }));

// --- Passport ---
app.use(passport.initialize());

// --- Static Files ---
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// ============================================
// HEALTH CHECK ENDPOINTS
// ============================================

/**
 * @route   GET /health
 * @desc    Health check endpoint
 * @access  Public
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: ENV,
  });
});

/**
 * @route   GET /health/detailed
 * @desc    Detailed health check with database and redis status
 * @access  Public (Internal use only)
 */
app.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: ENV,
    services: {
      database: { status: 'unknown' },
      redis: { status: 'unknown' },
    },
  };

  try {
    await sequelize.authenticate();
    health.services.database.status = 'connected';
  } catch (error) {
    health.services.database.status = 'disconnected';
    health.services.database.error = error.message;
    health.status = 'unhealthy';
  }

  try {
    await redisClient.ping();
    health.services.redis.status = 'connected';
  } catch (error) {
    health.services.redis.status = 'disconnected';
    health.services.redis.error = error.message;
    health.status = 'unhealthy';
  }

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

/**
 * @route   GET /ping
 * @desc    Simple ping endpoint for load balancers
 * @access  Public
 */
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// ============================================
// API ROUTES
// ============================================

// Mount API version 1 routes
app.use('/api/v1', v1Routes);

// GraphQL endpoint (optional, can be enabled later)
// app.use('/graphql', graphqlHTTP({
//   schema: require('./routes/graphql/schema'),
//   graphiql: ENV === 'development',
//   context: ({ req }) => ({ user: req.user, ip: req.ip }),
// }));

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    code: 'ERR_404',
    path: req.path,
    method: req.method,
  });
});

// ============================================
// ERROR HANDLER (Last middleware)
// ============================================

app.use(errorHandler);

// ============================================
// SERVER INITIALIZATION
// ============================================

/**
 * Initialize the server
 * @returns {Promise<void>}
 */
const initializeServer = async () => {
  try {
    logger.info('🚀 Starting CephasGM GameZone Server...');
    logger.info(`📦 Environment: ${ENV}`);
    logger.info(`🔧 Port: ${PORT}`);

    // Test database connection
    await testConnection();
    logger.info('✅ Database connection established');

    // Test Redis connection
    await testRedis();
    logger.info('✅ Redis connection established');

    // Sync database (with environment-specific settings)
    const isDevelopment = ENV === 'development';
    await syncDatabase({
      force: false, // Never force in production
      alter: isDevelopment, // Only alter in development
    });
    logger.info('✅ Database synced');

    // Start server
    server.listen(PORT, () => {
      logger.info(`✅ Server running on port ${PORT}`);
      logger.info(`🔗 API URL: http://localhost:${PORT}/api/v1`);
      logger.info(`🔗 Health: http://localhost:${PORT}/health`);
      logger.info(`🔗 WebSocket: ws://localhost:${PORT}`);
      logger.info(`📊 Environment: ${ENV}`);
      logger.info('🚀 CephasGM GameZone Server is ready!');
    });

    // Graceful shutdown
    setupGracefulShutdown();

    // Register global error handlers
    process.on('unhandledRejection', handleUnhandledRejection);
    process.on('uncaughtException', handleUncaughtException);

  } catch (error) {
    logger.error('❌ Server initialization failed:', error);
    process.exit(1);
  }
};

/**
 * Setup graceful shutdown
 */
const setupGracefulShutdown = () => {
  const shutdown = async () => {
    logger.info('🛑 Received shutdown signal. Cleaning up...');

    // Close HTTP server
    server.close(async () => {
      logger.info('✅ HTTP server closed');

      // Close Socket.IO
      if (io) {
        io.close(() => {
          logger.info('✅ Socket.IO closed');
        });
      }

      // Close Redis connection
      try {
        await redisClient.quit();
        logger.info('✅ Redis connection closed');
      } catch (error) {
        logger.error('❌ Error closing Redis:', error);
      }

      // Close database connection
      try {
        await sequelize.close();
        logger.info('✅ Database connection closed');
      } catch (error) {
        logger.error('❌ Error closing database:', error);
      }

      logger.info('👋 Shutdown complete. Goodbye!');
      process.exit(0);
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('❌ Force shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  // Handle shutdown signals
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Handle Docker stop signal
  process.on('SIGUSR2', shutdown);
};

// ============================================
// DEVELOPMENT HELPER FUNCTIONS
// ============================================

/**
 * Development helper to restart server on changes
 * (Used in development environment)
 */
if (ENV === 'development') {
  // Enable hot reloading with nodemon (handled by nodemon)
  logger.info('🔧 Development mode: Hot reload enabled');
}

// ============================================
// EXPORT APP (for testing)
// ============================================

module.exports = app;

// ============================================
// START SERVER (if not in test environment)
// ============================================

if (ENV !== 'test') {
  initializeServer();
}
