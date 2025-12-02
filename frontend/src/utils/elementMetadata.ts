import { openDesign } from '@canva/design';

/**
 * Element metadata storage utility using element naming convention.
 *
 * ARCHITECTURE DECISION:
 * Since regular Canva elements (added via addElementAtPoint) don't support custom
 * data properties, we use a naming convention to link labels to images:
 *
 * - Product images: No special naming needed, tracked by element ID
 * - Brand labels: Named "moodboard-label-brand-{imageId}"
 * - Price labels: Named "moodboard-label-price-{imageId}"
 *
 * We also maintain a localStorage mapping of imageId -> product metadata for
 * quick lookups without parsing element names.
 *
 * This approach:
 * - Works with regular Canva elements
 * - Persists with the design file
 * - Allows independent label positioning
 * - Enables smart repositioning after layout changes
 */

export interface ProductMetadata {
  imageId: string;
  brandName: string | null;
  productName: string | null;
  price: string | null;
  currency: string | null;
  sourceUrl: string | null;
  addedAt: number;
}

const METADATA_STORAGE_KEY = 'moodboard_product_metadata';

/**
 * Store product metadata in localStorage.
 * This persists across sessions and allows quick lookups.
 */
export function saveProductMetadata(metadata: ProductMetadata): void {
  try {
    const existing = loadAllProductMetadata();
    existing.set(metadata.imageId, metadata);

    const dataToStore = Array.from(existing.entries());
    localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(dataToStore));
  } catch (error) {
    console.error('Failed to save product metadata:', error);
  }
}

/**
 * Load all product metadata from localStorage.
 */
export function loadAllProductMetadata(): Map<string, ProductMetadata> {
  try {
    const stored = localStorage.getItem(METADATA_STORAGE_KEY);
    if (!stored) {
      return new Map();
    }

    const parsed = JSON.parse(stored) as Array<[string, ProductMetadata]>;
    return new Map(parsed);
  } catch (error) {
    console.error('Failed to load product metadata:', error);
    return new Map();
  }
}

/**
 * Get product metadata for a specific image ID.
 */
export function getProductMetadata(imageId: string): ProductMetadata | null {
  const allMetadata = loadAllProductMetadata();
  return allMetadata.get(imageId) || null;
}

/**
 * Delete product metadata (when an image is removed).
 */
export function deleteProductMetadata(imageId: string): void {
  try {
    const existing = loadAllProductMetadata();
    existing.delete(imageId);

    const dataToStore = Array.from(existing.entries());
    localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(dataToStore));
  } catch (error) {
    console.error('Failed to delete product metadata:', error);
  }
}

/**
 * Generate a label name that links it to its parent image.
 */
export function createLabelName(type: 'brand' | 'price', imageId: string): string {
  return `moodboard-label-${type}-${imageId}`;
}

/**
 * Parse a label name to extract the parent image ID.
 * Returns null if the name doesn't match our pattern.
 */
export function parseLabelName(name: string): { type: 'brand' | 'price'; imageId: string } | null {
  const match = name.match(/^moodboard-label-(brand|price)-(.+)$/);
  if (!match) {
    return null;
  }

  return {
    type: match[1] as 'brand' | 'price',
    imageId: match[2],
  };
}

/**
 * Find all labels associated with a specific image ID on the canvas.
 */
export async function getLabelsForImage(imageId: string): Promise<{
  brandLabel: any | null;
  priceLabel: any | null;
}> {
  let brandLabel = null;
  let priceLabel = null;

  await openDesign({ type: 'current_page' }, async (session) => {
    const page = session.page as any;
    const elements = page.elements?.toArray() || [];

    const brandName = createLabelName('brand', imageId);
    const priceName = createLabelName('price', imageId);

    for (const element of elements) {
      if (element.type === 'text' && element.name) {
        if (element.name === brandName) {
          brandLabel = element;
        } else if (element.name === priceName) {
          priceLabel = element;
        }
      }
    }
  });

  return { brandLabel, priceLabel };
}

/**
 * Get all product images on the canvas with their metadata.
 * This searches for images that have associated metadata in localStorage.
 */
export async function getAllProductImages(): Promise<
  Array<{ element: any; metadata: ProductMetadata }>
> {
  const allMetadata = loadAllProductMetadata();
  const products: Array<{ element: any; metadata: ProductMetadata }> = [];

  await openDesign({ type: 'current_page' }, async (session) => {
    const page = session.page as any;
    const elements = page.elements?.toArray() || [];

    for (const element of elements) {
      if (element.type === 'image' && element.id) {
        const metadata = allMetadata.get(element.id);
        if (metadata) {
          products.push({ element, metadata });
        }
      }
    }
  });

  return products;
}

/**
 * Clean up orphaned metadata (metadata for images that no longer exist on canvas).
 * Call this periodically to keep localStorage clean.
 */
export async function cleanupOrphanedMetadata(): Promise<void> {
  const allMetadata = loadAllProductMetadata();

  await openDesign({ type: 'current_page' }, async (session) => {
    const page = session.page as any;
    const elements = page.elements?.toArray() || [];

    // Get all image IDs currently on canvas
    const currentImageIds = new Set(
      elements
        .filter((el: any) => el.type === 'image')
        .map((el: any) => el.id)
    );

    // Remove metadata for images that no longer exist
    for (const imageId of allMetadata.keys()) {
      if (!currentImageIds.has(imageId)) {
        deleteProductMetadata(imageId);
      }
    }
  });
}
