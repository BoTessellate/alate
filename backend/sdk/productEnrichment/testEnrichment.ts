/**
 * Test Product Enrichment Pipeline
 * Complete end-to-end test with real data
 */

import * as dotenv from 'dotenv';
import { createEnrichmentEngine } from './enrichProduct';
import { RawProductInput } from './types';

// Load environment variables
dotenv.config();

async function testEnrichment() {
  console.log('🧪 Testing Product Enrichment Pipeline\n');
  console.log('='.repeat(60));

  // Check API keys
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
    console.error('❌ ANTHROPIC_API_KEY not set in .env file');
    console.log('\n📝 Please add your Anthropic API key to .env:');
    console.log('   ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    console.error('❌ Supabase credentials not set in .env file');
    process.exit(1);
  }

  console.log('✅ API keys configured\n');

  // Initialize engine
  const engine = createEnrichmentEngine({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_KEY
  });

  console.log('✅ Enrichment engine initialized\n');
  console.log('='.repeat(60));

  // Test 1: Enrich a single product
  console.log('\n📦 TEST 1: Enrich Single Product');
  console.log('-'.repeat(60));

  const testProduct: RawProductInput = {
    product_name: 'Handwoven Ikat Cushion',
    brand: 'Amala Earth',
    category: 'home',
    price: 799,
    region: 'India',
    dimensions: '40x40cm'
  };

  console.log('Input:', JSON.stringify(testProduct, null, 2));

  try {
    console.log('\n⏳ Calling Claude AI for enrichment...');
    const enriched = await engine.enrichProduct(testProduct);

    console.log('\n✅ Enrichment successful!');
    console.log('\n🎨 Enriched Fields:');
    console.log(`   Colors: ${enriched.color_palette?.join(', ')}`);
    console.log(`   Tags: ${enriched.tags?.join(', ')}`);
    console.log(`   Texture: ${enriched.texture}`);
    console.log(`   Material: ${enriched.material}`);
    console.log(`   Tone: ${enriched.tone}`);
    console.log(`   Enriched at: ${enriched.enriched_at}`);

    // Test 2: Save to database
    console.log('\n' + '='.repeat(60));
    console.log('\n💾 TEST 2: Save to Database');
    console.log('-'.repeat(60));

    console.log('⏳ Saving to Supabase...');
    const saved = await engine.saveToDatabase(enriched);

    console.log('\n✅ Saved successfully!');
    console.log(`   Database ID: ${saved.id}`);
    console.log(`   Created at: ${saved.created_at}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('API key')) {
      console.log('\n💡 Tip: Check your Anthropic API key in .env file');
    }
    process.exit(1);
  }

  // Test 3: Enrich and save in one call
  console.log('\n' + '='.repeat(60));
  console.log('\n🚀 TEST 3: Enrich + Save Pipeline');
  console.log('-'.repeat(60));

  const product2: RawProductInput = {
    product_name: 'Ceramic Matte Black Vase',
    brand: 'Studio Pottery',
    category: 'home',
    price: 1200,
    region: 'Japan',
    dimensions: '25cm height'
  };

  console.log('Input:', JSON.stringify(product2, null, 2));

  try {
    console.log('\n⏳ Running end-to-end pipeline...');
    const result = await engine.enrichAndSave(product2);

    console.log('\n✅ Pipeline completed!');
    console.log(`   Product: ${result.product_name}`);
    console.log(`   ID: ${result.id}`);
    console.log(`   Colors: ${result.color_palette?.join(', ')}`);
    console.log(`   Tags: ${result.tags?.join(', ')}`);
    console.log(`   Tone: ${result.tone}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }

  // Test 4: Batch processing
  console.log('\n' + '='.repeat(60));
  console.log('\n📚 TEST 4: Batch Enrichment (3 products)');
  console.log('-'.repeat(60));

  const batchProducts: RawProductInput[] = [
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

  console.log(`Processing ${batchProducts.length} products...`);

  try {
    console.log('\n⏳ Batch enrichment in progress...');
    const enrichedBatch = await engine.enrichBatch(batchProducts);

    console.log(`\n✅ Enriched ${enrichedBatch.length} products!`);

    enrichedBatch.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.product_name}`);
      console.log(`   Brand: ${p.brand}`);
      console.log(`   Colors: ${p.color_palette?.join(', ')}`);
      console.log(`   Tags: ${p.tags?.join(', ')}`);
      console.log(`   Tone: ${p.tone}`);
    });

    // Save batch
    console.log('\n⏳ Saving batch to database...');
    await engine.saveToDatabase(enrichedBatch[0]);
    await engine.saveToDatabase(enrichedBatch[1]);
    await engine.saveToDatabase(enrichedBatch[2]);

    console.log('✅ All products saved!');

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n🎉 ALL TESTS PASSED!');
  console.log('\n📊 Summary:');
  console.log('   ✅ Single product enrichment');
  console.log('   ✅ Database save operation');
  console.log('   ✅ End-to-end pipeline');
  console.log('   ✅ Batch processing (3 products)');
  console.log('\n💡 Total products enriched and saved: 5');
  console.log('\n✨ Product Enrichment SDK is fully functional!\n');
}

// Run tests
testEnrichment().catch((error) => {
  console.error('\n❌ Test failed:', error);
  process.exit(1);
});
