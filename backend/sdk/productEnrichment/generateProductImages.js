/**
 * Generate product images using Google Gemini Imagen 3
 * Creates AI-generated product images for visual LLM training
 *
 * Usage: GEMINI_API_KEY=your_key node generateProductImages.js
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const geminiApiKey = process.env.GEMINI_NANO_API_KEY || process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

if (!geminiApiKey) {
  console.error('❌ Missing GEMINI_NANO_API_KEY or GEMINI_API_KEY');
  console.log('\nTo get a Gemini API key:');
  console.log('1. Go to https://aistudio.google.com/apikey');
  console.log('2. Create an API key');
  console.log('3. Add to .env: GEMINI_NANO_API_KEY=your_key_here');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Build a detailed prompt for image generation
function buildImagePrompt(product) {
  const name = product.product_name.replace('test_', '').replace(/_/g, ' ');
  const colors = product.color_palette?.map(hex => hexToColorName(hex)).join(', ') || '';

  let prompt = `Professional product photography of a ${name}`;

  if (product.material) {
    prompt += `, made of ${product.material}`;
  }

  if (colors) {
    prompt += `, in ${colors} colors`;
  }

  if (product.texture) {
    prompt += `, ${product.texture} texture`;
  }

  if (product.tone) {
    prompt += `, ${product.tone} tone`;
  }

  // Add style guidance
  prompt += `. Clean white background, studio lighting, high-end product shot, e-commerce style, centered composition, 4K quality`;

  // Add category-specific details
  const categoryPrompts = {
    'home-decor': ', interior design aesthetic, lifestyle product',
    'tableware': ', dining setting, elegant presentation',
    'furniture': ', modern interior, lifestyle context',
    'textiles': ', fabric detail visible, soft lighting',
    'garden': ', natural setting, outdoor aesthetic',
    'fashion': ', fashion photography style, elegant',
    'art': ', artistic presentation, gallery style',
    'lighting': ', ambient glow, atmospheric'
  };

  if (product.category && categoryPrompts[product.category]) {
    prompt += categoryPrompts[product.category];
  }

  return prompt;
}

// Convert hex color to approximate color name
function hexToColorName(hex) {
  const colors = {
    '#FFFFFF': 'white', '#000000': 'black', '#FF0000': 'red', '#00FF00': 'green',
    '#0000FF': 'blue', '#FFFF00': 'yellow', '#FF00FF': 'magenta', '#00FFFF': 'cyan',
    '#8B4513': 'brown', '#F5DEB3': 'wheat', '#4682B4': 'steel blue', '#D2691E': 'chocolate',
    '#B8860B': 'dark goldenrod', '#DAA520': 'goldenrod', '#CD7F32': 'bronze',
    '#F5F5DC': 'beige', '#D3D3D3': 'light gray', '#2F4F4F': 'dark slate gray',
    '#D2B48C': 'tan', '#F4A460': 'sandy brown', '#FFFACD': 'lemon chiffon',
    '#E6E6FA': 'lavender', '#A0522D': 'sienna', '#191970': 'midnight blue',
    '#DC143C': 'crimson', '#E2725B': 'terracotta', '#DEB887': 'burlywood',
    '#B87333': 'copper', '#FF1493': 'deep pink', '#FFD700': 'gold',
    '#00CED1': 'dark turquoise', '#8B7355': 'tan', '#4B0082': 'indigo',
    '#708090': 'slate gray', '#800080': 'purple', '#8B0000': 'dark red',
    '#00008B': 'dark blue', '#6495ED': 'cornflower blue', '#4169E1': 'royal blue',
    '#F0E68C': 'khaki', '#696969': 'dim gray'
  };

  // Find closest match or return generic
  const upperHex = hex.toUpperCase();
  return colors[upperHex] || 'neutral';
}

// Generate image using Gemini 2.5 Flash Image (Nano Banana)
async function generateImageWithGemini(prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE']
        }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Extract image from response parts
  if (data.candidates && data.candidates[0]?.content?.parts) {
    for (const part of data.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        return part.inlineData.data;
      }
    }
  }

  return null;
}

// Fetch placeholder image from Picsum (for testing)
async function fetchPlaceholderImage(seed) {
  // Use seed for consistent images per product
  const imageId = (seed % 1000) + 1; // Picsum has images 1-1000+
  const url = `https://picsum.photos/id/${imageId}/800/800`;

  const response = await fetch(url);
  if (!response.ok) {
    // Fallback to random if specific ID fails
    const fallbackResponse = await fetch('https://picsum.photos/800/800');
    if (!fallbackResponse.ok) {
      throw new Error(`Picsum error: ${fallbackResponse.status}`);
    }
    const buffer = await fallbackResponse.arrayBuffer();
    return Buffer.from(buffer).toString('base64');
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

// Generate image - uses placeholder for testing, Gemini for production
async function generateImage(prompt, productIndex = 0) {
  const useGemini = process.env.USE_GEMINI_IMAGES === 'true';

  if (useGemini && geminiApiKey) {
    return generateImageWithGemini(prompt);
  }

  // Default to placeholder images for testing
  return fetchPlaceholderImage(productIndex);
}

// Upload base64 image to Supabase Storage
async function uploadToStorage(base64Data, productName) {
  const fileName = `${productName.replace(/\s+/g, '_')}_${Date.now()}.png`;
  const filePath = `product-images/${fileName}`;

  // Convert base64 to buffer
  const buffer = Buffer.from(base64Data, 'base64');

  const { data, error } = await supabase.storage
    .from('images')
    .upload(filePath, buffer, {
      contentType: 'image/png',
      upsert: true
    });

  if (error) {
    throw new Error(`Storage upload error: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('images')
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

// Save base64 image locally as fallback
function saveLocally(base64Data, productName) {
  const outputDir = path.join(__dirname, 'generated-images');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const fileName = `${productName.replace(/\s+/g, '_')}.png`;
  const filePath = path.join(outputDir, fileName);

  const buffer = Buffer.from(base64Data, 'base64');
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

// Rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateProductImages() {
  const useGemini = process.env.USE_GEMINI_IMAGES === 'true';
  console.log(`🎨 Generating product images using ${useGemini ? 'Gemini Nano Banana' : 'Picsum placeholders'}...\n`);

  try {
    // Fetch test products without images
    const { data: products, error: fetchError } = await supabase
      .from('enriched_products')
      .select('id, product_name, brand, category, material, texture, tone, color_palette, tags')
      .like('product_name', 'test_%')
      .is('image_url', null);

    if (fetchError) {
      console.error('❌ Error fetching products:', fetchError);
      return;
    }

    if (!products || products.length === 0) {
      const { data: withImages } = await supabase
        .from('enriched_products')
        .select('id', { count: 'exact' })
        .like('product_name', 'test_%')
        .not('image_url', 'is', null);

      if (withImages && withImages.length > 0) {
        console.log(`✅ All ${withImages.length} test products already have images!`);
      } else {
        console.log('📭 No test products found. Run createTestData.js first.');
      }
      return;
    }

    console.log(`📦 Found ${products.length} test products without images\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const prompt = buildImagePrompt(product);

      console.log(`[${i + 1}/${products.length}] ${product.product_name}`);
      console.log(`   📝 Prompt: "${prompt.substring(0, 80)}..."`);

      try {
        const base64Image = await generateImage(prompt, i);

        if (base64Image) {
          let imageUrl;

          try {
            // Try to upload to Supabase Storage
            imageUrl = await uploadToStorage(base64Image, product.product_name);
            console.log(`   ☁️  Uploaded to Supabase Storage`);
          } catch (storageError) {
            // Fallback to local save
            const localPath = saveLocally(base64Image, product.product_name);
            imageUrl = localPath; // Use local path as URL for now
            console.log(`   💾 Saved locally: ${localPath}`);
          }

          // Update product with image URL
          const { error: updateError } = await supabase
            .from('enriched_products')
            .update({
              image_url: imageUrl,
              image_urls: {
                original: imageUrl,
                large: imageUrl,
                preview: imageUrl,
                thumb: imageUrl
              }
            })
            .eq('id', product.id);

          if (updateError) {
            console.log(`   ❌ DB update failed: ${updateError.message}`);
            failCount++;
          } else {
            console.log(`   ✅ Image generated and saved`);
            successCount++;
          }
        } else {
          console.log(`   ⚠️  No image generated`);
          failCount++;
        }

        // Rate limiting: Gemini has generous limits but let's be safe
        if (i < products.length - 1) {
          await sleep(2000); // 2 second delay between requests
        }

      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        failCount++;

        if (error.message.includes('429') || error.message.includes('quota')) {
          console.log('\n⏳ Rate limit reached. Please wait and run again later.');
          break;
        }
      }
    }

    console.log(`\n✨ Image generation complete!`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  generateProductImages()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { generateProductImages };
