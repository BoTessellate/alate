/**
 * Board Draft Export
 * Exports moodboards to PNG, JSON, or draft preview mode
 */

import { MoodboardComposition } from './composeBoard';
import { BoardRenderer } from '../exportEngine/renderBoard';
import { exportToImage } from '../exportEngine/exportToImage';
import { createClient } from '@supabase/supabase-js';
import { Canvas } from 'canvas';
import path from 'path';
import fs from 'fs';

export type ExportMode = 'png' | 'json' | 'draft';

export interface ExportBoardRequest {
  composition: MoodboardComposition;
  mode: ExportMode;
  quality?: number; // For PNG exports (1-100)
  upload_to_cdn?: boolean; // Upload to Supabase storage
}

export interface ExportBoardResponse {
  success: boolean;
  mode: ExportMode;
  url?: string; // CDN URL or local path
  data?: any; // JSON data if mode is 'json'
  preview_url?: string; // For draft mode
  file_path?: string; // Local file path if not uploaded
  metadata: {
    file_size?: number;
    dimensions?: { width: number; height: number };
    format?: string;
  };
}

/**
 * Export moodboard to specified format
 */
export async function exportBoardDraft(request: ExportBoardRequest): Promise<ExportBoardResponse> {
  const { composition, mode, quality = 90, upload_to_cdn = true } = request;

  switch (mode) {
    case 'png':
      return await exportToPNG(composition, quality, upload_to_cdn);
    case 'json':
      return exportToJSON(composition);
    case 'draft':
      return await exportToDraft(composition, upload_to_cdn);
    default:
      throw new Error(`Unsupported export mode: ${mode}`);
  }
}

/**
 * Export to PNG image
 */
