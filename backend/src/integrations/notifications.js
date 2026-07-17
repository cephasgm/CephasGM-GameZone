/**
 * Notifications Integration - Email, Push, SMS in One File
 * CephasGM GameZone
 * 
 * This file consolidates all notification services including:
 * - Email (SendGrid, AWS SES, Nodemailer fallback)
 * - Push Notifications (Firebase Cloud Messaging)
 * - SMS (Twilio, Africa's Talking)
 * 
 * Each notification channel implements a consistent interface:
 * - initialize(config)
 * - send(data)
 * - sendBulk(data)
 * - getStatus()
 * - healthCheck()
 */

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

// ============================================
// CONFIGURATION
// ============================================

const config = {
  // Email Configuration
  email: {
    provider: process.env.EMAIL_PROVIDER || 'sendgrid', // sendgrid, ses, nodemailer
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
      fromEmail: process.env.FROM_EMAIL || 'noreply@cephasgm.com',
      fromName: process.env.FROM_NAME || 'CephasGM GameZone',
    },
    ses: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      fromEmail: process.env.FROM_EMAIL || 'noreply@cephasgm.com',
    },
    nodemailer: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      fromEmail: process.env.FROM_EMAIL || 'noreply@cephasgm.com',
    },
  },

  // Push Configuration
  push: {
    provider: process.env.PUSH_PROVIDER || 'fcm', // fcm, onesignal
    fcm: {
      serverKey: process.env.FCM_SERVER_KEY,
      projectId: process.env.FCM_PROJECT_ID,
      senderId: process.env.FCM_SENDER_ID,
    },
    onesignal: {
      appId: process.env.ONESIGNAL_APP_ID,
      apiKey: process.env.ONESIGNAL_API_KEY,
    },
  },

  // SMS Configuration
  sms: {
    provider: process.env.SMS_PROVIDER || 'twilio', // twilio, africas_talking
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      fromNumber: process.env.TWILIO_FROM_NUMBER,
    },
    africasTalking: {
      apiKey: process.env.AFRICAS_TALKING_API_KEY,
      username: process.env.AFRICAS_TALKING_USERNAME,
      from: process.env.AFRICAS_TALKING_FROM || 'CEPHASGM',
    },
  },
};

// ============================================
// EMAIL SERVICE
// ============================================

class EmailService {
  constructor() {
    this.initialized = false;
    this.provider = config.email.provider;
  }

  async initialize() {
    try {
      // Test the email provider configuration
      if (this.provider === 'sendgrid') {
        if (!config.email.sendgrid.apiKey) {
          logger.warn('⚠️ SendGrid API key not configured. Email will be disabled.');
          return { initialized: false, reason: 'Not configured' };
        }
        // Test API key
        await axios.get('https://api.sendgrid.com/v3/user/profile', {
          headers: { Authorization: `Bearer ${config.email.sendgrid.apiKey}` },
        });
        logger.info('✅ SendGrid initialized');
      } else if (this.provider === 'ses') {
        if (!config.email.ses.accessKeyId) {
          logger.warn('⚠️ AWS SES not configured. Email will be disabled.');
          return { initialized: false, reason: 'Not configured' };
        }
        logger.info('✅ AWS SES initialized');
      } else if (this.provider === 'nodemailer') {
        if (!config.email.nodemailer.auth.user) {
          logger.warn('⚠️ Nodemailer not configured. Email will be disabled.');
          return { initialized: false, reason: 'Not configured' };
        }
        logger.info('✅ Nodemailer initialized');
      } else {
        logger.warn('⚠️ No email provider configured. Email will be disabled.');
        return { initialized: false, reason: 'No provider configured' };
      }

      this.initialized = true;
      return { initialized: true, provider: this.provider };
    } catch (error) {
      logger.error('❌ Email service initialization failed:', error.message);
      this.initialized = false;
      return { initialized: false, error: error.message };
    }
  }

