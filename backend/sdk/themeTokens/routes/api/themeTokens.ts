/**
 * Theme Tokens API Endpoint
 * POST /api/themeTokens
 */

import { Request, Response } from 'express';
import { generateThemeTokens, toFigmaTokens, toCanvaTokens, toCSSVariables } from '../../generateTokens';
import { LayoutOutput } from '../../../layoutGenerator/types';

export async function themeTokensHandler(req: Request, res: Response) {
  try {
    const { layout, products, format = 'json' } = req.body;

    if (!layout || !products) {
      return res.status(400).json({
        success: false,
        error: 'Layout and products are required'
      });
    }

    const tokens = await generateThemeTokens(layout as LayoutOutput, products);

    let formattedTokens: any = tokens;

    switch (format) {
      case 'figma':
        formattedTokens = toFigmaTokens(tokens);
        break;
      case 'canva':
        formattedTokens = toCanvaTokens(tokens);
        break;
      case 'css':
        return res.type('text/css').send(toCSSVariables(tokens));
      case 'json':
      default:
        formattedTokens = tokens;
    }

    res.json({
      success: true,
      tokens: formattedTokens,
      format
    });

  } catch (error) {
    console.error('Theme tokens error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate theme tokens'
    });
  }
}

export function setupThemeTokensRoutes(app: any) {
  app.post('/api/themeTokens', themeTokensHandler);
}
