/**
 * Import January 2025 Trending Products
 *
 * This script imports products from the january_products.csv file,
 * enriches them using the ProductEnrichmentEngine, and saves to the database.
 *
 * Usage:
 *   npx ts-node importJanuaryProducts.ts
 */

import * as dotenv from 'dotenv';
import { createEnrichmentEngine, ProductEnrichmentEngine } from './enrichProduct';
import { RawProductInput } from './types';

// Load environment variables
dotenv.config({ path: '../../.env' });
dotenv.config();

// January 2025 Trending Products from CSV
const JANUARY_PRODUCTS: RawProductInput[] = [
  {
    product_name: 'Redmi Note 15 5G',
    brand: 'Redmi',
    category: 'tech',
    region: 'Global',
  },
  {
    product_name: 'Realme 16 Pro',
    brand: 'Realme',
    category: 'tech',
    region: 'Global',
  },
  {
    product_name: 'Honor Power 2',
    brand: 'Honor',
    category: 'tech',
    region: 'Global',
  },
  {
    product_name: 'Samsung Galaxy S26',
    brand: 'Samsung',
    category: 'tech',
    region: 'Global',
  },
  {
    product_name: 'Smart Ring Gen 4',
    brand: 'Oura',
    category: 'wearables',
    region: 'Global',
  },
  {
    product_name: 'Mouth Tape Sleep Aid',
    brand: 'SleepWell',
    category: 'wellness',
    region: 'Global',
  },
  {
    product_name: 'Red Light Therapy Mask',
    brand: 'CurrentBody',
    category: 'beauty',
    region: 'Global',
  },
  {
    product_name: 'Candle Warmer Lamp',
    brand: 'CANDLE WARMERS ETC',
    category: 'home',
    region: 'Global',
  },
  {
    product_name: 'Predictive Energy Thermostat',
    brand: 'Nest',
    category: 'smart-home',
    region: 'Global',
  },
  {
    product_name: 'Weighted Stuffed Animal',
    brand: 'Warmies',
    category: 'toys',
    region: 'Global',
  },
];

// Metadata from CSV for reference (not used in enrichment but saved for logging)
const PRODUCT_METADATA: Record<string, { trendStatus: string; description: string }> = {
  'Redmi Note 15 5G': {
    trendStatus: 'Launching Jan 6',
    description: 'Mid-range 5G phone with 108MP camera and Snapdragon 6 Gen 3.',
  },
  'Realme 16 Pro': {
    trendStatus: 'Live/Buzzing',
    description: "Features new 'LumaColor' technology and 200MP camera.",
  },
  'Honor Power 2': {
    trendStatus: 'Niche Viral',
    description: 'Battery-centric phone with massive 10080mAh battery.',
  },
  'Samsung Galaxy S26': {
    trendStatus: 'Rumor/Hype',
    description: 'Next-gen flagship anticipated for late Jan/Feb reveal.',
  },
  'Smart Ring Gen 4': {
    trendStatus: 'Trending',
    description: 'Smart rings focusing on sleep apnea and smaller form factors.',
  },
  'Mouth Tape Sleep Aid': {
    trendStatus: 'Viral (TikTok)',
    description: 'Sleep aid for reducing snoring and improving jaw posture.',
  },
  'Red Light Therapy Mask': {
    trendStatus: 'Mainstream',
    description: 'LED masks for collagen production; moving from niche to standard care.',
  },
  'Candle Warmer Lamp': {
    trendStatus: 'Spiking',
    description: 'Fire-safe alternative to burning candles; highly giftable.',
  },
  'Predictive Energy Thermostat': {
    trendStatus: 'Utility',
    description: 'AI-driven thermostats that adjust based on grid pricing.',
  },
  'Weighted Stuffed Animal': {
    trendStatus: 'High Demand',
    description: 'Anxiety-relief plush toys for adults and kids.',
  },
};

async function importJanuaryProducts() {
  console.log('🚀 January 2025 Products Import\n');
  console.log('=' .repeat(50));

  // Validate environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials');
    console.log('   Set SUPABASE_URL and SUPABASE_KEY in your .env file');
    process.exit(1);
  }

  if (!anthropicKey && !geminiKey) {
    console.error('❌ Missing AI API key');
    console.log('   Set ANTHROPIC_API_KEY or GEMINI_API_KEY in your .env file');
    process.exit(1);
  }

  console.log(`\n📦 Products to import: ${JANUARY_PRODUCTS.length}`);
  console.log(`🤖 AI Provider: ${anthropicKey ? 'Claude (primary)' : 'Gemini (fallback)'}`);
  console.log(`🗄️  Database: ${supabaseUrl.replace('https://', '').split('.')[0]}\n`);

  // Initialize enrichment engine
  let engine: ProductEnrichmentEngine;
  try {
    engine = createEnrichmentEngine({
      anthropicApiKey: anthropicKey,
      geminiApiKey: geminiKey,
      supabaseUrl,
      supabaseKey,
    });
    console.log('✅ Enrichment engine initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize engine:', error);
    process.exit(1);
  }

  // Process each product
  const results: { success: string[]; failed: string[] } = { success: [], failed: [] };

  for (const product of JANUARY_PRODUCTS) {
    const meta = PRODUCT_METADATA[product.product_name];
    console.log(`\n📌 Processing: ${product.product_name}`);
    console.log(`   Brand: ${product.brand} | Category: ${product.category}`);
    if (meta) {
      console.log(`   Trend: ${meta.trendStatus}`);
    }

    try {
      // Enrich and save
      const enriched = await engine.enrichAndSave(product);

      console.log(`   ✅ Enriched & Saved (ID: ${enriched.id})`);
      console.log(`   🎨 Colors: ${enriched.color_palette?.join(', ')}`);
      console.log(`   🏷️  Tags: ${enriched.tags?.join(', ')}`);
      console.log(`   🎭 Tone: ${enriched.tone}`);

      results.success.push(product.product_name);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ Failed: ${errorMsg}`);
      results.failed.push(product.product_name);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Import Summary\n');
  console.log(`   ✅ Success: ${results.success.length}/${JANUARY_PRODUCTS.length}`);
  if (results.failed.length > 0) {
    console.log(`   ❌ Failed: ${results.failed.length}`);
    console.log(`      - ${results.failed.join('\n      - ')}`);
  }
  console.log('\n✨ Import complete!');
}

// Run the import
importJanuaryProducts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
