/**
 * Smart Label API Endpoint
 * POST /api/smartLabel
 */

import { Request, Response } from 'express';
import { generateSmartLabels } from '../../generateSmartLabels';
import { LayoutOutput } from '../../../layoutGenerator/types';

export async function smartLabelHandler(req: Request, res: Response) {
  try {
    const layout: LayoutOutput = req.body.layout;

    if (!layout) {
      return res.status(400).json({
        success: false,
        error: 'Layout data is required'
      });
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      return res.status(500).json({
        success: false,
        error: 'Anthropic API key not configured'
      });
    }

    const enhancedLayout = await generateSmartLabels(layout, anthropicApiKey);

    res.json({
      success: true,
      layout: enhancedLayout
    });

  } catch (error) {
    console.error('Smart label error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate smart labels'
    });
  }
}

export function setupSmartLabelRoutes(app: any) {
  app.post('/api/smartLabel', smartLabelHandler);
}
