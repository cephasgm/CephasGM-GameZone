/**
 * Report Controller - Reporting & Analytics HTTP Controllers
 * CephasGM GameZone
 * 
 * This controller handles all report-related HTTP requests including:
 * - Financial reports (deposits, withdrawals, revenue)
 * - Betting reports (volume, win/loss, popular markets)
 * - User reports (registrations, activity, retention)
 * - Payment reports (transactions, methods, fees)
 * - Performance reports (system metrics, response times)
 * - Custom report generation
 * - Report export (CSV, Excel, PDF)
 * - Scheduled reports
 */

const reportService = require('../services/reportService');
const { catchAsync, createValidationError, createForbiddenError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ============================================
// FINANCIAL REPORTS
// ============================================

/**
 * Get financial summary report
 * GET /api/v1/reports/financial/summary
 */
const getFinancialSummary = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { startDate, endDate, period = 'daily' } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getFinancialSummary({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    period,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

/**
 * Get deposit report
 * GET /api/v1/reports/financial/deposits
 */
const getDepositReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const {
    startDate,
    endDate,
    method = null,
    status = 'completed',
    groupBy = 'daily',
  } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getDepositReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    method,
    status,
    groupBy,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

/**
 * Get withdrawal report
 * GET /api/v1/reports/financial/withdrawals
 */
const getWithdrawalReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const {
    startDate,
    endDate,
    method = null,
    status = null,
    groupBy = 'daily',
  } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getWithdrawalReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    method,
    status,
    groupBy,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

/**
 * Get revenue report
 * GET /api/v1/reports/financial/revenue
 */
const getRevenueReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { startDate, endDate, groupBy = 'daily' } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getRevenueReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    groupBy,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

// ============================================
// BETTING REPORTS
// ============================================

/**
 * Get betting volume report
 * GET /api/v1/reports/betting/volume
 */
const getBettingVolumeReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const {
    startDate,
    endDate,
    sportId = null,
    betType = null,
    groupBy = 'daily',
  } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getBettingVolumeReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    sportId,
    betType,
    groupBy,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

/**
 * Get win/loss report
 * GET /api/v1/reports/betting/winloss
 */
const getWinLossReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const {
    startDate,
    endDate,
    userId = null,
    groupBy = 'daily',
  } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getWinLossReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    userId,
    groupBy,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

/**
 * Get popular markets report
 * GET /api/v1/reports/betting/markets
 */
const getPopularMarketsReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const {
    startDate,
    endDate,
    sportId = null,
    limit = 20,
  } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getPopularMarketsReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    sportId,
    limit: parseInt(limit),
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

// ============================================
// USER REPORTS
// ============================================

/**
 * Get user registration report
 * GET /api/v1/reports/users/registrations
 */
const getUserRegistrationReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const {
    startDate,
    endDate,
    country = null,
    groupBy = 'daily',
  } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getUserRegistrationReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    country,
    groupBy,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

/**
 * Get user activity report
 * GET /api/v1/reports/users/activity
 */
const getUserActivityReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { startDate, endDate, groupBy = 'daily' } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getUserActivityReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    groupBy,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

/**
 * Get user retention report
 * GET /api/v1/reports/users/retention
 */
const getUserRetentionReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { cohortDate, periods = 12 } = req.query;

  if (!cohortDate) {
    throw createValidationError('Cohort date is required');
  }

  const report = await reportService.getUserRetentionReport({
    cohortDate: new Date(cohortDate),
    periods: parseInt(periods),
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

/**
 * Get VIP user report
 * GET /api/v1/reports/users/vip
 */
const getVipUserReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { startDate, endDate, tier = null } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getVipUserReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    tier,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

// ============================================
// PAYMENT REPORTS
// ============================================

/**
 * Get payment method report
 * GET /api/v1/reports/payments/methods
 */
const getPaymentMethodReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { startDate, endDate, type = 'all' } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getPaymentMethodReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    type,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

/**
 * Get transaction fee report
 * GET /api/v1/reports/payments/fees
 */
const getTransactionFeeReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { startDate, endDate, groupBy = 'daily' } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getTransactionFeeReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    groupBy,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

// ============================================
// PERFORMANCE REPORTS
// ============================================

/**
 * Get system performance report
 * GET /api/v1/reports/performance/system
 */
const getSystemPerformanceReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getSystemPerformanceReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

/**
 * Get API performance report
 * GET /api/v1/reports/performance/api
 */
const getApiPerformanceReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { startDate, endDate, endpoint = null } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const report = await reportService.getApiPerformanceReport({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    endpoint,
  });

  res.status(200).json({
    success: true,
    data: {
      report,
    },
  });
});

// ============================================
// REPORT EXPORT
// ============================================

/**
 * Export report as CSV
 * GET /api/v1/reports/export/csv/:reportType
 */
const exportReportCSV = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { reportType } = req.params;
  const { startDate, endDate, format = 'csv' } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const result = await reportService.exportReport({
    type: reportType,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    format,
  });

  // Set appropriate headers for file download
  const filename = `${reportType}_${startDate}_${endDate}.${format}`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

  res.send(result.data);
});

/**
 * Export report as Excel
 * GET /api/v1/reports/export/excel/:reportType
 */
const exportReportExcel = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { reportType } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const result = await reportService.exportReport({
    type: reportType,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    format: 'excel',
  });

  const filename = `${reportType}_${startDate}_${endDate}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

  res.send(result.data);
});

/**
 * Export report as PDF
 * GET /api/v1/reports/export/pdf/:reportType
 */
const exportReportPDF = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { reportType } = req.params;
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw createValidationError('Start date and end date are required');
  }

  const result = await reportService.exportReport({
    type: reportType,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    format: 'pdf',
  });

  const filename = `${reportType}_${startDate}_${endDate}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

  res.send(result.data);
});

