/**
 * KycDocument Model - KYC Document Management
 * CephasGM GameZone
 * 
 * This model manages all KYC (Know Your Customer) documents submitted
 * by users for identity verification. It supports multiple document types,
 * verification status tracking, and compliance with regulatory requirements.
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * KycDocument Model Definition
 */
const KycDocument = sequelize.define(
  'KycDocument',
  {
    // Primary Key
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    // User Association
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    },

    // Document Type
    type: {
      type: DataTypes.ENUM(
        'passport',
        'national_id',
        'drivers_license',
        'residence_permit',
        'proof_of_address',
        'bank_statement',
        'utility_bill',
        'tax_document',
        'selfie',
        'other'
      ),
      allowNull: false,
    },

    // Document Metadata
    document_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    issuing_country: {
      type: DataTypes.STRING(2),
      allowNull: true,
      validate: {
        len: [2, 2],
        isUppercase: true,
      },
    },
    issuing_authority: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
      },
    },
    date_of_birth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      validate: {
        isDate: true,
      },
    },
    full_name_on_document: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // File Storage
    file_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        isUrl: true,
      },
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'File size in bytes',
    },
    file_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'MIME type (e.g., image/jpeg, application/pdf)',
    },
    file_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment: 'SHA-256 hash for integrity verification',
    },
    thumbnail_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },

    // OCR/Extracted Data
    extracted_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Data extracted from document via OCR',
    },
    extraction_confidence: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: 0,
        max: 100,
      },
    },

    // Verification Status
    status: {
      type: DataTypes.ENUM('pending', 'submitted', 'in_review', 'verified', 'rejected', 'expired', 'retry'),
      defaultValue: 'pending',
      allowNull: false,
    },

    // Verification Details
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verified_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rejection_reason_code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    reviewer_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // Compliance
    compliance_risk_score: {
      type: DataTypes.FLOAT,
      allowNull: true,
      validate: {
        min: 0,
        max: 100,
      },
    },
    compliance_check_id: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'External compliance system reference',
    },
    aml_check_status: {
      type: DataTypes.ENUM('not_checked', 'passed', 'failed', 'pending'),
      defaultValue: 'not_checked',
      allowNull: false,
    },
    aml_check_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Submission
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    submitted_from_ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    submitted_from_device: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // Retry/Expiry
    expiry_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Days until document expires (if applicable)',
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    retry_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    max_retries: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      allowNull: false,
    },

    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },

    // Admin
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
    tableName: 'kyc_documents',
    timestamps: true,
    paranoid: false,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['created_at'],
      },
      {
        fields: ['file_hash'],
        where: {
          file_hash: {
            [sequelize.Op.ne]: null,
          },
        },
      },
      // For user document queries
      {
        fields: ['user_id', 'status'],
      },
      // For compliance/audit
      {
        fields: ['status', 'verified_at'],
      },
      // For AML checks
      {
        fields: ['aml_check_status', 'created_at'],
        where: {
          aml_check_status: {
            [sequelize.Op.ne]: 'not_checked',
          },
        },
      },
    ],

    // Hooks
    hooks: {
      /**
       * Before creating a document, set defaults
       */
      beforeCreate: (doc) => {
        if (!doc.submitted_at) {
          doc.submitted_at = new Date();
        }

        // Calculate expiry based on document type
        if (!doc.expiry_days) {
          const defaultExpiryDays = {
            passport: 365 * 10,
            national_id: 365 * 5,
            drivers_license: 365 * 5,
            residence_permit: 365,
            proof_of_address: 90,
            bank_statement: 90,
            utility_bill: 90,
            tax_document: 365,
            selfie: 365,
            other: 365,
          };
          doc.expiry_days = defaultExpiryDays[doc.type] || 365;
        }

        if (!doc.expires_at) {
          const expiryDate = new Date();
          expiryDate.setDate(expiryDate.getDate() + doc.expiry_days);
          doc.expires_at = expiryDate;
        }
      },

      /**
       * Before updating a document, handle verification/status changes
       */
      beforeUpdate: (doc) => {
        // Handle verification
        if (doc.changed('status') && doc.status === 'verified' && !doc.verified_at) {
          doc.verified_at = new Date();
        }

        // Handle rejection
        if (doc.changed('status') && doc.status === 'rejected' && !doc.rejection_reason) {
          // Ensure rejection reason is provided
          if (!doc.rejection_reason) {
            doc.rejection_reason = 'Document verification failed';
          }
        }

        // Increment retry count if status is retry
        if (doc.changed('status') && doc.status === 'retry') {
          doc.retry_count = (doc.retry_count || 0) + 1;
        }
      },

      /**
       * After creating a document, update user KYC status
       */
      afterCreate: async (doc) => {
        try {
          const User = sequelize.models.User;
          if (User) {
            // Update user's KYC status to pending if not already
            await User.update(
              { kyc_status: 'pending' },
              {
                where: {
                  id: doc.user_id,
                  kyc_status: 'not_started',
                },
              }
            );
          }
        } catch (error) {
          logger.error('Error updating user KYC status after document creation:', error);
        }

        logger.info(
          `KYC document ${doc.id} created for user ${doc.user_id}: ${doc.type} - ${doc.status}`
        );
      },

      /**
       * After updating a document, verify if all required docs are completed
       */
      afterUpdate: async (doc) => {
        try {
          const User = sequelize.models.User;
          if (User && doc.status === 'verified') {
            // Check if all required documents are verified
            const allDocs = await KycDocument.findAll({
              where: {
                user_id: doc.user_id,
                status: 'verified',
              },
            });

            // For simplicity, we consider KYC complete if at least one ID and one proof of address
            // In real implementation, this would check required document types
            const hasId = allDocs.some(d => ['passport', 'national_id', 'drivers_license'].includes(d.type));
            const hasAddress = allDocs.some(d => ['proof_of_address', 'utility_bill', 'bank_statement'].includes(d.type));

            if (hasId && hasAddress) {
              await User.update(
                { kyc_status: 'verified' },
                {
                  where: { id: doc.user_id },
                }
              );
              logger.info(`User ${doc.user_id} KYC completed`);
            }
          }
        } catch (error) {
          logger.error('Error updating user KYC status after document update:', error);
        }
      },
    },
  }
);

