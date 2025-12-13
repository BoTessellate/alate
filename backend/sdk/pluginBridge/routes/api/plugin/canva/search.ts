/**
 * Canva Search API
 * POST /api/plugin/canva/search
 */

import { Request, Response } from 'express';
import { createCanvaSearchHandler } from '../../../../canva/canvaSearch';
import { CanvaSearchRequest } from '../../../../types';

export async function canvaSearchHandler(req: Request, res: Response) {
  try {
    const searchRequest: CanvaSearchRequest = req.body;

    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;

    const searchHandler = createCanvaSearchHandler(supabaseUrl, supabaseKey);
    const result = await searchHandler.searchProducts(searchRequest);

    res.json(result);

  } catch (error) {
    console.error('Canva search error:', error);
    res.status(500).json({
      success: false,
      products: [],
      count: 0,
      query: req.body
    });
  }
}
