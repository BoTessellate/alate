/**
 * Product Image Search Module - Stub
 * Original module was removed during cleanup. These are minimal stubs
 * to satisfy imports from image-processing and photoUpload modules.
 */

export interface DetectedProductInfo {
  name: string;
  brand?: string;
  category: string;
  tags: string[];
  colors: string[];
  confidence: number;
}

export interface ImageSearchOptions {
  enableDatabaseSearch?: boolean;
  enableWebSearch?: boolean;
  databaseMinSimilarity?: number;
}

export interface ImageSearchResult {
  found: boolean;
  imageUrl?: string;
  source?: string;
  matchedProductId?: string;
  matchedProductName?: string;
  matchScore?: number;
  searchTimeMs?: number;
}

export function shouldSearchForImage(_info: DetectedProductInfo): boolean {
  return false;
}

export async function findBestProductImage(
  _info: DetectedProductInfo,
  _options?: ImageSearchOptions
): Promise<ImageSearchResult> {
  return { found: false };
}