/**
 * Instance methods
 */
KycDocument.prototype = {
  ...KycDocument.prototype,

  /**
   * Check if document is verified
   * @returns {boolean} - Whether document is verified
   */
  isVerified() {
    return this.status === 'verified';
  },

  /**
   * Check if document is pending
   * @returns {boolean} - Whether document is pending
   */
  isPending() {
    return ['pending', 'submitted', 'in_review'].includes(this.status);
  },

  /**
   * Check if document is expired
   * @returns {boolean} - Whether document is expired
   */
  isExpired() {
    return this.status === 'expired' || (this.expires_at && this.expires_at < new Date());
  },

  /**
   * Check if document is rejected
   * @returns {boolean} - Whether document is rejected
   */
  isRejected() {
    return this.status === 'rejected';
  },

  /**
   * Verify the document
   * @param {string} verifierId - User ID of verifier
   * @param {string} notes - Verification notes
   * @returns {Promise<KycDocument>} - Updated document
   */
  async verify(verifierId, notes = '') {
    if (this.isExpired()) {
      throw new Error('Document has expired');
    }
    this.status = 'verified';
    this.verified_at = new Date();
    this.verified_by = verifierId;
    if (notes) this.reviewer_notes = notes;
    await this.save();
    logger.info(`KYC document ${this.id} verified by ${verifierId}`);
    return this;
  },

  /**
   * Reject the document
   * @param {string} reason - Rejection reason
   * @param {string} reasonCode - Rejection reason code
   * @param {string} reviewerId - User ID of reviewer
   * @returns {Promise<KycDocument>} - Updated document
   */
  async reject(reason, reasonCode = null, reviewerId = null) {
    this.status = 'rejected';
    this.rejection_reason = reason;
    if (reasonCode) this.rejection_reason_code = reasonCode;
    if (reviewerId) this.verified_by = reviewerId;
    this.reviewer_notes = (this.reviewer_notes || '') + `\nRejected: ${reason}`;
    await this.save();
    logger.info(`KYC document ${this.id} rejected: ${reason}`);
    return this;
  },

  /**
   * Mark document for retry
   * @param {string} reason - Reason for retry
   * @returns {Promise<KycDocument>} - Updated document
   */
  async markForRetry(reason = '') {
    if (this.retry_count >= this.max_retries) {
      throw new Error('Maximum retry attempts exceeded');
    }
    this.status = 'retry';
    this.rejection_reason = reason;
    this.retry_count = (this.retry_count || 0) + 1;
    await this.save();
    logger.info(`KYC document ${this.id} marked for retry (${this.retry_count}/${this.max_retries})`);
    return this;
  },

  /**
   * Get document summary for display
   * @returns {Object} - Document summary
   */
  getSummary() {
    return {
      id: this.id,
      type: this.type,
      typeDisplay: this.getTypeDisplay(),
      status: this.status,
      statusDisplay: this.getStatusDisplay(),
      fileName: this.file_name,
      fileSize: this.file_size,
      fileType: this.file_type,
      submittedAt: this.submitted_at,
      verifiedAt: this.verified_at,
      expiresAt: this.expires_at,
      isVerified: this.isVerified(),
      isPending: this.isPending(),
      isExpired: this.isExpired(),
      isRejected: this.isRejected(),
    };
  },

  /**
   * Get full document data
   * @returns {Object} - Full document data
   */
  getFullData() {
    return {
      ...this.getSummary(),
      documentNumber: this.document_number,
      issuingCountry: this.issuing_country,
      issuingAuthority: this.issuing_authority,
      expiryDate: this.expiry_date,
      dateOfBirth: this.date_of_birth,
      fullNameOnDocument: this.full_name_on_document,
      fileUrl: this.file_url,
      thumbnailUrl: this.thumbnail_url,
      fileHash: this.file_hash,
      extractedData: this.extracted_data,
      extractionConfidence: this.extraction_confidence,
      rejectionReason: this.rejection_reason,
      rejectionReasonCode: this.rejection_reason_code,
      reviewerNotes: this.reviewer_notes,
      complianceRiskScore: this.compliance_risk_score,
      amlCheckStatus: this.aml_check_status,
      amlCheckAt: this.aml_check_at,
      retryCount: this.retry_count,
      maxRetries: this.max_retries,
      metadata: this.metadata,
    };
  },

  /**
   * Get document type display name
   * @returns {string} - Display name
   */
  getTypeDisplay() {
    const typeMap = {
      passport: '🛂 Passport',
      national_id: '🪪 National ID',
      drivers_license: '🚗 Driver\'s License',
      residence_permit: '🏠 Residence Permit',
      proof_of_address: '📬 Proof of Address',
      bank_statement: '🏦 Bank Statement',
      utility_bill: '💡 Utility Bill',
      tax_document: '📄 Tax Document',
      selfie: '📸 Selfie',
      other: '📋 Other',
    };
    return typeMap[this.type] || this.type;
  },

  /**
   * Get document status display name
   * @returns {string} - Display name
   */
  getStatusDisplay() {
    const statusMap = {
      pending: '⏳ Pending',
      submitted: '📤 Submitted',
      in_review: '🔍 In Review',
      verified: '✅ Verified',
      rejected: '❌ Rejected',
      expired: '⏰ Expired',
      retry: '🔄 Retry',
    };
    return statusMap[this.status] || this.status;
  },
};

