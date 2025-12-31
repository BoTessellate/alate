/**
 * API Client Service
 * Handles all HTTP requests to the backend
 *
 * Backend API Reference:
 * - /api/scrape: POST { url } -> { title, brandName, price, currency, imageUrl }
 * - /api/enrich: POST { product } -> { success, product, model_used }
 * - /api/search: POST { prompt, limit } -> { mode, products[], total, parsed_query, suggestions, model_used }
 * - /api/smart-labels: POST { image_positions[], label_style, canvas_size } -> { success, label_placements[], method }
 * - /api/theme: POST { products[], canvas_size } -> { colors, typography, spacing, export_formats }
 * - /api/layout: POST { layout_type, products[], canvas_width, canvas_height } -> { layout_type, canvas_size, products[] }
 * - /api/moodboards: GET/POST/PUT/DELETE with ?id= query param
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { API_BASE_URL, ENDPOINTS, TIMEOUTS } from '../constants/api';
import {
  ScrapeResponse,
  EnrichResponse,
  SearchResponse,
  Product,
  Moodboard,
  LabelPlacement,
  MoodboardTheme,
} from '../types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: TIMEOUTS.DEFAULT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for auth tokens
    this.client.interceptors.request.use(
      async (config) => {
        // Add auth token if available
        // const token = await SecureStore.getItemAsync('auth_token');
        // if (token) {
        //   config.headers.Authorization = `Bearer ${token}`;
        // }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Handle unauthorized - clear token, redirect to login
          console.log('Unauthorized - session expired');
        }
        return Promise.reject(error);
      }
    );
  }

  // ============================================================================
  // SCRAPING - POST { url } -> ScrapeResponse
  // ============================================================================
  async scrapeUrl(url: string): Promise<ScrapeResponse> {
    const response = await this.client.post(
      ENDPOINTS.SCRAPE,
      { url },
      { timeout: TIMEOUTS.SCRAPE }
    );
    // Backend returns: { title, brandName, price, currency, imageUrl, _debug }
    return response.data;
  }

  // ============================================================================
  // PRODUCT ENRICHMENT - POST { product } -> EnrichResponse
  // ============================================================================
  async enrichProduct(product: Partial<Product>): Promise<EnrichResponse> {
    // Backend expects: { product: { name, description?, brand?, price?, currency?, image_url?, source_url? } }
    const response = await this.client.post(
      ENDPOINTS.ENRICH,
      { product },
      { timeout: TIMEOUTS.AI }
    );
    // Backend returns: { success, product, model_used }
    return response.data;
  }

  // ============================================================================
  // SEMANTIC SEARCH - POST { prompt, limit } -> SearchResponse
  // ============================================================================
  async searchProducts(
    query: string,
    filters?: { category?: string; tags?: string[] }
  ): Promise<SearchResponse> {
    // Backend expects: { prompt, limit }
    const response = await this.client.post(
      ENDPOINTS.SEARCH,
      { prompt: query, limit: 20 },
      { timeout: TIMEOUTS.AI }
    );

    // Backend returns: { mode, products[], total, parsed_query?, suggestions?, model_used? }
    // Transform to frontend expected format
    const data = response.data;
    return {
      success: true,
      results: (data.products || []).map((product: any) => ({
        product_id: product.id,
        score: 0.85, // Backend doesn't return scores for DB queries
        product: {
          id: product.id,
          name: product.product_name,
          brand: product.brand,
          price: product.price,
          image_url: product.image_url || product.image_urls?.preview,
          tags: product.tags,
          color_palette: product.color_palette,
          category: product.category,
          material: product.material,
          texture: product.texture,
          tone: product.tone,
          created_at: product.created_at,
        }
      })),
      query,
      model_used: data.model_used || 'database',
    };
  }

  // ============================================================================
  // SMART LABEL PLACEMENT - POST { image_positions, label_style, canvas_size }
  // ============================================================================
  async getSmartLabels(
    imagePositions: Array<{
      product_name: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>,
    labelStyle: { font_size: number; color: string; placement_preference?: string },
    canvasSize: { width: number; height: number }
  ): Promise<{ label_placements: LabelPlacement[]; method: string }> {
    // Backend expects: { image_positions, label_style, canvas_size }
    const response = await this.client.post(
      ENDPOINTS.SMART_LABELS,
      {
        image_positions: imagePositions,
        label_style: labelStyle,
        canvas_size: canvasSize,
      },
      { timeout: TIMEOUTS.AI }
    );
    // Backend returns: { success, label_placements[], method, model_used? }
    return {
      label_placements: response.data.label_placements || [],
      method: response.data.method || 'unknown',
    };
  }

  // ============================================================================
  // THEME GENERATION - POST { products, canvas_size }
  // ============================================================================
  async generateTheme(
    products: Product[],
    canvasSize?: { width: number; height: number }
  ): Promise<MoodboardTheme> {
    // Backend expects: { products[], canvas_size? }
    const response = await this.client.post(
      ENDPOINTS.THEME,
      { products, canvas_size: canvasSize },
      { timeout: TIMEOUTS.AI }
    );
    // Backend returns: { colors, typography, spacing, export_formats }
    // Transform to frontend MoodboardTheme format
    const data = response.data;
    return {
      colors: {
        primary: data.colors?.primary || '#4A5568',
        secondary: data.colors?.secondary || '#718096',
        accent: data.colors?.accent || '#ED8936',
        background: data.colors?.background || '#FFFFFF',
        text: data.colors?.text || '#1A202C',
        textSecondary: data.colors?.textSecondary || '#4A5568',
      },
      fonts: {
        heading: data.typography?.fontFamily || 'Inter',
        body: data.typography?.fontFamily || 'Inter',
      },
    };
  }

  // ============================================================================
  // AUTO LAYOUT - POST { layout_type, products, canvas_width, canvas_height }
  // ============================================================================
  async generateLayout(
    products: Array<{ id: string; name?: string; image_url?: string; aspect_ratio?: number }>,
    canvasSize: { width: number; height: number },
    style?: 'grid' | 'masonry' | 'freeform' | 'zigzag' | 'centerpiece' | 'asymmetric' | 'stacked' | 'diagonal' | 'cluster' | 'magazine'
  ): Promise<{
    positions: Array<{ id: string; x: number; y: number; width: number; height: number; rotation?: number; z_index: number }>;
  }> {
    // Map frontend style names to backend layout_type
    const layoutTypeMap: Record<string, string> = {
      'grid': 'grid',
      'masonry': 'asymmetric',
      'freeform': 'diagonal',
      'zigzag': 'zigzag',
      'centerpiece': 'centerpiece',
      'asymmetric': 'asymmetric',
      'stacked': 'stacked',
      'diagonal': 'diagonal',
      'cluster': 'cluster',
      'magazine': 'magazine',
    };

    const layoutType = style ? (layoutTypeMap[style] || 'grid') : 'grid';

    // Backend expects: { layout_type, products[], canvas_width, canvas_height }
    const response = await this.client.post(
      ENDPOINTS.LAYOUT,
      {
        layout_type: layoutType,
        products: products.map(p => ({ id: p.id, name: p.name || 'Product' })),
        canvas_width: canvasSize.width,
        canvas_height: canvasSize.height,
      },
      { timeout: TIMEOUTS.AI }
    );

    // Backend returns: { layout_type, canvas_size, products[] }
    // Transform to frontend expected format
    return {
      positions: (response.data.products || []).map((p: any) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        rotation: p.rotation,
        z_index: p.z_index,
      })),
    };
  }

  // ============================================================================
  // MOODBOARD CRUD - All use /api/moodboards with ?id= query param
  // ============================================================================

  // GET /api/moodboards -> { moodboards[] }
  async getMoodboards(): Promise<Moodboard[]> {
    const response = await this.client.get(ENDPOINTS.MOODBOARDS);
    return response.data.moodboards || [];
  }

  // GET /api/moodboards?id=xxx -> { moodboard }
  async getMoodboard(id: string): Promise<Moodboard> {
    const response = await this.client.get(ENDPOINTS.MOODBOARDS, { params: { id } });
    return response.data.moodboard;
  }

  // POST /api/moodboards { name, description?, user_id?, products?, theme?, canvas_size? } -> { moodboard }
  async createMoodboard(data: Partial<Moodboard>): Promise<Moodboard> {
    const response = await this.client.post(ENDPOINTS.MOODBOARDS, data);
    return response.data.moodboard;
  }

  // PUT /api/moodboards?id=xxx { ...fields } -> { moodboard }
  async updateMoodboard(id: string, data: Partial<Moodboard>): Promise<Moodboard> {
    const response = await this.client.put(ENDPOINTS.MOODBOARDS, data, { params: { id } });
    return response.data.moodboard;
  }

  // DELETE /api/moodboards?id=xxx -> { success: true }
  async deleteMoodboard(id: string): Promise<void> {
    await this.client.delete(ENDPOINTS.MOODBOARDS, { params: { id } });
  }
}

export const api = new ApiClient();
export default api;
