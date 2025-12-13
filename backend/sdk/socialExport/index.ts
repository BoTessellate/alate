/**
 * Social Export SDK
 * Exports for social sharing and link generation
 */

export {
  createShareDataGenerator,
  type ShareDataRequest,
  type SharePlatform,
  type ShareData,
  type PlatformShareData
} from './generateShareData';

export {
  createExportLinkGenerator,
  type ExportLinkRequest,
  type ExportLinkResponse,
  type LinkAccessRequest,
  type LinkAccessResponse
} from './exportToLink';
