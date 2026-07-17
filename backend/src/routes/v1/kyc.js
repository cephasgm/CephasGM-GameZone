/**
 * KYC Routes - Know Your Customer API Routes
 * CephasGM GameZone
 * 
 * This module defines all KYC-related API routes including:
 * - KYC status and document retrieval
 * - KYC document upload (single and multiple)
 * - KYC document management (update, delete)
 * - Admin KYC review (verify, reject, retry)
 * - KYC compliance reporting (admin)
 * - AML check integration (admin)
 * - KYC statistics (admin)
 * 
 * All routes are mounted under /api/v1/kyc
 */

const express = require('express');
const router = express.Router();

// Import controllers
const kycController = require('../../controllers/kycController');

// Import middleware
const { authenticate } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin, logAdminAction, adminRateLimit } = require('../../middleware/admin');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// MULTER CONFIGURATION FOR FILE UPLOADS
// ============================================

// Note: Multer configuration should be set up in app.js or a separate config file
// This is a placeholder for the route definitions
// The actual multer middleware should be imported from a separate file

// ============================================
// USER KYC ROUTES
// ============================================

/**
 * @route   GET /api/v1/kyc/status
 * @desc    Get KYC status for current user
 * @access  Private
 */
router.get(
  '/status',
  authenticate,
  kycController.getKycStatus
);

/**
 * @route   GET /api/v1/kyc/documents
 * @desc    Get KYC documents for current user
 * @access  Private
 */
router.get(
  '/documents',
  authenticate,
  kycController.getKycDocuments
);

/**
 * @route   GET /api/v1/kyc/documents/:documentId
 * @desc    Get KYC document by ID
 * @access  Private
 */
router.get(
  '/documents/:documentId',
  authenticate,
  validateParams(validationSchemas.idParam),
  kycController.getKycDocument
);

/**
 * @route   GET /api/v1/kyc/requirements
 * @desc    Get KYC required documents
 * @access  Private
 */
router.get(
  '/requirements',
  authenticate,
  kycController.getKycRequirements
);

// ============================================
// KYC DOCUMENT UPLOAD ROUTES
// ============================================

/**
 * @route   POST /api/v1/kyc/upload
 * @desc    Upload KYC document (single file)
 * @access  Private
 */
router.post(
  '/upload',
  authenticate,
  // multerMiddleware.single('document'),
  sanitize({ strategy: 'strict' }),
  kycController.uploadKycDocument
);

/**
 * @route   POST /api/v1/kyc/upload/multiple
 * @desc    Upload multiple KYC documents
 * @access  Private
 */
router.post(
  '/upload/multiple',
  authenticate,
  // multerMiddleware.array('documents', 10),
  sanitize({ strategy: 'strict' }),
  kycController.uploadMultipleKycDocuments
);

/**
 * @route   PUT /api/v1/kyc/documents/:documentId
 * @desc    Update KYC document
 * @access  Private
 */
router.put(
  '/documents/:documentId',
  authenticate,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  kycController.updateKycDocument
);

/**
 * @route   DELETE /api/v1/kyc/documents/:documentId
 * @desc    Delete KYC document
 * @access  Private
 */
router.delete(
  '/documents/:documentId',
  authenticate,
  validateParams(validationSchemas.idParam),
  kycController.deleteKycDocument
);

// ============================================
// ADMIN KYC REVIEW ROUTES
// ============================================

/**
 * @route   GET /api/v1/kyc/admin/review
 * @desc    Get KYC documents for review (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/review',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  kycController.getDocumentsForReview
);

/**
 * @route   GET /api/v1/kyc/admin/submissions
 * @desc    Get all KYC submissions (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/submissions',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  kycController.getAllKycSubmissions
);

/**
 * @route   GET /api/v1/kyc/admin/users/:userId/submissions
 * @desc    Get user KYC submissions (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/users/:userId/submissions',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  adminRateLimit(),
  logAdminAction,
  kycController.getUserKycSubmissions
);

/**
 * @route   POST /api/v1/kyc/admin/verify/:documentId
 * @desc    Verify KYC document (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/verify/:documentId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  logAdminAction,
  kycController.verifyKycDocument
);

/**
 * @route   POST /api/v1/kyc/admin/reject/:documentId
 * @desc    Reject KYC document (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/reject/:documentId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  logAdminAction,
  kycController.rejectKycDocument
);

/**
 * @route   POST /api/v1/kyc/admin/retry/:documentId
 * @desc    Mark KYC document for retry (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/retry/:documentId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  sanitize({ strategy: 'strict' }),
  logAdminAction,
  kycController.retryKycDocument
);

// ============================================
// KYC COMPLIANCE & REPORTS (Admin)
// ============================================

/**
 * @route   GET /api/v1/kyc/admin/compliance
 * @desc    Get KYC compliance report (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/compliance',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  kycController.getComplianceReport
);

/**
 * @route   GET /api/v1/kyc/admin/stats
 * @desc    Get KYC statistics (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/stats',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  kycController.getKycStats
);

/**
 * @route   GET /api/v1/kyc/admin/aml/:userId
 * @desc    Get AML check results (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/aml/:userId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  adminRateLimit(),
  logAdminAction,
  kycController.getAmlCheckResults
);

/**
 * @route   POST /api/v1/kyc/admin/aml/check/:userId
 * @desc    Run AML check (admin only)
 * @access  Private/Admin
 */
router.post(
  '/admin/aml/check/:userId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  adminRateLimit(),
  logAdminAction,
  kycController.runAmlCheck
);

/**
 * @route   GET /api/v1/kyc/admin/users/:userId/history
 * @desc    Get user KYC verification history (admin only)
 * @access  Private/Admin
 */
router.get(
  '/admin/users/:userId/history',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.userIdParam),
  adminRateLimit(),
  logAdminAction,
  kycController.getUserKycHistory
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
