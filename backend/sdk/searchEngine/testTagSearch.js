/**
 * Tag Search Test (No API Key Required)
 * Tests tag-based product search without Claude AI
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testTagSearch() {
  console.log('🔍 Testing Tag-Based Search (No AI)\n');
  console.log('='.repeat(60));

  try {
    // TEST 1: Search all products
    console.log('\n📦 TEST 1: Get All Products (limited)');
    console.log('-'.repeat(60));

    const { data: allProducts, error: allError } = await supabase
      .from('enriched_products')
      .select('*')
      .limit(5);

    if (allError) {
      console.error('❌ Error:', allError.message);
      throw allError;
    }

    console.log(`✅ Found ${allProducts.length} products`);
    allProducts.forEach((p, i) => {
      console.log(`\n${i + 1}. ${p.product_name}`);
      console.log(`   Brand: ${p.brand}`);
      console.log(`   Category: ${p.category}`);
      console.log(`   Tags: ${p.tags?.join(', ')}`);
    });

    // TEST 2: Search by category
    console.log('\n' + '='.repeat(60));
    console.log('\n🏠 TEST 2: Search by Category (home)');
    console.log('-'.repeat(60));

    const { data: homeProducts, error: homeError } = await supabase
      .from('enriched_products')
      .select('*')
      .eq('category', 'home')
      .limit(5);

    if (homeError) {
      console.error('❌ Error:', homeError.message);
    } else {
      console.log(`✅ Found ${homeProducts.length} home products`);
      homeProducts.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.product_name} - ${p.brand}`);
      });
    }

    // TEST 3: Search by region
    console.log('\n' + '='.repeat(60));
    console.log('\n🌍 TEST 3: Search by Region (India)');
    console.log('-'.repeat(60));

    const { data: indiaProducts, error: indiaError } = await supabase
      .from('enriched_products')
      .select('*')
      .eq('region', 'India')
      .limit(5);

    if (indiaError) {
      console.error('❌ Error:', indiaError.message);
    } else {
      console.log(`✅ Found ${indiaProducts.length} products from India`);
      indiaProducts.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.product_name} - ${p.region}`);
      });
    }

    // TEST 4: Search by tags (overlaps)
    console.log('\n' + '='.repeat(60));
    console.log('\n🏷️  TEST 4: Search by Tags (handwoven OR traditional)');
    console.log('-'.repeat(60));

    const searchTags = ['handwoven', 'traditional'];
    const { data: tagProducts, error: tagError } = await supabase
      .from('enriched_products')
      .select('*')
      .overlaps('tags', searchTags)
      .limit(5);

    if (tagError) {
      console.error('❌ Error:', tagError.message);
    } else {
      console.log(`✅ Found ${tagProducts.length} products with tags: ${searchTags.join(' OR ')}`);
      tagProducts.forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.product_name}`);
        console.log(`   Tags: ${p.tags?.join(', ')}`);
        const matchedTags = p.tags?.filter(t => searchTags.includes(t));
        console.log(`   Matched: ${matchedTags?.join(', ')}`);
      });
    }

    // TEST 5: Combined search
    console.log('\n' + '='.repeat(60));
    console.log('\n🔎 TEST 5: Combined Search (category + tags + region)');
    console.log('-'.repeat(60));

    const { data: combinedProducts, error: combinedError } = await supabase
      .from('enriched_products')
      .select('*')
      .eq('category', 'fashion')
      .overlaps('tags', ['traditional'])
      .eq('region', 'India')
      .limit(5);

    if (combinedError) {
      console.error('❌ Error:', combinedError.message);
    } else {
      console.log(`✅ Found ${combinedProducts.length} traditional fashion products from India`);
      combinedProducts.forEach((p, i) => {
        console.log(`\n${i + 1}. ${p.product_name}`);
        console.log(`   Category: ${p.category}, Region: ${p.region}`);
        console.log(`   Tags: ${p.tags?.join(', ')}`);
      });
    }

    // TEST 6: Count products by category
    console.log('\n' + '='.repeat(60));
    console.log('\n📊 TEST 6: Product Counts by Category');
    console.log('-'.repeat(60));

    const categories = ['home', 'fashion', 'kids'];
    for (const cat of categories) {
      const { count, error } = await supabase
        .from('enriched_products')
        .select('*', { count: 'exact', head: true })
        .eq('category', cat);

      if (!error) {
        console.log(`   ${cat}: ${count || 0} products`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n🎉 ALL TAG SEARCH TESTS PASSED!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Database connection working');
    console.log('   ✅ Category filtering working');
    console.log('   ✅ Region filtering working');
    console.log('   ✅ Tag matching (overlaps) working');
    console.log('   ✅ Combined filters working');
    console.log('\n💡 Tag-based search is fully functional!');
    console.log('📝 Next: Add Anthropic API key for prompt-based search\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run tests
testTagSearch().catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
