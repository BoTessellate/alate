/**
 * Brand Dashboard SDK
 * Exports for brand authentication, CSV uploads, and sync status
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
