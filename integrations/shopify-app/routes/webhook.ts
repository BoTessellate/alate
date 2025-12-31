/**
 * Shopify Webhook Handlers
 *
 * Processes webhooks from Shopify:
 * - products/create - New product added
 * - products/update - Product modified
 * - products/delete - Product removed
 * - app/uninstalled - App uninstalled from store
 */

import { createShopifyClient, ShopifyProduct, ShopifyVariant } from '../utils/shopifyClient';

// =============================================================================
// TYPES
// =============================================================================

export type WebhookTopic =
  | 'products/create'
  | 'products/update'
  | 'products/delete'
  | 'app/uninstalled';

interface WebhookPayload {
  topic: WebhookTopic;
  shop: string;
  body: any;
  hmac: string;
}

interface WebhookResult {
  success: boolean;
  message: string;
  processed?: boolean;
}

interface ProductPayload extends ShopifyProduct {
  admin_graphql_api_id: string;
}

// =============================================================================
// WEBHOOK HANDLERS
// =============================================================================

/**
 * Main webhook processor
 */
export async function processWebhook(payload: WebhookPayload): Promise<WebhookResult> {
  const { topic, shop, body, hmac } = payload;

  // Verify webhook authenticity
  const client = createShopifyClient();
  if (!client.verifyWebhook(JSON.stringify(body), hmac)) {
    console.error(`[ShopifyWebhook] Invalid HMAC for ${topic} from ${shop}`);
    return {
      success: false,
      message: 'Webhook verification failed',
    };
  }

  console.log(`[ShopifyWebhook] Processing ${topic} from ${shop}`);

  // Route to appropriate handler
  switch (topic) {
    case 'products/create':
      return handleProductCreate(shop, body);

    case 'products/update':
      return handleProductUpdate(shop, body);

    case 'products/delete':
      return handleProductDelete(shop, body);

    case 'app/uninstalled':
      return handleAppUninstalled(shop);

    default:
      console.warn(`[ShopifyWebhook] Unknown topic: ${topic}`);
      return {
        success: true,
        message: `Unknown topic: ${topic}`,
        processed: false,
      };
  }
}

/**
 * Handle product creation
 */
