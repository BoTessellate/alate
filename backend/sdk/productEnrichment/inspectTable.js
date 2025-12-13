/**
 * Inspect actual table schema
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function inspectTable() {
  console.log('🔍 Inspecting enriched_products table schema\n');

  try {
    // Try to get one record to see the columns
    const { data, error } = await supabase
      .from('enriched_products')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error:', error.message);

      // Try to insert a minimal record to see what's required
      console.log('\n🧪 Testing with minimal insert to discover required fields...\n');

      const { error: insertError } = await supabase
        .from('enriched_products')
        .insert({});

      if (insertError) {
        console.log('Required field error:', insertError.message);
        console.log('Details:', insertError.details);
      }

      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Table has existing data');
      console.log('\n📋 Columns found:');
      const columns = Object.keys(data[0]);
      columns.forEach(col => {
        console.log(`   - ${col}: ${typeof data[0][col]}`);
      });

      console.log('\n📦 Sample record:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('📭 Table is empty');
      console.log('\nAttempting minimal insert to discover required fields...');

      // Try inserting with just product_name
      const { error: testError } = await supabase
        .from('enriched_products')
        .insert({ product_name: 'Test' });

      if (testError) {
        console.log('\n❌ Insert error reveals required fields:');
        console.log('   Message:', testError.message);
        console.log('   Details:', testError.details);
        console.log('   Code:', testError.code);
      }
    }

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

inspectTable();
