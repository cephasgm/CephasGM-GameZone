/**
 * Payment Integrations - All Payment Gateways in One File
 * CephasGM GameZone
 * 
 * This file consolidates all payment gateway integrations including:
 * - Mobile Money: MixbyYas, M-Pesa, Airtel Money, Halopesa
 * - Digital Wallets: PayPal
 * - Mobile Banking: Mobile Banking (Bank Transfer via Mobile)
 * - Cryptocurrency: Bitcoin, Ethereum, USDT
 * 
 * Each payment method implements a consistent interface:
 * - initialize(config)
 * - processDeposit(paymentData)
 * - processWithdrawal(paymentData)
 * - verifyPayment(paymentData)
 * - handleWebhook(payload, headers)
 * - healthCheck()
 */

const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

// ============================================
// CONFIGURATION
// ============================================

// Load from environment variables
const config = {
  // MixbyYas - Mobile Money
  mixbyYas: {
    apiKey: process.env.MIXBY_YAS_API_KEY,
    apiSecret: process.env.MIXBY_YAS_API_SECRET,
    baseUrl: process.env.MIXBY_YAS_BASE_URL || 'https://api.mixbyyas.com/v1',
    merchantId: process.env.MIXBY_YAS_MERCHANT_ID,
    callbackUrl: process.env.MIXBY_YAS_CALLBACK_URL,
  },
  // M-Pesa
  mpesa: {
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    baseUrl: process.env.MPESA_BASE_URL || 'https://api.safaricom.co.ke',
    shortCode: process.env.MPESA_SHORT_CODE,
    passkey: process.env.MPESA_PASSKEY,
    callbackUrl: process.env.MPESA_CALLBACK_URL,
  },
  // Airtel Money
  airtel: {
    apiKey: process.env.AIRTEL_API_KEY,
    apiSecret: process.env.AIRTEL_API_SECRET,
    baseUrl: process.env.AIRTEL_BASE_URL || 'https://api.airtel.africa',
    merchantId: process.env.AIRTEL_MERCHANT_ID,
    callbackUrl: process.env.AIRTEL_CALLBACK_URL,
  },
  // Halopesa
  halopesa: {
    apiKey: process.env.HALOPESA_API_KEY,
    apiSecret: process.env.HALOPESA_API_SECRET,
    baseUrl: process.env.HALOPESA_BASE_URL || 'https://api.halopesa.com/v1',
    merchantId: process.env.HALOPESA_MERCHANT_ID,
    callbackUrl: process.env.HALOPESA_CALLBACK_URL,
  },
  // PayPal
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    baseUrl: process.env.PAYPAL_BASE_URL || 'https://api.paypal.com',
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
  },
  // Mobile Banking
  mobileBanking: {
    apiKey: process.env.MOBILE_BANKING_API_KEY,
    apiSecret: process.env.MOBILE_BANKING_API_SECRET,
    baseUrl: process.env.MOBILE_BANKING_BASE_URL || 'https://api.mobilebanking.com/v1',
    callbackUrl: process.env.MOBILE_BANKING_CALLBACK_URL,
  },
  // Cryptocurrency
  crypto: {
    provider: process.env.CRYPTO_PROVIDER || 'blockchain',
    apiKey: process.env.CRYPTO_API_KEY,
    baseUrl: process.env.CRYPTO_BASE_URL || 'https://api.blockchain.com/v3',
    callbackUrl: process.env.CRYPTO_CALLBACK_URL,
  },
};

// ============================================
// PAYMENT GATEWAY BASE CLASS
// ============================================

class PaymentGateway {
  constructor(name, config) {
    this.name = name;
    this.config = config;
    this.initialized = false;
  }

  async initialize() {
    if (!this.config.apiKey && !this.config.clientId && !this.config.consumerKey) {
      logger.warn(`⚠️ ${this.name} not configured. Skipping initialization.`);
      return { initialized: false, reason: 'Not configured' };
    }
    this.initialized = true;
    logger.info(`✅ ${this.name} initialized`);
    return { initialized: true };
  }

  getStatus() {
    return { available: this.initialized };
  }

  async healthCheck() {
    return { healthy: this.initialized };
  }

  // To be overridden by child classes
  async processDeposit(data) {
    throw new Error(`${this.name}.processDeposit not implemented`);
  }

