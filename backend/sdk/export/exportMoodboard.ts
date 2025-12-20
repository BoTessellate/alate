/**
 * Export Moodboard Module
 * Bundles moodboard image with metadata into downloadable format
 */

import JSZip from 'jszip';
import sharp from 'sharp';
import {
  MoodboardExportInput,
  ExportOptions,
  ExportResult,
  MoodboardMetadata
} from './types';
import { buildMetadata, serializeMetadata } from './metadataBuilder';

const DEFAULT_OPTIONS: ExportOptions = {
  format: 'png',
  quality: 90,
  includeMetadata: true,
  includeWatermark: false
};

/**
 * Export moodboard as image with optional metadata
 * @param input - Moodboard data
 * @param options - Export options
 * @returns Export result with buffers
 */
export async function exportMoodboard(
  input: MoodboardExportInput,
  options: Partial<ExportOptions> = {}
): Promise<ExportResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const exportedAt = new Date().toISOString();

  try {
    // Get image buffer
    let imageBuffer = getImageBuffer(input.imageData);

    // Process image (format conversion, watermark)
    imageBuffer = await processImage(imageBuffer, opts);

    // Build metadata
    const metadata = buildMetadata(input);

    // If metadata included, create zip
    if (opts.includeMetadata) {
      const zipBuffer = await createExportZip(
        input.id,
        imageBuffer,
        metadata,
        opts.format
      );

      return {
        success: true,
        imageBuffer,
        metadata,
        zipBuffer,
        exportedAt
      };
    }

    // Just return image
    return {
      success: true,
      imageBuffer,
      metadata,
      exportedAt
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Export failed',
      exportedAt
    };
  }
}

/**
 * Convert input to buffer
 */
function getImageBuffer(imageData: Buffer | string): Buffer {
  if (Buffer.isBuffer(imageData)) {
    return imageData;
  }

  // Assume base64 string
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

/**
 * Process image with sharp
 */
async function processImage(
  buffer: Buffer,
  options: ExportOptions
): Promise<Buffer> {
  let pipeline = sharp(buffer);

  // Add watermark if requested
  if (options.includeWatermark && options.watermarkText) {
    pipeline = await addWatermark(pipeline, options.watermarkText);
  }

  // Convert to output format
  if (options.format === 'jpg') {
    return pipeline.jpeg({ quality: options.quality || 90 }).toBuffer();
  }

  return pipeline.png().toBuffer();
}

/**
 * Add text watermark to image
 */
async function addWatermark(
  pipeline: sharp.Sharp,
  text: string
): Promise<sharp.Sharp> {
  const metadata = await pipeline.metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 600;

  // Create SVG watermark
  const fontSize = Math.max(12, Math.floor(width / 40));
  const svgWatermark = `
    <svg width="${width}" height="${height}">
      <style>
        .watermark {
          fill: rgba(255,255,255,0.5);
          font-size: ${fontSize}px;
          font-family: Arial, sans-serif;
        }
      </style>
      <text x="${width - 10}" y="${height - 10}" text-anchor="end" class="watermark">${text}</text>
    </svg>
  `;

  return pipeline.composite([
    {
      input: Buffer.from(svgWatermark),
      gravity: 'southeast'
    }
  ]);
}

/**
 * Create zip file with image and metadata
 */
async function createExportZip(
  moodboardId: string,
  imageBuffer: Buffer,
  metadata: MoodboardMetadata,
  format: 'png' | 'jpg'
): Promise<Buffer> {
  const zip = new JSZip();

  // Create folder
  const folderName = `moodboard_${moodboardId}`;
  const folder = zip.folder(folderName);

  if (!folder) {
    throw new Error('Failed to create zip folder');
  }

  // Add image
  const imageFilename = `moodboard.${format}`;
  folder.file(imageFilename, imageBuffer);

  // Add metadata JSON
  const metadataJson = serializeMetadata(metadata);
  folder.file('moodboard_meta.json', metadataJson);

  // Generate zip buffer
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

/**
 * Generate filename for export
 */
export function generateExportFilename(
  moodboardId: string,
  format: 'png' | 'jpg' | 'zip'
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `moodboard_${moodboardId}_${timestamp}.${format}`;
}

/**
 * Get MIME type for format
 */
export function getMimeType(format: 'png' | 'jpg' | 'zip'): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'jpg':
      return 'image/jpeg';
    case 'zip':
      return 'application/zip';
  }
}

/**
 * Export multiple moodboards as a single zip
 */
export async function exportMultipleMoodboards(
  inputs: MoodboardExportInput[],
  options: Partial<ExportOptions> = {}
): Promise<{ success: boolean; zipBuffer?: Buffer; errors: string[] }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const zip = new JSZip();
  const errors: string[] = [];

  for (const input of inputs) {
    try {
      const imageBuffer = await processImage(
        getImageBuffer(input.imageData),
        opts
      );
      const metadata = buildMetadata(input);

      const folderName = `moodboard_${input.id}`;
      const folder = zip.folder(folderName);

      if (folder) {
        folder.file(`moodboard.${opts.format}`, imageBuffer);
        folder.file('moodboard_meta.json', serializeMetadata(metadata));
      }
    } catch (error) {
      errors.push(`Failed to export ${input.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (zip.length === 0) {
    return { success: false, errors: ['No moodboards exported'] };
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });

  return {
    success: true,
    zipBuffer,
    errors
  };
}
