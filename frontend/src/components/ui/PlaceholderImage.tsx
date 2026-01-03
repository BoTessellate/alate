'use client';

import Image from 'next/image';

/**
 * PlaceholderImage - Displays a decorative Moroccan tile pattern
 * Used as placeholder for missing product images
 * Automatically adapts background to light/dark mode
 */

interface PlaceholderImageProps {
  /** Width of the container */
  width?: number | string;
  /** Height of the container */
  height?: number | string;
  /** Custom className */
  className?: string;
}

/**
 * PlaceholderImage component
 * Displays the Moroccan tile pattern placeholder image
 * Automatically inverts/adjusts for dark mode
 */
export function PlaceholderImage({
  width = '100%',
  height = '100%',
  className = '',
}: PlaceholderImageProps) {
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        width,
        height,
        backgroundColor: 'var(--surface)',
      }}
    >
      {/* Light mode image */}
      <Image
        src="/placeholder-missing.png"
        alt="Product image placeholder"
        fill
        className="object-cover dark:brightness-[0.3] dark:contrast-125"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      />
    </div>
  );
}

/**
 * Generate a simple placeholder data URL for blur effect
 * Uses a neutral color that works in both light and dark modes
 */
export function generatePlaceholderStarsSVG(
  width: number = 200,
  height: number = 200
): string {
  // Simple neutral placeholder for blur effect
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#c4a77d"/>
    </svg>
  `.trim().replace(/\s+/g, ' ');

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default PlaceholderImage;
