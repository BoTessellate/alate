/**
 * Direct Database Table Creation
 * Creates the products table using Supabase REST API
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function createProductsTable() {
  console.log('🚀 Creating products table in Supabase...\n');

  // Since we can't execute raw SQL directly via the client,
  // let's verify if the table exists by trying to query it
  console.log('📊 Checking if products table exists...');

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .limit(1);

  if (error && error.message.includes('relation "public.products" does not exist')) {
    console.log('❌ Table does not exist yet.');
    console.log('\n📋 Please run the following SQL in Supabase SQL Editor:');
    console.log('   Dashboard → SQL Editor → New Query → Paste and Run\n');
    console.log('File location: backend/sdk/productEnrichment/schema.sql\n');

    console.log('Or copy this SQL:\n');
    console.log('='.repeat(60));
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    console.log(schema);
    console.log('='.repeat(60));

    process.exit(1);
  } else if (error) {
    console.error('❌ Error checking table:', error.message);
    process.exit(1);
  } else {
    console.log('✅ Products table exists!');
    console.log(`📦 Current record count: ${data ? data.length : 0}`);

    // Show table structure
    if (data && data.length > 0) {
      console.log('\n📋 Sample record structure:');
      console.log(Object.keys(data[0]).join(', '));
    }
  }
}

createProductsTable().catch(console.error);
