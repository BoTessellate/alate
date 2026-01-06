require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

console.log('URL:', url ? 'SET' : 'MISSING');
console.log('Key:', key ? 'SET' : 'MISSING');

if (!url || !key) {
  console.log('Missing Supabase credentials!');
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  console.log('Checking Shopify products enrichment...\n');

  // Get all Shopify products
  const { data, error, count } = await supabase
    .from('enriched_products')
    .select('product_name, platform, shop_domain, color_palette, tags, material, texture, tone, enriched_at', { count: 'exact' })
    .eq('platform', 'shopify')
    .limit(10);

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('Total Shopify products:', count || data?.length || 0);
  console.log('');

  if (!data || data.length === 0) {
    console.log('No Shopify products found!');
    return;
  }

  // Count enriched vs non-enriched
  const enriched = data.filter(p => p.enriched_at);
  const notEnriched = data.filter(p => !p.enriched_at);

  console.log('In this sample:');
  console.log('  Enriched:', enriched.length);
  console.log('  Not enriched:', notEnriched.length);
  console.log('');

  // Show first few products
  data.slice(0, 5).forEach((p, i) => {
    console.log(`--- Product ${i + 1} ---`);
    console.log('Name:', p.product_name);
    console.log('Shop:', p.shop_domain);
    console.log('enriched_at:', p.enriched_at || 'NULL (not enriched)');
    console.log('color_palette:', JSON.stringify(p.color_palette) || '[]');
    console.log('tags:', JSON.stringify(p.tags) || '[]');
    console.log('material:', p.material || 'NULL');
    console.log('texture:', p.texture || 'NULL');
    console.log('tone:', p.tone || 'NULL');
    console.log('');
  });
}

check().catch(console.error);