  getStatus() {
    return { available: this.initialized, provider: this.provider };
  }

  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, reason: 'Not initialized' };
    }
    return { healthy: true };
  }

  async send(data) {
    const { to, subject, html, text, template, templateData, from, attachments = [] } = data;

    if (!this.initialized) {
      return { success: false, error: 'Email service not initialized' };
    }

    if (!to || !subject) {
      return { success: false, error: 'To and subject are required' };
    }

    try {
      let result;

      if (this.provider === 'sendgrid') {
        result = await this.sendSendgrid({ to, subject, html, text, from, attachments });
      } else if (this.provider === 'ses') {
        result = await this.sendSES({ to, subject, html, text, from });
      } else if (this.provider === 'nodemailer') {
        result = await this.sendNodemailer({ to, subject, html, text, from, attachments });
      } else {
        return { success: false, error: 'No email provider configured' };
      }

      logger.info(`📧 Email sent to ${to} (${subject})`);
      return { success: true, provider: this.provider, result };
    } catch (error) {
      logger.error('❌ Email send failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendBulk(data) {
    const { tos, subject, html, text, template, templateData } = data;

    if (!tos || tos.length === 0) {
      return { success: false, error: 'No recipients provided' };
    }

    const results = [];
    for (const to of tos) {
      const result = await this.send({ to, subject, html, text, template, templateData });
      results.push({ to, ...result });
    }

    const successCount = results.filter(r => r.success).length;
    return {
      success: successCount > 0,
      total: results.length,
      successCount,
      failCount: results.length - successCount,
      results,
    };
  }

  // SendGrid implementation
  async sendSendgrid({ to, subject, html, text, from, attachments }) {
    const payload = {
      personalizations: [{ to: [{ email: to }] }],
      from: { email: from || config.email.sendgrid.fromEmail, name: config.email.sendgrid.fromName },
      subject: subject,
      content: [],
    };

    if (html) {
      payload.content.push({ type: 'text/html', value: html });
    }
    if (text) {
      payload.content.push({ type: 'text/plain', value: text });
    }
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments.map(att => ({
        content: att.content,
        filename: att.filename,
        type: att.type,
        disposition: 'attachment',
      }));
    }

    const response = await axios.post('https://api.sendgrid.com/v3/mail/send', payload, {
      headers: {
        Authorization: `Bearer ${config.email.sendgrid.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    return { status: response.status, messageId: response.headers['x-message-id'] };
  }

  // AWS SES implementation (simplified)
  async sendSES({ to, subject, html, text, from }) {
    // In production, this would use the AWS SDK
    // For now, we'll log and simulate
    logger.info(`📧 SES: Sending email to ${to}`);
    return { status: 200, messageId: `ses-${Date.now()}` };
  }

  // Nodemailer implementation
  async sendNodemailer({ to, subject, html, text, from, attachments }) {
    // In production, this would use nodemailer
    // For now, we'll log and simulate
    logger.info(`📧 Nodemailer: Sending email to ${to}`);
    return { status: 200, messageId: `nodemailer-${Date.now()}` };
  }
}

// ============================================
// PUSH NOTIFICATION SERVICE
// ============================================

class PushService {
  constructor() {
    this.initialized = false;
    this.provider = config.push.provider;
    this.registrations = new Map();
  }

  async initialize() {
    try {
      if (this.provider === 'fcm') {
        if (!config.push.fcm.serverKey) {
          logger.warn('⚠️ FCM server key not configured. Push notifications will be disabled.');
          return { initialized: false, reason: 'Not configured' };
        }
        logger.info('✅ FCM initialized');
      } else if (this.provider === 'onesignal') {
        if (!config.push.onesignal.appId) {
          logger.warn('⚠️ OneSignal not configured. Push notifications will be disabled.');
          return { initialized: false, reason: 'Not configured' };
        }
        logger.info('✅ OneSignal initialized');
      } else {
        logger.warn('⚠️ No push provider configured. Push notifications will be disabled.');
        return { initialized: false, reason: 'No provider configured' };
      }

      this.initialized = true;
      return { initialized: true, provider: this.provider };
    } catch (error) {
      logger.error('❌ Push service initialization failed:', error.message);
      this.initialized = false;
      return { initialized: false, error: error.message };
    }
  }

  getStatus() {
    return { available: this.initialized, provider: this.provider };
  }

  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, reason: 'Not initialized' };
    }
    return { healthy: true };
  }

  registerDevice(userId, deviceToken, platform = 'web') {
    if (!this.registrations.has(userId)) {
      this.registrations.set(userId, []);
    }
    this.registrations.get(userId).push({ deviceToken, platform, registeredAt: new Date() });
    logger.debug(`📱 Device registered for user ${userId}`);
    return { success: true };
  }

  unregisterDevice(userId, deviceToken) {
    if (this.registrations.has(userId)) {
      const devices = this.registrations.get(userId).filter(d => d.deviceToken !== deviceToken);
      if (devices.length === 0) {
        this.registrations.delete(userId);
      } else {
        this.registrations.set(userId, devices);
      }
      logger.debug(`📱 Device unregistered for user ${userId}`);
      return { success: true };
    }
    return { success: false, error: 'User not found' };
  }

  async send(data) {
    const { userId, title, body, data: extraData, priority = 'normal', deviceToken = null } = data;

    if (!this.initialized) {
      return { success: false, error: 'Push service not initialized' };
    }

    if (!title || !body) {
      return { success: false, error: 'Title and body are required' };
    }

    try {
      let devices = [];
      if (deviceToken) {
        devices = [{ deviceToken, platform: 'web' }];
      } else if (userId && this.registrations.has(userId)) {
        devices = this.registrations.get(userId);
      } else {
        return { success: false, error: 'No device token or user ID provided' };
      }

      if (devices.length === 0) {
        return { success: false, error: 'No devices registered for this user' };
      }

      let result;

      if (this.provider === 'fcm') {
        result = await this.sendFCM(devices, { title, body, data: extraData, priority });
      } else if (this.provider === 'onesignal') {
        result = await this.sendOneSignal(devices, { title, body, data: extraData, priority });
      } else {
        return { success: false, error: 'No push provider configured' };
      }

      logger.info(`📱 Push notification sent to ${devices.length} devices for user ${userId}`);
      return { success: true, provider: this.provider, result, devices: devices.length };
    } catch (error) {
      logger.error('❌ Push send failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendBulk(data) {
    const { userIds, title, body, data: extraData, priority = 'normal' } = data;

    if (!userIds || userIds.length === 0) {
      return { success: false, error: 'No users provided' };
    }

    const results = [];
    for (const userId of userIds) {
      const result = await this.send({ userId, title, body, data: extraData, priority });
      results.push({ userId, ...result });
    }

    const successCount = results.filter(r => r.success).length;
    return {
      success: successCount > 0,
      total: results.length,
      successCount,
      failCount: results.length - successCount,
      results,
    };
  }

  // FCM implementation
  async sendFCM(devices, { title, body, data, priority }) {
    const tokens = devices.map(d => d.deviceToken);

    const payload = {
      registration_ids: tokens,
      priority: priority === 'high' ? 'high' : 'normal',
      notification: {
        title: title,
        body: body,
        sound: 'default',
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
      },
    };

    const response = await axios.post('https://fcm.googleapis.com/fcm/send', payload, {
      headers: {
        Authorization: `key=${config.push.fcm.serverKey}`,
        'Content-Type': 'application/json',
      },
    });

    return {
      status: response.status,
      success: response.data.success,
      failure: response.data.failure,
      results: response.data.results,
    };
  }

  // OneSignal implementation
  async sendOneSignal(devices, { title, body, data, priority }) {
    const playerIds = devices.map(d => d.deviceToken);

    const payload = {
      app_id: config.push.onesignal.appId,
      contents: { en: body },
      headings: { en: title },
      include_player_ids: playerIds,
      data: data || {},
      priority: priority === 'high' ? 10 : 5,
    };

    const response = await axios.post('https://onesignal.com/api/v1/notifications', payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${config.push.onesignal.apiKey}`,
      },
    });

    return {
      status: response.status,
      id: response.data.id,
      recipients: response.data.recipients,
    };
  }
}

