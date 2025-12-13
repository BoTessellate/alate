/**
 * Theme Token Generation
 * Extracts design tokens from product layouts
 */

import { LayoutOutput } from '../layoutGenerator/types';
import { getDominantColor, isLightColor, getAnalogousColors, lightenColor, darkenColor } from './colorUtils';

export interface ThemeTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    textSecondary: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      small: number;
      medium: number;
      large: number;
      xlarge: number;
    };
  };
  spacing: {
    small: number;
    medium: number;
    large: number;
    xlarge: number;
  };
  metadata: {
    generated_at: string;
    source: 'layout' | 'products' | 'manual';
  };
}

/**
 * Generate theme tokens from layout and products
 */
export async function generateThemeTokens(
  layout: LayoutOutput,
  products: any[]
): Promise<ThemeTokens> {
  // Collect all colors from products
  const allColors: string[] = [];

  for (const product of products) {
    if (product.color_palette && Array.isArray(product.color_palette)) {
      allColors.push(...product.color_palette);
    }
  }

  // Extract dominant colors
  const primary = getDominantColor(allColors);
  const analogous = getAnalogousColors(primary, 2);
  const secondary = analogous[0] || lightenColor(primary, 20);
  const accent = analogous[1] || darkenColor(primary, 15);

  // Determine text colors based on primary color
  const isPrimaryLight = isLightColor(primary);
  const textColor = isPrimaryLight ? '#2C2416' : '#FFFFFF';
  const textSecondary = isPrimaryLight ? '#6B5D4F' : '#E0E0E0';

  // Generate typography tokens
  const typography = {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: {
      small: 14,
      medium: 18,
      large: 24,
      xlarge: 32
    }
  };

  // Generate spacing tokens based on canvas size
  const baseSpacing = Math.round(layout.canvas_size.width / 60);
  const spacing = {
    small: baseSpacing,
    medium: baseSpacing * 2,
    large: baseSpacing * 3,
    xlarge: baseSpacing * 4
  };

  return {
    colors: {
      primary,
      secondary,
      accent,
      background: '#F6E9CF',
      text: textColor,
      textSecondary
    },
    typography,
    spacing,
    metadata: {
      generated_at: new Date().toISOString(),
      source: 'layout'
    }
  };
}

/**
 * Convert theme tokens to Figma format
 */
export function toFigmaTokens(tokens: ThemeTokens): any {
  return {
    colors: Object.entries(tokens.colors).map(([name, value]) => ({
      name: `color/${name}`,
      value,
      type: 'color'
    })),
    typography: {
      fontFamily: {
        name: 'typography/fontFamily',
        value: tokens.typography.fontFamily,
        type: 'string'
      },
      fontSize: Object.entries(tokens.typography.fontSize).map(([name, value]) => ({
        name: `typography/fontSize/${name}`,
        value: `${value}px`,
        type: 'dimension'
      }))
    },
    spacing: Object.entries(tokens.spacing).map(([name, value]) => ({
      name: `spacing/${name}`,
      value: `${value}px`,
      type: 'dimension'
    }))
  };
}

/**
 * Convert theme tokens to Canva format
 */
export function toCanvaTokens(tokens: ThemeTokens): any {
  return {
    brandColors: [
      { name: 'Primary', hex: tokens.colors.primary },
      { name: 'Secondary', hex: tokens.colors.secondary },
      { name: 'Accent', hex: tokens.colors.accent },
      { name: 'Background', hex: tokens.colors.background }
    ],
    brandFonts: [
      {
        family: tokens.typography.fontFamily.split(',')[0].trim(),
        sizes: Object.values(tokens.typography.fontSize)
      }
    ],
    spacing: tokens.spacing
  };
}

/**
 * Export tokens as CSS variables
 */
export function toCSSVariables(tokens: ThemeTokens): string {
  const cssVars: string[] = [
    ':root {',
    `  /* Colors */`,
    ...Object.entries(tokens.colors).map(([name, value]) =>
      `  --color-${name}: ${value};`
    ),
    ``,
    `  /* Typography */`,
    `  --font-family: ${tokens.typography.fontFamily};`,
    ...Object.entries(tokens.typography.fontSize).map(([name, value]) =>
      `  --font-size-${name}: ${value}px;`
    ),
    ``,
    `  /* Spacing */`,
    ...Object.entries(tokens.spacing).map(([name, value]) =>
      `  --spacing-${name}: ${value}px;`
    ),
    '}'
  ];

  return cssVars.join('\n');
}