/**
 * Static methods
 */
KycDocument.findByUser = async function(userId, options = {}) {
  const { limit = 50, offset = 0, status = null, type = null } = options;

  const where = { user_id: userId };
  if (status) where.status = status;
  if (type) where.type = type;

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'DESC']],
  });
};

KycDocument.findByStatus = async function(status, options = {}) {
  const { limit = 100, offset = 0, userId = null } = options;

  const where = { status };
  if (userId) where.user_id = userId;

  return this.findAndCountAll({
    where,
    limit,
    offset,
    order: [['created_at', 'ASC']],
    include: [
      {
        model: sequelize.models.User,
        attributes: ['id', 'first_name', 'last_name', 'email', 'username', 'kyc_status'],
      },
    ],
  });
};

KycDocument.findExpiredDocuments = async function() {
  const now = new Date();
  return this.findAll({
    where: {
      status: ['verified', 'pending', 'submitted', 'in_review'],
      expires_at: {
        [sequelize.Op.lt]: now,
      },
    },
  });
};

KycDocument.findPendingReview = async function(limit = 50) {
  return this.findAll({
    where: {
      status: ['submitted', 'in_review'],
    },
    order: [['submitted_at', 'ASC']],
    limit,
    include: [
      {
        model: sequelize.models.User,
        attributes: ['id', 'first_name', 'last_name', 'email', 'username', 'kyc_status'],
      },
    ],
  });
};

KycDocument.getUserVerificationStatus = async function(userId) {
  const documents = await this.findAll({
    where: {
      user_id: userId,
    },
    attributes: ['type', 'status', 'verified_at'],
    order: [['created_at', 'DESC']],
  });

  const statusMap = {
    all_verified: false,
    any_pending: false,
    any_rejected: false,
    any_expired: false,
    document_status: {},
  };

  for (const doc of documents) {
    const key = doc.type;
    statusMap.document_status[key] = doc.status;
    if (doc.status === 'verified') statusMap.all_verified = true;
    if (doc.status === 'pending' || doc.status === 'submitted' || doc.status === 'in_review') {
      statusMap.any_pending = true;
    }
    if (doc.status === 'rejected') statusMap.any_rejected = true;
    if (doc.status === 'expired') statusMap.any_expired = true;
  }

  // Determine overall status
  if (documents.length === 0) {
    statusMap.overall = 'not_started';
  } else if (statusMap.any_rejected) {
    statusMap.overall = 'rejected';
  } else if (statusMap.any_pending) {
    statusMap.overall = 'pending';
  } else if (statusMap.any_expired) {
    statusMap.overall = 'expired';
  } else if (statusMap.all_verified) {
    statusMap.overall = 'verified';
  } else {
    statusMap.overall = 'in_progress';
  }

  return statusMap;
};

KycDocument.getRequiredDocuments = function() {
  // Required document types based on regulatory requirements
  return {
    identity: ['passport', 'national_id', 'drivers_license'],
    address: ['proof_of_address', 'utility_bill', 'bank_statement'],
    selfie: ['selfie'],
  };
};

KycDocument.cleanupExpiredDocuments = async function() {
  const expired = await this.findExpiredDocuments();
  let updatedCount = 0;

  for (const doc of expired) {
    doc.status = 'expired';
    await doc.save();
    updatedCount++;
  }

  logger.info(`Marked ${updatedCount} documents as expired`);
  return updatedCount;
};

// Export the model
module.exports = KycDocument;