// ============================================
// SMS SERVICE
// ============================================

class SMSService {
  constructor() {
    this.initialized = false;
    this.provider = config.sms.provider;
  }

  async initialize() {
    try {
      if (this.provider === 'twilio') {
        if (!config.sms.twilio.accountSid || !config.sms.twilio.authToken) {
          logger.warn('⚠️ Twilio not configured. SMS will be disabled.');
          return { initialized: false, reason: 'Not configured' };
        }
        logger.info('✅ Twilio initialized');
      } else if (this.provider === 'africas_talking') {
        if (!config.sms.africasTalking.apiKey) {
          logger.warn('⚠️ Africa\'s Talking not configured. SMS will be disabled.');
          return { initialized: false, reason: 'Not configured' };
        }
        logger.info('✅ Africa\'s Talking initialized');
      } else {
        logger.warn('⚠️ No SMS provider configured. SMS will be disabled.');
        return { initialized: false, reason: 'No provider configured' };
      }

      this.initialized = true;
      return { initialized: true, provider: this.provider };
    } catch (error) {
      logger.error('❌ SMS service initialization failed:', error.message);
      this.initialized = false;
      return { initialized: false, error: error.message };
    }
  }

  getStatus() {
    return { available: this.initialized, provider: this.provider };
  }

  async healthCheck() {
    if (!this.initialized) {
      return { healthy: false, reason: 'Not initialized' };
    }
    return { healthy: true };
  }

