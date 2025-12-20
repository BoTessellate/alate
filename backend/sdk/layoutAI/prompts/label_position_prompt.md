# Smart Label Placement - Vision Model Prompt Specification

## Task 18: Smart Label Placement Flow

This document specifies the prompts used for GPT-4V and Claude-based label placement.

---

## GPT-4V Prompt (Image-Based Analysis)

### System Prompt

```
You are a visual layout assistant specializing in moodboard design.
Analyze the provided canvas image and suggest optimal label placements for product brand names and prices.

Rules:
- Labels must not overlap with product images in ways that obscure important details
- Labels must not overlap with each other
- Prefer placing labels below or to the side of products
- Use consistent font sizes for visual harmony
- Consider the overall layout goal provided
- Artistic/intentional overlaps are acceptable if they enhance the design

Return a JSON array with placement suggestions for each product.
```

### User Prompt Template

```
Layout Goal: {layoutGoal}

Products to label:
{productList}

Analyze the canvas image and provide label placements as a JSON array with this structure:
[
  {
    "id": "product-id",
    "labelX": number,
    "labelY": number,
    "fontSize": number (10-18),
    "style": "bold" | "italic" (optional),
    "notes": "placement reasoning" (optional)
  }
]

Return ONLY the JSON array, no other text.
```

---

## Claude Prompt (Text-Based Analysis)

### System Context

Claude analyzes product positions without seeing the actual image. It uses spatial reasoning based on coordinates.

### Prompt Template

```
You are a design expert analyzing a moodboard layout.

Canvas dimensions: {width}x{height}px

Product images positioned at:
1. "{productName}" at ({x}, {y}), size {width}x{height}
2. ...

Label style: {fontSize}px, color {color}, preference: {placementPreference}

Task: Determine optimal label placement for each product that:
1. Avoids UNSIGHTLY overlaps with images (artistic/intentional overlaps are OK if they enhance the design)
2. Maintains visual hierarchy and balance
3. Is easily readable with good contrast
4. Follows modern moodboard design best practices (labels can be positioned creatively)
5. Considers the overall aesthetic - some strategic overlaps can create visual interest

Note: Moodboards often have intentional, aesthetic overlaps. Avoid only those overlaps that would:
- Obscure important product details
- Make text unreadable
- Create visual confusion
- Break the design hierarchy

Return ONLY a JSON array in this exact format:
[
  {
    "product_name": "product name",
    "position": { "x": 100, "y": 200 },
    "justification": "brief reason"
  }
]
```

---

## Placement Strategies

### Below Product (Default)
- Position: `{ x: product.x, y: product.y + product.height + padding }`
- Best for: Standard grid layouts, products with clear bottom edges

### Above Product
- Position: `{ x: product.x, y: product.y - labelHeight - padding }`
- Best for: Products at bottom of canvas, hero images

### Beside Product (Right)
- Position: `{ x: product.x + product.width + padding, y: product.y + product.height/2 }`
- Best for: Wide products, horizontal layouts

### Beside Product (Left)
- Position: `{ x: product.x - labelWidth - padding, y: product.y + product.height/2 }`
- Best for: Products on right edge of canvas

### Corner Overlay (Aesthetic)
- Position: `{ x: product.x + product.width - labelWidth - margin, y: product.y + product.height - labelHeight - margin }`
- Best for: Editorial/magazine style layouts

---

## Collision Detection

### Algorithm

```typescript
function detectCollision(
  label: { x: number; y: number; width: number; height: number },
  element: { x: number; y: number; width: number; height: number }
): boolean {
  return !(
    label.x + label.width < element.x ||
    label.x > element.x + element.width ||
    label.y + label.height < element.y ||
    label.y > element.y + element.height
  );
}
```

### Collision Resolution

1. Try default position (below)
2. If collision, try above
3. If collision, try right
4. If collision, try left
5. If all fail, use corner overlay with reduced opacity

---

## Font Size Guidelines

| Product Count | Recommended Font Size |
|--------------|----------------------|
| 1-2          | 16-18px              |
| 3-4          | 14-16px              |
| 5-6          | 12-14px              |
| 7+           | 10-12px              |

---

## Response Format

### Success Response

```json
[
  {
    "id": "product-0",
    "labelX": 120,
    "labelY": 340,
    "fontSize": 14,
    "style": "bold",
    "notes": "Positioned below product, clear whitespace"
  },
  {
    "id": "product-1",
    "labelX": 450,
    "labelY": 180,
    "fontSize": 14,
    "style": "bold",
    "notes": "Right side placement to avoid overlap with product-0"
  }
]
```

### Fallback Behavior

If vision model fails or returns invalid JSON:
1. Use rule-based fallback positioning
2. Apply collision detection algorithm
3. Log error for monitoring

---

## Test Scenarios

### 1. Single Product (Whitespace Optimized)
- Input: 1 product centered on canvas
- Expected: Label centered below product

### 2. Grid Layout (4 Products)
- Input: 2x2 grid of products
- Expected: Labels below each product, no overlaps

### 3. Overlapping Products (Collage)
- Input: 5 products with intentional overlaps
- Expected: Labels in whitespace areas, creative positioning

### 4. Edge Cases
- Product touching canvas edge
- Very small products
- Very large products

---

## Integration Points

1. **generateSmartLabels.ts** - Main entry point
2. **visionClient.ts** - Claude/GPT-4V abstraction
3. **Label.tsx** - Frontend component
4. **layoutGenerator** - Layout output with label positions
