/**
 * Local Development Server
 * Routes requests to Vercel serverless function handlers
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Import handlers
import aiHandler from './ai';
import scrapeHandler from './scrape';
import searchHandler from './search';
import moodboardsHandler from './moodboards';
import relatedProductsHandler from './related-products';
import aiStatusHandler from './ai-status';
import fetchImagesHandler from './fetch-images';
import imageProcessingHandler from './image-processing';
import shopifyHandler from './shopify';
import shopifyCallbackHandler from './shopify-callback';
import shopifyWebhooksHandler from './shopify-webhooks';

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
const wrapHandler = (handler: any) => async (req: any, res: any) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// API Routes
app.all('/api/ai', wrapHandler(aiHandler));
app.all('/api/scrape', wrapHandler(scrapeHandler));
app.all('/api/search', wrapHandler(searchHandler));
app.all('/api/moodboards', wrapHandler(moodboardsHandler));
app.all('/api/related-products', wrapHandler(relatedProductsHandler));
app.all('/api/ai-status', wrapHandler(aiStatusHandler));
app.all('/api/fetch-images', wrapHandler(fetchImagesHandler));
app.all('/api/image-processing', wrapHandler(imageProcessingHandler));
app.all('/api/shopify', wrapHandler(shopifyHandler));
app.all('/api/shopify-callback', wrapHandler(shopifyCallbackHandler));
app.all('/api/shopify-webhooks', wrapHandler(shopifyWebhooksHandler));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend API running at http://localhost:${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🎨 AI endpoint: http://localhost:${PORT}/api/ai?action=enrich`);
});

export default app;