  async send(data) {
    const { to, message, from, template, templateData } = data;

    if (!this.initialized) {
      return { success: false, error: 'SMS service not initialized' };
    }

    if (!to || !message) {
      return { success: false, error: 'To and message are required' };
    }

    try {
      let result;

      if (this.provider === 'twilio') {
        result = await this.sendTwilio({ to, message, from });
      } else if (this.provider === 'africas_talking') {
        result = await this.sendAfricaTalking({ to, message, from });
      } else {
        return { success: false, error: 'No SMS provider configured' };
      }

      logger.info(`📱 SMS sent to ${to}`);
      return { success: true, provider: this.provider, result };
    } catch (error) {
      logger.error('❌ SMS send failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async sendBulk(data) {
    const { tos, message, from } = data;

    if (!tos || tos.length === 0) {
      return { success: false, error: 'No recipients provided' };
    }

    const results = [];
    for (const to of tos) {
      const result = await this.send({ to, message, from });
      results.push({ to, ...result });
    }

    const successCount = results.filter(r => r.success).length;
    return {
      success: successCount > 0,
      total: results.length,
      successCount,
      failCount: results.length - successCount,
      results,
    };
  }

  // Twilio implementation
  async sendTwilio({ to, message, from }) {
    const accountSid = config.sms.twilio.accountSid;
    const authToken = config.sms.twilio.authToken;

    const response = await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      new URLSearchParams({
        To: to,
        From: from || config.sms.twilio.fromNumber,
        Body: message,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: accountSid,
          password: authToken,
        },
      }
    );

    return {
      status: response.status,
      sid: response.data.sid,
      status: response.data.status,
    };
  }

  // Africa's Talking implementation
  async sendAfricaTalking({ to, message, from }) {
    const response = await axios.post(
      'https://api.africastalking.com/version1/messaging',
      new URLSearchParams({
        to: to,
        message: message,
        from: from || config.sms.africasTalking.from,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apiKey': config.sms.africasTalking.apiKey,
        },
      }
    );

    return {
      status: response.status,
      id: response.data.SMSMessageData?.Recipients?.[0]?.messageId,
      status: response.data.SMSMessageData?.Recipients?.[0]?.status,
    };
  }
}

// ============================================
// UNIFIED NOTIFICATION SERVICE
// ============================================

class NotificationService {
  constructor() {
    this.email = new EmailService();
    this.push = new PushService();
    this.sms = new SMSService();
    this.initialized = false;
  }

