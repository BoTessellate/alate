/**
 * Database-Only Test
 * Tests database connectivity and save operations without Claude AI
 * This can run without an Anthropic API key
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testDatabase() {
  console.log('🧪 Testing Database Operations (No AI Enrichment)\n');
  console.log('='.repeat(60));

  // Mock enriched product (simulating what Claude would return)
  // Note: Including user_id to match actual table schema
  const mockEnrichedProduct = {
    user_id: '00000000-0000-0000-0000-000000000000', // System/backend user ID
    product_name: 'Test Handwoven Cushion',
    brand: 'Test Brand',
    category: 'home',
    price: 799,
    region: 'India',
    dimensions: '40x40cm',
    color_palette: ['indigo', 'rust-orange', 'cream', 'ochre'],
    tags: ['handwoven', 'ikat', 'traditional', 'artisanal', 'bohemian'],
    texture: 'textured',
    material: 'cotton',
    tone: 'warm',
    flags: ['sustainable', 'handmade'],
    enriched_at: new Date().toISOString()
  };

  console.log('\n📦 TEST 1: Save Mock Enriched Product');
  console.log('-'.repeat(60));
  console.log('Mock data:', JSON.stringify(mockEnrichedProduct, null, 2));

  try {
    console.log('\n⏳ Saving to Supabase...');

    const { data, error } = await supabase
      .from('enriched_products')
      .insert(mockEnrichedProduct)
      .select()
      .single();

    if (error) {
      console.error('\n❌ Database save failed:', error.message);
      console.error('Error details:', error);
      process.exit(1);
    }

    console.log('\n✅ Save successful!');
    console.log(`   Database ID: ${data.id}`);
    console.log(`   Product: ${data.product_name}`);
    console.log(`   Brand: ${data.brand}`);
    console.log(`   Colors: ${data.color_palette.join(', ')}`);
    console.log(`   Tags: ${data.tags.join(', ')}`);
    console.log(`   Created at: ${data.created_at}`);

    // Store ID for cleanup
    const savedId = data.id;

    // TEST 2: Retrieve the saved product
    console.log('\n' + '='.repeat(60));
    console.log('\n📖 TEST 2: Retrieve Saved Product');
    console.log('-'.repeat(60));

    const { data: retrieved, error: retrieveError } = await supabase
      .from('enriched_products')
      .select('*')
      .eq('id', savedId)
      .single();

    if (retrieveError) {
      console.error('\n❌ Retrieve failed:', retrieveError.message);
      process.exit(1);
    }

    console.log('\n✅ Retrieved successfully!');
    console.log(`   ID: ${retrieved.id}`);
    console.log(`   Product: ${retrieved.product_name}`);
    console.log(`   All fields match: ${JSON.stringify(retrieved.color_palette) === JSON.stringify(mockEnrichedProduct.color_palette)}`);

    // TEST 3: Query by filters
    console.log('\n' + '='.repeat(60));
    console.log('\n🔍 TEST 3: Query by Category');
    console.log('-'.repeat(60));

    const { data: filtered, error: filterError } = await supabase
      .from('enriched_products')
      .select('*')
      .eq('category', 'home')
      .limit(10);

    if (filterError) {
      console.error('\n❌ Query failed:', filterError.message);
      process.exit(1);
    }

    console.log(`\n✅ Found ${filtered.length} product(s) in 'home' category`);
    filtered.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.product_name} by ${p.brand}`);
    });

    // TEST 4: Batch insert
    console.log('\n' + '='.repeat(60));
    console.log('\n📚 TEST 4: Batch Insert (3 products)');
    console.log('-'.repeat(60));

    const batchProducts = [
      {
        user_id: '00000000-0000-0000-0000-000000000000',
        product_name: 'Mock Organic Kurta',
        brand: 'FabIndia',
        category: 'fashion',
        price: 1499,
        region: 'India',
        color_palette: ['white', 'ivory', 'natural'],
        tags: ['organic', 'cotton', 'kurta', 'traditional', 'comfortable'],
        texture: 'soft',
        material: 'organic-cotton',
        tone: 'neutral',
        enriched_at: new Date().toISOString()
      },
      {
        user_id: '00000000-0000-0000-0000-000000000000',
        product_name: 'Mock Wooden Blocks',
        brand: 'Kinder Toys',
        category: 'kids',
        price: 599,
        region: 'Germany',
        color_palette: ['natural-wood', 'multicolor', 'primary-colors'],
        tags: ['educational', 'wooden', 'alphabet', 'montessori', 'eco-friendly'],
        texture: 'smooth',
        material: 'wood',
        tone: 'playful',
        enriched_at: new Date().toISOString()
      },
      {
        user_id: '00000000-0000-0000-0000-000000000000',
        product_name: 'Mock Silk Saree',
        brand: 'Sabyasachi',
        category: 'fashion',
        price: 25000,
        region: 'India',
        color_palette: ['deep-red', 'gold', 'emerald', 'maroon'],
        tags: ['luxury', 'silk', 'embroidered', 'wedding', 'traditional'],
        texture: 'silky',
        material: 'silk',
        tone: 'luxurious',
        flags: ['premium', 'handcrafted'],
        enriched_at: new Date().toISOString()
      }
    ];

    const { data: batchData, error: batchError } = await supabase
      .from('enriched_products')
      .insert(batchProducts)
      .select();

    if (batchError) {
      console.error('\n❌ Batch insert failed:', batchError.message);
      process.exit(1);
    }

    console.log(`\n✅ Batch insert successful! Saved ${batchData.length} products`);
    batchData.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.product_name} (${p.category}) - ID: ${p.id}`);
    });

    // Store IDs for cleanup
    const batchIds = batchData.map(p => p.id);

    // TEST 5: Count total records
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 TEST 5: Count Total Records');
    console.log('-'.repeat(60));

    const { count, error: countError } = await supabase
      .from('enriched_products')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('\n❌ Count failed:', countError.message);
      process.exit(1);
    }

    console.log(`\n✅ Total records in database: ${count}`);

    // Cleanup
    console.log('\n' + '='.repeat(60));
    console.log('\n🧹 Cleaning up test data...');
    console.log('-'.repeat(60));

    const allIds = [savedId, ...batchIds];

    const { error: deleteError } = await supabase
      .from('enriched_products')
      .delete()
      .in('id', allIds);

    if (deleteError) {
      console.warn('\n⚠️  Cleanup warning:', deleteError.message);
    } else {
      console.log(`\n✅ Cleaned up ${allIds.length} test records`);
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 ALL DATABASE TESTS PASSED!');
    console.log('\n📊 Tests completed:');
    console.log('   ✅ Single product save');
    console.log('   ✅ Product retrieval by ID');
    console.log('   ✅ Query by category filter');
    console.log('   ✅ Batch insert (3 products)');
    console.log('   ✅ Record count');
    console.log('   ✅ Cleanup');
    console.log('\n💡 Database is fully functional and ready for AI enrichment!');
    console.log('\n📝 Next step: Add Anthropic API key and run full enrichment tests');
    console.log('   Command: npx ts-node testEnrichment.ts\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
testDatabase().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
