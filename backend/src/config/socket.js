/**
 * Socket.IO Configuration - Real-time Communication
 * CephasGM GameZone
 * 
 * This module configures Socket.IO for real-time features including:
 * - Live betting updates
 * - Match score updates
 * - Odds changes
 * - User notifications
 * - Chat messages
 * - Admin alerts
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const authConfig = require('./auth');
const corsConfig = require('./cors');

// Environment variables
const env = process.env.NODE_ENV || 'development';
const config = authConfig.config;

/**
 * Socket.IO Configuration
 */
const socketConfig = {
  // CORS settings
  cors: corsConfig.socketCorsConfig,

  // Connection settings
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  upgradeTimeout: 10000, // 10 seconds

  // Transport options
  transports: ['websocket', 'polling'],
  allowEIO3: true,

  // Socket.IO v4 options
  allowUpgrades: true,
  cookie: {
    name: 'io',
    httpOnly: true,
    sameSite: 'lax',
  },

  // Max HTTP buffer size
  maxHttpBufferSize: 1e6, // 1 MB

  // Path for Socket.IO
  path: '/socket.io',

  // Adapter for scaling (Redis adapter for production)
  adapter: null, // Will be set if Redis is available

  // Connection state recovery
  connectionStateRecovery: {
    maxDisconnectionDuration: 120000, // 2 minutes
    skipMiddlewares: true,
  },

  // Enable/disable compression
  perMessageDeflate: {
    threshold: 1024, // 1 KB
  },

  // Rate limiting per socket
  rateLimit: {
    maxEventsPerMinute: 100,
    maxConnectionsPerIP: 50,
    maxRoomsPerSocket: 20,
  },
};

/**
 * Socket.IO namespace configurations
 */
const namespaces = {
  '/': {
    // Default namespace
    middleware: ['authenticate'],
    events: ['connection', 'disconnect', 'error'],
  },
  '/match': {
    // Match updates namespace
    middleware: ['authenticate'],
    events: ['subscribe', 'unsubscribe', 'update'],
  },
  '/bet': {
    // Betting namespace
    middleware: ['authenticate'],
    events: ['place', 'cashout', 'update'],
  },
  '/notification': {
    // Notifications namespace
    middleware: ['authenticate'],
    events: ['subscribe', 'unsubscribe', 'received'],
  },
  '/chat': {
    // Chat namespace
    middleware: ['authenticate'],
    events: ['message', 'typing', 'read'],
  },
  '/admin': {
    // Admin namespace
    middleware: ['authenticate', 'admin'],
    events: ['alert', 'update', 'stats'],
  },
};

/**
 * Socket.IO event types
 */
const eventTypes = {
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  ERROR: 'error',

  // Match events
  MATCH_UPDATE: 'match:update',
  MATCH_SCORE: 'match:score',
  MATCH_START: 'match:start',
  MATCH_END: 'match:end',

  // Odds events
  ODDS_UPDATE: 'odds:update',
  ODDS_CHANGE: 'odds:change',

  // Bet events
  BET_PLACED: 'bet:placed',
  BET_CASHOUT: 'bet:cashout',
  BET_RESULT: 'bet:result',

  // Notification events
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',

  // Chat events
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',
  CHAT_READ: 'chat:read',

  // Admin events
  ADMIN_ALERT: 'admin:alert',
  ADMIN_UPDATE: 'admin:update',
  ADMIN_STATS: 'admin:stats',

  // User events
  USER_LOGIN: 'user:login',
  USER_LOGOUT: 'user:logout',
  USER_UPDATE: 'user:update',
};

/**
 * Create Socket.IO server instance
 * @param {Object} server - HTTP server instance
 * @returns {Server} - Socket.IO server instance
 */
const createSocketServer = (server) => {
  const io = new Server(server, socketConfig);

  // Apply Redis adapter if available
  if (process.env.REDIS_HOST && socketConfig.adapter) {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      const { redisClient, pubClient } = require('./redis');
      io.adapter(createAdapter(pubClient, redisClient));
      logger.info('🔴 Redis adapter applied to Socket.IO');
    } catch (error) {
      logger.warn('Redis adapter not available for Socket.IO:', error.message);
    }
  }

  // Apply authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      logger.warn('Socket connection rejected: No token provided');
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      });

      socket.userId = decoded.sub;
      socket.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role || 'user',
      };

      logger.debug(`Socket authenticated for user: ${socket.userId}`);
      next();
    } catch (error) {
      logger.warn('Socket connection rejected: Invalid token', error.message);
      next(new Error('Invalid token'));
    }
  });

  // Apply admin middleware for admin namespace
  const adminNamespace = io.of('/admin');
  adminNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: config.jwt.issuer,
        audience: config.jwt.audience,
      });

      if (!['admin', 'super_admin'].includes(decoded.role)) {
        return next(new Error('Admin access required'));
      }

      socket.userId = decoded.sub;
      socket.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role || 'user',
      };

      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  return io;
};

