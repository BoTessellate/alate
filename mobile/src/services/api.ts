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
}

export interface FitWarning {
  severity: 'minor' | 'moderate' | 'major';
  message: string;
}

export interface ScrapeResult {
  success: boolean;
  data?: ScrapedProduct;
  error?: string;
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

const TIMEOUT = 30000;

async function apiRequest<T>(
  action: string,
  body: Record<string, unknown>
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai?action=${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client': 'Alate/1.0',
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
        price?: { amount: number; currency: string };
        brand?: string;
        brandName?: string;
        availableSizes?: string[];
      };
      error?: string;
    }>('scrape', { url });

    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Failed to scrape product' };
    }

    return {
      success: true,
      data: {
        name: result.data.title || result.data.name,
        image: result.data.image || result.data.imageUrl,
        description: result.data.description,
        price: result.data.price,
        brand: result.data.brand || result.data.brandName,
        availableSizes: result.data.availableSizes,
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
 * Send a brand nudge - asks our backend to email the brand a pitch
 */
export async function nudgeBrand(brandDomain: string, brandName: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/brand-nudge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brandDomain, brandName }),
    });
    return response.json();
  } catch {
    return { success: false, error: 'Failed to send nudge' };
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
  avatar: Avatar
): Promise<FitCheckResult> {
  try {
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
    }>('check-fit', { product, avatar });

    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
