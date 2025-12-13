/**
 * Canva Insert API
 * POST /api/plugin/canva/insert
 */

import { Request, Response } from 'express';
import { createCanvaInsertHandler } from '../../../../canva/canvaInsert';
import { CanvaInsertRequest } from '../../../../types';

export async function canvaInsertHandler(req: Request, res: Response) {
  try {
    const insertRequest: CanvaInsertRequest = req.body;

    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_KEY!;

    const insertHandler = createCanvaInsertHandler(supabaseUrl, supabaseKey);
    const result = await insertHandler.generateCanvaLayout(insertRequest);

    res.json(result);

  } catch (error) {
    console.error('Canva insert error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Insert failed'
    });
  }
}
