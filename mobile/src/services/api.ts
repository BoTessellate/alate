/**
 * API Client Service - Alate
 *
 * Backend API Reference:
 * - POST /api/ai?action=scrape { url } -> { success, data: { name, image, price, description } }
 * - POST /api/ai?action=enrich { product } -> { success, product }
 * - POST /api/ai?action=check-fit { product, avatar } -> { success, warnings, fit_score, size_recommendation }
 */

import { API_BASE_URL } from '../constants/api';
import { Avatar } from '../store/avatarStore';
import { useDeviceStore } from '../store/deviceStore';

export interface ScrapedProduct {
  name?: string;
  image?: string;
  description?: string;
  price?: {
    amount: number;
    currency: string;
  };
  brand?: string;
  availableSizes?: string[];
  // Populated when the backend's Shopify direct-fetch layer succeeds.
  // Lets FitResultScreen skip the Claude-based enrichment round-trip
  // when the storefront already gave us structured data.
  category?: string;
  tags?: string[];
  material?: string;
  compareAtPrice?: { amount: number; currency: string };
  // Surfaced when the storefront advertises made-to-measure / custom
  // sizing — FitResultScreen renders a brand-spotlight badge near the
  // hero. Ephemeral per scrape (anti-pattern #1: don't persist scraped
  // brand metadata into a shared catalog).
  customFit?: { available: boolean; label?: string };
}

export interface FitWarning {
  severity: 'minor' | 'moderate' | 'major';
  message: string;
}

export interface ScrapeResult {
  success: boolean;
  data?: ScrapedProduct;
  error?: string;
  /** True when the origin is on the brand opt-out list or robots.txt
   *  disallows the path. App should show an opt-out card, not an error. */
  blocked?: boolean;
  blockedReason?: 'brand-optout' | 'robots-disallow';
  blockedOrigin?: string;
  blockedMessage?: string;
}

export interface EnrichResult {
  success: boolean;
  product?: {
    id?: string;
    name: string;
    category?: string;
    material?: string;
    tags?: string[];
  };
  error?: string;
}

export interface FitCheckResult {
  success: boolean;
  warnings?: FitWarning[];
  fit_score?: 'great' | 'moderate' | 'poor';
  size_recommendation?: {
    size: string;
    confidence: 'high' | 'medium' | 'low';
    note?: string;
  };
  error?: string;
}

/** Body cm measurements estimated from a garment the user owns */
export interface CalibrationData {
  bust_cm: number;
  waist_cm: number;
  hips_cm: number;
  shoulders_cm: number;
}

export interface CalibrateGarmentResult {
  success: boolean;
  estimated_cm?: CalibrationData;
  error?: string;
  message?: string;
}

const TIMEOUT = 30000;

