/**
 * Image Export Module
 * Converts canvas to PNG/JPG/WebP and optionally uploads to CDN
 */

import { Canvas } from 'canvas';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ExportFormat, ExportResponse } from './types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Export canvas to image buffer
 */
export async function exportToImage(
  canvas: Canvas,
  format: ExportFormat = 'png',
  quality: number = 90
): Promise<Buffer> {
  switch (format) {
    case 'png':
      return canvas.toBuffer('image/png');

    case 'jpg':
      return canvas.toBuffer('image/jpeg', { quality: quality / 100 });

    case 'webp':
      // node-canvas doesn't natively support webp, fallback to PNG
      console.warn('WebP not supported, using PNG instead');
      return canvas.toBuffer('image/png');

    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Export canvas and upload to Supabase storage
 */
export async function exportAndUpload(
  canvas: Canvas,
  format: ExportFormat = 'png',
  options: {
    quality?: number;
    uploadToCdn?: boolean;
    fileName?: string;
    supabaseUrl?: string;
    supabaseKey?: string;
  } = {}
): Promise<ExportResponse> {
  const {
    quality = 90,
    uploadToCdn = false,
    fileName = `export-${Date.now()}.${format}`,
    supabaseUrl,
    supabaseKey
  } = options;

  // Generate image buffer
  const buffer = await exportToImage(canvas, format, quality);

  const response: ExportResponse = {
    success: true,
    width: canvas.width,
    height: canvas.height,
    format,
    file_size: buffer.length,
    generated_at: new Date().toISOString(),
    buffer
  };

  // Upload to CDN if requested
  if (uploadToCdn) {
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase credentials not provided, skipping upload');
      return response;
    }

    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const uploadUrl = await uploadToSupabase(supabase, buffer, fileName, format);
      response.export_url = uploadUrl;
      delete response.buffer; // Remove buffer if uploaded successfully
    } catch (error) {
      console.error('Failed to upload to CDN:', error);
      // Keep buffer in response if upload fails
    }
  }

  return response;
}

/**
 * Upload buffer to Supabase storage
 */
async function uploadToSupabase(
  supabase: SupabaseClient,
  buffer: Buffer,
  fileName: string,
  format: ExportFormat
): Promise<string> {
  const bucketName = 'moodboard-exports';
  const contentType = getContentType(format);

  // Upload to Supabase storage
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, buffer, {
      contentType,
      upsert: true
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

/**
 * Save export to local file system
 */
export async function exportToFile(
  canvas: Canvas,
  filePath: string,
  format: ExportFormat = 'png',
  quality: number = 90
): Promise<void> {
  const buffer = await exportToImage(canvas, format, quality);

  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(filePath, buffer);
}

/**
 * Get MIME content type for format
 */
function getContentType(format: ExportFormat): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'jpg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Export with automatic file naming
 */
export async function exportWithAutoName(
  canvas: Canvas,
  outputDir: string,
  format: ExportFormat = 'png',
  quality: number = 90
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `moodboard-${timestamp}.${format}`;
  const filePath = path.join(outputDir, fileName);

  await exportToFile(canvas, filePath, format, quality);

  return filePath;
}

/**
 * Convenience function: Render and export in one call
 */
export async function renderAndExport(
  renderFn: () => Promise<Canvas>,
  format: ExportFormat = 'png',
  options?: {
    quality?: number;
    uploadToCdn?: boolean;
    fileName?: string;
    supabaseUrl?: string;
    supabaseKey?: string;
  }
): Promise<ExportResponse> {
  const canvas = await renderFn();
  return exportAndUpload(canvas, format, options);
}
