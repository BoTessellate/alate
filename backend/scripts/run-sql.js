#!/usr/bin/env node
/**
 * SQL Runner Script
 * Execute SQL files against Supabase PostgreSQL database
 *
 * Usage:
 *   node scripts/run-sql.js <sql-file>
 *   node scripts/run-sql.js supabase/schema.sql
 *   node scripts/run-sql.js --query "SELECT * FROM enriched_products LIMIT 5"
 */

// Force IPv6 for Supabase (only has AAAA records)
const dns = require('dns');
dns.setDefaultResultOrder('ipv6first');

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runSQL() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
SQL Runner - Execute SQL against Supabase

Usage:
  node scripts/run-sql.js <sql-file>       Run a SQL file
  node scripts/run-sql.js --query "SQL"    Run inline SQL
  node scripts/run-sql.js --schema         Run schema.sql

Examples:
  node scripts/run-sql.js supabase/schema.sql
  node scripts/run-sql.js --query "SELECT COUNT(*) FROM enriched_products"
  node scripts/run-sql.js --schema
`);
    process.exit(0);
  }

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL not set in .env file');
    console.error('Add: DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres');
    process.exit(1);
  }

  // Check if password placeholder is still there
  if (process.env.DATABASE_URL.includes('[YOUR-PASSWORD]')) {
    console.error('Error: Replace [YOUR-PASSWORD] in DATABASE_URL with your actual Supabase database password');
    process.exit(1);
  }

  let sql;

  // Parse arguments
  if (args[0] === '--query' && args[1]) {
    sql = args[1];
  } else if (args[0] === '--schema') {
    const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.error(`Schema file not found: ${schemaPath}`);
      process.exit(1);
    }
    sql = fs.readFileSync(schemaPath, 'utf-8');
  } else {
    // Treat as file path
    const filePath = path.resolve(args[0]);
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    sql = fs.readFileSync(filePath, 'utf-8');
  }

  // Connect and execute
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!\n');

    console.log('Executing SQL...\n');
    const result = await client.query(sql);

    // Handle results
    if (Array.isArray(result)) {
      // Multiple statements
      let successCount = 0;
      for (const r of result) {
        if (r.command) {
          console.log(`✓ ${r.command}${r.rowCount !== null ? ` (${r.rowCount} rows)` : ''}`);
          successCount++;
        }
      }
      console.log(`\n✅ Executed ${successCount} statements successfully`);
    } else if (result.rows && result.rows.length > 0) {
      // SELECT query with results
      console.table(result.rows);
      console.log(`\n${result.rowCount} row(s) returned`);
    } else if (result.command) {
      console.log(`✓ ${result.command}${result.rowCount !== null ? ` (${result.rowCount} rows affected)` : ''}`);
      console.log('\n✅ SQL executed successfully');
    }

  } catch (error) {
    console.error('\n❌ SQL Error:', error.message);
    if (error.position) {
      const lines = sql.split('\n');
      let pos = 0;
      for (let i = 0; i < lines.length; i++) {
        pos += lines[i].length + 1;
        if (pos >= parseInt(error.position)) {
          console.error(`   Near line ${i + 1}: ${lines[i].trim()}`);
          break;
        }
      }
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('\nConnection closed.');
  }
}

runSQL();
