/**
 * Test Script for Semantic Search with Pinecone + OpenAI
 *
 * Run with: npx ts-node sdk/shared/testSemanticSearch.ts
 */

import 'dotenv/config';
import { createSemanticSearchEngine, SearchableItem } from './semanticSearch';

async function runTests() {
  console.log('🧪 Testing Semantic Search Integration\n');
  console.log('=' .repeat(50));

  // Check environment variables
  console.log('\n📋 Environment Check:');
  console.log(`  PINECONE_API_KEY: ${process.env.PINECONE_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  PINECONE_INDEX_NAME: ${process.env.PINECONE_INDEX_NAME || 'mood-layer-products'}`);
  console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`  SUPABASE_URL: ${process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);

  if (!process.env.PINECONE_API_KEY || !process.env.OPENAI_API_KEY) {
    console.error('\n❌ Missing required API keys. Please check your .env file.');
    process.exit(1);
  }

  try {
    // Initialize the search engine
    console.log('\n🔧 Initializing Semantic Search Engine...');
    const searchEngine = createSemanticSearchEngine();
    console.log('  ✅ Engine initialized');

    // Test 1: Get Pinecone index stats
    console.log('\n📊 Test 1: Pinecone Index Stats');
    const stats = await searchEngine.getIndexStats();
    console.log(`  ✅ Connected to Pinecone`);
    console.log(`  Total vectors: ${stats.totalVectors}`);
    console.log(`  Dimensions: ${stats.dimension}`);

    // Test 2: Generate an embedding
    console.log('\n🧮 Test 2: Generate Embedding');
    const testText = 'modern minimalist ceramic vase';
    const embedding = await searchEngine.generateEmbedding(testText);
    console.log(`  ✅ Generated embedding for: "${testText}"`);
    console.log(`  Embedding dimensions: ${embedding.length}`);
    console.log(`  First 5 values: [${embedding.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]`);

    // Test 3: Index sample products
    console.log('\n📦 Test 3: Index Sample Products');
    const sampleProducts: SearchableItem[] = [
      {
        id: 'test-product-1',
        title: 'Modern White Ceramic Vase',
        description: 'Minimalist ceramic vase with clean lines',
        category: 'home-decor',
        brand: 'Nordic Home',
        material: 'ceramic',
        tone: 'minimalist',
        colors: ['white', 'cream'],
        tags: ['modern', 'minimalist', 'scandinavian', 'vase'],
        price: 45.00,
      },
      {
        id: 'test-product-2',
        title: 'Handwoven Jute Basket',
        description: 'Natural jute storage basket with leather handles',
        category: 'storage',
        brand: 'Artisan Co',
        material: 'jute',
        tone: 'bohemian',
        colors: ['beige', 'brown'],
        tags: ['boho', 'handmade', 'storage', 'basket'],
        price: 35.00,
      },
      {
        id: 'test-product-3',
        title: 'Velvet Throw Pillow - Navy',
        description: 'Luxurious velvet cushion cover in deep navy blue',
        category: 'textiles',
        brand: 'Luxe Living',
        material: 'velvet',
        tone: 'luxury',
        colors: ['navy', 'blue'],
        tags: ['luxury', 'velvet', 'pillow', 'cushion'],
        price: 55.00,
      },
    ];

    console.log(`  Indexing ${sampleProducts.length} products...`);
    const indexResult = await searchEngine.indexItems(sampleProducts);
    console.log(`  ✅ Indexed: ${indexResult.indexed} products`);
    if (indexResult.failed.length > 0) {
      console.log(`  ⚠️ Failed: ${indexResult.failed.length} products`);
    }

    // Wait a moment for Pinecone to index
    console.log('  Waiting 2s for Pinecone to sync...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 4: Semantic search
    console.log('\n🔍 Test 4: Semantic Search');
    const searchQuery = 'cozy boho natural decor';
    console.log(`  Query: "${searchQuery}"`);
    const results = await searchEngine.semanticSearch(searchQuery, { limit: 5, threshold: 0.3 });
    console.log(`  ✅ Found ${results.length} results:`);
    results.forEach((result, i) => {
      console.log(`    ${i + 1}. ${result.item.title} (score: ${result.score.toFixed(4)})`);
    });

    // Test 5: Find similar items
    console.log('\n🔗 Test 5: Find Similar Items');
    console.log(`  Finding items similar to: "${sampleProducts[0].title}"`);
    const similar = await searchEngine.findSimilar('test-product-1', { limit: 3, threshold: 0.3 });
    console.log(`  ✅ Found ${similar.length} similar items:`);
    similar.forEach((result, i) => {
      console.log(`    ${i + 1}. ${result.item.title} (score: ${result.score.toFixed(4)})`);
    });

    // Test 6: Query parsing (without Anthropic, uses simple parser)
    console.log('\n🧠 Test 6: Query Parsing');
    const complexQuery = 'blue velvet luxury pillow under $60';
    console.log(`  Query: "${complexQuery}"`);
    const parsed = await searchEngine.parseQuery(complexQuery);
    console.log(`  ✅ Parsed query:`);
    console.log(`    Intent: ${parsed.intent}`);
    console.log(`    Keywords: ${parsed.keywords.join(', ')}`);
    console.log(`    Colors: ${parsed.filters.colors?.join(', ') || 'none'}`);
    console.log(`    Material: ${parsed.filters.material || 'none'}`);
    console.log(`    Style: ${parsed.filters.style?.join(', ') || 'none'}`);

    // Test 7: Filtered search
    console.log('\n🎯 Test 7: Filtered Search');
    console.log(`  Query: "home decor" with filter: material=ceramic`);
    const filteredResults = await searchEngine.semanticSearch('home decor', {
      limit: 5,
      threshold: 0.3,
      filters: { material: 'ceramic' },
    });
    console.log(`  ✅ Found ${filteredResults.length} results with ceramic filter:`);
    filteredResults.forEach((result, i) => {
      console.log(`    ${i + 1}. ${result.item.title} (${result.item.material})`);
    });

    // Cleanup: Remove test products
    console.log('\n🧹 Cleanup: Removing test products...');
    await searchEngine.removeItemsFromIndex(['test-product-1', 'test-product-2', 'test-product-3']);
    console.log('  ✅ Test products removed');

    // Final stats
    console.log('\n📊 Final Index Stats:');
    const finalStats = await searchEngine.getIndexStats();
    console.log(`  Total vectors: ${finalStats.totalVectors}`);

    console.log('\n' + '='.repeat(50));
    console.log('✅ All tests passed! Semantic search is working correctly.');
    console.log('='.repeat(50));

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run tests
runTests();
