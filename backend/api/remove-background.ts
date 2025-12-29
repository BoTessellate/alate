import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

/**
 * Background Removal API Endpoint
 *
 * STATUS: Infrastructure ready, processing DISABLED
 * Enable when real products are available.
 *
 * FUTURE OPTIMIZATION:
 * Consider switching to Replicate API for lower costs at scale:
 * - OpenAI: ~$0.02-0.04/image
 * - Replicate (rembg model): ~$0.01/image
 *
 * To switch to Replicate:
 * 1. npm install replicate
 * 2. Add REPLICATE_API_TOKEN to env
 * 3. Replace OpenAI call with:
 *    const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
 *    const output = await replicate.run("cjwbw/rembg:...", { input: { image: url } });
 */

const PROCESSING_ENABLED = false; // Set to true when ready to process real products

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

interface RemoveBackgroundRequest {
  product_id: string;
  image_url: string;
  force?: boolean; // Force reprocessing even if cutout exists
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if processing is enabled
  if (!PROCESSING_ENABLED) {
    return res.status(503).json({
      error: 'Background removal is currently disabled',
      message: 'Processing will be enabled when real products are available',
      status: 'infrastructure_ready',
    });
  }

  try {
    const { product_id, image_url, force = false } = req.body as RemoveBackgroundRequest;

    if (!product_id || !image_url) {
      return res.status(400).json({ error: 'product_id and image_url are required' });
    }

    // Check if cutout already exists (unless force reprocessing)
    if (!force) {
      const { data: existingProduct } = await supabase
        .from('products')
        .select('cutout_url')
        .eq('id', product_id)
        .single();

      if (existingProduct?.cutout_url) {
        return res.status(200).json({
          success: true,
          cutout_url: existingProduct.cutout_url,
          cached: true,
        });
      }
    }

    // Process with OpenAI
    // NOTE: OpenAI's image editing requires specific format - may need to fetch and convert
    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: image_url, // May need to be a file/buffer depending on API requirements
      prompt: 'Remove the background from this product image completely. Keep only the product itself with a transparent background. Preserve all product details, colors, and quality.',
      size: '1024x1024',
    });

    const processedImageUrl = response.data?.[0]?.url;

    if (!processedImageUrl) {
      throw new Error('No image returned from OpenAI');
    }

    // Upload to Supabase Storage
    const imageResponse = await fetch(processedImageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    const fileName = `${product_id}.png`;
    const { error: uploadError } = await supabase.storage
      .from('cutouts')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('cutouts')
      .getPublicUrl(fileName);

    const cutoutUrl = publicUrlData.publicUrl;

    // Update product record with cutout URL
    const { error: updateError } = await supabase
      .from('products')
      .update({ cutout_url: cutoutUrl })
      .eq('id', product_id);

    if (updateError) {
      console.error('Failed to update product with cutout URL:', updateError);
      // Don't fail the request, cutout was still created
    }

    return res.status(200).json({
      success: true,
      cutout_url: cutoutUrl,
      cached: false,
    });

  } catch (error) {
    console.error('Background removal error:', error);
    return res.status(500).json({
      error: 'Failed to remove background',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
