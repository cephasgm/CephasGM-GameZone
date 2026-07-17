/**
 * Models Index - Database Model Registration & Associations
 * CephasGM GameZone
 * 
 * This file imports all models, registers them with Sequelize, defines
 * all model associations, and exports the models and sequelize instance
 * for use throughout the application.
 */

const { sequelize, Sequelize } = require('../config/database');
const logger = require('../utils/logger');

// Import all models
const User = require('./User');
const Wallet = require('./Wallet');
const Transaction = require('./Transaction');
const Bet = require('./Bet');
const Match = require('./Match');
const Sport = require('./Sport');
const League = require('./League');
const Payment = require('./Payment');
const Bonus = require('./Bonus');
const Promotion = require('./Promotion');
const Notification = require('./Notification');
const Message = require('./Message');
const SupportTicket = require('./SupportTicket');
const AuditLog = require('./AuditLog');
const Session = require('./Session');
const KycDocument = require('./KycDocument');

// Initialize models with sequelize instance
// All models are already defined with sequelize.define, so they are already registered.

// Define associations
// Note: Associations should be defined after all models are imported

// ============================================
// USER ASSOCIATIONS
// ============================================
User.hasOne(Wallet, {
  foreignKey: 'user_id',
  as: 'wallet',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

User.hasMany(Transaction, {
  foreignKey: 'user_id',
  as: 'transactions',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

User.hasMany(Bet, {
  foreignKey: 'user_id',
  as: 'bets',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

User.hasMany(Payment, {
  foreignKey: 'user_id',
  as: 'payments',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

User.hasMany(Bonus, {
  foreignKey: 'user_id',
  as: 'bonuses',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

User.hasMany(Notification, {
  foreignKey: 'user_id',
  as: 'notifications',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

User.hasMany(Message, {
  foreignKey: 'sender_id',
  as: 'sentMessages',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

User.hasMany(SupportTicket, {
  foreignKey: 'user_id',
  as: 'supportTickets',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

User.hasMany(Session, {
  foreignKey: 'user_id',
  as: 'sessions',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

User.hasMany(KycDocument, {
  foreignKey: 'user_id',
  as: 'kycDocuments',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

User.hasMany(AuditLog, {
  foreignKey: 'user_id',
  as: 'auditLogs',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

// Referral relationships
User.belongsTo(User, {
  foreignKey: 'referred_by',
  as: 'referrer',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

User.hasMany(User, {
  foreignKey: 'referred_by',
  as: 'referees',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

// Admin relationships
User.hasMany(SupportTicket, {
  foreignKey: 'assigned_to',
  as: 'assignedTickets',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

User.hasMany(SupportTicket, {
  foreignKey: 'closed_by',
  as: 'closedTickets',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

User.hasMany(AuditLog, {
  foreignKey: 'approved_by',
  as: 'approvedAudits',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

// ============================================
// WALLET ASSOCIATIONS
// ============================================
Wallet.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

Wallet.hasMany(Transaction, {
  foreignKey: 'wallet_id',
  as: 'transactions',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

Wallet.hasMany(Bet, {
  foreignKey: 'wallet_id',
  as: 'bets',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

Wallet.hasMany(Payment, {
  foreignKey: 'wallet_id',
  as: 'payments',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

// ============================================
// TRANSACTION ASSOCIATIONS
// ============================================
Transaction.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

Transaction.belongsTo(Wallet, {
  foreignKey: 'wallet_id',
  as: 'wallet',
});

Transaction.belongsTo(Bet, {
  foreignKey: 'bet_id',
  as: 'bet',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

Transaction.belongsTo(Bonus, {
  foreignKey: 'bonus_id',
  as: 'bonus',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

Transaction.belongsTo(Transaction, {
  foreignKey: 'related_transaction_id',
  as: 'relatedTransaction',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

// ============================================
// BET ASSOCIATIONS
// ============================================
Bet.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

Bet.belongsTo(Wallet, {
  foreignKey: 'wallet_id',
  as: 'wallet',
});

Bet.belongsTo(Bonus, {
  foreignKey: 'bonus_id',
  as: 'bonus',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

Bet.hasMany(Transaction, {
  foreignKey: 'bet_id',
  as: 'transactions',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

// ============================================
// MATCH ASSOCIATIONS
// ============================================
Match.belongsTo(Sport, {
  foreignKey: 'sport_id',
  as: 'sport',
});

Match.belongsTo(League, {
  foreignKey: 'league_id',
  as: 'league',
});

Match.hasMany(Bet, {
  foreignKey: 'match_id',
  as: 'bets',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

// ============================================
// SPORT ASSOCIATIONS
// ============================================
Sport.hasMany(League, {
  foreignKey: 'sport_id',
  as: 'leagues',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

Sport.hasMany(Match, {
  foreignKey: 'sport_id',
  as: 'matches',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

// ============================================
// LEAGUE ASSOCIATIONS
// ============================================
League.belongsTo(Sport, {
  foreignKey: 'sport_id',
  as: 'sport',
});

League.hasMany(Match, {
  foreignKey: 'league_id',
  as: 'matches',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

// ============================================
// PAYMENT ASSOCIATIONS
// ============================================
Payment.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

Payment.belongsTo(Wallet, {
  foreignKey: 'wallet_id',
  as: 'wallet',
});

Payment.belongsTo(Transaction, {
  foreignKey: 'transaction_id',
  as: 'transaction',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

// ============================================
// BONUS ASSOCIATIONS
// ============================================
Bonus.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

Bonus.belongsTo(Promotion, {
  foreignKey: 'promotion_id',
  as: 'promotion',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

Bonus.belongsTo(Transaction, {
  foreignKey: 'transaction_id',
  as: 'transaction',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

Bonus.belongsTo(User, {
  foreignKey: 'claimed_by_user_id',
  as: 'claimedBy',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

Bonus.hasMany(Transaction, {
  foreignKey: 'bonus_id',
  as: 'transactions',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

// ============================================
// PROMOTION ASSOCIATIONS
// ============================================
Promotion.hasMany(Bonus, {
  foreignKey: 'promotion_id',
  as: 'bonuses',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE',
});

// ============================================
// NOTIFICATION ASSOCIATIONS
// ============================================
Notification.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// ============================================
// MESSAGE ASSOCIATIONS
// ============================================
Message.belongsTo(User, {
  foreignKey: 'sender_id',
  as: 'sender',
});

Message.belongsTo(Message, {
  foreignKey: 'replied_to',
  as: 'parent',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

Message.hasMany(Message, {
  foreignKey: 'replied_to',
  as: 'replies',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

// ============================================
// SUPPORT TICKET ASSOCIATIONS
// ============================================
SupportTicket.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

SupportTicket.belongsTo(User, {
  foreignKey: 'assigned_to',
  as: 'assignedAgent',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

SupportTicket.belongsTo(User, {
  foreignKey: 'closed_by',
  as: 'closedBy',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

SupportTicket.belongsTo(User, {
  foreignKey: 'escalated_to',
  as: 'escalatedAgent',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

// ============================================
// SESSION ASSOCIATIONS
// ============================================
Session.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

Session.belongsTo(User, {
  foreignKey: 'revoked_by',
  as: 'revokedBy',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

// ============================================
// KYC DOCUMENT ASSOCIATIONS
// ============================================
KycDocument.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

KycDocument.belongsTo(User, {
  foreignKey: 'verified_by',
  as: 'verifiedBy',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
});

// ============================================
// AUDIT LOG ASSOCIATIONS
// ============================================
AuditLog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

// ============================================
// EXPORT ALL MODELS AND SEQUELIZE
// ============================================

const db = {
  sequelize,
  Sequelize,
  User,
  Wallet,
  Transaction,
  Bet,
  Match,
  Sport,
  League,
  Payment,
  Bonus,
  Promotion,
  Notification,
  Message,
  SupportTicket,
  AuditLog,
  Session,
  KycDocument,
};

// Add convenience method for syncing database
db.sync = async (options = {}) => {
  const { force = false, alter = false } = options;
  try {
    await sequelize.sync({ force, alter });
    logger.info(`✅ Database synced successfully. Force: ${force}, Alter: ${alter}`);
    return true;
  } catch (error) {
    logger.error('❌ Database sync failed:', error);
    throw error;
  }
};

// Add method to test connection
db.testConnection = async () => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Database connection established successfully.');
    return true;
  } catch (error) {
    logger.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Add method to close connection
db.close = async () => {
  try {
    await sequelize.close();
    logger.info('✅ Database connection closed.');
    return true;
  } catch (error) {
    logger.error('❌ Error closing database connection:', error);
    throw error;
  }
};

module.exports = db;