  async initialize() {
    const emailResult = await this.email.initialize();
    const pushResult = await this.push.initialize();
    const smsResult = await this.sms.initialize();

    this.initialized = true;

    return {
      email: emailResult,
      push: pushResult,
      sms: smsResult,
      success: emailResult.initialized || pushResult.initialized || smsResult.initialized,
    };
  }

  getStatus() {
    return {
      initialized: this.initialized,
      email: this.email.getStatus(),
      push: this.push.getStatus(),
      sms: this.sms.getStatus(),
    };
  }

  async healthCheck() {
    const emailHealth = await this.email.healthCheck();
    const pushHealth = await this.push.healthCheck();
    const smsHealth = await this.sms.healthCheck();

    return {
      healthy: emailHealth.healthy || pushHealth.healthy || smsHealth.healthy,
      email: emailHealth,
      push: pushHealth,
      sms: smsHealth,
    };
  }

  async send(data) {
    const { channels = ['email'], to, subject, message, title, body, ...rest } = data;

    const results = {};

    if (channels.includes('email') && this.email.initialized) {
      results.email = await this.email.send({ to, subject, html: message, text: message, ...rest });
    }

    if (channels.includes('push') && this.push.initialized) {
      results.push = await this.push.send({ userId: to, title: title || subject, body: message || body, ...rest });
    }

    if (channels.includes('sms') && this.sms.initialized) {
      results.sms = await this.sms.send({ to, message: message || body, ...rest });
    }

    const success = Object.values(results).some(r => r && r.success);
    return { success, results };
  }

  async sendBulk(data) {
    const { channels = ['email'], tos, subject, message, title, body, ...rest } = data;

    const results = {};

    if (channels.includes('email') && this.email.initialized) {
      results.email = await this.email.sendBulk({ tos, subject, html: message, text: message, ...rest });
    }

    if (channels.includes('push') && this.push.initialized) {
      results.push = await this.push.sendBulk({ userIds: tos, title: title || subject, body: message || body, ...rest });
    }

    if (channels.includes('sms') && this.sms.initialized) {
      results.sms = await this.sms.sendBulk({ tos, message: message || body, ...rest });
    }

    const success = Object.values(results).some(r => r && r.success);
    return { success, results };
  }

  // Convenience methods
  sendEmail(data) {
    return this.send({ ...data, channels: ['email'] });
  }

  sendPush(data) {
    return this.send({ ...data, channels: ['push'] });
  }

  sendSms(data) {
    return this.send({ ...data, channels: ['sms'] });
  }

  registerPushDevice(userId, deviceToken, platform) {
    return this.push.registerDevice(userId, deviceToken, platform);
  }

  unregisterPushDevice(userId, deviceToken) {
    return this.push.unregisterDevice(userId, deviceToken);
  }
}

// ============================================
// EXPORTS
// ============================================

// Create singleton instance
const notificationService = new NotificationService();

module.exports = {
  NotificationService,
  EmailService,
  PushService,
  SMSService,
  notificationService,
  config,
  initialize: () => notificationService.initialize(),
  getStatus: () => notificationService.getStatus(),
  healthCheck: () => notificationService.healthCheck(),
  send: (data) => notificationService.send(data),
  sendBulk: (data) => notificationService.sendBulk(data),
  sendEmail: (data) => notificationService.sendEmail(data),
  sendPush: (data) => notificationService.sendPush(data),
  sendSms: (data) => notificationService.sendSms(data),
  registerPushDevice: (userId, deviceToken, platform) => notificationService.registerPushDevice(userId, deviceToken, platform),
  unregisterPushDevice: (userId, deviceToken) => notificationService.unregisterPushDevice(userId, deviceToken),
};