// ============================================
// SCHEDULED REPORTS
// ============================================

/**
 * Get scheduled reports
 * GET /api/v1/reports/scheduled
 */
const getScheduledReports = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const reports = await reportService.getScheduledReports();

  res.status(200).json({
    success: true,
    data: {
      reports,
    },
  });
});

/**
 * Create scheduled report
 * POST /api/v1/reports/scheduled
 */
const createScheduledReport = catchAsync(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { name, type, schedule, recipients, filters = {} } = req.body;

  if (!name) throw createValidationError('Report name is required');
  if (!type) throw createValidationError('Report type is required');
  if (!schedule) throw createValidationError('Schedule is required');

  const report = await reportService.createScheduledReport({
    name,
    type,
    schedule,
    recipients,
    filters,
  }, req);

  res.status(201).json({
    success: true,
    message: 'Scheduled report created successfully',
    data: {
      report,
    },
  });
});

/**
 * Update scheduled report
 * PUT /api/v1/reports/scheduled/:reportId
 */
const updateScheduledReport = catchAsync(async (req, res) => {
  const { reportId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  const { name, schedule, recipients, filters, isActive } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (schedule !== undefined) updates.schedule = schedule;
  if (recipients !== undefined) updates.recipients = recipients;
  if (filters !== undefined) updates.filters = filters;
  if (isActive !== undefined) updates.isActive = isActive;

  const report = await reportService.updateScheduledReport(reportId, updates, req);

  res.status(200).json({
    success: true,
    message: 'Scheduled report updated successfully',
    data: {
      report,
    },
  });
});

/**
 * Delete scheduled report
 * DELETE /api/v1/reports/scheduled/:reportId
 */
const deleteScheduledReport = catchAsync(async (req, res) => {
  const { reportId } = req.params;

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    throw createForbiddenError('Admin access required');
  }

  await reportService.deleteScheduledReport(reportId, req);

  res.status(200).json({
    success: true,
    message: 'Scheduled report deleted successfully',
  });
});

// Export all controller methods
module.exports = {
  // Financial Reports
  getFinancialSummary,
  getDepositReport,
  getWithdrawalReport,
  getRevenueReport,

  // Betting Reports
  getBettingVolumeReport,
  getWinLossReport,
  getPopularMarketsReport,

  // User Reports
  getUserRegistrationReport,
  getUserActivityReport,
  getUserRetentionReport,
  getVipUserReport,

  // Payment Reports
  getPaymentMethodReport,
  getTransactionFeeReport,

  // Performance Reports
  getSystemPerformanceReport,
  getApiPerformanceReport,

  // Export
  exportReportCSV,
  exportReportExcel,
  exportReportPDF,

  // Scheduled Reports
  getScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
};
