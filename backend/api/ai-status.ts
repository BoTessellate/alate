/**
 * AI Provider Status Check API
 * Returns health status for all AI providers (Claude, Gemini, OpenAI)
 * Uses minimal API calls to check connectivity (costs ~$0.01 per full check)
 * Results are cached for 5 minutes to minimize costs
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

// Cache status for 24 hours (build mode)
let cachedStatus: AIProviderStatus | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (once per day during build mode)

interface ProviderStatus {
  available: boolean;
  configured: boolean;
  latencyMs?: number;
  error?: string;
  model?: string;
  lastChecked?: string;
}

interface AIProviderStatus {
  anthropic: ProviderStatus;
  gemini: ProviderStatus;
  openai: ProviderStatus;
  timestamp: string;
  cached: boolean;
}

async function checkAnthropic(): Promise<ProviderStatus> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return { available: false, configured: false, error: 'API key not configured' };
  }

  const start = Date.now();
  try {
    const anthropic = new Anthropic({ apiKey });

    // Minimal API call - just enough to verify connectivity
    // Using a very short prompt to minimize cost
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307', // Use cheapest model for status check
      max_tokens: 5,
      messages: [{ role: 'user', content: 'Reply with OK' }],
    });

    const latencyMs = Date.now() - start;
    return {
      available: true,
      configured: true,
      latencyMs,
      model: process.env.ENRICHMENT_MODEL || 'claude-opus-4-5-20251101',
      lastChecked: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      available: false,
      configured: true,
      latencyMs: Date.now() - start,
      error: error.message || 'Connection failed',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkGemini(): Promise<ProviderStatus> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { available: false, configured: false, error: 'API key not configured' };
  }

  const start = Date.now();
  try {
    const gemini = new GoogleGenerativeAI(apiKey);

    // Use a cheap text model for status check
    const model = gemini.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    // Minimal prompt
    const result = await model.generateContent('Reply with OK');
    await result.response;

    const latencyMs = Date.now() - start;
    return {
      available: true,
      configured: true,
      latencyMs,
      model: process.env.GEMINI_ENRICHMENT_MODEL || 'gemini-2.5-flash',
      lastChecked: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      available: false,
      configured: true,
      latencyMs: Date.now() - start,
      error: error.message || 'Connection failed',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkOpenAI(): Promise<ProviderStatus> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return { available: false, configured: false, error: 'API key not configured' };
  }

  const start = Date.now();
  try {
    const openai = new OpenAI({ apiKey });

    // Use models list endpoint (free) or a minimal chat completion
    const models = await openai.models.list();

    const latencyMs = Date.now() - start;
    const hasImageModel = models.data.some(m => m.id.includes('gpt-image') || m.id.includes('dall-e'));

    return {
      available: true,
      configured: true,
      latencyMs,
      model: hasImageModel ? 'gpt-image-1' : 'models available',
      lastChecked: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      available: false,
      configured: true,
      latencyMs: Date.now() - start,
      error: error.message || 'Connection failed',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function getProviderStatus(forceRefresh = false): Promise<AIProviderStatus> {
  const now = Date.now();

  // Return cached status if still valid
  if (!forceRefresh && cachedStatus && (now - cacheTimestamp) < CACHE_TTL) {
    return { ...cachedStatus, cached: true };
  }

  // Check all providers in parallel
  const [anthropic, gemini, openai] = await Promise.all([
    checkAnthropic(),
    checkGemini(),
    checkOpenAI(),
  ]);

  const status: AIProviderStatus = {
    anthropic,
    gemini,
    openai,
    timestamp: new Date().toISOString(),
    cached: false,
  };

  // Cache the result
  cachedStatus = status;
  cacheTimestamp = now;

  return status;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const forceRefresh = req.query.refresh === 'true';
    const status = await getProviderStatus(forceRefresh);

    // Calculate summary
    const configuredCount = [status.anthropic, status.gemini, status.openai]
      .filter(p => p.configured).length;
    const availableCount = [status.anthropic, status.gemini, status.openai]
      .filter(p => p.available).length;

    return res.status(200).json({
      ...status,
      summary: {
        total: 3,
        configured: configuredCount,
        available: availableCount,
        health: availableCount === 0 ? 'critical' : availableCount < configuredCount ? 'degraded' : 'healthy',
      },
      fallbackStatus: {
        enrichment: status.anthropic.available ? 'Claude' : status.gemini.available ? 'Gemini (fallback)' : 'unavailable',
        imageGen: status.openai.available ? 'OpenAI' : status.gemini.available ? 'Gemini (fallback)' : 'unavailable',
        virtualTryOn: status.gemini.available ? 'Gemini' : status.openai.available ? 'OpenAI (fallback)' : 'unavailable',
      },
    });
  } catch (error: any) {
    console.error('AI status check failed:', error);
    return res.status(500).json({
      error: 'Failed to check AI provider status',
      message: error.message,
    });
  }
}
