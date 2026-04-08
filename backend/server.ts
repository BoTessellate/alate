/**
 * Local Development Server
 * Routes requests to Vercel serverless function handlers
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initSentry } from './sdk/shared/sentryInit';

// Initialise Sentry before anything else so all errors are captured
initSentry();

// Import handlers
import aiHandler from './api/ai';
import searchHandler from './api/search';
import imageProcessingHandler from './api/image-processing';
import shopifyHandler from './api/shopify';
import shopifyCallbackHandler from './api/shopify-callback';
import shopifyWebhooksHandler from './api/shopify-webhooks';
import removeBackgroundHandler from './api/remove-background';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Route handlers - wrap Vercel handlers for Express
// WHY: Vercel handlers use VercelRequest/VercelResponse, Express uses Request/Response
// This wrapper adapts between the two while maintaining type safety
type VercelHandler = (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>;

const wrapHandler = (handler: VercelHandler) => async (req: Request, res: Response) => {
  try {
    // Cast Express req/res to Vercel types (compatible interfaces)
    await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Handler error:', message, error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// API Routes
app.all('/api/ai', wrapHandler(aiHandler));
app.all('/api/search', wrapHandler(searchHandler));
app.all('/api/image-processing', wrapHandler(imageProcessingHandler));
app.all('/api/shopify', wrapHandler(shopifyHandler));
app.all('/api/shopify-callback', wrapHandler(shopifyCallbackHandler));
app.all('/api/shopify-webhooks', wrapHandler(shopifyWebhooksHandler));
app.all('/api/remove-background', wrapHandler(removeBackgroundHandler));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend API running at http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎨 AI endpoint: http://localhost:${PORT}/api/ai?action=enrich`);
});

export default app;
