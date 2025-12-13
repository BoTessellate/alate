/**
 * Export Board API Endpoint
 * POST /api/exportBoard
 */

import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { BoardRenderer } from '../../renderBoard';
import { exportAndUpload } from '../../exportToImage';
import { ExportRequest, ExportResponse, LayoutOutput } from '../../types';

/**
 * POST /api/exportBoard
 *
 * Request body:
 * {
 *   layout?: LayoutOutput,      // Inline layout data
 *   layout_id?: string,          // Or layout ID to fetch from database
 *   canvas_size?: [number, number],
 *   format?: 'png' | 'jpg' | 'webp',
 *   background_color?: string,
 *   add_branding?: boolean,
 *   quality?: number,
 *   upload_to_cdn?: boolean
 * }
 */
export async function exportBoardHandler(req: Request, res: Response) {
  try {
    const exportRequest: ExportRequest & { upload_to_cdn?: boolean } = req.body;

    // Validate request
    if (!exportRequest.layout && !exportRequest.layout_id) {
      return res.status(400).json({
        success: false,
        error: 'Either layout or layout_id is required'
      });
    }

    // Get layout data
    let layout: LayoutOutput;

    if (exportRequest.layout) {
      layout = exportRequest.layout;
    } else if (exportRequest.layout_id) {
      // Fetch from database
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({
          success: false,
          error: 'Supabase credentials not configured'
        });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase
        .from('layouts')
        .select('*')
        .eq('id', exportRequest.layout_id)
        .single();

      if (error || !data) {
        return res.status(404).json({
          success: false,
          error: `Layout not found: ${exportRequest.layout_id}`
        });
      }

      layout = data.layout_data as LayoutOutput;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid request'
      });
    }

    // Override canvas size if provided
    if (exportRequest.canvas_size) {
      layout.canvas_size = {
        width: exportRequest.canvas_size[0],
        height: exportRequest.canvas_size[1]
      };
    }

    // Create renderer
    const renderer = new BoardRenderer(
      layout.canvas_size.width,
      layout.canvas_size.height,
      {
        background_color: exportRequest.background_color || '#f6e9cf',
        add_branding: exportRequest.add_branding !== false, // Default true
        default_font: 'Inter',
        label_font_size: 18,
        label_font_color: '#2C2416',
        branding_position: 'bottom-right',
        branding_padding: 30
      }
    );

    // Render layout
    const canvas = await renderer.render(layout);

    // Export to image
    const format = exportRequest.format || 'png';
    const quality = exportRequest.quality || 90;
    const uploadToCdn = exportRequest.upload_to_cdn || false;

    const exportResponse: ExportResponse = await exportAndUpload(
      canvas,
      format,
      {
        quality,
        uploadToCdn,
        fileName: exportRequest.layout_id
          ? `layout-${exportRequest.layout_id}.${format}`
          : `export-${Date.now()}.${format}`,
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseKey: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
      }
    );

    // If not uploaded to CDN, return buffer as base64
    if (!uploadToCdn && exportResponse.buffer) {
      const base64 = exportResponse.buffer.toString('base64');
      delete exportResponse.buffer;
      return res.json({
        ...exportResponse,
        image_data: `data:image/${format};base64,${base64}`
      });
    }

    res.json(exportResponse);

  } catch (error) {
    console.error('Export board error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Setup route
 */
export function setupExportRoutes(app: any) {
  app.post('/api/exportBoard', exportBoardHandler);
}
