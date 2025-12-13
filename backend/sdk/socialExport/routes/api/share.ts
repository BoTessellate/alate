/**
 * Social Export API Routes
 */

import { Router, Request, Response } from 'express';
import { createShareDataGenerator, SharePlatform } from '../../generateShareData';
import { createExportLinkGenerator } from '../../exportToLink';

const router = Router();
const shareGenerator = createShareDataGenerator();
const linkGenerator = createExportLinkGenerator();

/**
 * POST /api/social/share
 * Generate social share data for moodboard
 */
router.post('/share', async (req: Request, res: Response) => {
  try {
    const {
      composition,
      platforms,
      custom_message,
      include_product_links
    } = req.body;

    if (!composition) {
      return res.status(400).json({
        success: false,
        error: 'Composition data is required'
      });
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one platform is required'
      });
    }

    const result = await shareGenerator.generateShareData({
      composition,
      platforms: platforms as SharePlatform[],
      custom_message,
      include_product_links
    });

    res.json(result);
  } catch (error) {
    console.error('Share generation error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/social/share/track
 * Track share event
 */
router.post('/share/track', async (req: Request, res: Response) => {
  try {
    const { share_id, platform } = req.body;

    if (!share_id || !platform) {
      return res.status(400).json({
        success: false,
        error: 'share_id and platform are required'
      });
    }

    await shareGenerator.trackShare(share_id, platform as SharePlatform);

    res.json({ success: true });
  } catch (error) {
    console.error('Track share error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/social/share/:shareId/analytics
 * Get share analytics
 */
router.get('/share/:shareId/analytics', async (req: Request, res: Response) => {
  try {
    const { shareId } = req.params;
    const analytics = await shareGenerator.getShareAnalytics(shareId);

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Share not found'
      });
    }

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Share analytics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/social/link/create
 * Create shareable export link
 */
router.post('/link/create', async (req: Request, res: Response) => {
  try {
    const {
      composition,
      export_format,
      allow_download,
      expires_in_days,
      password_protected,
      password
    } = req.body;

    if (!composition) {
      return res.status(400).json({
        success: false,
        error: 'Composition data is required'
      });
    }

    const result = await linkGenerator.createExportLink({
      composition,
      export_format,
      allow_download,
      expires_in_days,
      password_protected,
      password
    });

    res.json(result);
  } catch (error) {
    console.error('Create link error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/social/link/:linkId/access
 * Access a shared link
 */
router.post('/link/:linkId/access', async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    const { password } = req.body;

    const result = await linkGenerator.accessLink({
      link_id: linkId,
      password
    });

    if (!result.allowed) {
      return res.status(403).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Access link error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/social/link/:linkId
 * Revoke a shared link
 */
router.delete('/link/:linkId', async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    const result = await linkGenerator.revokeLink(linkId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Revoke link error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/social/link/:linkId/analytics
 * Get link analytics
 */
router.get('/link/:linkId/analytics', async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    const analytics = await linkGenerator.getLinkAnalytics(linkId);

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Link not found'
      });
    }

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Link analytics error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/social/link/:linkId
 * Update link settings
 */
router.put('/link/:linkId', async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    const { allow_download, expires_in_days, password } = req.body;

    const result = await linkGenerator.updateLink(linkId, {
      allow_download,
      expires_in_days,
      password
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Update link error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/social/link/:linkId/qr
 * Generate QR code for link
 */
router.get('/link/:linkId/qr', async (req: Request, res: Response) => {
  try {
    const { linkId } = req.params;
    const qrCodeUrl = await linkGenerator.generateQRCode(linkId);

    res.json({
      success: true,
      qr_code_url: qrCodeUrl
    });
  } catch (error) {
    console.error('QR code error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/social/cleanup
 * Cleanup expired links
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const result = await linkGenerator.cleanupExpiredLinks();

    res.json({
      success: true,
      deleted: result.deleted
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
