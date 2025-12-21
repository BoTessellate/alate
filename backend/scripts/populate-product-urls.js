#!/usr/bin/env node
/**
 * Populate Product URLs Script
 * Generates and stores product URLs in the database based on brand mappings
 *
 * Usage:
 *   node scripts/populate-product-urls.js           Populate all products
 *   node scripts/populate-product-urls.js --dry-run Preview without updating
 *   node scripts/populate-product-urls.js --limit 10 Only process first 10 products
 */

// Force IPv6 for Supabase (only has AAAA records)
const dns = require('dns');
dns.setDefaultResultOrder('ipv6first');

const { Client } = require('pg');
require('dotenv').config();

/**
 * Brand URL mappings - maps brand names to their website search patterns
 */
const BRAND_URL_MAPPINGS = {
  // Major furniture retailers
  'west elm': { domain: 'westelm.com', searchPath: '/search/results.html?words=' },
  'westelm': { domain: 'westelm.com', searchPath: '/search/results.html?words=' },
  'cb2': { domain: 'cb2.com', searchPath: '/search?query=' },
  'crate and barrel': { domain: 'crateandbarrel.com', searchPath: '/search?query=' },
  'crate & barrel': { domain: 'crateandbarrel.com', searchPath: '/search?query=' },
  'pottery barn': { domain: 'potterybarn.com', searchPath: '/search/results.html?words=' },
  'potterybarn': { domain: 'potterybarn.com', searchPath: '/search/results.html?words=' },
  'restoration hardware': { domain: 'rh.com', searchPath: '/search/results.jsp?Ntt=' },
  'rh': { domain: 'rh.com', searchPath: '/search/results.jsp?Ntt=' },
  'ikea': { domain: 'ikea.com', searchPath: '/us/en/search/?q=' },
  'wayfair': { domain: 'wayfair.com', searchPath: '/keyword.html?keyword=' },
  'article': { domain: 'article.com', searchPath: '/search?query=' },
  'joybird': { domain: 'joybird.com', searchPath: '/search?q=' },
  'anthropologie': { domain: 'anthropologie.com', searchPath: '/search/?q=' },
  'urban outfitters': { domain: 'urbanoutfitters.com', searchPath: '/search?q=' },
  'target': { domain: 'target.com', searchPath: '/s?searchTerm=' },
  'amazon': { domain: 'amazon.com', searchPath: '/s?k=' },
  'etsy': { domain: 'etsy.com', searchPath: '/search?q=' },
  'overstock': { domain: 'overstock.com', searchPath: '/Home-Garden/?query=' },
  'allmodern': { domain: 'allmodern.com', searchPath: '/keyword.html?keyword=' },
  'world market': { domain: 'worldmarket.com', searchPath: '/search?q=' },
  'cost plus world market': { domain: 'worldmarket.com', searchPath: '/search?q=' },
  'homesense': { domain: 'homesense.com', searchPath: '/search?q=' },
  'homegoods': { domain: 'homegoods.com', searchPath: '/search?q=' },
  'tj maxx': { domain: 'tjmaxx.com', searchPath: '/search?q=' },
  'marshalls': { domain: 'marshalls.com', searchPath: '/search?q=' },
  'z gallerie': { domain: 'zgallerie.com', searchPath: '/search?q=' },
  'arhaus': { domain: 'arhaus.com', searchPath: '/search?q=' },
  'room and board': { domain: 'roomandboard.com', searchPath: '/search?query=' },
  'room & board': { domain: 'roomandboard.com', searchPath: '/search?query=' },
  'design within reach': { domain: 'dwr.com', searchPath: '/search/?q=' },
  'dwr': { domain: 'dwr.com', searchPath: '/search/?q=' },
  'blu dot': { domain: 'bludot.com', searchPath: '/search?q=' },
  'hay': { domain: 'hay.com', searchPath: '/search?q=' },
  'muuto': { domain: 'muuto.com', searchPath: '/search?q=' },
  'knoll': { domain: 'knoll.com', searchPath: '/search?q=' },
  'herman miller': { domain: 'hermanmiller.com', searchPath: '/search?q=' },
  'kartell': { domain: 'kartell.com', searchPath: '/search?q=' },
  'ferm living': { domain: 'fermliving.com', searchPath: '/search?q=' },
  'normann copenhagen': { domain: 'normann-copenhagen.com', searchPath: '/search?q=' },
  'menu': { domain: 'menudesignshop.com', searchPath: '/search?q=' },
  'h&m home': { domain: 'hm.com', searchPath: '/en_us/search-results.html?q=' },
  'h&m': { domain: 'hm.com', searchPath: '/en_us/search-results.html?q=' },
  'zara home': { domain: 'zarahome.com', searchPath: '/search?term=' },
  'made': { domain: 'made.com', searchPath: '/search?q=' },
  'habitat': { domain: 'habitat.co.uk', searchPath: '/search?searchTerm=' },
};

