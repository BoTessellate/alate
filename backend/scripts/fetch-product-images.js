/**
 * Fetch Product Images Script
 * Uses DuckDuckGo image search (no API key required) to find product images
 * Then updates the enriched_products table in Supabase
 */

const https = require('https');
const http = require('http');

// Supabase config - set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

/**
 * Search for an image using DuckDuckGo
 */
async function searchImage(query) {
  return new Promise((resolve, reject) => {
    // First, get the vqd token from DuckDuckGo
    const searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;

    https.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Extract vqd token
        const vqdMatch = data.match(/vqd=["']?([^"'&]+)/);
        if (!vqdMatch) {
          // Fallback: try alternative image search
          resolve(null);
          return;
        }

        const vqd = vqdMatch[1];

        // Now fetch images
        const imageUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,,,&p=1`;

        https.get(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Referer': 'https://duckduckgo.com/'
          }
        }, (imgRes) => {
          let imgData = '';
          imgRes.on('data', chunk => imgData += chunk);
          imgRes.on('end', () => {
            try {
              const json = JSON.parse(imgData);
              if (json.results && json.results.length > 0) {
                // Return the first high-quality image
                const img = json.results.find(r => r.image && !r.image.includes('placeholder')) || json.results[0];
                resolve(img.image);
              } else {
                resolve(null);
              }
            } catch (e) {
              resolve(null);
            }
          });
        }).on('error', () => resolve(null));
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Alternative: Use Bing image search (scraping, no API)
 */
async function searchImageBing(query) {
  return new Promise((resolve) => {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2&first=1`;

    https.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Extract image URLs from the page
        // Look for murl (media URL) in the page
        const murlMatch = data.match(/murl&quot;:&quot;(https?:\/\/[^&]+\.(?:jpg|jpeg|png|webp))/i);
        if (murlMatch) {
          resolve(decodeURIComponent(murlMatch[1].replace(/&amp;/g, '&')));
          return;
        }

        // Alternative pattern
        const imgMatch = data.match(/src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
        if (imgMatch) {
          resolve(imgMatch[1]);
          return;
        }

        resolve(null);
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Fetch from Supabase
 */
async function fetchProductsWithoutImages() {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/enriched_products`);
    url.searchParams.set('select', 'id,product_name,brand,category,image_url');
    url.searchParams.set('or', '(image_url.is.null,image_url.eq.)');
    url.searchParams.set('limit', '50');

    https.get(url.toString(), {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Update product image in Supabase
 */
async function updateProductImage(productId, imageUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/enriched_products`);
    url.searchParams.set('id', `eq.${productId}`);

    const postData = JSON.stringify({ image_url: imageUrl });

    const options = {
      hostname: new URL(SUPABASE_URL).hostname,
      path: `/rest/v1/enriched_products?id=eq.${productId}`,
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve(res.statusCode === 204 || res.statusCode === 200);
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

/**
 * Main function
 */
async function main() {
  console.log('🔍 Fetching products without images...\n');

  if (!SUPABASE_KEY) {
    console.error('❌ SUPABASE_KEY environment variable is required');
    console.log('\nRun with: SUPABASE_KEY=your_key node fetch-product-images.js');
    process.exit(1);
  }

  let products;
  try {
    products = await fetchProductsWithoutImages();
  } catch (error) {
    console.error('❌ Failed to fetch products:', error.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log('✅ All products already have images!');
    return;
  }

  console.log(`Found ${products.length} products without images\n`);

  let updated = 0;
  let failed = 0;

  for (const product of products) {
    const searchQuery = `${product.product_name} ${product.brand || ''} product official`.trim();
    console.log(`🔎 Searching: ${product.product_name}...`);

    // Try Bing first, then DuckDuckGo
    let imageUrl = await searchImageBing(searchQuery);

    if (!imageUrl) {
      imageUrl = await searchImage(searchQuery);
    }

    if (imageUrl) {
      console.log(`   ✓ Found: ${imageUrl.substring(0, 60)}...`);

      const success = await updateProductImage(product.id, imageUrl);
      if (success) {
        updated++;
        console.log(`   ✅ Updated in database\n`);
      } else {
        failed++;
        console.log(`   ⚠️ Database update failed\n`);
      }
    } else {
      failed++;
      console.log(`   ❌ No image found\n`);
    }

    // Rate limiting - wait 1 second between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n========================================');
  console.log(`✅ Updated: ${updated} products`);
  console.log(`❌ Failed: ${failed} products`);
  console.log('========================================');
}

main().catch(console.error);
