/**
 * Database Setup Script
 * Automatically creates the products table in Supabase
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

async function setupDatabase() {
  console.log('🚀 Setting up Supabase database...\n');

  // Initialize Supabase client
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );

  try {
    // Read the schema SQL file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    console.log('📄 Executing schema.sql...');

    // Execute the SQL schema
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_query: schemaSql
    });

    if (error) {
      console.error('❌ Error creating database schema:');
      console.error(error);

      // Try alternative approach - execute statements one by one
      console.log('\n🔄 Trying alternative approach...');
      await executeSchemaStatements(supabase, schemaSql);
      return;
    }

    console.log('✅ Database schema created successfully!');

    // Test the table by inserting a test product
    console.log('\n🧪 Testing database connection...');
    await testDatabase(supabase);

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

async function executeSchemaStatements(supabase: any, sql: string) {
  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', {
        sql_query: statement + ';'
      });

      if (error) {
        console.warn(`⚠️  Statement warning: ${error.message}`);
      } else {
        console.log('✓ Executed statement');
      }
    } catch (err) {
      console.warn(`⚠️  Statement error: ${err}`);
    }
  }

  console.log('✅ Schema execution completed (with possible warnings)');
}

async function testDatabase(supabase: any) {
  const testProduct = {
    product_name: 'Test Product',
    brand: 'Test Brand',
    category: 'test',
    price: 999,
    region: 'Test Region',
    color_palette: ['red', 'blue'],
    tags: ['test', 'sample', 'demo'],
    texture: 'smooth',
    material: 'test-material',
    tone: 'neutral'
  };

  const { data, error } = await supabase
    .from('products')
    .insert(testProduct)
    .select()
    .single();

  if (error) {
    console.error('❌ Database test failed:', error);
    throw error;
  }

  console.log('✅ Database test passed!');
  console.log('📦 Test product created with ID:', data.id);

  // Clean up test product
  await supabase.from('products').delete().eq('id', data.id);
  console.log('🧹 Test product cleaned up');
}

// Run setup
setupDatabase().catch(console.error);
