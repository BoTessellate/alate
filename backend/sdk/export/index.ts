/**
 * Moodboard Export SDK
 * Export moodboards with metadata
 */

// Types
export type {
  ExportProductInfo,
  ExportTheme,
  MoodboardMetadata,
  ExportOptions,
  ExportResult,
  MoodboardExportInput
} from './types';

// Metadata builder
export {
  buildMetadata,
  normalizeProducts,
  formatPrice,
  normalizeTheme,
  normalizeColor,
  serializeMetadata,
  parseMetadata,
  validateMetadata,
  extractSummary
} from './metadataBuilder';

// Export functions
export {
  exportMoodboard,
  generateExportFilename,
  getMimeType,
  exportMultipleMoodboards
} from './exportMoodboard';
