# Layout Generator SDK

Intelligent moodboard layout generation system for Mood Layer with 8 predefined composition archetypes.

## Features

- **8 Layout Archetypes** - ZigZag, Layered Centerpiece, Minimal Split, Grid, Diagonal, Symmetric, Asymmetric, Collage
- **Smart Positioning** - Algorithm-based element placement with overlap control
- **Flexible Configuration** - Custom canvas sizes, label toggling, rotation control
- **JSON Output** - Rendering-agnostic layout plans
- **Type-Safe** - Full TypeScript support
- **Comprehensive Tests** - 40+ test cases covering all scenarios

## Quick Start

```typescript
import { createLayoutGenerator } from './sdk/layoutGenerator';

const layoutGenerator = createLayoutGenerator();

const layout = await layoutGenerator.generateLayout({
  products: [
    {
      image_url: 'https://example.com/product1.jpg',
      brand: 'Brand Name',
      tags: ['handmade', 'boho']
    },
    // ... more products
  ],
  layout_type: 'LayeredCenterpiece'
});

console.log(layout);
```

## Layout Archetypes

### 1. ZigZag Staggered
- **Products**: 3-7
- **Style**: Alternating left-right pattern
- **Best for**: Storytelling flow, editorial layouts
- **Overlap**: No

### 2. Layered Centerpiece
- **Products**: 3-5
- **Style**: Central hero with supporting elements
- **Best for**: Product showcases, hero highlights
- **Overlap**: Yes

### 3. Minimal Split
- **Products**: 2-4
- **Style**: Clean split with whitespace
- **Best for**: Minimalist aesthetic, luxury brands
- **Overlap**: No

### 4. Grid With Overlap
- **Products**: 4-9
- **Style**: Grid-based with intentional overlaps
- **Best for**: Catalog style, multiple products
- **Overlap**: Yes

### 5. Diagonal Cascade
- **Products**: 3-6
- **Style**: Diagonal flow top-left to bottom-right
- **Best for**: Dynamic movement, editorial
- **Overlap**: Yes

### 6. Symmetric Balance
- **Products**: 4-8
- **Style**: Perfect vertical symmetry
- **Best for**: Formal compositions, balanced aesthetics
- **Overlap**: No

### 7. Asymmetric Flow
- **Products**: 3-7
- **Style**: Intentionally unbalanced
- **Best for**: Editorial style, visual interest
- **Overlap**: Yes

### 8. Collage Style
- **Products**: 5-10
- **Style**: Organic, magazine-style
- **Best for**: Creative layouts, casual feel
- **Overlap**: Yes

## API Usage

### POST /api/generateLayout

**Request:**
```json
{
  "products": [
    {
      "image_url": "https://example.com/product.jpg",
      "brand": "Brand Name",
      "product_name": "Product Name",
      "price": 999,
      "tags": ["tag1", "tag2"]
    }
  ],
  "layout_type": "LayeredCenterpiece",
  "canvas_size": { "width": 1200, "height": 1200 },
  "show_labels": true,
  "show_prices": false
}
```

**Response:**
```json
{
  "layout_type": "LayeredCenterpiece",
  "canvas_size": { "width": 1200, "height": 1200 },
  "elements": [
    {
      "type": "image",
      "src": "https://example.com/product.jpg",
      "position": { "x": 375, "y": 375 },
      "size": { "width": 450, "height": 450 },
      "zIndex": 10
    },
    {
      "type": "label",
      "text": "Brand Name",
      "position": { "x": 550, "y": 855 },
      "style": "label",
      "zIndex": 20
    }
  ],
  "metadata": {
    "generated_at": "2025-12-13T...",
    "product_count": 5,
    "archetype_description": "Central hero image with layered supporting products"
  }
}
```

## Configuration Options

```typescript
const layoutGenerator = createLayoutGenerator({
  padding: 80,           // Canvas padding
  minImageSize: 200,     // Minimum image dimension
  maxImageSize: 500,     // Maximum image dimension
  labelOffset: 20,       // Distance from image to label
  allowRotation: true,   // Allow element rotation
  maxRotation: 15        // Max rotation in degrees
});
```

## Layout Input Types

