/**
 * Board Rendering Engine
 * Renders layout JSON to canvas with images and text
 */

import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D, Image } from 'canvas';
import axios from 'axios';
import { LayoutOutput, LayoutElement } from '../layoutGenerator/types';
import { RenderConfig, FontConfig } from './types';

/**
 * Default rendering configuration
 */
const DEFAULT_CONFIG: RenderConfig = {
  background_color: '#f6e9cf',
  default_font: 'Inter',
  label_font_size: 18,
  label_font_color: '#2C2416',
  add_branding: true,
  branding_position: 'bottom-right',
  branding_padding: 30
};

/**
 * Board Renderer Class
 */
export class BoardRenderer {
  private config: RenderConfig;
  private canvas: Canvas;
  private ctx: CanvasRenderingContext2D;

  constructor(width: number, height: number, config: Partial<RenderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.canvas = createCanvas(width, height);
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Render layout to canvas
   */
  async render(layout: LayoutOutput): Promise<Canvas> {
    // Draw background
    this.drawBackground();

    // Sort elements by z-index (lower first)
    const sortedElements = [...layout.elements].sort((a, b) => {
      const zA = a.zIndex !== undefined ? a.zIndex : 0;
      const zB = b.zIndex !== undefined ? b.zIndex : 0;
      return zA - zB;
    });

    // Render each element
    for (const element of sortedElements) {
      await this.renderElement(element);
    }

    // Add branding if enabled
    if (this.config.add_branding) {
      this.addBranding();
    }

    return this.canvas;
  }

  /**
   * Draw background color
   */
  private drawBackground(): void {
    this.ctx.fillStyle = this.config.background_color;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Render a single layout element
   */
  private async renderElement(element: LayoutElement): Promise<void> {
    switch (element.type) {
      case 'image':
        await this.renderImage(element);
        break;

      case 'label':
      case 'text':
      case 'price':
        this.renderText(element);
        break;
    }
  }

  /**
   * Render an image element
   */
  private async renderImage(element: LayoutElement): Promise<void> {
    if (!element.src || !element.size) {
      console.warn('Image element missing src or size:', element);
      return;
    }

    try {
      const image = await this.loadImageFromUrl(element.src);

      this.ctx.save();

      // Apply opacity
      if (element.opacity !== undefined) {
        this.ctx.globalAlpha = element.opacity;
      }

      // Apply rotation
      if (element.rotation) {
        const centerX = element.position.x + element.size.width / 2;
        const centerY = element.position.y + element.size.height / 2;

        this.ctx.translate(centerX, centerY);
        this.ctx.rotate((element.rotation * Math.PI) / 180);
        this.ctx.translate(-centerX, -centerY);
      }

      // Draw image
      this.ctx.drawImage(
        image,
        element.position.x,
        element.position.y,
        element.size.width,
        element.size.height
      );

      this.ctx.restore();
    } catch (error) {
      console.error(`Failed to load image: ${element.src}`, error);
      // Draw placeholder rectangle
      this.drawImagePlaceholder(element);
    }
  }

  /**
   * Load image from URL or local path
   */
  private async loadImageFromUrl(url: string): Promise<Image> {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Load from URL
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 10000 // 10 second timeout
      });
      return await loadImage(Buffer.from(response.data));
    } else {
      // Load from local path
      return await loadImage(url);
    }
  }

  /**
   * Draw placeholder for failed images
   */
  private drawImagePlaceholder(element: LayoutElement): void {
    if (!element.size) return;

    this.ctx.save();
    this.ctx.fillStyle = '#e0e0e0';
    this.ctx.fillRect(
      element.position.x,
      element.position.y,
      element.size.width,
      element.size.height
    );

    this.ctx.strokeStyle = '#bdbdbd';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(
      element.position.x,
      element.position.y,
      element.size.width,
      element.size.height
    );

    // Draw X
    this.ctx.strokeStyle = '#9e9e9e';
    this.ctx.beginPath();
    this.ctx.moveTo(element.position.x, element.position.y);
    this.ctx.lineTo(
      element.position.x + element.size.width,
      element.position.y + element.size.height
    );
    this.ctx.moveTo(element.position.x + element.size.width, element.position.y);
    this.ctx.lineTo(element.position.x, element.position.y + element.size.height);
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Render text element (label, caption, price)
   */
  private renderText(element: LayoutElement): void {
    if (!element.text) {
      console.warn('Text element missing text:', element);
      return;
    }

    const font = this.getFontForStyle(element.style);

    this.ctx.save();
    this.ctx.font = `${font.weight} ${font.size}px ${font.family}`;
    this.ctx.fillStyle = font.color;

    // Apply opacity if specified
    if (element.opacity !== undefined) {
      this.ctx.globalAlpha = element.opacity;
    }

    // Draw text
    this.ctx.fillText(element.text, element.position.x, element.position.y);

    this.ctx.restore();
  }

  /**
   * Get font configuration for text style
   */
  private getFontForStyle(style?: string): FontConfig {
    switch (style) {
      case 'label':
        return {
          family: this.config.default_font,
          size: this.config.label_font_size,
          weight: '600',
          color: this.config.label_font_color
        };

      case 'caption':
        return {
          family: this.config.default_font,
          size: 14,
          weight: '400',
          color: this.config.label_font_color
        };

      case 'price':
        return {
          family: this.config.default_font,
          size: 16,
          weight: '500',
          color: this.config.label_font_color
        };

      case 'heading':
        return {
          family: this.config.default_font,
          size: 24,
          weight: '700',
          color: this.config.label_font_color
        };

      default:
        return {
          family: this.config.default_font,
          size: this.config.label_font_size,
          weight: '400',
          color: this.config.label_font_color
        };
    }
  }

  /**
   * Add Mood Layer branding
   */
  private addBranding(): void {
    const brandText = 'Created with Mood Layer';
    const fontSize = 14;
    const padding = this.config.branding_padding;

    this.ctx.save();
    this.ctx.font = `400 ${fontSize}px ${this.config.default_font}`;
    this.ctx.fillStyle = 'rgba(44, 36, 22, 0.6)';

    const metrics = this.ctx.measureText(brandText);
    const textWidth = metrics.width;
    const textHeight = fontSize;

    let x: number, y: number;

    switch (this.config.branding_position) {
      case 'bottom-right':
        x = this.canvas.width - textWidth - padding;
        y = this.canvas.height - padding;
        break;

      case 'bottom-left':
        x = padding;
        y = this.canvas.height - padding;
        break;

      case 'top-right':
        x = this.canvas.width - textWidth - padding;
        y = padding + textHeight;
        break;

      case 'top-left':
        x = padding;
        y = padding + textHeight;
        break;

      default:
        x = this.canvas.width - textWidth - padding;
        y = this.canvas.height - padding;
    }

    this.ctx.fillText(brandText, x, y);

    this.ctx.restore();
  }

  /**
   * Get canvas
   */
  getCanvas(): Canvas {
    return this.canvas;
  }

  /**
   * Get context
   */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }
}

/**
 * Render layout to canvas (convenience function)
 */
export async function renderLayout(
  layout: LayoutOutput,
  config?: Partial<RenderConfig>
): Promise<Canvas> {
  const renderer = new BoardRenderer(
    layout.canvas_size.width,
    layout.canvas_size.height,
    config
  );

  return await renderer.render(layout);
}