async function exportToPNG(
  composition: MoodboardComposition,
  quality: number,
  uploadToCDN: boolean
): Promise<ExportBoardResponse> {
  try {
    // Render layout to canvas
    const renderer = new BoardRenderer(composition.layout, {
      add_branding: composition.metadata.has_branding
    });
    const canvas = await renderer.render();

    // Convert to PNG buffer
    const imageBuffer = await exportToImage(canvas, 'png', quality);

    let url: string | undefined;
    let filePath: string | undefined;

    if (uploadToCDN) {
      // Upload to Supabase storage
      url = await uploadToSupabase(imageBuffer, composition.id, 'png');
    } else {
      // Save locally
      filePath = await saveLocally(imageBuffer, composition.id, 'png');
    }

    return {
      success: true,
      mode: 'png',
      url,
      file_path: filePath,
      metadata: {
        file_size: imageBuffer.length,
        dimensions: {
          width: composition.layout.canvas_size.width,
          height: composition.layout.canvas_size.height
        },
        format: 'image/png'
      }
    };
  } catch (error) {
    console.error('PNG export error:', error);
    throw new Error(`Failed to export PNG: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export to JSON format
 */
function exportToJSON(composition: MoodboardComposition): ExportBoardResponse {
  try {
    // Create comprehensive JSON export
    const jsonData = {
      version: '1.0',
      export_date: new Date().toISOString(),
      composition: {
        id: composition.id,
        name: composition.name,
        created_at: composition.created_at,
        metadata: composition.metadata
      },
      layout: {
        type: composition.layout.layout_type,
        canvas_size: composition.layout.canvas_size,
        elements: composition.layout.elements.map(el => ({
          type: el.type,
          position: el.position,
          size: el.size,
          rotation: el.rotation,
          opacity: el.opacity,
          text: el.text,
          font_size: el.font_size,
          color: el.color,
          image_url: el.image_url,
          zIndex: el.zIndex
        }))
      },
      products: composition.products.map(p => ({
        id: p.id,
        name: p.product_name,
        brand: p.brand,
        category: p.category,
        tags: p.tags,
        color_palette: p.color_palette,
        price: p.price
      })),
      theme: {
        colors: composition.theme.colors,
        typography: composition.theme.typography,
        spacing: composition.theme.spacing
      }
    };

    return {
      success: true,
      mode: 'json',
      data: jsonData,
      metadata: {
        file_size: JSON.stringify(jsonData).length,
        format: 'application/json'
      }
    };
  } catch (error) {
    console.error('JSON export error:', error);
    throw new Error(`Failed to export JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Export to draft preview mode
 * Creates both PNG and JSON for web preview
 */
async function exportToDraft(
  composition: MoodboardComposition,
  uploadToCDN: boolean
): Promise<ExportBoardResponse> {
  try {
    // Render preview image
    const renderer = new BoardRenderer(composition.layout, {
      add_branding: composition.metadata.has_branding
    });
    const canvas = await renderer.render();
    const imageBuffer = await exportToImage(canvas, 'png', 80); // Lower quality for preview

    // Create draft metadata
    const draftData = {
      id: composition.id,
      name: composition.name,
      created_at: composition.created_at,
      preview_mode: true,
      product_count: composition.metadata.product_count,
      layout_type: composition.metadata.layout_type,
      canvas_size: composition.layout.canvas_size,
      products: composition.products.map(p => ({
        id: p.id,
        name: p.product_name,
        brand: p.brand,
        price: p.price
      })),
      theme_colors: {
        primary: composition.theme.colors.primary,
        secondary: composition.theme.colors.secondary,
        accent: composition.theme.colors.accent
      }
    };

    let previewUrl: string | undefined;
    let filePath: string | undefined;

    if (uploadToCDN) {
      // Upload preview image
      previewUrl = await uploadToSupabase(imageBuffer, `${composition.id}_preview`, 'png');

      // Save draft metadata to database
      await saveDraftMetadata(composition.id, draftData, previewUrl);
    } else {
      // Save locally
      filePath = await saveLocally(imageBuffer, `${composition.id}_preview`, 'png');

      // Save draft JSON locally
      const jsonPath = path.join(
        __dirname,
        '../../exports/drafts',
        `${composition.id}_draft.json`
      );
      fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
      fs.writeFileSync(jsonPath, JSON.stringify(draftData, null, 2));
    }

    return {
      success: true,
      mode: 'draft',
      preview_url: previewUrl,
      file_path: filePath,
      data: draftData,
      metadata: {
        file_size: imageBuffer.length,
        dimensions: {
          width: composition.layout.canvas_size.width,
          height: composition.layout.canvas_size.height
        },
        format: 'image/png'
      }
    };
  } catch (error) {
    console.error('Draft export error:', error);
    throw new Error(`Failed to export draft: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload file to Supabase storage
 */
async function uploadToSupabase(
  buffer: Buffer,
  fileName: string,
  format: string
): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const filePath = `moodboards/${fileName}.${format}`;
  const { data, error } = await supabase.storage
    .from('exports')
    .upload(filePath, buffer, {
      contentType: format === 'png' ? 'image/png' : 'application/json',
      upsert: true
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from('exports')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}

/**
 * Save file locally
 */
async function saveLocally(
  buffer: Buffer,
  fileName: string,
  format: string
): Promise<string> {
  const exportDir = path.join(__dirname, '../../exports/boards');
  fs.mkdirSync(exportDir, { recursive: true });

  const filePath = path.join(exportDir, `${fileName}.${format}`);
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

/**
 * Save draft metadata to database
 */
async function saveDraftMetadata(
  boardId: string,
  draftData: any,
  previewUrl: string
): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase credentials not configured');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { error } = await supabase
    .from('board_drafts')
    .upsert({
      board_id: boardId,
      preview_url: previewUrl,
      draft_data: draftData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.warn('Failed to save draft metadata:', error.message);
    // Don't throw - draft can still be used without database entry
  }
}

/**
 * Batch export multiple boards
 */
export async function batchExportBoards(
  compositions: MoodboardComposition[],
  mode: ExportMode,
  options?: {
    quality?: number;
    upload_to_cdn?: boolean;
  }
): Promise<ExportBoardResponse[]> {
  const results: ExportBoardResponse[] = [];

  for (const composition of compositions) {
    try {
      const result = await exportBoardDraft({
        composition,
        mode,
        quality: options?.quality,
        upload_to_cdn: options?.upload_to_cdn
      });
      results.push(result);
    } catch (error) {
      console.error(`Failed to export board ${composition.id}:`, error);
      results.push({
        success: false,
        mode,
        metadata: {},
        data: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  return results;
}

/**
 * Get export formats for a composition
 */
export function getSupportedFormats(composition: MoodboardComposition): ExportMode[] {
  return ['png', 'json', 'draft'];
}

/**
 * Estimate export file size
 */
export function estimateFileSize(
  composition: MoodboardComposition,
  mode: ExportMode
): number {
  const { width, height } = composition.layout.canvas_size;
  const pixelCount = width * height;

  switch (mode) {
    case 'png':
      // Rough estimate: 4 bytes per pixel (RGBA)
      return pixelCount * 4;
    case 'json':
      // Rough estimate based on structure
      return JSON.stringify(composition).length * 1.5;
    case 'draft':
      // Preview PNG + metadata
      return (pixelCount * 2) + 5000; // Smaller preview + JSON
    default:
      return 0;
  }
}
