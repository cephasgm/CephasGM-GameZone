/**
 * KYC Controller - Know Your Customer HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all KYC-related HTTP requests including:
 * - KYC document upload
 * - KYC status retrieval
 * - KYC document management
 * - KYC verification (admin)
 * - KYC rejection (admin)
 * - KYC document expiry management
 * - KYC compliance reporting
 * - AML check integration
 */

const kycService = require('../services/kycService');
const userService = require('../services/userService');
const { catchAsync, createValidationError, createNotFoundError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// KYC STATUS & RETRIEVAL
// ============================================

/**
 * Get KYC status for current user
 * GET /api/v1/kyc/status
 */
const getKycStatus = catchAsync(async (req, res) => {
  const status = await kycService.getUserKycStatus(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      status,
    },
  });
});

/**
 * Get KYC documents for current user
 * GET /api/v1/kyc/documents
 */
const getKycDocuments = catchAsync(async (req, res) => {
  const { status = null, type = null, limit = 50, offset = 0 } = req.query;

  const result = await kycService.getUserKycDocuments(req.user.id, {
    status,
    type,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      documents: result.documents,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get KYC document by ID
 * GET /api/v1/kyc/documents/:documentId
 */
const getKycDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params;

  const document = await kycService.getKycDocument(documentId, req.user.id);

  if (!document) {
    throw createNotFoundError('KYC document', documentId);
  }

  res.status(200).json({
    success: true,
    data: {
      document,
    },
  });
});

/**
 * Get KYC required documents
 * GET /api/v1/kyc/requirements
 */
const getKycRequirements = catchAsync(async (req, res) => {
  const requirements = await kycService.getKycRequirements(req.user.id);

  res.status(200).json({
    success: true,
    data: {
      requirements,
    },
  });
});

// ============================================
// KYC DOCUMENT UPLOAD
// ============================================

/**
 * Upload KYC document
 * POST /api/v1/kyc/upload
 */
const uploadKycDocument = catchAsync(async (req, res) => {
  const { type, documentNumber, issuingCountry, expiryDate, fullNameOnDocument } = req.body;

  // Check if file was uploaded
  if (!req.file) {
    throw createValidationError('Document file is required');
  }

  if (!type) {
    throw createValidationError('Document type is required');
  }

  // Validate document type
  const validTypes = ['passport', 'national_id', 'drivers_license', 'residence_permit', 'proof_of_address', 'bank_statement', 'utility_bill', 'tax_document', 'selfie', 'other'];
  if (!validTypes.includes(type)) {
    throw createValidationError(`Invalid document type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Prepare document data
  const documentData = {
    type,
    documentNumber,
    issuingCountry,
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    fullNameOnDocument,
    file: {
      url: req.file.location || `/uploads/${req.file.filename}`,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype,
    },
  };

  const document = await kycService.uploadKycDocument(req.user.id, documentData, req);

  res.status(201).json({
    success: true,
    message: 'KYC document uploaded successfully',
    data: {
      document,
    },
  });
});

/**
 * Upload KYC document with multiple files
 * POST /api/v1/kyc/upload/multiple
 */
const uploadMultipleKycDocuments = catchAsync(async (req, res) => {
  const { type, documentNumber, issuingCountry, expiryDate, fullNameOnDocument } = req.body;

  if (!req.files || req.files.length === 0) {
    throw createValidationError('At least one document file is required');
  }

  if (!type) {
    throw createValidationError('Document type is required');
  }

  // Process multiple uploads
  const documents = [];
  for (const file of req.files) {
    const documentData = {
      type,
      documentNumber,
      issuingCountry,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      fullNameOnDocument,
      file: {
        url: file.location || `/uploads/${file.filename}`,
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
      },
    };

    const document = await kycService.uploadKycDocument(req.user.id, documentData, req);
    documents.push(document);
  }

  res.status(201).json({
    success: true,
    message: `${documents.length} KYC documents uploaded successfully`,
    data: {
      documents,
      count: documents.length,
    },
  });
});

/**
 * Update KYC document
 * PUT /api/v1/kyc/documents/:documentId
 */
const updateKycDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params;
  const { documentNumber, issuingCountry, expiryDate, fullNameOnDocument } = req.body;

  const updates = {};
  if (documentNumber !== undefined) updates.documentNumber = documentNumber;
  if (issuingCountry !== undefined) updates.issuingCountry = issuingCountry;
  if (expiryDate !== undefined) updates.expiryDate = new Date(expiryDate);
  if (fullNameOnDocument !== undefined) updates.fullNameOnDocument = fullNameOnDocument;

  const document = await kycService.updateKycDocument(documentId, req.user.id, updates, req);

  res.status(200).json({
    success: true,
    message: 'KYC document updated successfully',
    data: {
      document,
    },
  });
});

/**
 * Delete KYC document
 * DELETE /api/v1/kyc/documents/:documentId
 */
const deleteKycDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params;

  await kycService.deleteKycDocument(documentId, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'KYC document deleted successfully',
  });
});

// ============================================
// ADMIN KYC OPERATIONS
// ============================================

/**
 * Get all KYC documents for review (admin only)
 * GET /api/v1/kyc/admin/review
 */
const getDocumentsForReview = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { limit = 50, offset = 0, status = 'submitted' } = req.query;

  const result = await kycService.getDocumentsForReview({
    limit: parseInt(limit),
    offset: parseInt(offset),
    status,
  });

  res.status(200).json({
    success: true,
    data: {
      documents: result.documents,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get all KYC submissions (admin only)
 * GET /api/v1/kyc/admin/submissions
 */
const getAllKycSubmissions = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const {
    status = null,
    type = null,
    userId = null,
    startDate = null,
    endDate = null,
    limit = 50,
    offset = 0,
  } = req.query;

  const result = await kycService.getAllKycSubmissions({
    status,
    type,
    userId,
    startDate,
    endDate,
    limit: parseInt(limit),
    offset: parseInt(offset),
  });

  res.status(200).json({
    success: true,
    data: {
      documents: result.documents,
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
    },
  });
});

/**
 * Get user KYC submissions (admin only)
 * GET /api/v1/kyc/admin/users/:userId/submissions
 */
const getUserKycSubmissions = catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const documents = await kycService.getUserKycSubmissions(userId);

  res.status(200).json({
    success: true,
    data: {
      documents,
    },
  });
});

/**
 * Verify KYC document (admin only)
 * POST /api/v1/kyc/admin/verify/:documentId
 */
const verifyKycDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params;
  const { notes = '' } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const document = await kycService.verifyKycDocument(documentId, req.user.id, notes, req);

  res.status(200).json({
    success: true,
    message: 'KYC document verified successfully',
    data: {
      document,
    },
  });
});

/**
 * Reject KYC document (admin only)
 * POST /api/v1/kyc/admin/reject/:documentId
 */
const rejectKycDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params;
  const { reason, reasonCode = null } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  if (!reason) {
    throw createValidationError('Rejection reason is required');
  }

  const document = await kycService.rejectKycDocument(documentId, reason, reasonCode, req.user.id, req);

  res.status(200).json({
    success: true,
    message: 'KYC document rejected successfully',
    data: {
      document,
    },
  });
});

/**
 * Mark KYC document for retry (admin only)
 * POST /api/v1/kyc/admin/retry/:documentId
 */
const retryKycDocument = catchAsync(async (req, res) => {
  const { documentId } = req.params;
  const { reason = '' } = req.body;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const document = await kycService.retryKycDocument(documentId, reason, req);

  res.status(200).json({
    success: true,
    message: 'KYC document marked for retry successfully',
    data: {
      document,
    },
  });
});

// ============================================
// KYC COMPLIANCE & REPORTS (Admin)
// ============================================

/**
 * Get KYC compliance report (admin only)
 * GET /api/v1/kyc/admin/compliance
 */
const getComplianceReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { startDate = null, endDate = null } = req.query;

  const report = await kycService.getComplianceReport({
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

/**
 * Get KYC statistics (admin only)
 * GET /api/v1/kyc/admin/stats
 */
const getKycStats = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const stats = await kycService.getKycStats();

  res.status(200).json({
    success: true,
    data: {
      stats,
    },
  });
});

/**
 * Get AML check results (admin only)
 * GET /api/v1/kyc/admin/aml/:userId
 */
const getAmlCheckResults = catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const results = await kycService.getAmlCheckResults(userId);

  res.status(200).json({
    success: true,
    data: {
      results,
    },
  });
});

/**
 * Run AML check (admin only)
 * POST /api/v1/kyc/admin/aml/check/:userId
 */
const runAmlCheck = catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const result = await kycService.runAmlCheck(userId, req);

  res.status(200).json({
    success: true,
    message: 'AML check completed successfully',
    data: {
      result,
    },
  });
});

/**
 * Get user KYC verification history (admin only)
 * GET /api/v1/kyc/admin/users/:userId/history
 */
const getUserKycHistory = catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const history = await kycService.getUserKycHistory(userId);

  res.status(200).json({
    success: true,
    data: {
      history,
    },
  });
});

// Export all controller methods
module.exports = {
  // User
  getKycStatus,
  getKycDocuments,
  getKycDocument,
  getKycRequirements,

  // Upload
  uploadKycDocument,
  uploadMultipleKycDocuments,
  updateKycDocument,
  deleteKycDocument,

  // Admin
  getDocumentsForReview,
  getAllKycSubmissions,
  getUserKycSubmissions,
  verifyKycDocument,
  rejectKycDocument,
  retryKycDocument,

  // Compliance
  getComplianceReport,
  getKycStats,
  getAmlCheckResults,
  runAmlCheck,
  getUserKycHistory,
};