/**
 * Socket.IO connection handler
 * @param {Server} io - Socket.IO server instance
 */
const setupSocketHandlers = (io) => {
  // Default namespace
  io.on('connection', (socket) => {
    const userId = socket.userId;
    logger.info(`Socket connected: ${socket.id} for user: ${userId}`);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Emit connection success
    socket.emit('connected', {
      id: socket.id,
      userId: userId,
      timestamp: new Date().toISOString(),
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} for user: ${userId} (${reason})`);
      socket.leave(`user:${userId}`);
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${userId}:`, error);
    });

    // Handle ping
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle subscribe to match updates
    socket.on('match:subscribe', (data) => {
      const { matchId } = data;
      if (matchId) {
        socket.join(`match:${matchId}`);
        socket.emit('match:subscribed', { matchId });
        logger.debug(`User ${userId} subscribed to match: ${matchId}`);
      }
    });

    // Handle unsubscribe from match updates
    socket.on('match:unsubscribe', (data) => {
      const { matchId } = data;
      if (matchId) {
        socket.leave(`match:${matchId}`);
        socket.emit('match:unsubscribed', { matchId });
        logger.debug(`User ${userId} unsubscribed from match: ${matchId}`);
      }
    });

    // Handle chat messages
    socket.on('chat:message', (data) => {
      const { to, message, type } = data;
      if (to && message) {
        // Emit to specific user room
        io.to(`user:${to}`).emit('chat:message', {
          from: userId,
          message,
          type: type || 'text',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle typing indicator
    socket.on('chat:typing', (data) => {
      const { to, isTyping } = data;
      if (to) {
        io.to(`user:${to}`).emit('chat:typing', {
          from: userId,
          isTyping: isTyping || true,
        });
      }
    });
  });

  // Admin namespace
  const adminNamespace = io.of('/admin');
  adminNamespace.on('connection', (socket) => {
    const userId = socket.userId;
    logger.info(`Admin socket connected: ${socket.id} for user: ${userId}`);

    socket.join(`admin:${userId}`);
    socket.join('admin:all');

    socket.on('disconnect', (reason) => {
      logger.info(`Admin socket disconnected: ${socket.id} for user: ${userId} (${reason})`);
      socket.leave(`admin:${userId}`);
      socket.leave('admin:all');
    });

    // Handle admin alerts
    socket.on('admin:alert', (data) => {
      io.to('admin:all').emit('admin:alert', {
        ...data,
        from: userId,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle admin stats request
    socket.on('admin:stats', async () => {
      // Stats will be handled by the stats service
      socket.emit('admin:stats', {
        timestamp: new Date().toISOString(),
      });
    });
  });
};

/**
 * Utility functions for emitting events
 */
const emit = {
  /**
   * Emit match update to subscribers
   * @param {Object} io - Socket.IO server instance
   * @param {string} matchId - Match ID
   * @param {Object} data - Match data
   */
  matchUpdate: (io, matchId, data) => {
    io.to(`match:${matchId}`).emit('match:update', {
      matchId,
      data,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Emit odds update to subscribers
   * @param {Object} io - Socket.IO server instance
   * @param {string} matchId - Match ID
   * @param {Object} odds - Odds data
   */
  oddsUpdate: (io, matchId, odds) => {
    io.to(`match:${matchId}`).emit('odds:update', {
      matchId,
      odds,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Emit notification to specific user
   * @param {Object} io - Socket.IO server instance
   * @param {string} userId - User ID
   * @param {Object} notification - Notification data
   */
  notification: (io, userId, notification) => {
    io.to(`user:${userId}`).emit('notification:new', {
      notification,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Emit bet update to user
   * @param {Object} io - Socket.IO server instance
   * @param {string} userId - User ID
   * @param {Object} betData - Bet data
   */
  betUpdate: (io, userId, betData) => {
    io.to(`user:${userId}`).emit('bet:update', {
      bet: betData,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Emit admin alert to all admins
   * @param {Object} io - Socket.IO server instance
   * @param {Object} alertData - Alert data
   */
  adminAlert: (io, alertData) => {
    io.of('/admin').emit('admin:alert', {
      ...alertData,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Broadcast system message to all connected clients
   * @param {Object} io - Socket.IO server instance
   * @param {Object} message - Message data
   */
  systemBroadcast: (io, message) => {
    io.emit('system:message', {
      message,
      timestamp: new Date().toISOString(),
    });
  },
};

// Export configuration and utilities
module.exports = {
  socketConfig,
  namespaces,
  eventTypes,
  createSocketServer,
  setupSocketHandlers,
  emit,
};

// Default export
module.exports.default = createSocketServer;
