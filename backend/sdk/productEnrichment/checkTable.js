/**
 * Check if enriched_products table exists
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function checkTable() {
  console.log('🔍 Checking enriched_products table...\n');

  try {
    const { data, error, count } = await supabase
      .from('enriched_products')
      .select('*', { count: 'exact', head: false })
      .limit(5);

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('❌ Table does NOT exist yet');
        console.log('\n📋 Please run the SQL in Supabase SQL Editor');
        console.log('   Location: backend/sdk/productEnrichment/createEnrichedTable.sql\n');
        return false;
      } else {
        console.error('❌ Error:', error.message);
        return false;
      }
    }

    console.log('✅ Table EXISTS!');
    console.log(`📊 Current records: ${count || 0}`);

    if (data && data.length > 0) {
      console.log('\n📋 Table columns:');
      console.log(Object.keys(data[0]).join(', '));
      console.log('\n📦 Sample records:');
      data.forEach((record, i) => {
        console.log(`  ${i + 1}. ${record.product_name} by ${record.brand}`);
      });
    } else {
      console.log('\n📭 Table is empty (ready for data!)');
    }

    return true;

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    return false;
  }
}

checkTable().then(exists => {
  if (exists) {
    console.log('\n🎉 Database is ready for product enrichment!');
  }
  process.exit(exists ? 0 : 1);
});
