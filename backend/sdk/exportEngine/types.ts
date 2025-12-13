/**
 * Export Engine Types
 * Type definitions for moodboard export and rendering
 */

import { LayoutOutput } from '../layoutGenerator/types';

/**
 * Export format types
 */
export type ExportFormat = 'png' | 'jpg' | 'webp';

/**
 * Canvas size presets
 */
export type CanvasPreset = 'instagram-square' | 'instagram-portrait' | 'pinterest' | 'custom';

/**
 * Export request input
 */
export interface ExportRequest {
  layout?: LayoutOutput;      // Inline layout data
  layout_id?: string;          // Or layout ID to fetch from database
  canvas_size?: [number, number]; // [width, height] or use layout's canvas_size
  format?: ExportFormat;       // Default: 'png'
  background_color?: string;   // Default: '#f6e9cf'
  add_branding?: boolean;      // Add Mood Layer watermark (default: true for free tier)
  quality?: number;            // JPEG quality 0-100 (default: 90)
}

/**
 * Export response
 */
export interface ExportResponse {
  success: boolean;
  export_url?: string;         // CDN URL if uploaded
  buffer?: Buffer;             // PNG buffer if not uploaded
  width: number;
  height: number;
  format: ExportFormat;
  file_size?: number;          // In bytes
  generated_at: string;
}

/**
 * Rendering configuration
 */
export interface RenderConfig {
  background_color: string;
  default_font: string;
  label_font_size: number;
  label_font_color: string;
  add_branding: boolean;
  branding_position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  branding_padding: number;
}

/**
 * Font configuration
 */
export interface FontConfig {
  family: string;
  size: number;
  weight: string;
  color: string;
}

/**
 * Image load error
 */
export interface ImageLoadError {
  url: string;
  error: string;
}
