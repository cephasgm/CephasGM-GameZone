/**
 * Integrations Index - Main Integration Orchestrator
 * CephasGM GameZone
 * 
 * This file orchestrates all third-party integrations including:
 * - Payment gateways (Stripe, PayPal, M-Pesa, Airtel, Bank, Crypto)
 * - Odds providers (Third-party odds API)
 * - Notification services (Email, Push, SMS)
 * 
 * It provides a unified interface for all integrations with
 * consistent error handling, logging, and retry logic.
 */

const logger = require('../utils/logger');
const paymentIntegrations = require('./payment');
const oddsIntegrations = require('./odds');
const notificationIntegrations = require('./notifications');

/**
 * Integration registry with all available integrations
 */
const integrations = {
  payment: paymentIntegrations,
  odds: oddsIntegrations,
  notifications: notificationIntegrations,
};

/**
 * Initialize all integrations
 * @param {Object} config - Configuration for integrations
 * @returns {Promise<Object>} - Initialization results
 */
const initializeIntegrations = async (config = {}) => {
  const results = {
    payment: { initialized: false, error: null },
    odds: { initialized: false, error: null },
    notifications: { initialized: false, error: null },
  };

  // Initialize payment integrations
  try {
    await paymentIntegrations.initialize(config.payment);
    results.payment.initialized = true;
    logger.info('✅ Payment integrations initialized');
  } catch (error) {
    results.payment.error = error.message;
    logger.error('❌ Payment integrations initialization failed:', error);
  }

  // Initialize odds integrations
  try {
    await oddsIntegrations.initialize(config.odds);
    results.odds.initialized = true;
    logger.info('✅ Odds integrations initialized');
  } catch (error) {
    results.odds.error = error.message;
    logger.error('❌ Odds integrations initialization failed:', error);
  }

  // Initialize notification integrations
  try {
    await notificationIntegrations.initialize(config.notifications);
    results.notifications.initialized = true;
    logger.info('✅ Notification integrations initialized');
  } catch (error) {
    results.notifications.error = error.message;
    logger.error('❌ Notification integrations initialization failed:', error);
  }

  return results;
};

/**
 * Get integration status
 * @returns {Object} - Integration status
 */
const getIntegrationStatus = () => {
  return {
    payment: paymentIntegrations.getStatus ? paymentIntegrations.getStatus() : { available: true },
    odds: oddsIntegrations.getStatus ? oddsIntegrations.getStatus() : { available: true },
    notifications: notificationIntegrations.getStatus ? notificationIntegrations.getStatus() : { available: true },
  };
};

/**
 * Health check for all integrations
 * @returns {Promise<Object>} - Health check results
 */
const healthCheck = async () => {
  const results = {
    payment: await paymentIntegrations.healthCheck ? await paymentIntegrations.healthCheck() : { healthy: true },
    odds: await oddsIntegrations.healthCheck ? await oddsIntegrations.healthCheck() : { healthy: true },
    notifications: await notificationIntegrations.healthCheck ? await notificationIntegrations.healthCheck() : { healthy: true },
  };

  const allHealthy = Object.values(results).every(r => r.healthy !== false);
  return { healthy: allHealthy, details: results };
};

// Export all integrations
module.exports = {
  ...integrations,
  initializeIntegrations,
  getIntegrationStatus,
  healthCheck,
};