  async processWithdrawal(data) {
    throw new Error(`${this.name}.processWithdrawal not implemented`);
  }

  async verifyPayment(data) {
    throw new Error(`${this.name}.verifyPayment not implemented`);
  }

  async handleWebhook(payload, headers) {
    throw new Error(`${this.name}.handleWebhook not implemented`);
  }
}

// ============================================
// MIXBY YAS - Mobile Money
// ============================================

class MixbyYasGateway extends PaymentGateway {
  constructor() {
    super('MixbyYas', config.mixbyYas);
  }

  async processDeposit(data) {
    const { amount, currency = 'TZS', phoneNumber, reference, metadata = {} } = data;

    try {
      // Generate request signature
      const timestamp = Date.now().toString();
      const signature = this.generateSignature({
        merchantId: this.config.merchantId,
        amount,
        currency,
        phoneNumber,
        reference,
        timestamp,
      });

      const response = await axios.post(
        `${this.config.baseUrl}/deposit`,
        {
          merchantId: this.config.merchantId,
          amount,
          currency,
          phoneNumber,
          reference,
          timestamp,
          callbackUrl: this.config.callbackUrl,
          metadata,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Signature': signature,
          },
        }
      );

      return {
        success: true,
        providerReference: response.data.transactionId || response.data.reference,
        status: response.data.status || 'pending',
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('MixbyYas deposit failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async processWithdrawal(data) {
    const { amount, currency = 'TZS', phoneNumber, reference, metadata = {} } = data;

    try {
      const timestamp = Date.now().toString();
      const signature = this.generateSignature({
        merchantId: this.config.merchantId,
        amount,
        currency,
        phoneNumber,
        reference,
        timestamp,
      });

      const response = await axios.post(
        `${this.config.baseUrl}/withdrawal`,
        {
          merchantId: this.config.merchantId,
          amount,
          currency,
          phoneNumber,
          reference,
          timestamp,
          callbackUrl: this.config.callbackUrl,
          metadata,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Signature': signature,
          },
        }
      );

      return {
        success: true,
        providerReference: response.data.transactionId || response.data.reference,
        status: response.data.status || 'pending',
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('MixbyYas withdrawal failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async verifyPayment(data) {
    const { providerReference } = data;

    try {
      const response = await axios.get(
        `${this.config.baseUrl}/transaction/${providerReference}`,
        {
          headers: {
            'X-API-Key': this.config.apiKey,
          },
        }
      );

      const statusMap = {
        completed: 'completed',
        success: 'completed',
        pending: 'pending',
        processing: 'processing',
        failed: 'failed',
        cancelled: 'cancelled',
      };

      return {
        status: statusMap[response.data.status] || response.data.status,
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('MixbyYas verification failed:', error.response?.data || error.message);
      return {
        status: 'failed',
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async handleWebhook(payload, headers) {
    // Verify signature
    const signature = headers['x-signature'] || headers['X-Signature'];
    if (!this.verifySignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    const event = payload.event || payload.type;
    const data = payload.data || payload;

    return {
      event: event,
      data: data,
      status: data.status || 'completed',
      providerReference: data.transactionId || data.reference,
    };
  }

  generateSignature(data) {
    const sorted = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('&');
    return crypto.createHmac('sha256', this.config.apiSecret).update(sorted).digest('hex');
  }

  verifySignature(payload, signature) {
    const computed = crypto.createHmac('sha256', this.config.apiSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  }
}

// ============================================
// M-PESA - Mobile Money
// ============================================

class MpesaGateway extends PaymentGateway {
  constructor() {
    super('M-Pesa', config.mpesa);
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.config.consumerKey}:${this.config.consumerSecret}`).toString('base64');
      const response = await axios.get(
        `${this.config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
      return this.accessToken;
    } catch (error) {
      logger.error('M-Pesa token generation failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with M-Pesa');
    }
  }

  async processDeposit(data) {
    const { amount, phoneNumber, reference, metadata = {} } = data;

    try {
      const token = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
      const password = Buffer.from(`${this.config.shortCode}${this.config.passkey}${timestamp}`).toString('base64');

      const response = await axios.post(
        `${this.config.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.config.shortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: Math.round(amount),
          PartyA: phoneNumber,
          PartyB: this.config.shortCode,
          PhoneNumber: phoneNumber,
          CallBackURL: this.config.callbackUrl,
          AccountReference: reference,
          TransactionDesc: `Deposit ${reference}`,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        providerReference: response.data.CheckoutRequestID,
        status: 'pending',
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('M-Pesa deposit failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || error.message,
      };
    }
  }

  async processWithdrawal(data) {
    const { amount, phoneNumber, reference, metadata = {} } = data;

    try {
      const token = await this.getAccessToken();

      const response = await axios.post(
        `${this.config.baseUrl}/mpesa/b2c/v3/paymentrequest`,
        {
          InitiatorName: this.config.initiatorName || 'Test',
          SecurityCredential: this.config.securityCredential,
          CommandID: 'BusinessPayment',
          Amount: Math.round(amount),
          PartyA: this.config.shortCode,
          PartyB: phoneNumber,
          Remarks: `Withdrawal ${reference}`,
          QueueTimeOutURL: this.config.callbackUrl,
          ResultURL: this.config.callbackUrl,
          Occasion: reference,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        providerReference: response.data.ConversationID,
        status: 'pending',
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('M-Pesa withdrawal failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.errorMessage || error.message,
      };
    }
  }

  async verifyPayment(data) {
    const { providerReference } = data;

    try {
      const token = await this.getAccessToken();
      const response = await axios.get(
        `${this.config.baseUrl}/mpesa/stkpushquery/v1/query`,
        {
          params: {
            BusinessShortCode: this.config.shortCode,
            Password: Buffer.from(`${this.config.shortCode}${this.config.passkey}${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}`).toString('base64'),
            Timestamp: new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14),
            CheckoutRequestID: providerReference,
          },
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const resultCode = response.data.ResultCode;
      const statusMap = {
        '0': 'completed',
        '1037': 'pending',
        '1032': 'failed',
      };

      return {
        status: statusMap[resultCode] || 'pending',
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('M-Pesa verification failed:', error.response?.data || error.message);
      return {
        status: 'pending',
        error: error.response?.data?.errorMessage || error.message,
      };
    }
  }

  async handleWebhook(payload, headers) {
    const data = payload.Body?.stkCallback || payload;
    const resultCode = data.ResultCode;
    const resultDesc = data.ResultDesc;

    const statusMap = {
      '0': 'completed',
      '1037': 'pending',
      '1032': 'failed',
    };

    return {
      event: 'payment',
      data: data,
      status: statusMap[resultCode] || 'pending',
      providerReference: data.CheckoutRequestID || data.TransactionID,
      resultCode: resultCode,
      resultDesc: resultDesc,
    };
  }
}

// ============================================
// AIRTEL MONEY - Mobile Money
// ============================================

class AirtelGateway extends PaymentGateway {
  constructor() {
    super('Airtel Money', config.airtel);
  }

  async processDeposit(data) {
    const { amount, currency = 'TZS', phoneNumber, reference, metadata = {} } = data;

    try {
      const timestamp = Date.now();
      const signature = this.generateSignature({
        merchantId: this.config.merchantId,
        amount,
        currency,
        phoneNumber,
        reference,
        timestamp,
      });

      const response = await axios.post(
        `${this.config.baseUrl}/payment/request`,
        {
          merchantId: this.config.merchantId,
          amount,
          currency,
          phoneNumber,
          reference,
          timestamp,
          callbackUrl: this.config.callbackUrl,
          metadata,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Signature': signature,
          },
        }
      );

      return {
        success: true,
        providerReference: response.data.transactionId || response.data.reference,
        status: response.data.status || 'pending',
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('Airtel deposit failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async processWithdrawal(data) {
    const { amount, currency = 'TZS', phoneNumber, reference, metadata = {} } = data;

    try {
      const timestamp = Date.now();
      const signature = this.generateSignature({
        merchantId: this.config.merchantId,
        amount,
        currency,
        phoneNumber,
        reference,
        timestamp,
      });

      const response = await axios.post(
        `${this.config.baseUrl}/payment/withdraw`,
        {
          merchantId: this.config.merchantId,
          amount,
          currency,
          phoneNumber,
          reference,
          timestamp,
          callbackUrl: this.config.callbackUrl,
          metadata,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Signature': signature,
          },
        }
      );

      return {
        success: true,
        providerReference: response.data.transactionId || response.data.reference,
        status: response.data.status || 'pending',
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('Airtel withdrawal failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async verifyPayment(data) {
    const { providerReference } = data;

    try {
      const response = await axios.get(
        `${this.config.baseUrl}/transaction/${providerReference}`,
        {
          headers: {
            'X-API-Key': this.config.apiKey,
          },
        }
      );

      const statusMap = {
        completed: 'completed',
        success: 'completed',
        pending: 'pending',
        processing: 'processing',
        failed: 'failed',
      };

      return {
        status: statusMap[response.data.status] || response.data.status,
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('Airtel verification failed:', error.response?.data || error.message);
      return {
        status: 'failed',
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async handleWebhook(payload, headers) {
    const signature = headers['x-signature'] || headers['X-Signature'];
    if (!this.verifySignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    return {
      event: payload.event || payload.type,
      data: payload.data || payload,
      status: payload.data?.status || 'completed',
      providerReference: payload.data?.transactionId || payload.data?.reference,
    };
  }

  generateSignature(data) {
    const sorted = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('&');
    return crypto.createHmac('sha256', this.config.apiSecret).update(sorted).digest('hex');
  }

  verifySignature(payload, signature) {
    const computed = crypto.createHmac('sha256', this.config.apiSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  }
}

// ============================================
// HALOPESA - Mobile Money
// ============================================

class HalopesaGateway extends PaymentGateway {
  constructor() {
    super('Halopesa', config.halopesa);
  }

  async processDeposit(data) {
    const { amount, currency = 'TZS', phoneNumber, reference, metadata = {} } = data;

    try {
      const signature = this.generateSignature({
        merchantId: this.config.merchantId,
        amount,
        currency,
        phoneNumber,
        reference,
      });

      const response = await axios.post(
        `${this.config.baseUrl}/deposit`,
        {
          merchantId: this.config.merchantId,
          amount,
          currency,
          phoneNumber,
          reference,
          callbackUrl: this.config.callbackUrl,
          metadata,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Signature': signature,
          },
        }
      );

      return {
        success: true,
        providerReference: response.data.transactionId || response.data.reference,
        status: response.data.status || 'pending',
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('Halopesa deposit failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async processWithdrawal(data) {
    const { amount, currency = 'TZS', phoneNumber, reference, metadata = {} } = data;

    try {
      const signature = this.generateSignature({
        merchantId: this.config.merchantId,
        amount,
        currency,
        phoneNumber,
        reference,
      });

      const response = await axios.post(
        `${this.config.baseUrl}/withdrawal`,
        {
          merchantId: this.config.merchantId,
          amount,
          currency,
          phoneNumber,
          reference,
          callbackUrl: this.config.callbackUrl,
          metadata,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Signature': signature,
          },
        }
      );

      return {
        success: true,
        providerReference: response.data.transactionId || response.data.reference,
        status: response.data.status || 'pending',
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('Halopesa withdrawal failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async verifyPayment(data) {
    const { providerReference } = data;

    try {
      const response = await axios.get(
        `${this.config.baseUrl}/transaction/${providerReference}`,
        {
          headers: {
            'X-API-Key': this.config.apiKey,
          },
        }
      );

      const statusMap = {
        completed: 'completed',
        success: 'completed',
        pending: 'pending',
        processing: 'processing',
        failed: 'failed',
        cancelled: 'cancelled',
      };

      return {
        status: statusMap[response.data.status] || response.data.status,
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('Halopesa verification failed:', error.response?.data || error.message);
      return {
        status: 'failed',
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async handleWebhook(payload, headers) {
    const signature = headers['x-signature'] || headers['X-Signature'];
    if (!this.verifySignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    return {
      event: payload.event || payload.type,
      data: payload.data || payload,
      status: payload.data?.status || 'completed',
      providerReference: payload.data?.transactionId || payload.data?.reference,
    };
  }

  generateSignature(data) {
    const sorted = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('&');
    return crypto.createHmac('sha256', this.config.apiSecret).update(sorted).digest('hex');
  }

  verifySignature(payload, signature) {
    const computed = crypto.createHmac('sha256', this.config.apiSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  }
}

// ============================================
// PAYPAL - Digital Wallet
// ============================================

class PayPalGateway extends PaymentGateway {
  constructor() {
    super('PayPal', config.paypal);
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64');
      const response = await axios.post(
        `${this.config.baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
      return this.accessToken;
    } catch (error) {
      logger.error('PayPal token generation failed:', error.response?.data || error.message);
      throw new Error('Failed to authenticate with PayPal');
    }
  }

  async processDeposit(data) {
    const { amount, currency = 'USD', reference, metadata = {} } = data;

    try {
      const token = await this.getAccessToken();

      const response = await axios.post(
        `${this.config.baseUrl}/v2/checkout/orders`,
        {
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: reference,
            amount: {
              currency_code: currency,
              value: amount.toFixed(2),
            },
            description: `Deposit ${reference}`,
          }],
          application_context: {
            return_url: this.config.callbackUrl,
            cancel_url: this.config.callbackUrl,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Find approval link
      const approvalLink = response.data.links.find(l => l.rel === 'approve');

      return {
        success: true,
        providerReference: response.data.id,
        status: 'pending',
        redirectUrl: approvalLink?.href,
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('PayPal deposit failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async processWithdrawal(data) {
    const { amount, currency = 'USD', accountEmail, reference, metadata = {} } = data;

    try {
      const token = await this.getAccessToken();

      // Create payout
      const response = await axios.post(
        `${this.config.baseUrl}/v1/payments/payouts`,
        {
          sender_batch_header: {
            sender_batch_id: reference,
            email_subject: 'Withdrawal from CephasGM GameZone',
          },
          items: [{
            recipient_type: 'EMAIL',
            amount: {
              value: amount.toFixed(2),
              currency: currency,
            },
            receiver: accountEmail,
            note: `Withdrawal ${reference}`,
            sender_item_id: reference,
          }],
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        providerReference: response.data.batch_header.payout_batch_id,
        status: 'processing',
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('PayPal withdrawal failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async verifyPayment(data) {
    const { providerReference, type = 'order' } = data;

    try {
      const token = await this.getAccessToken();
      const endpoint = type === 'order' ? `/v2/checkout/orders/${providerReference}` : `/v1/payments/payouts/${providerReference}`;

      const response = await axios.get(
        `${this.config.baseUrl}${endpoint}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      let status;
      if (type === 'order') {
        const statusMap = {
          'CREATED': 'pending',
          'APPROVED': 'pending',
          'COMPLETED': 'completed',
          'PAYER_ACTION_REQUIRED': 'pending',
          'VOIDED': 'cancelled',
        };
        status = statusMap[response.data.status] || 'pending';
      } else {
        const statusMap = {
          'PENDING': 'pending',
          'PROCESSING': 'processing',
          'SUCCESS': 'completed',
          'FAILED': 'failed',
          'CANCELLED': 'cancelled',
        };
        status = statusMap[response.data.batch_header?.batch_status] || 'pending';
      }

      return {
        status: status,
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('PayPal verification failed:', error.response?.data || error.message);
      return {
        status: 'failed',
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async handleWebhook(payload, headers) {
    // Verify webhook signature
    const webhookId = this.config.webhookId;
    const authAlgo = headers['paypal-auth-algo'];
    const authCert = headers['paypal-cert-url'];
    const transmissionId = headers['paypal-transmission-id'];
    const transmissionTime = headers['paypal-transmission-time'];
    const transmissionSig = headers['paypal-transmission-sig'];

    // In production, verify using PayPal's webhook verification
    // For now, we'll trust the webhook

    const event = payload.event_type || payload.type;
    const data = payload.resource || payload.data;

    let status = 'pending';
    if (event === 'CHECKOUT.ORDER.COMPLETED' || event === 'PAYMENT.CAPTURE.COMPLETED') {
      status = 'completed';
    } else if (event === 'PAYMENT.CAPTURE.DENIED' || event === 'PAYMENT.CAPTURE.REFUNDED') {
      status = 'failed';
    } else if (event === 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED') {
      status = 'completed';
    } else if (event === 'PAYMENT.PAYOUTS-ITEM.FAILED') {
      status = 'failed';
    }

    return {
      event: event,
      data: data,
      status: status,
      providerReference: data.id || data.payout_item_id,
    };
  }
}

// ============================================
// MOBILE BANKING - Bank Transfer via Mobile
// ============================================

class MobileBankingGateway extends PaymentGateway {
  constructor() {
    super('Mobile Banking', config.mobileBanking);
  }

  async processDeposit(data) {
    const { amount, currency = 'TZS', accountNumber, bankCode, reference, metadata = {} } = data;

    try {
      const timestamp = Date.now();
      const signature = this.generateSignature({
        accountNumber,
        bankCode,
        amount,
        currency,
        reference,
        timestamp,
      });

      const response = await axios.post(
        `${this.config.baseUrl}/deposit`,
        {
          accountNumber,
          bankCode,
          amount,
          currency,
          reference,
          timestamp,
          callbackUrl: this.config.callbackUrl,
          metadata,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Signature': signature,
          },
        }
      );

      return {
        success: true,
        providerReference: response.data.transactionId || response.data.reference,
        status: response.data.status || 'pending',
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('Mobile Banking deposit failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async processWithdrawal(data) {
    const { amount, currency = 'TZS', accountNumber, bankCode, reference, metadata = {} } = data;

    try {
      const timestamp = Date.now();
      const signature = this.generateSignature({
        accountNumber,
        bankCode,
        amount,
        currency,
        reference,
        timestamp,
      });

      const response = await axios.post(
        `${this.config.baseUrl}/withdrawal`,
        {
          accountNumber,
          bankCode,
          amount,
          currency,
          reference,
          timestamp,
          callbackUrl: this.config.callbackUrl,
          metadata,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey,
            'X-Signature': signature,
          },
        }
      );

      return {
        success: true,
        providerReference: response.data.transactionId || response.data.reference,
        status: response.data.status || 'pending',
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('Mobile Banking withdrawal failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async verifyPayment(data) {
    const { providerReference } = data;

    try {
      const response = await axios.get(
        `${this.config.baseUrl}/transaction/${providerReference}`,
        {
          headers: {
            'X-API-Key': this.config.apiKey,
          },
        }
      );

      const statusMap = {
        completed: 'completed',
        success: 'completed',
        pending: 'pending',
        processing: 'processing',
        failed: 'failed',
        cancelled: 'cancelled',
      };

      return {
        status: statusMap[response.data.status] || response.data.status,
        gatewayData: response.data,
      };
    } catch (error) {
      logger.error('Mobile Banking verification failed:', error.response?.data || error.message);
      return {
        status: 'failed',
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async handleWebhook(payload, headers) {
    const signature = headers['x-signature'] || headers['X-Signature'];
    if (!this.verifySignature(payload, signature)) {
      throw new Error('Invalid webhook signature');
    }

    return {
      event: payload.event || payload.type,
      data: payload.data || payload,
      status: payload.data?.status || 'completed',
      providerReference: payload.data?.transactionId || payload.data?.reference,
    };
  }

  generateSignature(data) {
    const sorted = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('&');
    return crypto.createHmac('sha256', this.config.apiSecret).update(sorted).digest('hex');
  }

  verifySignature(payload, signature) {
    const computed = crypto.createHmac('sha256', this.config.apiSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  }
}

// ============================================
// CRYPTOCURRENCY
// ============================================

class CryptoGateway extends PaymentGateway {
  constructor() {
    super('Cryptocurrency', config.crypto);
    this.addresses = {}; // Store generated addresses
  }

  async processDeposit(data) {
    const { amount, currency = 'BTC', reference, metadata = {} } = data;

    try {
      // Generate a unique address for this deposit
      const address = await this.generateAddress(reference);

      return {
        success: true,
        providerReference: address,
        status: 'pending',
        address: address,
        currency: currency,
        amount: amount,
        gatewayData: {
          address,
          currency,
          amount,
          reference,
        },
      };
    } catch (error) {
      logger.error('Crypto deposit failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async processWithdrawal(data) {
    const { amount, currency = 'BTC', address, reference, metadata = {} } = data;

    try {
      // In production, this would call a blockchain API to send funds
      // For now, we'll simulate the withdrawal
      const txHash = crypto.randomBytes(32).toString('hex');

      return {
        success: true,
        providerReference: txHash,
        status: 'processing',
        txHash: txHash,
        gatewayData: {
          txHash,
          address,
          currency,
          amount,
          reference,
        },
      };
    } catch (error) {
      logger.error('Crypto withdrawal failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async verifyPayment(data) {
    const { providerReference, currency = 'BTC' } = data;

    try {
      // In production, this would check the blockchain for transaction confirmations
      // For now, we'll simulate verification
      const confirmations = Math.floor(Math.random() * 6) + 1;
      const status = confirmations >= 3 ? 'completed' : 'pending';

      return {
        status: status,
        confirmations: confirmations,
        gatewayData: {
          address: providerReference,
          confirmations,
          currency,
        },
      };
    } catch (error) {
      logger.error('Crypto verification failed:', error.response?.data || error.message);
      return {
        status: 'pending',
        error: error.response?.data?.message || error.message,
      };
    }
  }

  async handleWebhook(payload, headers) {
    // Webhook from blockchain API
    const data = payload;
    const confirmations = data.confirmations || 0;

    return {
      event: 'payment',
      data: data,
      status: confirmations >= 3 ? 'completed' : 'pending',
      providerReference: data.address || data.txHash,
      confirmations: confirmations,
    };
  }

  async generateAddress(reference) {
    // In production, this would call a blockchain API to generate a new address
    // For now, we'll generate a mock address
    const mockAddress = `0x${crypto.randomBytes(20).toString('hex')}`;
    this.addresses[reference] = mockAddress;
    return mockAddress;
  }

  async healthCheck() {
    // In production, check blockchain API availability
    return { healthy: true };
  }
}

// ============================================
// PAYMENT GATEWAY FACTORY
// ============================================

const gateways = {};

const getGateway = (method) => {
  // Initialize gateways lazily
  if (!gateways[method]) {
    switch (method) {
      case 'mixbyyas':
      case 'mixby_yas':
        gateways[method] = new MixbyYasGateway();
        break;
      case 'mpesa':
        gateways[method] = new MpesaGateway();
        break;
      case 'airtel':
      case 'airtel_money':
        gateways[method] = new AirtelGateway();
        break;
      case 'halopesa':
        gateways[method] = new HalopesaGateway();
        break;
      case 'paypal':
        gateways[method] = new PayPalGateway();
        break;
      case 'mobile_banking':
      case 'mobilebanking':
        gateways[method] = new MobileBankingGateway();
        break;
      case 'crypto':
      case 'cryptocurrency':
        gateways[method] = new CryptoGateway();
        break;
      default:
        throw new Error(`Unsupported payment method: ${method}`);
    }
  }
  return gateways[method];
};

const getAvailableMethods = () => {
  const methods = [];
  const methodConfigs = {
    mixbyyas: config.mixbyYas,
    mpesa: config.mpesa,
    airtel: config.airtel,
    halopesa: config.halopesa,
    paypal: config.paypal,
    mobile_banking: config.mobileBanking,
    crypto: config.crypto,
  };

  for (const [method, cfg] of Object.entries(methodConfigs)) {
    if (cfg.apiKey || cfg.clientId || cfg.consumerKey) {
      methods.push(method);
    }
  }
  return methods;
};

const initialize = async (config) => {
  const results = {};
  const availableMethods = getAvailableMethods();

  for (const method of availableMethods) {
    try {
      const gateway = getGateway(method);
      results[method] = await gateway.initialize();
    } catch (error) {
      results[method] = { initialized: false, error: error.message };
    }
  }

  return results;
};

const getStatus = () => {
  const status = {};
  for (const method of getAvailableMethods()) {
    const gateway = getGateway(method);
    status[method] = gateway.getStatus();
  }
  return status;
};

const healthCheck = async () => {
  const results = {};
  for (const method of getAvailableMethods()) {
    const gateway = getGateway(method);
    results[method] = await gateway.healthCheck();
  }
  return results;
};

module.exports = {
  // Gateways
  MixbyYasGateway,
  MpesaGateway,
  AirtelGateway,
  HalopesaGateway,
  PayPalGateway,
  MobileBankingGateway,
  CryptoGateway,

  // Factory functions
  getGateway,
  getAvailableMethods,

  // Management
  initialize,
  getStatus,
  healthCheck,

  // Configuration
  config,
};
