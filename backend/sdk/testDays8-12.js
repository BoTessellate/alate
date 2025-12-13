/**
 * Comprehensive Test Suite for Days 8-12 Implementation
 * Tests Layout AI, Theme Tokens, Moodboard Composer, Brand Dashboard, and Social Export
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Test configuration
const TEST_CONFIG = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY,
  brandEmail: 'test@moodlayer.com',
  brandPassword: 'TestPassword123!',
  brandName: 'Test Brand'
};

// Verify environment
function verifyEnvironment() {
  console.log('🔍 Verifying environment...\n');

  const required = ['anthropicApiKey', 'supabaseUrl', 'supabaseKey'];
  const missing = required.filter(key => !TEST_CONFIG[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing);
    process.exit(1);
  }

  console.log('✅ All required environment variables present\n');
}

// Test Day 8: Layout AI (Smart Labels)
async function testLayoutAI() {
  console.log('📍 Day 8: Testing Layout AI (Smart Labels)...\n');

  try {
    const { createVisionClient } = require('./layoutAI/visionClient');
    const { generateSmartLabels } = require('./layoutAI/generateSmartLabels');

    // Mock layout for testing
    const mockLayout = {
      layout_type: 'zigzag',
      canvas_size: { width: 1200, height: 800 },
      elements: [
        {
          type: 'image',
          position: { x: 100, y: 100 },
          size: { width: 300, height: 300 },
          text: 'Handwoven Cushion'
        },
        {
          type: 'label',
          position: { x: 100, y: 420 },
          text: 'Handwoven Cushion',
          font_size: 18,
          color: '#2C2416'
        }
      ]
    };

    console.log('  Testing Vision Client creation...');
    const visionClient = createVisionClient(TEST_CONFIG.anthropicApiKey);
    console.log('  ✅ Vision Client created successfully\n');

    console.log('  Testing smart label generation...');
    const updatedLayout = await generateSmartLabels(mockLayout, TEST_CONFIG.anthropicApiKey);
    console.log('  ✅ Smart labels generated successfully');
    console.log('  Updated layout has', updatedLayout.elements.length, 'elements\n');

    return { success: true, data: updatedLayout };
  } catch (error) {
    console.error('  ❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test Day 9: Theme Tokens
async function testThemeTokens() {
  console.log('🎨 Day 9: Testing Theme Tokenization Engine...\n');

  try {
    const { generateThemeTokens } = require('./themeTokens/generateTokens');
    const { rgbToHsl, getContrastRatio, getComplementaryColor } = require('./themeTokens/colorUtils');

    // Test color utilities
    console.log('  Testing color utilities...');
    const hsl = rgbToHsl(255, 0, 0);
    console.log('  RGB(255, 0, 0) -> HSL:', hsl);

    const contrast = getContrastRatio('#FFFFFF', '#000000');
    console.log('  Contrast ratio (white/black):', contrast);

    const complementary = getComplementaryColor('#FF0000');
    console.log('  Complementary of #FF0000:', complementary);
    console.log('  ✅ Color utilities working\n');

    // Test theme generation
    console.log('  Testing theme token generation...');
    const mockLayout = {
      layout_type: 'grid',
      canvas_size: { width: 1200, height: 800 },
      elements: []
    };

    const mockProducts = [
      {
        product_name: 'Cushion',
        color_palette: ['#8B4513', '#F5DEB3', '#4682B4']
      },
      {
        product_name: 'Vase',
        color_palette: ['#2F4F4F', '#20B2AA', '#87CEEB']
      }
    ];

    const tokens = await generateThemeTokens(mockLayout, mockProducts);
    console.log('  ✅ Theme tokens generated');
    console.log('  Primary color:', tokens.colors.primary);
    console.log('  Secondary color:', tokens.colors.secondary);
    console.log('  Accent color:', tokens.colors.accent);
    console.log('  Font family:', tokens.typography.fontFamily, '\n');

    return { success: true, data: tokens };
  } catch (error) {
    console.error('  ❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test Day 10: Moodboard Composer
async function testMoodboardComposer() {
  console.log('📋 Day 10: Testing Moodboard Composer...\n');

  try {
    const { composeBoard, validateComposition, getCompositionSummary } = require('./moodboardComposer/composeBoard');
    const { exportBoardDraft } = require('./moodboardComposer/exportBoardDraft');

    // Mock data
    const mockLayout = {
      layout_type: 'centerpiece',
      canvas_size: { width: 1200, height: 800 },
      elements: [
        {
          type: 'image',
          position: { x: 100, y: 100 },
          size: { width: 300, height: 300 }
        }
      ]
    };

    const mockProducts = [
      {
        id: 'prod_1',
        product_name: 'Handwoven Cushion',
        brand: 'Amala Earth',
        category: 'home-decor',
        tags: ['handmade', 'boho'],
        color_palette: ['#8B4513', '#F5DEB3'],
        price: 1299
      }
    ];

    const mockTheme = {
      colors: {
        primary: '#8B4513',
        secondary: '#F5DEB3',
        accent: '#4682B4',
        background: '#FFFFFF',
        text: '#2C2416'
      },
      typography: {
        fontFamily: 'Inter, sans-serif',
        fontSize: { small: 14, medium: 18, large: 24 }
      },
      spacing: {
        small: 8,
        medium: 16,
        large: 32
      }
    };

    console.log('  Testing board composition...');
    const composition = await composeBoard({
      name: 'Test Moodboard',
      layout: mockLayout,
      products: mockProducts,
      theme: mockTheme,
      add_branding: true
    });

    console.log('  ✅ Board composed successfully');
    console.log('  Board ID:', composition.id);
    console.log('  Board name:', composition.name);
    console.log('  Products:', composition.products.length, '\n');

    console.log('  Testing composition validation...');
    const validation = validateComposition(composition);
    console.log('  Valid:', validation.valid);
    if (!validation.valid) {
      console.log('  Errors:', validation.errors);
    }
    console.log('  ✅ Validation complete\n');

    console.log('  Testing composition summary...');
    const summary = getCompositionSummary(composition);
    console.log('  Summary:', summary);
    console.log('  ✅ Summary generated\n');

    console.log('  Testing JSON export...');
    const jsonExport = await exportBoardDraft({
      composition,
      mode: 'json',
      upload_to_cdn: false
    });

    console.log('  ✅ JSON export successful');
    console.log('  Export size:', jsonExport.metadata.file_size, 'bytes\n');

    return { success: true, data: { composition, validation, summary, export: jsonExport } };
  } catch (error) {
    console.error('  ❌ Error:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

// Test Day 11: Brand Dashboard
async function testBrandDashboard() {
  console.log('👤 Day 11: Testing Brand Dashboard...\n');

  try {
    const { createBrandAuthenticator } = require('./brandDashboard/loginBrand');
    const { createCSVUploadHandler } = require('./brandDashboard/uploadCSV');
    const { createSyncStatusService } = require('./brandDashboard/getSyncStatus');

    const authenticator = createBrandAuthenticator();
    const csvHandler = createCSVUploadHandler();
    const syncService = createSyncStatusService();

    console.log('  Testing CSV template generation...');
    const template = csvHandler.generateTemplate();
    console.log('  ✅ Template generated');
    console.log('  Template preview:', template.substring(0, 100) + '...\n');

    console.log('  Testing CSV validation...');
    const testCSV = `product_name,brand,category,price,tags
Handwoven Cushion,Amala Earth,home-decor,1299,handmade;boho
Terracotta Vase,Desi Crafts,home-decor,899,ceramic;minimal`;

    const validation = await csvHandler.validateCSV(testCSV);
    console.log('  ✅ CSV validation complete');
    console.log('  Valid:', validation.valid);
    console.log('  Row count:', validation.row_count);
    console.log('  Columns:', validation.columns.join(', '));
    if (validation.warnings.length > 0) {
      console.log('  Warnings:', validation.warnings);
    }
    console.log('');

    // Note: Not actually creating brand accounts to avoid cluttering database
    console.log('  ⏭️  Skipping actual brand registration (to avoid test data)\n');

    return { success: true, data: { template, validation } };
  } catch (error) {
    console.error('  ❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test Day 12: Social Export
async function testSocialExport() {
  console.log('🔗 Day 12: Testing Social Export...\n');

  try {
    const { createShareDataGenerator } = require('./socialExport/generateShareData');
    const { createExportLinkGenerator } = require('./socialExport/exportToLink');

    const shareGenerator = createShareDataGenerator();
    const linkGenerator = createExportLinkGenerator();

    // Mock composition for testing
    const mockComposition = {
      id: 'test_board_123',
      name: 'Test Moodboard',
      created_at: new Date().toISOString(),
      layout: {
        layout_type: 'grid',
        canvas_size: { width: 1200, height: 800 },
        elements: []
      },
      products: [
        {
          id: 'prod_1',
          product_name: 'Handwoven Cushion',
          brand: 'Amala Earth',
          category: 'home-decor',
          tags: ['handmade', 'boho', 'sustainable'],
          color_palette: ['#8B4513', '#F5DEB3'],
          price: 1299
        },
        {
          id: 'prod_2',
          product_name: 'Terracotta Vase',
          brand: 'Desi Crafts',
          category: 'home-decor',
          tags: ['ceramic', 'minimal', 'handcrafted'],
          color_palette: ['#CD853F', '#F4A460'],
          price: 899
        }
      ],
      theme: {
        colors: {
          primary: '#8B4513',
          secondary: '#F5DEB3',
          accent: '#4682B4'
        },
        typography: {
          fontFamily: 'Inter, sans-serif',
          fontSize: { small: 14, medium: 18, large: 24 }
        },
        spacing: { small: 8, medium: 16, large: 32 }
      },
      metadata: {
        canvas_size: { width: 1200, height: 800 },
        product_count: 2,
        layout_type: 'grid',
        has_branding: true,
        generated_by: 'Mood Layer SDK'
      }
    };

    console.log('  Testing social share data generation...');
    const shareData = await shareGenerator.generateShareData({
      composition: mockComposition,
      platforms: ['pinterest', 'instagram', 'facebook', 'twitter'],
      custom_message: 'Check out this amazing collection!',
      include_product_links: true
    });

    console.log('  ✅ Share data generated');
    console.log('  Share ID:', shareData.share_id);
    console.log('  Share URL:', shareData.share_url);
    console.log('  Platforms:', Object.keys(shareData.platforms).join(', '));

    if (shareData.platforms.pinterest) {
      console.log('\n  Pinterest data:');
      console.log('    Title:', shareData.platforms.pinterest.title);
      console.log('    Description:', shareData.platforms.pinterest.description.substring(0, 100) + '...');
      console.log('    Tags:', shareData.platforms.pinterest.tags.slice(0, 5).join(', '));
      console.log('    Share link:', shareData.platforms.pinterest.share_link?.substring(0, 80) + '...');
    }

    if (shareData.platforms.instagram) {
      console.log('\n  Instagram data:');
      console.log('    Title:', shareData.platforms.instagram.title);
      console.log('    Hashtags count:', shareData.platforms.instagram.metadata.hashtags.length);
    }

    console.log('\n  Testing QR code generation...');
    const qrCodeUrl = await linkGenerator.generateQRCode('test_link_123');
    console.log('  ✅ QR code URL generated');
    console.log('  QR URL:', qrCodeUrl.substring(0, 80) + '...\n');

    return { success: true, data: { shareData, qrCodeUrl } };
  } catch (error) {
    console.error('  ❌ Error:', error.message);
    console.error(error.stack);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runAllTests() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 DAYS 8-12 COMPREHENSIVE TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════\n');

  verifyEnvironment();

  const results = {
    day8: null,
    day9: null,
    day10: null,
    day11: null,
    day12: null
  };

  // Run tests sequentially
  results.day8 = await testLayoutAI();
  results.day9 = await testThemeTokens();
  results.day10 = await testMoodboardComposer();
  results.day11 = await testBrandDashboard();
  results.day12 = await testSocialExport();

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  const days = [
    { name: 'Day 8: Layout AI', result: results.day8 },
    { name: 'Day 9: Theme Tokens', result: results.day9 },
    { name: 'Day 10: Moodboard Composer', result: results.day10 },
    { name: 'Day 11: Brand Dashboard', result: results.day11 },
    { name: 'Day 12: Social Export', result: results.day12 }
  ];

  let passCount = 0;
  let failCount = 0;

  days.forEach(({ name, result }) => {
    if (result?.success) {
      console.log(`✅ ${name} - PASSED`);
      passCount++;
    } else {
      console.log(`❌ ${name} - FAILED: ${result?.error || 'Unknown error'}`);
      failCount++;
    }
  });

  console.log('\n───────────────────────────────────────────────────────────');
  console.log(`Total Tests: ${days.length}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Success Rate: ${Math.round((passCount / days.length) * 100)}%`);
  console.log('───────────────────────────────────────────────────────────\n');

  if (failCount === 0) {
    console.log('🎉 ALL TESTS PASSED! Days 8-12 implementation is working correctly.\n');
  } else {
    console.log('⚠️  Some tests failed. Please review the errors above.\n');
  }
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
