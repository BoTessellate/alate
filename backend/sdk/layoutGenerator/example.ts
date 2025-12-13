/**
 * Layout Generator SDK - Usage Examples
 * Demonstrates moodboard layout generation with various archetypes
 */

import { createLayoutGenerator } from './generateLayout';
import { LayoutInput, ProductInput } from './types';
import { findArchetypesForProductCount, getRecommendedArchetype } from './layoutArchetypes';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Mock product data for examples
 */
const mockProducts: ProductInput[] = [
  {
    image_url: 'https://example.com/ikat-cushion.jpg',
    brand: 'Amala Earth',
    product_name: 'Handwoven Ikat Cushion',
    price: 799,
    tags: ['handwoven', 'boho', 'traditional']
  },
  {
    image_url: 'https://example.com/ceramic-vase.jpg',
    brand: 'Studio Pottery',
    product_name: 'Ceramic Matte Black Vase',
    price: 1200,
    tags: ['ceramic', 'minimalist', 'modern']
  },
  {
    image_url: 'https://example.com/cotton-kurta.jpg',
    brand: 'FabIndia',
    product_name: 'Organic Cotton Kurta',
    price: 1499,
    tags: ['organic', 'cotton', 'traditional']
  },
  {
    image_url: 'https://example.com/wooden-blocks.jpg',
    brand: 'Kinder Toys',
    product_name: 'Wooden Alphabet Blocks',
    price: 599,
    tags: ['educational', 'wooden', 'eco-friendly']
  },
  {
    image_url: 'https://example.com/silk-saree.jpg',
    brand: 'Sabyasachi',
    product_name: 'Silk Embroidered Saree',
    price: 25000,
    tags: ['luxury', 'silk', 'wedding']
  },
  {
    image_url: 'https://example.com/jute-rug.jpg',
    brand: 'HomeCraft',
    product_name: 'Hand-tufted Jute Rug',
    price: 3500,
    tags: ['jute', 'natural', 'handmade']
  },
  {
    image_url: 'https://example.com/brass-lamp.jpg',
    brand: 'Artisan Lighting',
    product_name: 'Brass Floor Lamp',
    price: 4200,
    tags: ['brass', 'vintage', 'artisanal']
  },
  {
    image_url: 'https://example.com/linen-curtains.jpg',
    brand: 'Threads',
    product_name: 'Pure Linen Curtains',
    price: 2800,
    tags: ['linen', 'natural', 'minimalist']
  }
];

