/**
 * Brand Dashboard SDK
 * Exports for brand authentication, CSV uploads, sync status, and sync scheduling
 */

export {
  createBrandAuthenticator,
  type BrandCredentials,
  type BrandRegistration,
  type BrandSession,
  type BrandProfile
} from './loginBrand';

export {
  createCSVUploadHandler,
  type CSVUploadRequest,
  type CSVUploadResponse,
  type CSVValidationResult
} from './uploadCSV';

export {
  createSyncStatusService,
  type SyncHistoryRequest,
  type SyncHistoryResponse,
  type SyncRecord,
  type SyncStatistics
} from './getSyncStatus';

export {
  createSyncScheduleService,
  setSyncSchedule,
  getSyncSchedule,
  triggerManualSync,
  type SyncScheduleType,
  type SyncScheduleConfig,
  type SetSyncScheduleRequest,
  type SetSyncScheduleResponse,
  type GetSyncScheduleRequest,
  type GetSyncScheduleResponse,
  type BrandIntegration
} from './setSyncSchedule';

export {
  createSyncModeService,
  setSyncMode,
  getSyncMode,
  shouldAutoSync,
  type SyncMode,
  type SetSyncModeRequest,
  type SetSyncModeResponse,
  type GetSyncModeRequest,
  type GetSyncModeResponse
} from './setSyncMode';

export {
  createHealthCheckService,
  runHealthCheck,
  getHealthStatus,
  markReconnected,
  type HealthStatus,
  type HealthCheckResult,
  type HealthCheckSummary,
  type IntegrationHealth,
  type GetHealthStatusRequest,
  type GetHealthStatusResponse
} from './healthCheck';
