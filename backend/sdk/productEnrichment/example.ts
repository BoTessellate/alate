/**
 * Example Usage - Product Enrichment SDK
 * Demonstrates how to use the enrichment engine
 */

import * as dotenv from 'dotenv';
import { createEnrichmentEngine } from './enrichProduct';
import { RawProductInput } from './types';

// Load environment variables
dotenv.config();

async function main() {
  // Initialize enrichment engine
  const engine = createEnrichmentEngine({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_KEY!
  });

  console.log('🚀 Product Enrichment SDK - Example Usage\n');

  // Example 1: Enrich a single product
  console.log('--- Example 1: Enrich Single Product ---');
  const product1: RawProductInput = {
    product_name: 'Handwoven Ikat Cushion',
    brand: 'Amala Earth',
    category: 'home',
    price: 799,
    region: 'India',
    dimensions: '40x40cm'
  };

  try {
    const enriched1 = await engine.enrichProduct(product1);
    console.log('✅ Enriched Product:');
    console.log(JSON.stringify(enriched1, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Example 2: Enrich and save to database
  console.log('\n--- Example 2: Enrich and Save ---');
  const product2: RawProductInput = {
    product_name: 'Ceramic Matte Black Vase',
    brand: 'Studio Pottery',
    category: 'home',
    price: 1200,
    region: 'Japan',
    dimensions: '25cm height'
  };

  try {
    const saved = await engine.enrichAndSave(product2);
    console.log('✅ Saved to Database with ID:', saved.id);
    console.log(JSON.stringify(saved, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Example 3: Batch enrichment
  console.log('\n--- Example 3: Batch Enrichment ---');
  const products: RawProductInput[] = [
    {
      product_name: 'Organic Cotton Kurta',
      brand: 'FabIndia',
      category: 'fashion',
      price: 1499,
      region: 'India'
    },
    {
      product_name: 'Wooden Alphabet Blocks',
      brand: 'Kinder Toys',
      category: 'kids',
      price: 599,
      region: 'Germany'
    },
    {
      product_name: 'Silk Embroidered Saree',
      brand: 'Sabyasachi',
      category: 'fashion',
      price: 25000,
      region: 'India'
    }
  ];

  try {
    const enrichedBatch = await engine.enrichBatch(products);
    console.log(`✅ Enriched ${enrichedBatch.length} products`);
    enrichedBatch.forEach((p, i) => {
      console.log(`\nProduct ${i + 1}: ${p.product_name}`);
      console.log(`  Colors: ${p.color_palette?.join(', ')}`);
      console.log(`  Tags: ${p.tags?.join(', ')}`);
      console.log(`  Tone: ${p.tone}`);
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n✨ Example completed!');
}

// Run the example
main().catch(console.error);
