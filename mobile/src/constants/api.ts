/**
 * API Configuration Constants
 */

// Base URLs
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://backend-alate.vercel.app';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// API Endpoints
export const ENDPOINTS = {
  AI: '/api/ai',
  SEARCH: '/api/search',
  BRAND_NUDGE: '/api/brand-nudge',
} as const;

// Request timeouts (ms)
export const TIMEOUTS = {
  DEFAULT: 30000,
  SCRAPE: 60000,
  AI: 45000,
  UPLOAD: 120000,
} as const;
