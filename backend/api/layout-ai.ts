/**
 * Layout AI API - Vercel Serverless Function
 * Combined endpoint for layout generation and smart label placement
 *
 * Routes:
 * GET  /api/layout-ai              - List available layout types
 * POST /api/layout-ai?action=generate - Generate moodboard layout
 * POST /api/layout-ai?action=labels   - AI-powered label placement
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyMiddleware } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';
import { callClaude, parseJSONFromResponse } from '../sdk/shared/secureAI';

const log = createModuleLogger('layout-ai');

// ============================================================================
// TYPES
// ============================================================================

interface ProductPosition {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  z_index: number;
}

interface LayoutResult {
  layout_type: string;
  canvas_size: { width: number; height: number };
  products: ProductPosition[];
  background_color?: string;
}

interface ImagePosition {
  product_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LabelStyle {
  font_size: number;
  color: string;
  placement_preference?: 'above' | 'below' | 'beside' | 'auto';
}

interface LabelPlacement {
  product_name: string;
  position: { x: number; y: number };
  justification: string;
}

type LayoutType = 'zigzag' | 'centerpiece' | 'grid' | 'asymmetric' | 'stacked' | 'diagonal' | 'cluster' | 'magazine';

// ============================================================================
// LAYOUT GENERATORS
// ============================================================================

function generateZigZagLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  const itemWidth = canvasWidth * 0.35;
  const itemHeight = canvasHeight * 0.4;
  const padding = 20;

  products.forEach((product, i) => {
    const isLeft = i % 2 === 0;
    positions.push({
      id: product.id || `product-${i}`,
      name: product.name || `Product ${i + 1}`,
      x: isLeft ? padding : canvasWidth - itemWidth - padding,
      y: padding + (i * (itemHeight * 0.6)),
      width: itemWidth,
      height: itemHeight,
      z_index: i
    });
  });

  return positions;
}

function generateCenterpieceLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];

  if (products.length === 0) return positions;

  const heroWidth = canvasWidth * 0.5;
  const heroHeight = canvasHeight * 0.5;
  positions.push({
    id: products[0].id || 'hero',
    name: products[0].name || 'Hero Product',
    x: (canvasWidth - heroWidth) / 2,
    y: (canvasHeight - heroHeight) / 2,
    width: heroWidth,
    height: heroHeight,
    z_index: products.length
  });

  const supportWidth = canvasWidth * 0.25;
  const supportHeight = canvasHeight * 0.25;
  const corners = [
    { x: 20, y: 20 },
    { x: canvasWidth - supportWidth - 20, y: 20 },
    { x: 20, y: canvasHeight - supportHeight - 20 },
    { x: canvasWidth - supportWidth - 20, y: canvasHeight - supportHeight - 20 }
  ];

  products.slice(1, 5).forEach((product, i) => {
    if (corners[i]) {
      positions.push({
        id: product.id || `support-${i}`,
        name: product.name || `Product ${i + 2}`,
        x: corners[i].x,
        y: corners[i].y,
        width: supportWidth,
        height: supportHeight,
        z_index: i
      });
    }
  });

  return positions;
}

function generateGridLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  const cols = Math.ceil(Math.sqrt(products.length));
  const rows = Math.ceil(products.length / cols);
  const padding = 15;
  const itemWidth = (canvasWidth - padding * (cols + 1)) / cols;
  const itemHeight = (canvasHeight - padding * (rows + 1)) / rows;

  products.forEach((product, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({
      id: product.id || `grid-${i}`,
      name: product.name || `Product ${i + 1}`,
      x: padding + col * (itemWidth + padding),
      y: padding + row * (itemHeight + padding),
      width: itemWidth,
      height: itemHeight,
      z_index: i
    });
  });

  return positions;
}

function generateAsymmetricLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  const sizes = [
    { w: 0.45, h: 0.55 },
    { w: 0.35, h: 0.4 },
    { w: 0.3, h: 0.35 },
    { w: 0.4, h: 0.45 },
    { w: 0.25, h: 0.3 }
  ];

  let currentX = 20;
  let currentY = 20;
  let maxRowHeight = 0;

  products.forEach((product, i) => {
    const sizeIndex = i % sizes.length;
    const width = canvasWidth * sizes[sizeIndex].w;
    const height = canvasHeight * sizes[sizeIndex].h;

    if (currentX + width > canvasWidth - 20) {
      currentX = 20;
      currentY += maxRowHeight + 15;
      maxRowHeight = 0;
    }

    positions.push({
      id: product.id || `asym-${i}`,
      name: product.name || `Product ${i + 1}`,
      x: currentX,
      y: currentY,
      width,
      height,
      z_index: i
    });

    currentX += width + 15;
    maxRowHeight = Math.max(maxRowHeight, height);
  });

  return positions;
}

function generateStackedLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  const itemWidth = canvasWidth * 0.6;
  const itemHeight = canvasHeight * 0.4;
  const offsetX = 30;
  const offsetY = 50;

  products.forEach((product, i) => {
    positions.push({
      id: product.id || `stack-${i}`,
      name: product.name || `Product ${i + 1}`,
      x: (canvasWidth - itemWidth) / 2 + (i * offsetX),
      y: 50 + (i * offsetY),
      width: itemWidth,
      height: itemHeight,
      z_index: products.length - i
    });
  });

  return positions;
}

function generateDiagonalLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  const itemWidth = canvasWidth * 0.3;
  const itemHeight = canvasHeight * 0.35;

  products.forEach((product, i) => {
    const progress = i / Math.max(products.length - 1, 1);
    positions.push({
      id: product.id || `diag-${i}`,
      name: product.name || `Product ${i + 1}`,
      x: 20 + progress * (canvasWidth - itemWidth - 40),
      y: 20 + progress * (canvasHeight - itemHeight - 40),
      width: itemWidth,
      height: itemHeight,
      rotation: -5 + (i * 2),
      z_index: i
    });
  });

  return positions;
}

function generateClusterLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  const radius = Math.min(canvasWidth, canvasHeight) * 0.35;
  const itemSize = canvasWidth * 0.2;

  products.forEach((product, i) => {
    const angle = (i / products.length) * Math.PI * 2 - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius - itemSize / 2;
    const y = centerY + Math.sin(angle) * radius - itemSize / 2;

    positions.push({
      id: product.id || `cluster-${i}`,
      name: product.name || `Product ${i + 1}`,
      x,
      y,
      width: itemSize,
      height: itemSize,
      z_index: i
    });
  });

  return positions;
}

function generateMagazineLayout(products: any[], canvasWidth: number, canvasHeight: number): ProductPosition[] {
  const positions: ProductPosition[] = [];

  if (products.length > 0) {
    positions.push({
      id: products[0].id || 'featured',
      name: products[0].name || 'Featured',
      x: 20,
      y: 20,
      width: canvasWidth * 0.6,
      height: canvasHeight * 0.65,
      z_index: 0
    });
  }

  const sidebarWidth = canvasWidth * 0.35;
  const sidebarHeight = canvasHeight * 0.3;
  const sidebarX = canvasWidth - sidebarWidth - 20;

  products.slice(1, 3).forEach((product, i) => {
    positions.push({
      id: product.id || `sidebar-${i}`,
      name: product.name || `Sidebar ${i + 1}`,
      x: sidebarX,
      y: 20 + i * (sidebarHeight + 15),
      width: sidebarWidth,
      height: sidebarHeight,
      z_index: i + 1
    });
  });

  const bottomWidth = canvasWidth * 0.28;
  const bottomHeight = canvasHeight * 0.25;
  products.slice(3, 6).forEach((product, i) => {
    positions.push({
      id: product.id || `bottom-${i}`,
      name: product.name || `Bottom ${i + 1}`,
      x: 20 + i * (bottomWidth + 15),
      y: canvasHeight - bottomHeight - 20,
      width: bottomWidth,
      height: bottomHeight,
      z_index: i + 3
    });
  });

  return positions;
}

const layoutGenerators: Record<LayoutType, typeof generateGridLayout> = {
  zigzag: generateZigZagLayout,
  centerpiece: generateCenterpieceLayout,
  grid: generateGridLayout,
  asymmetric: generateAsymmetricLayout,
  stacked: generateStackedLayout,
  diagonal: generateDiagonalLayout,
  cluster: generateClusterLayout,
  magazine: generateMagazineLayout
};

// ============================================================================
// SMART LABELS
// ============================================================================

function buildVisionPrompt(
  image_positions: ImagePosition[],
  label_style: LabelStyle,
  canvas_size: { width: number; height: number }
): string {
  return `You are a moodboard layout assistant. Given product image positions on a canvas, determine optimal label placement.

Canvas size: ${canvas_size.width}x${canvas_size.height}

Product images positioned at:
${image_positions.map((pos, i) =>
  `${i + 1}. "${pos.product_name}" at (${pos.x}, ${pos.y}), size ${pos.width}x${pos.height}`
).join('\n')}

Label style: ${label_style.font_size}px, color ${label_style.color}, preference: ${label_style.placement_preference || 'auto'}

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
]`;
}

function generateRuleBasedLabels(
  image_positions: ImagePosition[],
  label_style: LabelStyle,
  canvas_size: { width: number; height: number }
): LabelPlacement[] {
  return image_positions.map(pos => {
    let x = pos.x;
    let y = pos.y;
    let justification = '';

    const preference = label_style.placement_preference || 'auto';

    switch (preference) {
      case 'above':
        y = pos.y - label_style.font_size - 10;
        justification = 'Placed above image as requested';
        break;
      case 'below':
        y = pos.y + pos.height + 10;
        justification = 'Placed below image as requested';
        break;
      case 'beside':
        x = pos.x + pos.width + 10;
        y = pos.y + pos.height / 2;
        justification = 'Placed beside image as requested';
        break;
      default:
        if (pos.y + pos.height + label_style.font_size + 10 < canvas_size.height) {
          y = pos.y + pos.height + 10;
          justification = 'Auto-placed below image';
        } else if (pos.y - label_style.font_size - 10 > 0) {
          y = pos.y - label_style.font_size - 10;
          justification = 'Auto-placed above (no room below)';
        } else {
          y = pos.y + pos.height - label_style.font_size - 5;
          justification = 'Overlaid on image (constrained space)';
        }
    }

    x = Math.max(10, Math.min(x, canvas_size.width - 100));
    y = Math.max(10, Math.min(y, canvas_size.height - label_style.font_size - 5));

    return {
      product_name: pos.product_name,
      position: { x, y },
      justification
    };
  });
}

// ============================================================================
// HANDLERS
// ============================================================================

function handleListLayouts(res: VercelResponse) {
  return res.status(200).json({
    layouts: [
      { type: 'zigzag', name: 'ZigZag', description: 'Alternating left-right placement' },
      { type: 'centerpiece', name: 'Centerpiece', description: 'Hero product in center' },
      { type: 'grid', name: 'Grid', description: 'Balanced grid layout' },
      { type: 'asymmetric', name: 'Asymmetric', description: 'Pinterest-style dynamic' },
      { type: 'stacked', name: 'Stacked', description: 'Vertical cascade with overlaps' },
      { type: 'diagonal', name: 'Diagonal', description: 'Products along diagonal' },
      { type: 'cluster', name: 'Cluster', description: 'Circular grouping' },
      { type: 'magazine', name: 'Magazine', description: 'Editorial style layout' }
    ]
  });
}

function handleGenerateLayout(req: VercelRequest, res: VercelResponse) {
  const { layout_type, products, canvas_width = 1200, canvas_height = 800 } = req.body;

  if (!layout_type) {
    return res.status(400).json({ error: 'layout_type is required' });
  }

  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ error: 'products array is required' });
  }

  const generator = layoutGenerators[layout_type as LayoutType];

  if (!generator) {
    return res.status(400).json({
      error: `Invalid layout_type. Available: ${Object.keys(layoutGenerators).join(', ')}`
    });
  }

  const positions = generator(products, canvas_width, canvas_height);

  const result: LayoutResult = {
    layout_type,
    canvas_size: { width: canvas_width, height: canvas_height },
    products: positions
  };

  return res.status(200).json(result);
}

async function handleSmartLabels(req: VercelRequest, res: VercelResponse) {
  const {
    image_positions,
    label_style,
    canvas_size
  } = req.body as {
    image_positions: ImagePosition[];
    label_style: LabelStyle;
    canvas_size: { width: number; height: number };
  };

  if (!image_positions || !Array.isArray(image_positions)) {
    return res.status(400).json({ error: 'image_positions array is required' });
  }

  const defaultLabelStyle = label_style || { font_size: 14, color: '#000000' };
  const defaultCanvasSize = canvas_size || { width: 1200, height: 800 };

  try {
    const prompt = buildVisionPrompt(image_positions, defaultLabelStyle, defaultCanvasSize);
    const aiResponse = await callClaude(prompt, { maxTokens: 1024 });

    let placements: LabelPlacement[] = [];

    if (aiResponse.success && aiResponse.text) {
      const parsed = parseJSONFromResponse(aiResponse.text);
      if (Array.isArray(parsed)) {
        placements = parsed;
      }
    }

    if (placements.length === 0) {
      log.info('AI label placement failed, using rule-based fallback');
      placements = generateRuleBasedLabels(image_positions, defaultLabelStyle, defaultCanvasSize);

      return res.status(200).json({
        success: true,
        label_placements: placements,
        method: 'rule-based-fallback'
      });
    }

    return res.status(200).json({
      success: true,
      label_placements: placements,
      method: 'ai',
      model_used: 'claude-via-edge-function'
    });
  } catch (error) {
    log.error({ error }, 'Smart label generation failed');

    const placements = generateRuleBasedLabels(image_positions, defaultLabelStyle, defaultCanvasSize);

    return res.status(200).json({
      success: true,
      label_placements: placements,
      method: 'rule-based-fallback',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const handled = applyMiddleware(req, res);
  if (handled) return;

  const action = req.query.action as string;

  // GET request without action - list layouts
  if (req.method === 'GET' && !action) {
    return handleListLayouts(res);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  switch (action) {
    case 'generate':
      return handleGenerateLayout(req, res);

    case 'labels':
      return handleSmartLabels(req, res);

    default:
      // Default to generate for backwards compatibility
      return handleGenerateLayout(req, res);
  }
}