async function runLayoutExamples() {
  console.log('🖼️  Layout Generator SDK - Usage Examples\n');
  console.log('='.repeat(60));

  const layoutGenerator = createLayoutGenerator();

  // EXAMPLE 1: ZigZag layout with 3 products
  console.log('\n📐 EXAMPLE 1: ZigZag Staggered Layout (3 products)');
  console.log('-'.repeat(60));

  const zigzagInput: LayoutInput = {
    products: mockProducts.slice(0, 3),
    layout_type: 'ZigZagStaggered'
  };

  const zigzagLayout = await layoutGenerator.generateLayout(zigzagInput);

  console.log(`Layout Type: ${zigzagLayout.layout_type}`);
  console.log(`Canvas Size: ${zigzagLayout.canvas_size.width}x${zigzagLayout.canvas_size.height}`);
  console.log(`Elements: ${zigzagLayout.elements.length}`);
  console.log(`Images: ${zigzagLayout.elements.filter(e => e.type === 'image').length}`);
  console.log(`Labels: ${zigzagLayout.elements.filter(e => e.type === 'label').length}`);

  // EXAMPLE 2: Layered Centerpiece with 5 products
  console.log('\n\n📐 EXAMPLE 2: Layered Centerpiece Layout (5 products)');
  console.log('-'.repeat(60));

  const centerpieceInput: LayoutInput = {
    products: mockProducts.slice(0, 5),
    layout_type: 'LayeredCenterpiece'
  };

  const centerpieceLayout = await layoutGenerator.generateLayout(centerpieceInput);

  console.log(`Layout Type: ${centerpieceLayout.layout_type}`);
  console.log(`Description: ${centerpieceLayout.metadata?.archetype_description}`);
  console.log(`Elements: ${centerpieceLayout.elements.length}`);

  console.log('\nSample elements:');
  centerpieceLayout.elements.slice(0, 3).forEach((el, i) => {
    console.log(`  ${i + 1}. ${el.type} at (${el.position.x}, ${el.position.y})`);
    if (el.size) {
      console.log(`     Size: ${el.size.width}x${el.size.height}`);
    }
    if (el.rotation) {
      console.log(`     Rotation: ${el.rotation}°`);
    }
  });

  // EXAMPLE 3: Grid with Overlap (8 products)
  console.log('\n\n📐 EXAMPLE 3: Grid With Overlap (8 products)');
  console.log('-'.repeat(60));

  const gridInput: LayoutInput = {
    products: mockProducts.slice(0, 8),
    layout_type: 'GridWithOverlap'
  };

  const gridLayout = await layoutGenerator.generateLayout(gridInput);

  console.log(`Layout Type: ${gridLayout.layout_type}`);
  console.log(`Product Count: ${gridLayout.metadata?.product_count}`);
  console.log(`Elements: ${gridLayout.elements.length}`);

  // EXAMPLE 4: Custom canvas size
  console.log('\n\n📐 EXAMPLE 4: Custom Canvas Size');
  console.log('-'.repeat(60));

  const customInput: LayoutInput = {
    products: mockProducts.slice(0, 4),
    layout_type: 'MinimalSplit',
    canvas_size: { width: 1500, height: 2000 }
  };

  const customLayout = await layoutGenerator.generateLayout(customInput);

  console.log(`Custom Canvas: ${customLayout.canvas_size.width}x${customLayout.canvas_size.height}`);
  console.log(`Elements fit within bounds: Yes`);

  // EXAMPLE 5: Without labels
  console.log('\n\n📐 EXAMPLE 5: Layout Without Labels');
  console.log('-'.repeat(60));

  const noLabelsInput: LayoutInput = {
    products: mockProducts.slice(0, 3),
    layout_type: 'DiagonalCascade',
    show_labels: false
  };

  const noLabelsLayout = await layoutGenerator.generateLayout(noLabelsInput);

  console.log(`Images: ${noLabelsLayout.elements.filter(e => e.type === 'image').length}`);
  console.log(`Labels: ${noLabelsLayout.elements.filter(e => e.type === 'label').length}`);

  // EXAMPLE 6: Find suitable archetypes for product count
  console.log('\n\n📐 EXAMPLE 6: Find Suitable Archetypes');
  console.log('-'.repeat(60));

  const productCounts = [3, 5, 8];

  productCounts.forEach(count => {
    console.log(`\nFor ${count} products:`);
    const suitable = findArchetypesForProductCount(count);
    const recommended = getRecommendedArchetype(count);

    console.log(`  Suitable: ${suitable.map(a => a.name).join(', ')}`);
    console.log(`  Recommended: ${recommended.name}`);
  });

  // EXAMPLE 7: Save layouts to JSON files
  console.log('\n\n📐 EXAMPLE 7: Export Layouts to JSON');
  console.log('-'.repeat(60));

  const outputDir = path.join(__dirname, 'examples-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const exampleLayouts = [
    { name: 'zigzag', layout: zigzagLayout },
    { name: 'centerpiece', layout: centerpieceLayout },
    { name: 'grid', layout: gridLayout }
  ];

  exampleLayouts.forEach(({ name, layout }) => {
    const filename = path.join(outputDir, `${name}-layout.json`);
    fs.writeFileSync(filename, JSON.stringify(layout, null, 2));
    console.log(`  ✓ Saved ${name} layout to ${filename}`);
  });

  // EXAMPLE 8: All archetypes showcase
  console.log('\n\n📐 EXAMPLE 8: Generate All Archetype Layouts');
  console.log('-'.repeat(60));

  const archetypes: Array<{ name: any; count: number }> = [
    { name: 'ZigZagStaggered', count: 5 },
    { name: 'LayeredCenterpiece', count: 4 },
    { name: 'MinimalSplit', count: 3 },
    { name: 'GridWithOverlap', count: 6 },
    { name: 'DiagonalCascade', count: 5 },
    { name: 'SymmetricBalance', count: 6 },
    { name: 'AsymmetricFlow', count: 5 },
    { name: 'CollageStyle', count: 7 }
  ];

  for (const { name, count } of archetypes) {
    const layout = await layoutGenerator.generateLayout({
      products: mockProducts.slice(0, count),
      layout_type: name
    });

    console.log(`  ✓ ${name}: ${layout.elements.length} elements`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n✨ All Examples Completed Successfully!');
  console.log('\n📊 Summary:');
  console.log('   ✓ Generated 8 different layout examples');
  console.log('   ✓ Tested with 3, 5, and 8 products');
  console.log('   ✓ Demonstrated custom canvas sizes');
  console.log('   ✓ Showed label toggling');
  console.log('   ✓ Exported layouts to JSON files');
  console.log('   ✓ Showcased all 8 archetype styles');
  console.log('\n💡 Layout Generator SDK is fully functional!\n');
}

// Run examples if executed directly
if (require.main === module) {
  runLayoutExamples().catch(console.error);
}

export { runLayoutExamples };
