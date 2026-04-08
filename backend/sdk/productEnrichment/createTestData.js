/**
 * Create 30 test products in the database
 * All products prefixed with "test_" for easy identification
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 30 test products with complete enrichment data
const testProducts = [
  { product_name: 'test_handwoven_ikat_cushion', brand: 'test_amala_earth', category: 'home-decor', tags: ['handmade', 'boho', 'cushion', 'ikat', 'sustainable'], region: 'India', price: 1299, color_palette: ['#8B4513', '#F5DEB3', '#4682B4'], texture: 'woven', material: 'cotton', tone: 'warm' },
  { product_name: 'test_ceramic_tea_set', brand: 'test_ellementry', category: 'tableware', tags: ['ceramic', 'handmade', 'tea', 'minimal', 'artisan'], region: 'India', price: 2499, color_palette: ['#FFFFFF', '#F5F5DC', '#D3D3D3'], texture: 'smooth', material: 'ceramic', tone: 'neutral' },
  { product_name: 'test_modern_accent_chair', brand: 'test_urban_ladder', category: 'furniture', tags: ['modern', 'chair', 'furniture', 'minimal', 'comfort'], region: 'India', price: 8999, color_palette: ['#2F4F4F', '#D2B48C', '#000000'], texture: 'upholstered', material: 'fabric', tone: 'cool' },
  { product_name: 'test_brass_wall_hanging', brand: 'test_exclusivelane', category: 'home-decor', tags: ['brass', 'wall-art', 'traditional', 'handmade', 'ethnic'], region: 'India', price: 1799, color_palette: ['#B8860B', '#DAA520', '#CD7F32'], texture: 'metallic', material: 'brass', tone: 'warm' },
  { product_name: 'test_rattan_basket_set', brand: 'test_nestasia', category: 'storage', tags: ['rattan', 'storage', 'boho', 'natural', 'handwoven'], region: 'India', price: 999, color_palette: ['#D2691E', '#F4A460', '#8B4513'], texture: 'woven', material: 'rattan', tone: 'warm' },
  { product_name: 'test_macrame_wall_tapestry', brand: 'test_the_wishing_chair', category: 'home-decor', tags: ['macrame', 'boho', 'wall-art', 'handmade', 'textile'], region: 'India', price: 1599, color_palette: ['#F5F5DC', '#FFFACD', '#E6E6FA'], texture: 'knotted', material: 'cotton', tone: 'neutral' },
  { product_name: 'test_wooden_serving_tray', brand: 'test_purple_turtles', category: 'tableware', tags: ['wood', 'serving', 'handmade', 'minimal', 'natural'], region: 'India', price: 849, color_palette: ['#8B4513', '#D2691E', '#A0522D'], texture: 'smooth', material: 'wood', tone: 'warm' },
  { product_name: 'test_block_print_tablecloth', brand: 'test_fabindia', category: 'textiles', tags: ['block-print', 'tablecloth', 'traditional', 'cotton', 'handmade'], region: 'India', price: 1199, color_palette: ['#191970', '#FFFACD', '#DC143C'], texture: 'woven', material: 'cotton', tone: 'vibrant' },
  { product_name: 'test_terracotta_planters', brand: 'test_brown_living', category: 'garden', tags: ['terracotta', 'planters', 'garden', 'eco-friendly', 'handmade'], region: 'India', price: 599, color_palette: ['#E2725B', '#D2691E', '#8B4513'], texture: 'rough', material: 'terracotta', tone: 'warm' },
  { product_name: 'test_jute_area_rug', brand: 'test_chumbak', category: 'rugs', tags: ['jute', 'rug', 'natural', 'boho', 'handwoven'], region: 'India', price: 3499, color_palette: ['#F5DEB3', '#D2B48C', '#DEB887'], texture: 'woven', material: 'jute', tone: 'neutral' },
  { product_name: 'test_copper_water_bottle', brand: 'test_pure_copper', category: 'drinkware', tags: ['copper', 'water-bottle', 'ayurvedic', 'health', 'traditional'], region: 'India', price: 799, color_palette: ['#B87333', '#CD7F32', '#8B4513'], texture: 'metallic', material: 'copper', tone: 'warm' },
  { product_name: 'test_embroidered_cushion_covers', brand: 'test_jaipuri_crafts', category: 'home-decor', tags: ['embroidery', 'cushion', 'traditional', 'colorful', 'handmade'], region: 'India', price: 899, color_palette: ['#FF1493', '#FFD700', '#00CED1'], texture: 'embroidered', material: 'fabric', tone: 'vibrant' },
  { product_name: 'test_bamboo_cutlery_set', brand: 'test_eco_roots', category: 'tableware', tags: ['bamboo', 'cutlery', 'eco-friendly', 'sustainable', 'minimal'], region: 'India', price: 449, color_palette: ['#F5DEB3', '#D2B48C', '#8B7355'], texture: 'smooth', material: 'bamboo', tone: 'neutral' },
  { product_name: 'test_printed_silk_scarf', brand: 'test_good_earth', category: 'fashion', tags: ['silk', 'scarf', 'printed', 'luxury', 'handmade'], region: 'India', price: 1899, color_palette: ['#4B0082', '#FFD700', '#DC143C'], texture: 'smooth', material: 'silk', tone: 'vibrant' },
  { product_name: 'test_metal_wall_clock', brand: 'test_rang_rage', category: 'home-decor', tags: ['metal', 'clock', 'wall-decor', 'modern', 'functional'], region: 'India', price: 1299, color_palette: ['#708090', '#000000', '#FFFFFF'], texture: 'metallic', material: 'metal', tone: 'cool' },
  { product_name: 'test_dhokra_art_figurine', brand: 'test_artisans_angle', category: 'art', tags: ['dhokra', 'art', 'traditional', 'handmade', 'tribal'], region: 'India', price: 2199, color_palette: ['#B8860B', '#8B4513', '#2F4F4F'], texture: 'metallic', material: 'brass', tone: 'warm' },
  { product_name: 'test_handpainted_coasters', brand: 'test_india_circus', category: 'tableware', tags: ['handpainted', 'coasters', 'colorful', 'quirky', 'functional'], region: 'India', price: 599, color_palette: ['#FF6347', '#FFD700', '#00CED1'], texture: 'smooth', material: 'wood', tone: 'vibrant' },
  { product_name: 'test_velvet_throw_blanket', brand: 'test_house_this', category: 'textiles', tags: ['velvet', 'blanket', 'luxury', 'cozy', 'modern'], region: 'India', price: 1999, color_palette: ['#800080', '#4B0082', '#191970'], texture: 'plush', material: 'velvet', tone: 'cool' },
  { product_name: 'test_marble_cheese_board', brand: 'test_the_table_culture', category: 'tableware', tags: ['marble', 'cheese-board', 'entertaining', 'luxury', 'minimal'], region: 'India', price: 1499, color_palette: ['#FFFFFF', '#D3D3D3', '#000000'], texture: 'smooth', material: 'marble', tone: 'neutral' },
  { product_name: 'test_cane_storage_basket', brand: 'test_the_bamboo_bae', category: 'storage', tags: ['cane', 'storage', 'natural', 'handwoven', 'eco-friendly'], region: 'India', price: 799, color_palette: ['#F5DEB3', '#D2691E', '#8B4513'], texture: 'woven', material: 'cane', tone: 'warm' },
  { product_name: 'test_geometric_vase_set', brand: 'test_home_centre', category: 'home-decor', tags: ['vase', 'geometric', 'modern', 'ceramic', 'minimal'], region: 'India', price: 1099, color_palette: ['#FFFFFF', '#696969', '#000000'], texture: 'smooth', material: 'ceramic', tone: 'neutral' },
  { product_name: 'test_kalamkari_bedsheet', brand: 'test_suta_bombay', category: 'textiles', tags: ['kalamkari', 'bedsheet', 'traditional', 'handpainted', 'cotton'], region: 'India', price: 2299, color_palette: ['#8B0000', '#FFD700', '#00008B'], texture: 'woven', material: 'cotton', tone: 'vibrant' },
  { product_name: 'test_leather_journal', brand: 'test_paper_plane_design', category: 'stationery', tags: ['leather', 'journal', 'handmade', 'minimal', 'vintage'], region: 'India', price: 899, color_palette: ['#8B4513', '#D2691E', '#F5DEB3'], texture: 'textured', material: 'leather', tone: 'warm' },
  { product_name: 'test_teak_wood_tray', brand: 'test_the_purple_turtles', category: 'tableware', tags: ['teak', 'wood', 'tray', 'handmade', 'natural'], region: 'India', price: 1599, color_palette: ['#8B4513', '#A0522D', '#DEB887'], texture: 'smooth', material: 'wood', tone: 'warm' },
  { product_name: 'test_indigo_dyed_napkins', brand: 'test_okhai', category: 'textiles', tags: ['indigo', 'napkins', 'dyed', 'traditional', 'cotton'], region: 'India', price: 699, color_palette: ['#191970', '#4169E1', '#6495ED'], texture: 'woven', material: 'cotton', tone: 'cool' },
  { product_name: 'test_glass_pendant_light', brand: 'test_the_light_store', category: 'lighting', tags: ['glass', 'pendant', 'lighting', 'modern', 'handblown'], region: 'India', price: 2499, color_palette: ['#F0E68C', '#FFD700', '#FFFFFF'], texture: 'smooth', material: 'glass', tone: 'warm' },
  { product_name: 'test_wicker_side_table', brand: 'test_craft_maestros', category: 'furniture', tags: ['wicker', 'table', 'boho', 'handwoven', 'natural'], region: 'India', price: 3299, color_palette: ['#D2691E', '#F5DEB3', '#8B4513'], texture: 'woven', material: 'wicker', tone: 'warm' },
  { product_name: 'test_pottery_bowl_set', brand: 'test_clay_craft', category: 'tableware', tags: ['pottery', 'bowls', 'handmade', 'ceramic', 'artisan'], region: 'India', price: 1199, color_palette: ['#8B4513', '#F5DEB3', '#D2691E'], texture: 'rough', material: 'ceramic', tone: 'warm' },
  { product_name: 'test_silk_cushion_covers', brand: 'test_pinjore_gardens', category: 'home-decor', tags: ['silk', 'cushion', 'luxury', 'embroidered', 'handmade'], region: 'India', price: 1799, color_palette: ['#800080', '#FFD700', '#DC143C'], texture: 'smooth', material: 'silk', tone: 'vibrant' },
  { product_name: 'test_bamboo_wind_chimes', brand: 'test_earth_n_us', category: 'home-decor', tags: ['bamboo', 'wind-chimes', 'eco-friendly', 'handmade', 'natural'], region: 'India', price: 549, color_palette: ['#F5DEB3', '#D2B48C', '#8B7355'], texture: 'smooth', material: 'bamboo', tone: 'neutral' }
];

async function createTestData() {
  console.log('🧪 Creating 30 test products in database...\n');

  try {
    // Check current count
    const { count: beforeCount, error: countError } = await supabase
      .from('enriched_products')
      .select('*', { count: 'exact', head: true })
      .like('product_name', 'test_%');

    if (countError) {
      console.error('❌ Error counting existing test products:', countError);
    } else {
      console.log(`📊 Existing test products: ${beforeCount || 0}`);
    }

    // Add user_id to all test products
    const productsWithUserId = testProducts.map(product => ({
      ...product,
      user_id: '00000000-0000-0000-0000-000000000000'
    }));

    // Insert test products in batches of 10
    const batchSize = 10;
    let successCount = 0;

    for (let i = 0; i < productsWithUserId.length; i += batchSize) {
      const batch = productsWithUserId.slice(i, i + batchSize);

      console.log(`📦 Inserting batch ${Math.floor(i / batchSize) + 1} (products ${i + 1}-${Math.min(i + batchSize, productsWithUserId.length)})...`);

      const { data, error } = await supabase
        .from('enriched_products')
        .insert(batch)
        .select();

      if (error) {
        console.error(`   ❌ Error inserting batch:`, error.message);
      } else {
        successCount += data.length;
        console.log(`   ✅ Inserted ${data.length} products`);
      }
    }

    // Final count
    const { count: afterCount } = await supabase
      .from('enriched_products')
      .select('*', { count: 'exact', head: true })
      .like('product_name', 'test_%');

    console.log(`\n✨ Test data creation complete!`);
    console.log(`📊 Total test products in database: ${afterCount}`);
    console.log(`✅ Successfully created: ${successCount} new products`);

    // Show sample products
    console.log('\n📋 Sample test products:');
    const { data: sampleProducts } = await supabase
      .from('enriched_products')
      .select('product_name, brand, category, tags')
      .like('product_name', 'test_%')
      .limit(5);

    if (sampleProducts) {
      sampleProducts.forEach(p => {
        console.log(`   - ${p.product_name} (${p.brand}) - ${p.category}`);
        console.log(`     Tags: ${p.tags.join(', ')}`);
      });
    }

  } catch (error) {
    console.error('❌ Error creating test data:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  createTestData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { createTestData };
