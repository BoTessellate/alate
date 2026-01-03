/**
 * Color Extraction Utility
 * Extracts dominant colors from product images using pixel sampling
 * Returns accurate hex codes mapped to fashion-friendly color names
 */

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

interface ExtractedColor {
  hex: string;
  rgb: { r: number; g: number; b: number };
  percentage: number;
  fashionName?: string;
  descriptiveName?: string;
}

interface ColorExtractionResult {
  dominantColors: ExtractedColor[];
  palette: string[]; // Fashion names
  hexCodes: string[];
  warmth: 'warm' | 'cool' | 'neutral';
}

/**
 * Extract dominant colors from an image URL
 * Uses k-means clustering approach for color quantization
 */
export async function extractColorsFromImage(
  imageUrl: string,
  numColors: number = 5
): Promise<ColorExtractionResult | null> {
  try {
    // Fetch image and get pixel data
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.warn('[colorExtractor] Failed to fetch image:', response.status);
      return null;
    }

    const buffer = await response.arrayBuffer();
    const pixels = await getPixelsFromBuffer(buffer);

    if (!pixels || pixels.length === 0) {
      return null;
    }

    // Sample pixels for performance (every nth pixel)
    const sampleRate = Math.max(1, Math.floor(pixels.length / 10000));
    const sampledPixels = pixels.filter((_, i) => i % sampleRate === 0);

    // Cluster colors using simplified k-means
    const clusters = kMeansCluster(sampledPixels, numColors);

    // Sort by frequency (percentage)
    clusters.sort((a, b) => b.count - a.count);

    // Convert to result format
    const totalPixels = sampledPixels.length;
    const dominantColors: ExtractedColor[] = clusters.map(cluster => ({
      hex: rgbToHex(cluster.centroid.r, cluster.centroid.g, cluster.centroid.b),
      rgb: cluster.centroid,
      percentage: (cluster.count / totalPixels) * 100,
    }));

    // Calculate overall warmth
    const warmth = calculateWarmth(dominantColors);

    return {
      dominantColors,
      palette: dominantColors.map(c => c.hex), // Will be replaced with names
      hexCodes: dominantColors.map(c => c.hex),
      warmth,
    };
  } catch (error) {
    console.error('[colorExtractor] Error extracting colors:', error);
    return null;
  }
}

/**
 * Map hex codes to fashion-friendly color names using database
 */
export async function mapColorsToNames(
  hexCodes: string[],
  supabaseUrl: string,
  supabaseKey: string
): Promise<Map<string, { fashionName: string; descriptiveName: string }>> {
  const colorMap = new Map<string, { fashionName: string; descriptiveName: string }>();

  if (!supabaseUrl || !supabaseKey) {
    // Fallback to basic color naming
    hexCodes.forEach(hex => {
      colorMap.set(hex, {
        fashionName: getBasicColorName(hex),
        descriptiveName: getBasicColorName(hex),
      });
    });
    return colorMap;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Query the database function for each color
    for (const hex of hexCodes) {
      const { data, error } = await supabase.rpc('find_closest_color', { p_hex: hex });

      if (!error && data && data.length > 0) {
        colorMap.set(hex, {
          fashionName: data[0].fashion_name || data[0].descriptive_name,
          descriptiveName: data[0].descriptive_name,
        });
      } else {
        // Fallback
        colorMap.set(hex, {
          fashionName: getBasicColorName(hex),
          descriptiveName: getBasicColorName(hex),
        });
      }
    }
  } catch (err) {
    console.error('[colorExtractor] Error mapping colors:', err);
    // Use fallback for all colors
    hexCodes.forEach(hex => {
      if (!colorMap.has(hex)) {
        colorMap.set(hex, {
          fashionName: getBasicColorName(hex),
          descriptiveName: getBasicColorName(hex),
        });
      }
    });
  }

  return colorMap;
}

/**
 * Full extraction pipeline: get colors from image and map to names
 */
