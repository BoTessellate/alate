/**
 * API Configuration Constants
 */

// Base URLs - update these for your environment
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://backend-ramsaptamis-projects.vercel.app';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// API Endpoints
export const ENDPOINTS = {
  // Scraping
  SCRAPE: '/api/scrape',

  // AI Features
  ENRICH: '/api/enrich',
  SEARCH: '/api/search',
  SMART_LABELS: '/api/smart-labels',
  THEME: '/api/theme',
  LAYOUT: '/api/layout',

  // Moodboard management
  MOODBOARDS: '/api/moodboards',
  PRODUCTS: '/api/products',

  // Auth
  AUTH: '/api/auth',
} as const;

// Request timeouts (ms)
export const TIMEOUTS = {
  DEFAULT: 30000,
  SCRAPE: 60000,
  AI: 45000,
  UPLOAD: 120000,
} as const;
