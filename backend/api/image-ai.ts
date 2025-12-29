/**
 * Image AI API - Vercel Serverless Function
 * Combined endpoint for:
 * - AI Moodboard Composition (replaces algorithmic layouts)
 * - Virtual Try-On (clothing + furniture)
 *
 * Routes:
 * POST /api/image-ai?action=compose - Moodboard composition
 * POST /api/image-ai?action=tryon - Virtual try-on
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyMiddleware } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';
import {
  createImageGenerator,
  MoodboardCompositionInput,
  VirtualTryOnInput,
  TryOnType,
} from '../sdk/imageGeneration';
import { createClient } from '@supabase/supabase-js';

const log = createModuleLogger('image-ai');

// Demo mode flag
const DEMO_MODE = process.env.DEMO_MODE !== 'false';

// Initialize Supabase for image storage
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

// ============================================================================
// REQUEST TYPES
// ============================================================================

interface ComposeRequest {
  productImages: Array<{
    url?: string;
    base64?: string;
  }>;
  style?: {
    aesthetic?: string;
    colorPalette?: string[];
    mood?: string;
    lighting?: 'natural' | 'studio' | 'warm' | 'cool' | 'dramatic';
  };
  arrangement?: 'balanced' | 'asymmetric' | 'collage' | 'grid' | 'organic';
  canvasSize?: '1024x1024' | '1536x1024' | '1024x1536';
  lookId?: string;
}

interface TryOnRequest {
  baseImage: {
    url?: string;
    base64?: string;
  };
  productImages: Array<{
    url?: string;
    base64?: string;
  }>;
  type: TryOnType;
  preserveBackground?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

async function uploadToStorage(
  base64Data: string,
  folder: string,
  fileName: string
): Promise<string | undefined> {
  if (!supabaseUrl || !supabaseKey) return undefined;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const path = `${folder}/${fileName}`;
    const buffer = Buffer.from(base64Data, 'base64');

    const { data, error } = await supabase.storage
      .from('moodboards')
      .upload(path, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from('moodboards')
        .getPublicUrl(data.path);
      return urlData.publicUrl;
    }
  } catch (err) {
    log.warn({ error: err }, 'Failed to upload to storage');
  }
  return undefined;
}

// ============================================================================
// HANDLERS
// ============================================================================

async function handleCompose(body: ComposeRequest, res: VercelResponse) {
  if (!body.productImages || body.productImages.length === 0) {
    return res.status(400).json({ error: 'At least one product image is required' });
  }

  if (body.productImages.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 product images allowed' });
  }

  // Demo mode
  if (DEMO_MODE) {
    log.info({ productCount: body.productImages.length, demoMode: true }, 'Demo mode active');
    return res.status(200).json({
      success: true,
      moodboard: {
        imageUrl: null,
        productCount: body.productImages.length,
        arrangement: body.arrangement || 'balanced',
        model: 'demo-mode',
        latencyMs: 0,
      },
      _demo: true,
      _note: 'Demo mode active. Set DEMO_MODE=false and configure OPENAI_API_KEY for real AI composition.',
      _fallback: '/api/layout',
    });
  }

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    return res.status(200).json({
      success: false,
      error: 'OpenAI API key not configured',
      _fallback: '/api/layout',
    });
  }

  log.info(
    { productCount: body.productImages.length, arrangement: body.arrangement },
    'Starting AI moodboard composition'
  );

  const imageGenerator = createImageGenerator();

  const input: MoodboardCompositionInput = {
    productImages: body.productImages.map((img) => ({
      url: img.url,
      base64: img.base64,
    })),
    style: body.style,
    arrangement: body.arrangement,
    canvasSize: body.canvasSize,
    mood: body.style?.mood,
  };

  const result = await imageGenerator.composeMoodboard(input);

  // Upload to storage
  let publicUrl: string | undefined;
  if (result.imageBase64) {
    publicUrl = await uploadToStorage(
      result.imageBase64,
      `moodboards/${body.lookId || 'temp'}`,
      `${Date.now()}.png`
    );
  }

  log.info(
    { productCount: body.productImages.length, latencyMs: result.latencyMs },
    'Moodboard composition complete'
  );

  return res.status(200).json({
    success: true,
    moodboard: {
      imageUrl: publicUrl || result.imageUrl,
      imageBase64: result.imageBase64,
      productCount: result.productCount,
      arrangement: result.arrangement,
      model: result.model,
      latencyMs: result.latencyMs,
      revisedPrompt: result.revisedPrompt,
    },
  });
}

async function handleTryOn(body: TryOnRequest, res: VercelResponse) {
  // Validation
  if (!body.baseImage || (!body.baseImage.url && !body.baseImage.base64)) {
    return res.status(400).json({
      error: 'Base image is required',
      hint: 'Provide a person photo (for clothing) or room photo (for furniture)',
    });
  }

  if (!body.productImages || body.productImages.length === 0) {
    return res.status(400).json({ error: 'At least one product image is required' });
  }

  if (body.productImages.length > 5) {
    return res.status(400).json({ error: 'Maximum 5 product images allowed per try-on' });
  }

  const validTypes: TryOnType[] = ['clothing', 'accessory', 'furniture', 'decor'];
  if (!body.type || !validTypes.includes(body.type)) {
    return res.status(400).json({
      error: 'Invalid try-on type',
      hint: 'Use one of: clothing, accessory, furniture, decor',
    });
  }

  // Demo mode
  if (DEMO_MODE) {
    log.info({ type: body.type, productCount: body.productImages.length, demoMode: true }, 'Demo mode active');
    return res.status(200).json({
      success: true,
      result: {
        imageUrl: null,
        type: body.type,
        productCount: body.productImages.length,
        model: 'demo-mode',
        latencyMs: 0,
      },
      _demo: true,
      _note: 'Demo mode active. Set DEMO_MODE=false and configure OPENAI_API_KEY for real virtual try-on.',
    });
  }

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'OpenAI API key not configured',
    });
  }

  log.info(
    { type: body.type, productCount: body.productImages.length },
    'Starting virtual try-on'
  );

  const imageGenerator = createImageGenerator();

  const input: VirtualTryOnInput = {
    baseImage: {
      url: body.baseImage.url,
      base64: body.baseImage.base64,
    },
    productImages: body.productImages.map((img) => ({
      url: img.url,
      base64: img.base64,
    })),
    type: body.type,
    preserveBackground: body.preserveBackground ?? true,
  };

  const result = await imageGenerator.virtualTryOn(input);

  // Upload to storage
  let publicUrl: string | undefined;
  if (result.imageBase64) {
    publicUrl = await uploadToStorage(result.imageBase64, `tryons/${body.type}`, `${Date.now()}.png`);
  }

  log.info(
    { type: body.type, productCount: body.productImages.length, latencyMs: result.latencyMs },
    'Virtual try-on complete'
  );

  return res.status(200).json({
    success: true,
    result: {
      imageUrl: publicUrl || result.imageUrl,
      imageBase64: result.imageBase64,
      type: result.type,
      productCount: result.productCount,
      model: result.model,
      latencyMs: result.latencyMs,
      revisedPrompt: result.revisedPrompt,
    },
  });
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS, rate limiting, and security headers
  const handled = applyMiddleware(req, res);
  if (handled) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action as string;

  try {
    switch (action) {
      case 'compose':
        return handleCompose(req.body as ComposeRequest, res);

      case 'tryon':
        return handleTryOn(req.body as TryOnRequest, res);

      default:
        return res.status(400).json({
          error: 'Invalid action',
          hint: 'Use ?action=compose or ?action=tryon',
          examples: {
            compose: 'POST /api/image-ai?action=compose',
            tryon: 'POST /api/image-ai?action=tryon',
          },
        });
    }
  } catch (error) {
    log.error({ error, action }, 'Image AI operation failed');
    return res.status(500).json({
      error: 'Operation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