async function apiRequest<T>(
  action: string,
  body: Record<string, unknown>
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    // Stable per-install device ID, used for server-side rate-limiting
    // (keys per-install instead of per-IP so users behind shared NAT
    // don't share a bucket). Generated on first launch, persisted via
    // AsyncStorage. Not PII — random UUID.
    const deviceId = useDeviceStore.getState().ensureDeviceId();

    const response = await fetch(`${API_BASE_URL}/api/ai?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client': 'Alate/1.0',
        'X-Device-Id': deviceId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw error;
  }
}

/**
 * Scrape product data from a URL
 */
export async function scrapeProduct(url: string): Promise<ScrapeResult> {
  try {
    const result = await apiRequest<{
      success: boolean;
      data?: {
        title?: string;
        name?: string;
        image?: string;
        imageUrl?: string;
        description?: string;
        price?: { amount: number; currency: string } | string;
        currency?: string;
        compareAtPrice?: string;
        brand?: string;
        brandName?: string;
        availableSizes?: string[];
        category?: string;
        tags?: string[];
        material?: string;
        customFit?: { available: boolean; label?: string };
      };
      error?: string;
      blocked?: boolean;
      reason?: 'brand-optout' | 'robots-disallow';
      origin?: string;
      message?: string;
    }>('scrape', { url });

    // Brand opt-out / robots.txt disallow comes back as `success:false`
    // + `blocked:true`. Surface it as a non-error result so the app can
    // render a distinct "this brand has opted out" card.
    if (result.blocked) {
      return {
        success: false,
        blocked: true,
        blockedReason: result.reason,
        blockedOrigin: result.origin,
        blockedMessage: result.message,
      };
    }

    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to scrape product' };
    }

    // Price shape reconciliation: the Shopify direct-fetch path returns
    // price as a bare string (the raw `"5931.00"` from the storefront
    // variant) + a separate `currency`, while HTML extraction returns
    // the already-parsed `{ amount, currency }` object. Normalise both
    // shapes into the app's canonical `{ amount, currency }`.
    let price: { amount: number; currency: string } | undefined;
    if (result.data.price && typeof result.data.price === 'object') {
      price = result.data.price;
    } else if (result.data.price && typeof result.data.price === 'string') {
      const amount = parseFloat(result.data.price.replace(/,/g, ''));
      if (Number.isFinite(amount) && result.data.currency) {
        price = { amount, currency: result.data.currency };
      }
    }

    let compareAtPrice: { amount: number; currency: string } | undefined;
    if (result.data.compareAtPrice && result.data.currency) {
      const amount = parseFloat(result.data.compareAtPrice.replace(/,/g, ''));
      if (Number.isFinite(amount)) {
        compareAtPrice = { amount, currency: result.data.currency };
      }
    }

    return {
      success: true,
      data: {
        name: result.data.title || result.data.name,
        image: result.data.image || result.data.imageUrl,
        description: result.data.description,
        price,
        compareAtPrice,
        brand: result.data.brand || result.data.brandName,
        availableSizes: result.data.availableSizes,
        category: result.data.category,
        tags: result.data.tags,
        material: result.data.material,
        customFit: result.data.customFit,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Enrich a product with AI-generated metadata
 */
export async function enrichProduct(product: {
  name: string;
  image_url?: string;
  description?: string;
  price?: number;
  currency?: string;
}): Promise<EnrichResult> {
  try {
    const result = await apiRequest<{
      success: boolean;
      product?: {
        id?: string;
        name: string;
        category?: string;
        material?: string;
        tags?: string[];
      };
      error?: string;
    }>('enrich', { product });

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check fit for a product against user's avatar
 */
/**
 * Extract brand name from a URL domain
 */
export function extractBrandFromUrl(url: string): { brandName: string; brandDomain: string } | null {
  try {
    const { hostname } = new URL(url);
    // Remove www. and get the main domain name
    const domain = hostname.replace(/^www\./, '');
    // Extract brand name from domain (e.g. "asos.com" -> "ASOS")
    const name = domain.split('.')[0];
    const brandName = name.charAt(0).toUpperCase() + name.slice(1);
    return { brandName, brandDomain: domain };
  } catch {
    return null;
  }
}

/**
 * Log a brand request — demand-tracking signal for unsupported brands.
 * Called from FitResult's error state. NO email goes out to the brand.
 * The aggregate count powers in-app social proof + a marketing/BD
 * dashboard. See backend/api/brand-request.ts for shape.
 */
export interface LogBrandRequestPayload {
  sourceUrl: string;
  brandDisplay?: string;
  requesterEmail?: string;
  userId?: string;
}
export interface LogBrandRequestResult {
  success: boolean;
  brandHandle?: string;
  count?: number;
  error?: string;
}
export async function logBrandRequest(
  payload: LogBrandRequestPayload
): Promise<LogBrandRequestResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/brand-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }
    const data = await response.json();
    return { success: true, brandHandle: data.brandHandle, count: data.count };
  } catch {
    return { success: false, error: 'Failed to log brand request' };
  }
}

/**
 * Read-only aggregate count for a brand_handle. Used by FitResult's
 * error card to gate the social-proof copy at >= 20.
 */
export async function getBrandRequestCount(brandHandle: string): Promise<number> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/brand-request?brandHandle=${encodeURIComponent(brandHandle)}`
    );
    if (!response.ok) return 0;
    const data = await response.json();
    return typeof data.count === 'number' ? data.count : 0;
  } catch {
    return 0;
  }
}

export async function checkFit(
  product: {
    id: string;
    product_name: string;
    category: string;
    material?: string;
    tags?: string[];
    description?: string;
  },
  avatar: Avatar,
  calibration?: CalibrationData,
  garmentCount?: number
): Promise<FitCheckResult> {
  try {
    const body: Record<string, unknown> = { product, avatar };
    if (calibration) {
      body.calibration = calibration;
      body.garment_count = garmentCount ?? 0;
    }

    const result = await apiRequest<{
      success: boolean;
      warnings?: FitWarning[];
      fit_score?: 'great' | 'moderate' | 'poor';
      size_recommendation?: {
        size: string;
        confidence: 'high' | 'medium' | 'low';
        note?: string;
      };
      error?: string;
    }>('check-fit', body);

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Estimate the user's body measurements (in cm) from a garment they own.
 * Calls the backend Claude-powered calibration endpoint. The result is stored
 * in the calibration store and averaged across all entries when checking fit.
 */
export async function calibrateGarment(input: {
  brand: string;
  size: string;
  fit: 'perfect' | 'slightly-tight' | 'slightly-loose';
  avatar: Avatar;
}): Promise<CalibrateGarmentResult> {
  try {
    const result = await apiRequest<CalibrateGarmentResult>('calibrate-garment', input);
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