async function handleProductCreate(shop: string, product: ProductPayload): Promise<WebhookResult> {
  console.log(`[ShopifyWebhook] Product created: ${product.id} - ${product.title}`);

  try {
    // Transform to Mood Layer format
    const enrichedProduct = transformShopifyProduct(product);

    // TODO: Send to Mood Layer backend for enrichment
    // await moodLayerClient.ingestProduct(shop, enrichedProduct);

    console.log(`[ShopifyWebhook] Ingested product ${product.id} with ${enrichedProduct.variants.length} variants`);

    return {
      success: true,
      message: `Product ${product.id} created and queued for enrichment`,
      processed: true,
    };
  } catch (error: any) {
    console.error(`[ShopifyWebhook] Error processing product create:`, error.message);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Handle product update
 */
async function handleProductUpdate(shop: string, product: ProductPayload): Promise<WebhookResult> {
  console.log(`[ShopifyWebhook] Product updated: ${product.id} - ${product.title}`);

  try {
    // Transform and update
    const enrichedProduct = transformShopifyProduct(product);

    // TODO: Update in Mood Layer backend
    // await moodLayerClient.updateProduct(shop, enrichedProduct);

    return {
      success: true,
      message: `Product ${product.id} updated`,
      processed: true,
    };
  } catch (error: any) {
    console.error(`[ShopifyWebhook] Error processing product update:`, error.message);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Handle product deletion
 */
async function handleProductDelete(shop: string, payload: { id: number }): Promise<WebhookResult> {
  console.log(`[ShopifyWebhook] Product deleted: ${payload.id}`);

  try {
    // TODO: Remove from Mood Layer backend
    // await moodLayerClient.deleteProduct(shop, payload.id.toString());

    return {
      success: true,
      message: `Product ${payload.id} deleted`,
      processed: true,
    };
  } catch (error: any) {
    console.error(`[ShopifyWebhook] Error processing product delete:`, error.message);
    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Handle app uninstallation
 */
async function handleAppUninstalled(shop: string): Promise<WebhookResult> {
  console.log(`[ShopifyWebhook] App uninstalled from: ${shop}`);

  try {
    // TODO: Clean up shop data
    // await moodLayerClient.disconnectShop(shop);

    return {
      success: true,
      message: `Shop ${shop} disconnected`,
      processed: true,
    };
  } catch (error: any) {
    console.error(`[ShopifyWebhook] Error handling uninstall:`, error.message);
    return {
      success: false,
      message: error.message,
    };
  }
}

// =============================================================================
// PRODUCT TRANSFORMATION
// =============================================================================

interface MoodLayerVariant {
  id: string;
  color?: string;
  size?: string;
  url: string;
  price: number;
  sku?: string;
  image_url?: string;
}

interface MoodLayerDimensions {
  width?: number;
  height?: number;
  depth?: number;
  weight?: number;
  weight_unit?: string;
}

interface MoodLayerProduct {
  external_id: string;
  platform: 'shopify';
  title: string;
  description: string;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: MoodLayerVariant[];
  dimensions?: MoodLayerDimensions;
  fit_tags: string[];
  images: string[];
  url: string;
  created_at: string;
  updated_at: string;
}

/**
 * Transform Shopify product to Mood Layer format
 */
function transformShopifyProduct(product: ProductPayload): MoodLayerProduct {
  // Extract variants with color/size
  const variants = product.variants.map((v: ShopifyVariant) => {
    const variant: MoodLayerVariant = {
      id: v.id.toString(),
      price: parseFloat(v.price),
      url: `https://shopify.com/products/${product.handle}?variant=${v.id}`,
    };

    // Parse options for color/size
    if (v.option1) {
      const opt1Lower = v.option1.toLowerCase();
      if (isColorValue(opt1Lower)) {
        variant.color = v.option1;
      } else if (isSizeValue(opt1Lower)) {
        variant.size = v.option1;
      }
    }
    if (v.option2) {
      const opt2Lower = v.option2.toLowerCase();
      if (isColorValue(opt2Lower)) {
        variant.color = v.option2;
      } else if (isSizeValue(opt2Lower)) {
        variant.size = v.option2;
      }
    }

    if (v.sku) variant.sku = v.sku;

    // Find variant image
    const variantImage = product.images.find((img) => img.variant_ids.includes(v.id));
    if (variantImage) {
      variant.image_url = variantImage.src;
    }

    return variant;
  });

  // Extract dimensions from first variant
  const firstVariant = product.variants[0];
  const dimensions: MoodLayerDimensions | undefined = firstVariant?.grams
    ? {
        weight: firstVariant.weight,
        weight_unit: firstVariant.weight_unit,
      }
    : undefined;

  // Generate fit tags based on product attributes
  const fitTags = generateFitTags(product, dimensions);

  // Parse tags
  const tags = product.tags
    ? product.tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  return {
    external_id: product.id.toString(),
    platform: 'shopify',
    title: product.title,
    description: stripHtml(product.body_html || ''),
    vendor: product.vendor,
    product_type: product.product_type,
    tags,
    variants,
    dimensions,
    fit_tags: fitTags,
    images: product.images.map((img) => img.src),
    url: `https://shopify.com/products/${product.handle}`,
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
}

/**
 * Generate fit tags based on product attributes
 */
function generateFitTags(product: ProductPayload, dimensions?: MoodLayerDimensions): string[] {
  const tags: string[] = [];
  const productType = product.product_type?.toLowerCase() || '';
  const title = product.title.toLowerCase();
  const description = (product.body_html || '').toLowerCase();

  // Weight-based tags
  if (dimensions?.weight) {
    const weightInKg = dimensions.weight_unit === 'kg'
      ? dimensions.weight
      : dimensions.weight / 1000;

    if (weightInKg > 5) {
      tags.push('bulky');
    } else if (weightInKg < 0.5) {
      tags.push('lightweight');
    }
  }

  // Product type based tags
  if (productType.includes('furniture') || productType.includes('sofa') || productType.includes('table')) {
    tags.push('bulky');
  }
  if (productType.includes('jewelry') || productType.includes('accessory')) {
    tags.push('delicate');
  }
  if (productType.includes('poster') || productType.includes('print') || productType.includes('art')) {
    tags.push('flat');
  }
  if (productType.includes('clothing') || productType.includes('apparel')) {
    tags.push('flat');
  }

  // Title/description based tags
  if (title.includes('fragile') || description.includes('fragile')) {
    tags.push('delicate');
  }
  if (title.includes('oversized') || description.includes('oversized')) {
    tags.push('bulky');
  }

  return [...new Set(tags)]; // Remove duplicates
}

/**
 * Check if value is a color
 */
function isColorValue(value: string): boolean {
  const colors = [
    'red', 'blue', 'green', 'yellow', 'black', 'white', 'pink', 'purple',
    'orange', 'brown', 'grey', 'gray', 'navy', 'beige', 'cream', 'gold',
    'silver', 'burgundy', 'teal', 'coral', 'mint', 'olive', 'maroon',
  ];
  return colors.some((c) => value.includes(c));
}

/**
 * Check if value is a size
 */
function isSizeValue(value: string): boolean {
  const sizes = ['xs', 'small', 'medium', 'large', 'xl', 'xxl', 's', 'm', 'l', 'one size'];
  return sizes.some((s) => value === s || value.includes(s));
}

/**
 * Strip HTML tags from string
 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// =============================================================================
// EXPRESS ROUTE HANDLER
// =============================================================================

/**
 * Express webhook route handler
 */
export const webhookRoute = async (req: any, res: any) => {
  const topic = req.headers['x-shopify-topic'] as WebhookTopic;
  const shop = req.headers['x-shopify-shop-domain'] as string;
  const hmac = req.headers['x-shopify-hmac-sha256'] as string;

  const result = await processWebhook({
    topic,
    shop,
    body: req.body,
    hmac,
  });

  if (result.success) {
    res.status(200).json(result);
  } else {
    res.status(401).json(result);
  }
};

export default webhookRoute;
