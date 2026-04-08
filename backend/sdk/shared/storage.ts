import { createClient } from '@supabase/supabase-js';
import { createModuleLogger } from './logger';

const log = createModuleLogger('storage');

/**
 * Upload base64-encoded data to Supabase Storage
 *
 * @param base64Data - Base64-encoded file data
 * @param bucket - Storage bucket name (e.g., 'moodboards')
 * @param folder - Folder path within bucket
 * @param fileName - File name
 * @param supabaseUrl - Supabase project URL
 * @param supabaseKey - Supabase service key
 * @returns Public URL of uploaded file, or undefined if upload fails
 */
export async function uploadToSupabaseStorage(
  base64Data: string,
  bucket: string,
  folder: string,
  fileName: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<string | undefined> {
  if (!supabaseUrl || !supabaseKey) {
    log.warn('Supabase credentials not provided');
    return undefined;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const path = `${folder}/${fileName}`;
    const buffer = Buffer.from(base64Data, 'base64');

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);
      return urlData.publicUrl;
    }
  } catch (err) {
    log.warn({ error: err }, 'Failed to upload to storage');
  }
  return undefined;
}
