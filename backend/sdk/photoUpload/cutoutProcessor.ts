/**
 * Cutout Processor
 * Handles background removal using @imgly/background-removal-node
 * Processes images asynchronously and stores results in Supabase
 */

import { removeBackground } from '@imgly/background-removal-node';
import { getSupabaseClient } from '../shared/supabaseClient';
import { createModuleLogger } from '../shared/logger';
import { Job, ProcessCutoutJobData } from '../shared/jobQueue';

const logger = createModuleLogger('cutoutProcessor');

interface CutoutResult {
  success: boolean;
  cutoutUrl?: string;
  error?: string;
}

/**
 * Process a single cutout job
 * Downloads image, removes background, uploads to cutouts bucket
 */
export async function processCutoutJob(
  job: Job<ProcessCutoutJobData>
): Promise<CutoutResult> {
  const { productId, imageUrl } = job.data;
  const startTime = Date.now();

  logger.info({ productId, imageUrl }, 'Starting cutout processing');

  try {
    logger.info({ productId }, 'Starting background removal');

    // Step 1: Remove background using imgly
    // Library accepts: ImageData | ArrayBuffer | Uint8Array | Blob | URL | string
    // Passing URL directly lets the library handle the fetch
    const blob = await removeBackground(imageUrl, {
      model: 'medium',
      output: {
        format: 'image/png',
        quality: 0.9,
      },
    });

    // Convert blob to buffer
    const cutoutBuffer = Buffer.from(await blob.arrayBuffer());
    logger.info({ productId, cutoutSize: cutoutBuffer.length }, 'Background removed');

    // Step 3: Upload to Supabase cutouts bucket
    const supabase = getSupabaseClient();
    const fileName = `${productId}.png`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cutouts')
      .upload(fileName, cutoutBuffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload cutout: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('cutouts')
      .getPublicUrl(uploadData.path);

    const cutoutUrl = urlData.publicUrl;

    // Step 4: Update enriched_products with cutout_url
    const { error: updateError } = await supabase
      .from('enriched_products')
      .update({ cutout_url: cutoutUrl })
      .eq('id', productId);

    if (updateError) {
      // Log but don't fail - the cutout is still saved
      logger.warn(
        { productId, error: updateError.message },
        'Failed to update enriched_products, cutout saved to storage'
      );
    }

    const duration = Date.now() - startTime;
    logger.info({ productId, cutoutUrl, duration }, 'Cutout processing complete');

    return {
      success: true,
      cutoutUrl,
    };
  } catch (error: any) {
    logger.error({ productId, error: error.message }, 'Cutout processing failed');
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Job handler for the queue system
 */
export async function handleProcessCutout(
  job: Job<ProcessCutoutJobData>
): Promise<CutoutResult> {
  return processCutoutJob(job);
}