/**
 * Normalize brand name for matching
 */
function normalizeBrand(brand) {
  if (!brand) return '';
  return brand
    .toLowerCase()
    .replace(/^test_/i, '')
    .replace(/_/g, ' ')
    .replace(/[^a-z0-9\s&]/g, '')
    .trim();
}

/**
 * Normalize product name for URL
 */
function normalizeProductName(productName) {
  if (!productName) return '';
  return productName
    .replace(/^test_/i, '')
    .replace(/_/g, ' ')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim();
}

/**
 * Generate a product URL based on brand and product name
 */
function getProductUrl(brand, productName) {
  const normalizedBrand = normalizeBrand(brand);
  const normalizedProduct = normalizeProductName(productName);

  // Check for known brand mapping
  for (const [brandKey, config] of Object.entries(BRAND_URL_MAPPINGS)) {
    if (normalizedBrand.includes(brandKey) || brandKey.includes(normalizedBrand)) {
      const searchQuery = encodeURIComponent(normalizedProduct);
      return `https://www.${config.domain}${config.searchPath}${searchQuery}`;
    }
  }

  // Fallback to Google Shopping search
  const searchQuery = encodeURIComponent(`${normalizedBrand} ${normalizedProduct}`);
  return `https://www.google.com/search?tbm=shop&q=${searchQuery}`;
}

async function populateProductUrls() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;

  console.log('='.repeat(60));
  console.log('Product URL Population Script');
  console.log('='.repeat(60));
  if (dryRun) console.log('\n>>> DRY RUN MODE - No changes will be made <<<\n');
  if (limit) console.log(`>>> Limited to ${limit} products <<<\n`);

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL not set in .env file');
    console.error('Add: DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:5432/postgres');
    process.exit(1);
  }

  if (process.env.DATABASE_URL.includes('[YOUR-PASSWORD]')) {
    console.error('Error: Replace [YOUR-PASSWORD] in DATABASE_URL with your actual Supabase database password');
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected!\n');

    // Fetch products
    let query = 'SELECT id, product_name, brand FROM enriched_products';
    if (limit) query += ` LIMIT ${limit}`;

    console.log('Fetching products...');
    const { rows: products } = await client.query(query);
    console.log(`Found ${products.length} products\n`);

    if (products.length === 0) {
      console.log('No products found in database.');
      return;
    }

    // Generate URLs and prepare updates
    const updates = [];
    const brandStats = {};

    for (const product of products) {
      const url = getProductUrl(product.brand, product.product_name);
      const normalizedBrand = normalizeBrand(product.brand);

      // Check if it's a known brand or Google fallback
      let matchedBrand = 'Google Shopping (fallback)';
      for (const brandKey of Object.keys(BRAND_URL_MAPPINGS)) {
        if (normalizedBrand.includes(brandKey) || brandKey.includes(normalizedBrand)) {
          matchedBrand = brandKey;
          break;
        }
      }

      brandStats[matchedBrand] = (brandStats[matchedBrand] || 0) + 1;
      updates.push({ id: product.id, url, brand: product.brand, name: product.product_name });
    }

    // Show brand distribution
    console.log('Brand URL Mapping Distribution:');
    console.log('-'.repeat(40));
    const sortedBrands = Object.entries(brandStats).sort((a, b) => b[1] - a[1]);
    for (const [brand, count] of sortedBrands) {
      console.log(`  ${brand}: ${count} products`);
    }
    console.log();

    // Show sample URLs
    console.log('Sample Generated URLs:');
    console.log('-'.repeat(40));
    const samples = updates.slice(0, 5);
    for (const sample of samples) {
      console.log(`  ${sample.brand} - ${sample.name}`);
      console.log(`    → ${sample.url}`);
      console.log();
    }

    if (dryRun) {
      console.log('='.repeat(60));
      console.log('DRY RUN COMPLETE - No changes made');
      console.log(`Would update ${updates.length} products`);
      console.log('='.repeat(60));
      return;
    }

    // Perform updates
    console.log('Updating database...');
    let successCount = 0;
    let errorCount = 0;

    for (const update of updates) {
      try {
        await client.query(
          'UPDATE enriched_products SET product_url = $1 WHERE id = $2',
          [update.url, update.id]
        );
        successCount++;

        // Progress indicator
        if (successCount % 50 === 0) {
          process.stdout.write(`  Updated ${successCount}/${updates.length} products\r`);
        }
      } catch (err) {
        errorCount++;
        console.error(`\nError updating product ${update.id}: ${err.message}`);
      }
    }

    console.log('\n');
    console.log('='.repeat(60));
    console.log('UPDATE COMPLETE');
    console.log('='.repeat(60));
    console.log(`  Successfully updated: ${successCount} products`);
    if (errorCount > 0) {
      console.log(`  Errors: ${errorCount} products`);
    }
    console.log();

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
    console.log('Connection closed.');
  }
}

populateProductUrls();
