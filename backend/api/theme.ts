/**
 * Theme Tokens API - Vercel Serverless Function
 * Extracts color palettes and design tokens from products
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyMiddleware } from '../sdk/shared/middleware';

interface ColorTokens {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
  textSecondary: string;
}

interface ThemeTokens {
  colors: ColorTokens;
  typography: {
    fontFamily: string;
    sizes: {
      small: string;
      medium: string;
      large: string;
      xlarge: string;
    };
  };
  spacing: {
    small: string;
    medium: string;
    large: string;
    xlarge: string;
  };
  export_formats: {
    figma: any;
    canva: any;
    css: string;
  };
}

// Color utility functions
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function getBrightness(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 128;
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
}

function getComplementary(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  return '#' + [255 - rgb.r, 255 - rgb.g, 255 - rgb.b]
    .map(c => c.toString(16).padStart(2, '0'))
    .join('');
}

function colorNameToHex(name: string): string {
  const colors: Record<string, string> = {
    // Basic colors
    'white': '#FFFFFF', 'black': '#000000', 'gray': '#808080', 'grey': '#808080',
    'red': '#FF0000', 'green': '#008000', 'blue': '#0000FF', 'yellow': '#FFFF00',
    'orange': '#FFA500', 'purple': '#800080', 'pink': '#FFC0CB', 'brown': '#A52A2A',
    // Earth tones
    'beige': '#F5F5DC', 'cream': '#FFFDD0', 'tan': '#D2B48C', 'sand': '#C2B280',
    'terracotta': '#E2725B', 'rust': '#B7410E', 'sienna': '#A0522D', 'ochre': '#CC7722',
    'ivory': '#FFFFF0', 'khaki': '#C3B091', 'olive': '#808000', 'sage': '#BCB88A',
    // Cool tones
    'navy': '#000080', 'teal': '#008080', 'turquoise': '#40E0D0', 'aqua': '#00FFFF',
    'indigo': '#4B0082', 'lavender': '#E6E6FA', 'periwinkle': '#CCCCFF',
    // Warm tones
    'coral': '#FF7F50', 'salmon': '#FA8072', 'peach': '#FFCBA4', 'apricot': '#FBCEB1',
    'maroon': '#800000', 'burgundy': '#800020', 'wine': '#722F37',
    // Nature
    'forest': '#228B22', 'emerald': '#50C878', 'mint': '#98FB98', 'moss': '#8A9A5B',
    'sky': '#87CEEB', 'ocean': '#006994', 'midnight': '#191970',
    // Neutrals
    'charcoal': '#36454F', 'slate': '#708090', 'silver': '#C0C0C0', 'ash': '#B2BEB5',
    'natural': '#C8AD7F', 'neutral': '#8B8B7A', 'taupe': '#483C32', 'coffee': '#6F4E37',
    'chocolate': '#7B3F00', 'espresso': '#3C2415', 'caramel': '#FFD59A', 'honey': '#EB9605'
  };

  const lowered = name.toLowerCase().trim();

  // Direct match
  if (colors[lowered]) return colors[lowered];

  // Partial match
  for (const [key, value] of Object.entries(colors)) {
    if (lowered.includes(key) || key.includes(lowered)) {
      return value;
    }
  }

  // Default neutral
  return '#808080';
}

function findDominantColor(colors: string[]): string {
  if (colors.length === 0) return '#4A5568';

  // Convert to hex and find most saturated
  let dominantColor = colors[0];
  let maxSaturation = 0;

  for (const color of colors) {
    const hex = color.startsWith('#') ? color : colorNameToHex(color);
    const rgb = hexToRgb(hex);
    if (rgb) {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      if (hsl.s > maxSaturation) {
        maxSaturation = hsl.s;
        dominantColor = hex;
      }
    }
  }

  return dominantColor.startsWith('#') ? dominantColor : colorNameToHex(dominantColor);
}

function generateColorTokens(productColors: string[][]): ColorTokens {
  // Flatten all colors
  const allColors = productColors.flat().map(c =>
    c.startsWith('#') ? c : colorNameToHex(c)
  );

  const primary = findDominantColor(allColors);
  const secondary = allColors[1] ? (allColors[1].startsWith('#') ? allColors[1] : colorNameToHex(allColors[1])) : '#718096';
  const accent = getComplementary(primary);

  const brightness = getBrightness(primary);
  const background = brightness > 128 ? '#FFFFFF' : primary;
  const text = brightness > 128 ? '#1A202C' : '#FFFFFF';

  return {
    primary,
    secondary,
    accent,
    background,
    text,
    textSecondary: brightness > 128 ? '#4A5568' : '#E2E8F0'
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apply CORS, rate limiting, and security headers
  const handled = applyMiddleware(req, res);
  if (handled) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { products, canvas_size } = req.body;

  if (!products || !Array.isArray(products)) {
    return res.status(400).json({ error: 'products array is required' });
  }

  // Extract color palettes from products
  const productColors: string[][] = products.map((p: any) =>
    p.color_palette || p.colors || []
  );

  const colors = generateColorTokens(productColors);

  // Generate responsive spacing based on canvas size
  const baseUnit = canvas_size?.width ? canvas_size.width / 100 : 12;

  const theme: ThemeTokens = {
    colors,
    typography: {
      fontFamily: 'Inter, system-ui, sans-serif',
      sizes: {
        small: `${Math.round(baseUnit * 1)}px`,
        medium: `${Math.round(baseUnit * 1.5)}px`,
        large: `${Math.round(baseUnit * 2)}px`,
        xlarge: `${Math.round(baseUnit * 3)}px`
      }
    },
    spacing: {
      small: `${Math.round(baseUnit * 0.5)}px`,
      medium: `${Math.round(baseUnit * 1)}px`,
      large: `${Math.round(baseUnit * 2)}px`,
      xlarge: `${Math.round(baseUnit * 4)}px`
    },
    export_formats: {
      figma: {
        colors: {
          'Primary': { value: colors.primary, type: 'color' },
          'Secondary': { value: colors.secondary, type: 'color' },
          'Accent': { value: colors.accent, type: 'color' },
          'Background': { value: colors.background, type: 'color' },
          'Text': { value: colors.text, type: 'color' }
        }
      },
      canva: {
        brandKit: {
          colors: [colors.primary, colors.secondary, colors.accent],
          fonts: ['Inter']
        }
      },
      css: `:root {
  --color-primary: ${colors.primary};
  --color-secondary: ${colors.secondary};
  --color-accent: ${colors.accent};
  --color-background: ${colors.background};
  --color-text: ${colors.text};
  --color-text-secondary: ${colors.textSecondary};
}`
    }
  };

  return res.status(200).json(theme);
}
