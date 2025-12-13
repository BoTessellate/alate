/**
 * Export Engine Examples
 * Demonstrates usage of the board rendering and export functionality
 */

import { BoardRenderer, renderLayout } from './renderBoard';
import { exportToFile, exportWithAutoName } from './exportToImage';
import { LayoutOutput } from './types';
import * as path from 'path';

// Example layouts
const exampleLayout3Products: LayoutOutput = {
  layout_type: 'ZigZagStaggered',
  canvas_size: { width: 1200, height: 1200 },
  elements: [
    {
      type: 'image',
      src: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500',
      position: { x: 100, y: 100 },
      size: { width: 450, height: 450 },
      zIndex: 1
    },
    {
      type: 'label',
      text: 'Sofa Collection',
      position: { x: 275, y: 570 },
      style: 'label',
      zIndex: 2
    },
    {
      type: 'image',
      src: 'https://images.unsplash.com/photo-1574180045827-681f8a1a9622?w=500',
      position: { x: 650, y: 300 },
      size: { width: 450, height: 450 },
      zIndex: 1
    },
    {
      type: 'label',
      text: 'Home Decor',
      position: { x: 825, y: 770 },
      style: 'label',
      zIndex: 2
    },
    {
      type: 'image',
      src: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=500',
      position: { x: 100, y: 650 },
      size: { width: 450, height: 450 },
      zIndex: 1
    },
    {
      type: 'label',
      text: 'Modern Chair',
      position: { x: 275, y: 1120 },
      style: 'label',
      zIndex: 2
    }
  ],
  metadata: {
    generated_at: new Date().toISOString(),
    product_count: 3,
    archetype_description: 'ZigZag staggered layout for storytelling'
  }
};

const exampleLayeredCenterpiece: LayoutOutput = {
  layout_type: 'LayeredCenterpiece',
  canvas_size: { width: 1080, height: 1080 },
  elements: [
    {
      type: 'image',
      src: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500',
      position: { x: 315, y: 315 },
      size: { width: 450, height: 450 },
      zIndex: 10,
      opacity: 1
    },
    {
      type: 'label',
      text: 'Featured Product',
      position: { x: 490, y: 790 },
      style: 'heading',
      zIndex: 11
    },
    {
      type: 'image',
      src: 'https://images.unsplash.com/photo-1574180045827-681f8a1a9622?w=400',
      position: { x: 165, y: 115 },
      size: { width: 300, height: 300 },
      zIndex: 5,
      rotation: -12,
      opacity: 0.9
    },
    {
      type: 'image',
      src: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=400',
      position: { x: 615, y: 115 },
      size: { width: 300, height: 300 },
      zIndex: 5,
      rotation: 12,
      opacity: 0.9
    },
    {
      type: 'image',
      src: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400',
      position: { x: 165, y: 665 },
      size: { width: 300, height: 300 },
      zIndex: 5,
      rotation: 8,
      opacity: 0.85
    },
    {
      type: 'image',
      src: 'https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=400',
      position: { x: 615, y: 665 },
      size: { width: 300, height: 300 },
      zIndex: 5,
      rotation: -8,
      opacity: 0.85
    }
  ],
  metadata: {
    generated_at: new Date().toISOString(),
    product_count: 5,
    archetype_description: 'Central hero with layered supporting products'
  }
};

const outputDir = path.join(__dirname, 'examples-output');