export async function extractAndNameColors(
  imageUrl: string,
  supabaseUrl: string,
  supabaseKey: string,
  numColors: number = 5
): Promise<{
  hexCodes: string[];
  colorNames: string[];
  warmth: 'warm' | 'cool' | 'neutral';
} | null> {
  const extracted = await extractColorsFromImage(imageUrl, numColors);
  if (!extracted) return null;

  const colorMap = await mapColorsToNames(extracted.hexCodes, supabaseUrl, supabaseKey);

  const colorNames = extracted.hexCodes.map(hex => {
    const mapped = colorMap.get(hex);
    return mapped?.fashionName || getBasicColorName(hex);
  });

  return {
    hexCodes: extracted.hexCodes,
    colorNames,
    warmth: extracted.warmth,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface Cluster {
  centroid: RGB;
  count: number;
}

/**
 * Parse image buffer to get pixel RGB values using sharp
 * Resizes image for performance and extracts raw pixel data
 */
async function getPixelsFromBuffer(buffer: ArrayBuffer): Promise<RGB[]> {
  try {
    // Resize to smaller dimensions for faster processing
    // 100x100 = 10,000 pixels is enough for color extraction
    // Process image and extract raw pixel data
    // Use 'any' to work around strict type issues with different sharp versions
    const sharpInstance = sharp(Buffer.from(buffer)) as any;
    const processed = await sharpInstance
      .resize(100, 100, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const data = processed.data as Buffer;
    const channels = processed.info?.channels || 3;

    const pixels: RGB[] = [];

    // Handle both RGB (3 channels) and RGBA (4 channels)
    const step = channels;
    for (let i = 0; i < data.length; i += step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Skip very dark pixels (likely background/shadows)
      // and very light pixels (likely white backgrounds)
      const brightness = (r + g + b) / 3;
      if (brightness > 15 && brightness < 245) {
        pixels.push({ r, g, b });
      }
    }

    const info = processed.info || {};
    console.log(`[colorExtractor] Extracted ${pixels.length} pixels from ${info.width || '?'}x${info.height || '?'} image`);
    return pixels;
  } catch (error) {
    console.error('[colorExtractor] Failed to decode image with sharp:', error);
    return [];
  }
}

/**
 * K-means clustering for color quantization
 */
function kMeansCluster(pixels: RGB[], k: number, maxIterations: number = 10): Cluster[] {
  if (pixels.length === 0) return [];

  // Initialize centroids randomly from existing pixels
  const centroids: RGB[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < k && i < pixels.length; i++) {
    let idx;
    do {
      idx = Math.floor(Math.random() * pixels.length);
    } while (usedIndices.has(idx));
    usedIndices.add(idx);
    centroids.push({ ...pixels[idx] });
  }

  let clusters: Cluster[] = centroids.map(c => ({ centroid: c, count: 0 }));

  for (let iter = 0; iter < maxIterations; iter++) {
    // Reset counts
    clusters.forEach(c => c.count = 0);
    const sums = clusters.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

    // Assign pixels to nearest centroid
    for (const pixel of pixels) {
      let minDist = Infinity;
      let minIdx = 0;

      for (let i = 0; i < clusters.length; i++) {
        const dist = colorDistance(pixel, clusters[i].centroid);
        if (dist < minDist) {
          minDist = dist;
          minIdx = i;
        }
      }

      sums[minIdx].r += pixel.r;
      sums[minIdx].g += pixel.g;
      sums[minIdx].b += pixel.b;
      sums[minIdx].count++;
      clusters[minIdx].count++;
    }

    // Update centroids
    for (let i = 0; i < clusters.length; i++) {
      if (sums[i].count > 0) {
        clusters[i].centroid = {
          r: Math.round(sums[i].r / sums[i].count),
          g: Math.round(sums[i].g / sums[i].count),
          b: Math.round(sums[i].b / sums[i].count),
        };
      }
    }
  }

  return clusters.filter(c => c.count > 0);
}

/**
 * Euclidean distance between two RGB colors
 */
function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

/**
 * Convert RGB to hex string
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, x)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

/**
 * Calculate overall warmth of a color palette
 */
function calculateWarmth(colors: ExtractedColor[]): 'warm' | 'cool' | 'neutral' {
  let warmScore = 0;
  let totalWeight = 0;

  for (const color of colors) {
    const { r, g, b } = color.rgb;
    const weight = color.percentage;

    // Warm colors have higher red, lower blue
    // Cool colors have higher blue, lower red
    const warmth = (r - b) / 255;
    warmScore += warmth * weight;
    totalWeight += weight;
  }

  const avgWarmth = warmScore / totalWeight;

  if (avgWarmth > 0.1) return 'warm';
  if (avgWarmth < -0.1) return 'cool';
  return 'neutral';
}

/**
 * Basic color naming from hex (fallback when DB not available)
 */
function getBasicColorName(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Convert to HSL for better naming
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;

  if (d === 0) {
    // Grayscale
    if (l < 0.2) return 'black';
    if (l > 0.9) return 'white';
    if (l > 0.7) return 'light grey';
    if (l < 0.4) return 'dark grey';
    return 'grey';
  }

  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;

  if (max === r / 255) {
    h = 60 * (((g - b) / 255 / d) % 6);
  } else if (max === g / 255) {
    h = 60 * ((b - r) / 255 / d + 2);
  } else {
    h = 60 * ((r - g) / 255 / d + 4);
  }

  if (h < 0) h += 360;

  // Name based on hue
  if (s < 0.1) {
    if (l < 0.2) return 'black';
    if (l > 0.8) return 'white';
    return 'grey';
  }

  if (h < 15 || h >= 345) return l < 0.5 ? 'dark red' : 'red';
  if (h < 45) return l < 0.5 ? 'brown' : 'orange';
  if (h < 65) return l < 0.5 ? 'olive' : 'yellow';
  if (h < 150) return l < 0.5 ? 'dark green' : 'green';
  if (h < 210) return l < 0.5 ? 'teal' : 'cyan';
  if (h < 260) return l < 0.5 ? 'navy' : 'blue';
  if (h < 290) return l < 0.5 ? 'purple' : 'violet';
  if (h < 345) return l < 0.5 ? 'maroon' : 'pink';

  return 'unknown';
}
