/**
 * Generate Layout API Endpoint
 * POST endpoint for moodboard layout generation
 */

import { Request, Response } from 'express';
import { createLayoutGenerator } from '../../generateLayout';
import { LayoutInput } from '../../types';

/**
 * Generate layout endpoint handler
 * POST /api/generateLayout
 *
 * Request body:
 * {
 *   "products": [...],
 *   "layout_type": "LayeredCenterpiece",
 *   "canvas_size": { "width": 1200, "height": 1200 },  // optional
 *   "show_labels": true,                                // optional
 *   "show_prices": false                                // optional
 * }
 */
export async function generateLayoutHandler(req: Request, res: Response) {
  try {
    const input: LayoutInput = req.body;

    // Validate input
    if (!input.products || !Array.isArray(input.products)) {
      return res.status(400).json({
        error: 'Invalid input: products array is required'
      });
    }

    if (input.products.length === 0) {
      return res.status(400).json({
        error: 'Invalid input: at least one product is required'
      });
    }

    if (!input.layout_type) {
      return res.status(400).json({
        error: 'Invalid input: layout_type is required'
      });
    }

    // Validate products have required fields
    for (const product of input.products) {
      if (!product.image_url || !product.brand) {
        return res.status(400).json({
          error: 'Invalid input: each product must have image_url and brand'
        });
      }
    }

    // Generate layout
    const layoutGenerator = createLayoutGenerator();
    const layout = await layoutGenerator.generateLayout(input);

    return res.json(layout);
  } catch (error: any) {
    console.error('Layout generation error:', error);

    // Handle specific errors
    if (error.message.includes('requires at least') || error.message.includes('supports max')) {
      return res.status(400).json({
        error: error.message
      });
    }

    if (error.message.includes('Unknown archetype')) {
      return res.status(400).json({
        error: error.message,
        available_archetypes: [
          'ZigZagStaggered',
          'LayeredCenterpiece',
          'MinimalSplit',
          'GridWithOverlap',
          'DiagonalCascade',
          'SymmetricBalance',
          'AsymmetricFlow',
          'CollageStyle'
        ]
      });
    }

    return res.status(500).json({
      error: 'Layout generation failed',
      message: error.message
    });
  }
}

/**
 * Express route setup
 */
export function setupLayoutRoutes(app: any) {
  app.post('/api/generateLayout', generateLayoutHandler);
}