async function main() {
  console.log('🎨 Export Engine Examples\n');

  try {
    // Example 1: Basic rendering with default config
    console.log('1️⃣  Rendering 3-product ZigZag layout...');
    const renderer1 = new BoardRenderer(
      exampleLayout3Products.canvas_size.width,
      exampleLayout3Products.canvas_size.height
    );
    const canvas1 = await renderer1.render(exampleLayout3Products);
    await exportToFile(canvas1, path.join(outputDir, 'example-zigzag.png'), 'png');
    console.log('   ✅ Saved: examples-output/example-zigzag.png');

    // Example 2: Layered centerpiece with custom background
    console.log('\n2️⃣  Rendering layered centerpiece with custom background...');
    const canvas2 = await renderLayout(exampleLayeredCenterpiece, {
      background_color: '#e8d5c4',
      add_branding: true,
      branding_position: 'bottom-right'
    });
    await exportToFile(canvas2, path.join(outputDir, 'example-centerpiece.png'), 'png');
    console.log('   ✅ Saved: examples-output/example-centerpiece.png');

    // Example 3: Export as JPG with quality setting
    console.log('\n3️⃣  Exporting as JPG (quality: 85)...');
    const renderer3 = new BoardRenderer(1080, 1080, {
      background_color: '#f6e9cf',
      add_branding: false
    });
    const canvas3 = await renderer3.render(exampleLayeredCenterpiece);
    await exportToFile(canvas3, path.join(outputDir, 'example-jpg.jpg'), 'jpg', 85);
    console.log('   ✅ Saved: examples-output/example-jpg.jpg');

    // Example 4: Instagram square format
    console.log('\n4️⃣  Instagram square (1080x1080)...');
    const instagramLayout: LayoutOutput = {
      ...exampleLayeredCenterpiece,
      canvas_size: { width: 1080, height: 1080 }
    };
    const canvas4 = await renderLayout(instagramLayout);
    await exportToFile(canvas4, path.join(outputDir, 'example-instagram-square.png'), 'png');
    console.log('   ✅ Saved: examples-output/example-instagram-square.png');

    // Example 5: Instagram portrait format
    console.log('\n5️⃣  Instagram portrait (1080x1350)...');
    const portraitLayout: LayoutOutput = {
      layout_type: 'MinimalSplit',
      canvas_size: { width: 1080, height: 1350 },
      elements: [
        {
          type: 'image',
          src: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500',
          position: { x: 290, y: 200 },
          size: { width: 500, height: 500 },
          zIndex: 1
        },
        {
          type: 'label',
          text: 'Minimalist Design',
          position: { x: 490, y: 750 },
          style: 'heading',
          zIndex: 2
        },
        {
          type: 'text',
          text: 'Curated home essentials',
          position: { x: 490, y: 800 },
          style: 'caption',
          zIndex: 2
        }
      ]
    };
    const canvas5 = await renderLayout(portraitLayout, {
      background_color: '#ffffff',
      add_branding: true
    });
    await exportToFile(canvas5, path.join(outputDir, 'example-instagram-portrait.png'), 'png');
    console.log('   ✅ Saved: examples-output/example-instagram-portrait.png');

    // Example 6: Pinterest format
    console.log('\n6️⃣  Pinterest format (1000x1500)...');
    const pinterestLayout: LayoutOutput = {
      layout_type: 'AsymmetricFlow',
      canvas_size: { width: 1000, height: 1500 },
      elements: [
        {
          type: 'image',
          src: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400',
          position: { x: 100, y: 150 },
          size: { width: 400, height: 400 },
          zIndex: 1
        },
        {
          type: 'image',
          src: 'https://images.unsplash.com/photo-1574180045827-681f8a1a9622?w=350',
          position: { x: 500, y: 300 },
          size: { width: 350, height: 350 },
          zIndex: 2,
          rotation: 5
        },
        {
          type: 'image',
          src: 'https://images.unsplash.com/photo-1567016432779-094069958ea5?w=450',
          position: { x: 200, y: 700 },
          size: { width: 450, height: 450 },
          zIndex: 3
        },
        {
          type: 'label',
          text: 'Interior Inspiration',
          position: { x: 150, y: 1200 },
          style: 'heading',
          zIndex: 4
        }
      ]
    };
    const canvas6 = await renderLayout(pinterestLayout);
    await exportToFile(canvas6, path.join(outputDir, 'example-pinterest.png'), 'png');
    console.log('   ✅ Saved: examples-output/example-pinterest.png');

    // Example 7: No branding
    console.log('\n7️⃣  Export without branding...');
    const canvas7 = await renderLayout(exampleLayout3Products, {
      add_branding: false
    });
    await exportToFile(canvas7, path.join(outputDir, 'example-no-branding.png'), 'png');
    console.log('   ✅ Saved: examples-output/example-no-branding.png');

    // Example 8: Auto-named export
    console.log('\n8️⃣  Auto-named export...');
    const canvas8 = await renderLayout(exampleLayeredCenterpiece);
    const autoPath = await exportWithAutoName(canvas8, outputDir, 'png');
    console.log(`   ✅ Saved: ${path.basename(autoPath)}`);

    console.log('\n✨ All examples completed successfully!');
    console.log(`\n📁 Check the examples-output folder for generated images:`);
    console.log(`   ${outputDir}`);

  } catch (error) {
    console.error('❌ Error running examples:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { main as runExamples };
