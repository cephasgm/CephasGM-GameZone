/**
 * Report Routes - Reporting & Analytics API Routes
 * CephasGM GameZone
 * 
 * This module defines all report-related API routes including:
 * - Financial reports (deposits, withdrawals, revenue)
 * - Betting reports (volume, win/loss, popular markets)
 * - User reports (registrations, activity, retention)
 * - Payment reports (transactions, methods, fees)
 * - Performance reports (system metrics, response times)
 * - Custom report generation
 * - Report export (CSV, Excel, PDF)
 * - Scheduled reports
 * 
 * All routes are mounted under /api/v1/reports
 * All routes require admin role
 */

const express = require('express');
const router = express.Router();

// Import controllers
const reportController = require('../../controllers/reportController');

// Import middleware
const { authenticate } = require('../../middleware/auth');
const { requireAdmin, requireSuperAdmin, logAdminAction, adminRateLimit } = require('../../middleware/admin');
const { validateBody, validateParams, validateQuery, validationSchemas } = require('../../middleware/validation');
const { sanitize } = require('../../middleware/sanitize');

// ============================================
// FINANCIAL REPORTS ROUTES
// ============================================

/**
 * @route   GET /api/v1/reports/financial/summary
 * @desc    Get financial summary report
 * @access  Private/Admin
 */
router.get(
  '/financial/summary',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getFinancialSummary
);

/**
 * @route   GET /api/v1/reports/financial/deposits
 * @desc    Get deposit report
 * @access  Private/Admin
 */
router.get(
  '/financial/deposits',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getDepositReport
);

/**
 * @route   GET /api/v1/reports/financial/withdrawals
 * @desc    Get withdrawal report
 * @access  Private/Admin
 */
router.get(
  '/financial/withdrawals',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getWithdrawalReport
);

/**
 * @route   GET /api/v1/reports/financial/revenue
 * @desc    Get revenue report
 * @access  Private/Admin
 */
router.get(
  '/financial/revenue',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getRevenueReport
);

// ============================================
// BETTING REPORTS ROUTES
// ============================================

/**
 * @route   GET /api/v1/reports/betting/volume
 * @desc    Get betting volume report
 * @access  Private/Admin
 */
router.get(
  '/betting/volume',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getBettingVolumeReport
);

/**
 * @route   GET /api/v1/reports/betting/winloss
 * @desc    Get win/loss report
 * @access  Private/Admin
 */
router.get(
  '/betting/winloss',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getWinLossReport
);

/**
 * @route   GET /api/v1/reports/betting/markets
 * @desc    Get popular markets report
 * @access  Private/Admin
 */
router.get(
  '/betting/markets',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getPopularMarketsReport
);

// ============================================
// USER REPORTS ROUTES
// ============================================

/**
 * @route   GET /api/v1/reports/users/registrations
 * @desc    Get user registration report
 * @access  Private/Admin
 */
router.get(
  '/users/registrations',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getUserRegistrationReport
);

/**
 * @route   GET /api/v1/reports/users/activity
 * @desc    Get user activity report
 * @access  Private/Admin
 */
router.get(
  '/users/activity',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getUserActivityReport
);

/**
 * @route   GET /api/v1/reports/users/retention
 * @desc    Get user retention report
 * @access  Private/Admin
 */
router.get(
  '/users/retention',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getUserRetentionReport
);

/**
 * @route   GET /api/v1/reports/users/vip
 * @desc    Get VIP user report
 * @access  Private/Admin
 */
router.get(
  '/users/vip',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getVipUserReport
);

// ============================================
// PAYMENT REPORTS ROUTES
// ============================================

/**
 * @route   GET /api/v1/reports/payments/methods
 * @desc    Get payment method report
 * @access  Private/Admin
 */
router.get(
  '/payments/methods',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getPaymentMethodReport
);

/**
 * @route   GET /api/v1/reports/payments/fees
 * @desc    Get transaction fee report
 * @access  Private/Admin
 */
router.get(
  '/payments/fees',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getTransactionFeeReport
);

// ============================================
// PERFORMANCE REPORTS ROUTES
// ============================================

/**
 * @route   GET /api/v1/reports/performance/system
 * @desc    Get system performance report
 * @access  Private/Admin
 */
router.get(
  '/performance/system',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getSystemPerformanceReport
);

/**
 * @route   GET /api/v1/reports/performance/api
 * @desc    Get API performance report
 * @access  Private/Admin
 */
router.get(
  '/performance/api',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getApiPerformanceReport
);

// ============================================
// REPORT EXPORT ROUTES
// ============================================

/**
 * @route   GET /api/v1/reports/export/csv/:reportType
 * @desc    Export report as CSV
 * @access  Private/Admin
 */
router.get(
  '/export/csv/:reportType',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.exportReportCSV
);

/**
 * @route   GET /api/v1/reports/export/excel/:reportType
 * @desc    Export report as Excel
 * @access  Private/Admin
 */
router.get(
  '/export/excel/:reportType',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.exportReportExcel
);

/**
 * @route   GET /api/v1/reports/export/pdf/:reportType
 * @desc    Export report as PDF
 * @access  Private/Admin
 */
router.get(
  '/export/pdf/:reportType',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.exportReportPDF
);

// ============================================
// SCHEDULED REPORTS ROUTES
// ============================================

/**
 * @route   GET /api/v1/reports/scheduled
 * @desc    Get scheduled reports
 * @access  Private/Admin
 */
router.get(
  '/scheduled',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  logAdminAction,
  reportController.getScheduledReports
);

/**
 * @route   POST /api/v1/reports/scheduled
 * @desc    Create scheduled report
 * @access  Private/Admin
 */
router.post(
  '/scheduled',
  authenticate,
  requireAdmin,
  adminRateLimit(),
  sanitize({ strategy: 'strict' }),
  logAdminAction,
  reportController.createScheduledReport
);

/**
 * @route   PUT /api/v1/reports/scheduled/:reportId
 * @desc    Update scheduled report
 * @access  Private/Admin
 */
router.put(
  '/scheduled/:reportId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  adminRateLimit(),
  sanitize({ strategy: 'strict' }),
  logAdminAction,
  reportController.updateScheduledReport
);

/**
 * @route   DELETE /api/v1/reports/scheduled/:reportId
 * @desc    Delete scheduled report
 * @access  Private/Admin
 */
router.delete(
  '/scheduled/:reportId',
  authenticate,
  requireAdmin,
  validateParams(validationSchemas.idParam),
  adminRateLimit(),
  logAdminAction,
  reportController.deleteScheduledReport
);

// ============================================
// EXPORT ROUTER
// ============================================

module.exports = router;
