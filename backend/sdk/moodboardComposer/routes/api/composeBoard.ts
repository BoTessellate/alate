/**
 * Moodboard Composition API Routes
 * Endpoints for composing and exporting moodboards
 */

import { Router, Request, Response } from 'express';
import { composeBoard, validateComposition, getCompositionSummary } from '../../composeBoard';
import { exportBoardDraft, ExportMode } from '../../exportBoardDraft';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * POST /api/compose/board
 * Compose a complete moodboard
 */
router.post('/board', async (req: Request, res: Response) => {
  try {
    const { name, layout, products, theme, add_branding } = req.body;

    // Validate required fields
    if (!layout || !products || !theme) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: layout, products, theme'
      });
    }

    // Compose board
    const composition = await composeBoard({
      name,
      layout,
      products,
      theme,
      add_branding
    });

    // Validate composition
    const validation = validateComposition(composition);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid composition',
        validation_errors: validation.errors
      });
    }

    // Save to database
    const { error: dbError } = await supabase
      .from('moodboard_compositions')
      .insert({
        id: composition.id,
        name: composition.name,
        created_at: composition.created_at,
        layout: composition.layout,
        products: composition.products,
        theme: composition.theme,
        metadata: composition.metadata,
        user_id: req.body.user_id || '00000000-0000-0000-0000-000000000000'
      });

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue even if DB save fails - return composition
    }

    res.json({
      success: true,
      composition,
      summary: getCompositionSummary(composition)
    });
  } catch (error) {
    console.error('Compose board error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/compose/export
 * Export a moodboard composition
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const { composition, mode, quality, upload_to_cdn } = req.body;

    // Validate composition
    if (!composition) {
      return res.status(400).json({
        success: false,
        error: 'Missing composition data'
      });
    }

    // Validate mode
    const validModes: ExportMode[] = ['png', 'json', 'draft'];
    if (!mode || !validModes.includes(mode)) {
      return res.status(400).json({
        success: false,
        error: `Invalid export mode. Must be one of: ${validModes.join(', ')}`
      });
    }

    // Export board
    const result = await exportBoardDraft({
      composition,
      mode: mode as ExportMode,
      quality: quality || 90,
      upload_to_cdn: upload_to_cdn !== false // Default true
    });

    res.json(result);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/compose/create-and-export
 * Compose and export in one step
 */
router.post('/create-and-export', async (req: Request, res: Response) => {
  try {
    const {
      name,
      layout,
      products,
      theme,
      add_branding,
      export_mode,
      quality,
      upload_to_cdn
    } = req.body;

    // Validate required fields
    if (!layout || !products || !theme || !export_mode) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: layout, products, theme, export_mode'
      });
    }

    // Compose board
    const composition = await composeBoard({
      name,
      layout,
      products,
      theme,
      add_branding
    });

    // Validate composition
    const validation = validateComposition(composition);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid composition',
        validation_errors: validation.errors
      });
    }

    // Export board
    const exportResult = await exportBoardDraft({
      composition,
      mode: export_mode as ExportMode,
      quality: quality || 90,
      upload_to_cdn: upload_to_cdn !== false
    });

    // Save to database
    const { error: dbError } = await supabase
      .from('moodboard_compositions')
      .insert({
        id: composition.id,
        name: composition.name,
        created_at: composition.created_at,
        layout: composition.layout,
        products: composition.products,
        theme: composition.theme,
        metadata: composition.metadata,
        export_url: exportResult.url || exportResult.preview_url,
        export_mode: export_mode,
        user_id: req.body.user_id || '00000000-0000-0000-0000-000000000000'
      });

    if (dbError) {
      console.error('Database error:', dbError);
    }

    res.json({
      success: true,
      composition,
      export: exportResult,
      summary: getCompositionSummary(composition)
    });
  } catch (error) {
    console.error('Create and export error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/compose/board/:boardId
 * Retrieve a moodboard composition by ID
 */
router.get('/board/:boardId', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;

    const { data, error } = await supabase
      .from('moodboard_compositions')
      .select('*')
      .eq('id', boardId)
      .single();

    if (error || !data) {
      return res.status(404).json({
        success: false,
        error: 'Moodboard not found'
      });
    }

    res.json({
      success: true,
      composition: data,
      summary: getCompositionSummary(data)
    });
  } catch (error) {
    console.error('Retrieve board error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/compose/boards
 * List all moodboard compositions
 */
router.get('/boards', async (req: Request, res: Response) => {
  try {
    const { limit = 20, offset = 0, user_id } = req.query;

    let query = supabase
      .from('moodboard_compositions')
      .select('id, name, created_at, metadata, export_url, export_mode')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    // Filter by user if provided
    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      boards: data || [],
      count: count || data?.length || 0,
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    console.error('List boards error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/compose/board/:boardId
 * Delete a moodboard composition
 */
router.delete('/board/:boardId', async (req: Request, res: Response) => {
  try {
    const { boardId } = req.params;

    // Delete from database
    const { error } = await supabase
      .from('moodboard_compositions')
      .delete()
      .eq('id', boardId);

    if (error) {
      throw error;
    }

    // Note: Files in storage are not automatically deleted
    // Implement cleanup job separately if needed

    res.json({
      success: true,
      message: 'Moodboard deleted successfully'
    });
  } catch (error) {
    console.error('Delete board error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/compose/validate
 * Validate a moodboard composition without saving
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const composition = req.body;

    if (!composition) {
      return res.status(400).json({
        success: false,
        error: 'Missing composition data'
      });
    }

    const validation = validateComposition(composition);

    res.json({
      success: true,
      valid: validation.valid,
      errors: validation.errors
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/compose/stats
 * Get composition statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { user_id } = req.query;

    let query = supabase
      .from('moodboard_compositions')
      .select('metadata, created_at');

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    // Calculate statistics
    const stats = {
      total_boards: data?.length || 0,
      total_products: data?.reduce((sum, board) => sum + (board.metadata?.product_count || 0), 0) || 0,
      layout_types: {} as Record<string, number>,
      avg_products_per_board: 0,
      boards_with_branding: 0
    };

    data?.forEach(board => {
      const layoutType = board.metadata?.layout_type || 'unknown';
      stats.layout_types[layoutType] = (stats.layout_types[layoutType] || 0) + 1;
      if (board.metadata?.has_branding) {
        stats.boards_with_branding++;
      }
    });

    if (stats.total_boards > 0) {
      stats.avg_products_per_board = Math.round(stats.total_products / stats.total_boards);
    }

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
