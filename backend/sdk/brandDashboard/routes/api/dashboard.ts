/**
 * Brand Dashboard API Routes
 */

import { Router, Request, Response } from 'express';
import { createCSVUploadHandler } from '../../uploadCSV';
import { createSyncStatusService } from '../../getSyncStatus';
import { createBrandAuthenticator } from '../../loginBrand';
import multer from 'multer';

const router = Router();
const csvHandler = createCSVUploadHandler();
const syncService = createSyncStatusService();
const authenticator = createBrandAuthenticator();

// Configure multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

/**
 * Middleware: Verify brand authentication
 */
async function verifyBrand(req: Request, res: Response, next: Function) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const verification = await authenticator.verifyToken(token);
    if (!verification.valid || !verification.brand_id) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Add brand_id to request
    (req as any).brand_id = verification.brand_id;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
}

/**
 * POST /api/brand/dashboard/upload-csv
 * Upload CSV file with products
 */
router.post('/upload-csv', verifyBrand, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const brandId = (req as any).brand_id;
    const { brand_name, auto_enrich, skip_duplicates } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'CSV file is required'
      });
    }

    if (!brand_name) {
      return res.status(400).json({
        success: false,
        error: 'Brand name is required'
      });
    }

    // Convert buffer to string
    const csvContent = file.buffer.toString('utf-8');

    // Validate CSV
    const validation = await csvHandler.validateCSV(csvContent);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CSV format',
        validation
      });
    }

    // Upload and process CSV
    const result = await csvHandler.uploadCSV({
      csv_content: csvContent,
      brand_id: brandId,
      brand_name,
      auto_enrich: auto_enrich === 'true' || auto_enrich === true,
      skip_duplicates: skip_duplicates !== 'false' && skip_duplicates !== false
    });

    res.json(result);
  } catch (error) {
    console.error('CSV upload error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/brand/dashboard/validate-csv
 * Validate CSV without uploading
 */
router.post('/validate-csv', verifyBrand, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'CSV file is required'
      });
    }

    const csvContent = file.buffer.toString('utf-8');
    const validation = await csvHandler.validateCSV(csvContent);

    res.json({
      success: true,
      validation
    });
  } catch (error) {
    console.error('CSV validation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/brand/dashboard/csv-template
 * Download CSV template
 */
router.get('/csv-template', (req: Request, res: Response) => {
  try {
    const template = csvHandler.generateTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=product_template.csv');
    res.send(template);
  } catch (error) {
    console.error('Template error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/brand/dashboard/sync-history
 * Get sync history
 */
router.get('/sync-history', verifyBrand, async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).brand_id;
    const { platform, limit, offset, status } = req.query;

    const result = await syncService.getSyncHistory({
      brand_id: brandId,
      platform: platform as any,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
      status_filter: status as any
    });

    res.json(result);
  } catch (error) {
    console.error('Sync history error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/brand/dashboard/sync-stats
 * Get sync statistics
 */
router.get('/sync-stats', verifyBrand, async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).brand_id;
    const stats = await syncService.getSyncStatistics(brandId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Sync stats error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/brand/dashboard/sync/:syncId
 * Get sync details
 */
router.get('/sync/:syncId', verifyBrand, async (req: Request, res: Response) => {
  try {
    const { syncId } = req.params;
    const sync = await syncService.getSyncDetails(syncId);

    if (!sync) {
      return res.status(404).json({
        success: false,
        error: 'Sync not found'
      });
    }

    res.json({
      success: true,
      sync
    });
  } catch (error) {
    console.error('Sync details error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/brand/dashboard/active-syncs
 * Get active syncs
 */
router.get('/active-syncs', verifyBrand, async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).brand_id;
    const syncs = await syncService.getActiveSyncs(brandId);

    res.json({
      success: true,
      syncs
    });
  } catch (error) {
    console.error('Active syncs error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/brand/dashboard/sync/:syncId/cancel
 * Cancel an active sync
 */
router.post('/sync/:syncId/cancel', verifyBrand, async (req: Request, res: Response) => {
  try {
    const { syncId } = req.params;
    const result = await syncService.cancelSync(syncId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Cancel sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/brand/dashboard/sync/:syncId/retry
 * Retry a failed sync
 */
router.post('/sync/:syncId/retry', verifyBrand, async (req: Request, res: Response) => {
  try {
    const { syncId } = req.params;
    const result = await syncService.retrySync(syncId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Retry sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/brand/dashboard/sync/:syncId/errors
 * Get sync errors
 */
router.get('/sync/:syncId/errors', verifyBrand, async (req: Request, res: Response) => {
  try {
    const { syncId } = req.params;
    const errors = await syncService.getSyncErrors(syncId);

    res.json({
      success: true,
      errors
    });
  } catch (error) {
    console.error('Sync errors error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/brand/dashboard/upload-history
 * Get CSV upload history
 */
router.get('/upload-history', verifyBrand, async (req: Request, res: Response) => {
  try {
    const brandId = (req as any).brand_id;
    const { limit } = req.query;

    const history = await csvHandler.getUploadHistory(
      brandId,
      limit ? parseInt(limit as string) : undefined
    );

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Upload history error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
