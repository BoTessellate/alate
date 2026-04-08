/**
 * Manually trigger enrichment for Shopify products
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!url || !key) {
  console.log('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(url, key);

// Import the AI functions
async function main() {
  const shopDomain = 'store-1-2352745.myshopify.com'; // From the data we saw
  const limit = 3; // Test with 3 products first

  console.log('Fetching products that need enrichment...');

  // Find products without enrichment
  const { data: products, error: fetchError } = await supabase
    .from('enriched_products')
    .select('id, product_name, brand, category, price, image_url, external_id')
    .eq('platform', 'shopify')
    .is('enriched_at', null)
    .limit(limit);

  if (fetchError) {
    console.error('Failed to fetch products:', fetchError);
    return;
  }

  console.log(`Found ${products?.length || 0} products to enrich\n`);

  if (!products || products.length === 0) {
    console.log('No products need enrichment');
    return;
  }

  // Check if AI keys are configured
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  console.log('AI API Keys:');
  console.log('  GEMINI_API_KEY:', geminiKey ? 'SET' : 'MISSING');
  console.log('  OPENAI_API_KEY:', openaiKey ? 'SET' : 'MISSING');
  console.log('  ANTHROPIC_API_KEY:', anthropicKey ? 'SET' : 'MISSING');
  console.log('');

  if (!geminiKey && !openaiKey && !anthropicKey) {
    console.log('ERROR: No AI API keys configured! Enrichment cannot run.');
    console.log('Add at least one of: GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY to .env');
    return;
  }

  // Call Gemini directly (simplest approach for testing)
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(geminiKey);

  async function callGemini(prompt) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return { success: true, text };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  function parseJSONFromResponse(text) {
    try {
      // Clean up response
      let cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      console.log('Parse error:', e.message);
      return null;
    }
  }

  // Try to enrich first product
  const product = products[0];
  console.log(`Testing enrichment on: ${product.product_name}`);
  console.log(`  Brand: ${product.brand || 'Unknown'}`);
  console.log(`  Category: ${product.category || 'General'}`);
  console.log('');

  const prompt = `Analyze this product and extract style attributes. Return JSON only.

Product: ${product.product_name}
Brand: ${product.brand || 'Unknown'}
Category: ${product.category || 'General'}
Price: ${product.price || 'N/A'}

Return this exact JSON structure:
{
  "color_palette": ["color1", "color2", "color3"],
  "tags": ["style1", "style2", "style3"],
  "texture": "texture_type",
  "material": "material_type",
  "tone": "aesthetic_mood",
  "flags": ["special_attribute"],
  "fit_tags": ["layout_hint"]
}`;

  // Try Gemini
  console.log('Calling Gemini...');
  const response = await callGemini(prompt);

  if (!response.success) {
    console.log('\nGemini FAILED!');
    console.log('Error:', response.error);
    return;
  }

  console.log(`\nSuccess! Model used: gemini`);
  console.log('Raw response:', response.text?.substring(0, 500));

  const enrichment = parseJSONFromResponse(response.text);
  if (!enrichment) {
    console.log('\nFailed to parse JSON from response');
    return;
  }

  console.log('\nParsed enrichment:');
  console.log(JSON.stringify(enrichment, null, 2));

  // Update the product in database
  console.log('\nUpdating database...');
  const { error: updateError } = await supabase
    .from('enriched_products')
    .update({
      color_palette: enrichment.color_palette,
      tags: enrichment.tags,
      texture: enrichment.texture,
      material: enrichment.material,
      tone: enrichment.tone,
      flags: enrichment.flags,
      fit_tags: enrichment.fit_tags,
      enriched_at: new Date().toISOString(),
    })
    .eq('id', product.id);

  if (updateError) {
    console.log('Database update failed:', updateError);
  } else {
    console.log('SUCCESS! Product enriched and saved.');

    // Verify
    const { data: updated } = await supabase
      .from('enriched_products')
      .select('product_name, color_palette, tags, material, texture, tone, enriched_at')
      .eq('id', product.id)
      .single();

    console.log('\nVerified in database:');
    console.log(JSON.stringify(updated, null, 2));
  }
}

main().catch(console.error);