```typescript
interface LayoutInput {
  products: ProductInput[];          // Product list
  layout_type: LayoutArchetypeName;  // Archetype name
  canvas_size?: Size;                // Optional canvas size
  show_labels?: boolean;             // Show brand labels (default: true)
  show_prices?: boolean;             // Show prices (default: false)
}

interface ProductInput {
  image_url: string;     // Product image URL (required)
  brand: string;         // Brand name (required)
  tags?: string[];       // Optional tags
  product_name?: string; // Optional product name
  price?: number;        // Optional price
}
```

## Layout Output Types

```typescript
interface LayoutOutput {
  layout_type: LayoutArchetypeName;
  canvas_size: Size;
  elements: LayoutElement[];
  metadata?: {
    generated_at: string;
    product_count: number;
    archetype_description: string;
  };
}

interface LayoutElement {
  type: 'image' | 'text' | 'label' | 'price';
  src?: string;              // For images
  text?: string;             // For text/labels
  position: Position;
  size?: Size;               // Optional for text
  style?: TextStyle;
  rotation?: number;         // Optional rotation in degrees
  opacity?: number;          // Optional opacity 0-1
  zIndex?: number;           // Layer order
}
```

## Helper Functions

### Find Suitable Archetypes
```typescript
import { findArchetypesForProductCount } from './sdk/layoutGenerator';

const suitable = findArchetypesForProductCount(5);
// Returns all archetypes that support 5 products
```

### Get Recommended Archetype
```typescript
import { getRecommendedArchetype } from './sdk/layoutGenerator';

const recommended = getRecommendedArchetype(5);
// Returns best archetype for 5 products
```

### Get Archetype Details
```typescript
import { getArchetype } from './sdk/layoutGenerator';

const archetype = getArchetype('LayeredCenterpiece');
console.log(archetype.description);
console.log(archetype.minItems, archetype.maxItems);
```

## Examples

See [example.ts](./example.ts) for comprehensive usage examples:

1. ZigZag layout with 3 products
2. Layered Centerpiece with 5 products
3. Grid layout with 8 products
4. Custom canvas sizes
5. Layouts without labels
6. Finding suitable archetypes
7. Exporting to JSON
8. All archetype showcase

Run examples:
```bash
npx ts-node sdk/layoutGenerator/example.ts
```

## Testing

Run the test suite:
```bash
npm test sdk/layoutGenerator/layout.test.ts
```

Tests cover:
- All 8 archetypes
- Product count validation
- Element positioning
- Canvas bounds checking
- Label toggling
- Custom configurations
- Metadata generation

## Integration

### Express Server Setup
```typescript
import express from 'express';
import { setupLayoutRoutes } from './sdk/layoutGenerator';

const app = express();
app.use(express.json());

setupLayoutRoutes(app);

app.listen(3000);
```

### Frontend Usage
```typescript
const response = await fetch('/api/generateLayout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    products: [...],
    layout_type: 'LayeredCenterpiece'
  })
});

const layout = await response.json();

// Render layout elements on canvas
layout.elements.forEach(element => {
  if (element.type === 'image') {
    // Place image at element.position with element.size
  } else if (element.type === 'label') {
    // Place text at element.position
  }
});
```

## Rendering-Agnostic

The layout generator outputs JSON plans that can be rendered on any platform:

- **Canva SDK** - Use element positions to place Canva design elements
- **HTML Canvas** - Draw images and text at specified positions
- **React/Vue** - Map elements to positioned components
- **SVG** - Generate SVG elements with transforms
- **PDF** - Export layouts to PDF documents

## Algorithm Details

Each archetype uses specific positioning algorithms:

- **ZigZag**: Alternating x positions with linear y progression
- **Centerpiece**: Hero at center, supporting in circular arrangement
- **Grid**: Matrix calculation with overlap offset
- **Diagonal**: Linear progression along diagonal axis
- **Symmetric**: Mirrored positioning around vertical centerline
- **Collage**: Randomized positions within bounds

## Performance

- **Layout Generation**: <10ms per layout
- **Memory Usage**: <5MB per layout
- **Max Products**: Up to 10 products per layout
- **Output Size**: ~1-5KB JSON per layout

## Future Enhancements

- [ ] Vision LLM integration for intelligent placement
- [ ] Color palette-based spacing
- [ ] Automatic size optimization
- [ ] Overlap detection and prevention
- [ ] Animation path generation
- [ ] Multi-page layouts
- [ ] Template customization

## License

Part of the Mood Layer project.
