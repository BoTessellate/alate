/**
 * Shopify GraphQL Client
 * Handles all GraphQL operations with Shopify Admin API
 */

import type {
  ShopifyClientConfig,
  ShopifyApiResponse,
  ShopifyGraphQLProduct,
  BulkOperationStatus,
} from './types';

// ============================================================================
// GraphQL Queries
// ============================================================================

const PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          vendor
          productType
          tags
          status
          createdAt
          updatedAt
          options {
            id
            name
            values
          }
          images(first: 10) {
            edges {
              node {
                id
                src
                altText
              }
            }
          }
          variants(first: 100) {
            edges {
              node {
                id
                title
                price
                compareAtPrice
                sku
                inventoryQuantity
                selectedOptions {
                  name
                  value
                }
                image {
                  src
                }
              }
            }
          }
        }
      }
    }
  }
`;

const PRODUCT_BY_ID_QUERY = `
  query GetProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      descriptionHtml
      vendor
      productType
      tags
      status
      createdAt
      updatedAt
      options {
        id
        name
        values
      }
      images(first: 10) {
        edges {
          node {
            id
            src
            altText
          }
        }
      }
      variants(first: 100) {
        edges {
          node {
            id
            title
            price
            compareAtPrice
            sku
            inventoryQuantity
            selectedOptions {
              name
              value
            }
            image {
              src
            }
          }
        }
      }
    }
  }
`;

const PRODUCTS_COUNT_QUERY = `
  query GetProductsCount {
    productsCount(limit: null) {
      count
    }
  }
`;

const BULK_OPERATION_QUERY = `
  mutation BulkProductsQuery {
    bulkOperationRunQuery(
      query: """
        {
          products {
            edges {
              node {
                id
                title
                handle
                descriptionHtml
                vendor
                productType
                tags
                status
                createdAt
                updatedAt
                images(first: 10) {
                  edges {
                    node {
                      id
                      src
                      altText
                    }
                  }
                }
                variants(first: 100) {
                  edges {
                    node {
                      id
                      title
                      price
                      compareAtPrice
                      sku
                      inventoryQuantity
                      selectedOptions {
                        name
                        value
                      }
                      weight
                      weightUnit
                      image {
                        src
                      }
                    }
                  }
                }
              }
            }
          }
        }
      """
    ) {
      bulkOperation {
        id
        status
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const BULK_OPERATION_STATUS_QUERY = `
  query GetBulkOperationStatus($id: ID!) {
    node(id: $id) {
      ... on BulkOperation {
        id
        status
        errorCode
        objectCount
        url
      }
    }
  }
`;

const REGISTER_WEBHOOKS_MUTATION = `
  mutation RegisterWebhook($topic: WebhookSubscriptionTopic!, $callbackUrl: String!) {
    webhookSubscriptionCreate(
      topic: $topic
      webhookSubscription: {
        callbackUrl: $callbackUrl
        format: JSON
      }
    ) {
      webhookSubscription {
        id
        topic
        endpoint {
          ... on WebhookHttpEndpoint {
            callbackUrl
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// ============================================================================
// Client Class
// ============================================================================

export class ShopifyGraphQLClient {
  private shopDomain: string;
  private accessToken: string;
  private apiVersion: string;
  private endpoint: string;

  constructor(config: ShopifyClientConfig) {
    this.shopDomain = config.shopDomain;
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion;
    this.endpoint = `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`;
  }

  /**
   * Execute GraphQL query/mutation
   */
  private async execute<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<ShopifyApiResponse<T>> {
    const startTime = Date.now();
    console.log('[ShopifyClient] API call to', this.endpoint);

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    console.log('[ShopifyClient] API response status:', response.status, 'in', Date.now() - startTime, 'ms');

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ShopifyClient] API error response:', errorText);
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<ShopifyApiResponse<T>>;
  }

  /**
   * Get total product count
   */
  async getProductCount(): Promise<number> {
    console.log('[ShopifyClient] Getting product count...');
    const result = await this.execute<{ productsCount: { count: number } }>(
      PRODUCTS_COUNT_QUERY
    );

    if (result.errors) {
      console.error('[ShopifyClient] Product count errors:', result.errors);
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const count = result.data?.productsCount.count ?? 0;
    console.log('[ShopifyClient] Product count:', count);
    return count;
  }

  /**
   * Fetch products with pagination
   */
  async getProducts(
    first: number = 50,
    after?: string
  ): Promise<{
    products: ShopifyGraphQLProduct[];
    hasNextPage: boolean;
    endCursor?: string;
  }> {
    const result = await this.execute<{
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string };
        edges: Array<{ node: ShopifyGraphQLProduct }>;
      };
    }>(PRODUCTS_QUERY, { first, after });

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const data = result.data?.products;
    return {
      products: data?.edges.map((e) => e.node) ?? [],
      hasNextPage: data?.pageInfo.hasNextPage ?? false,
      endCursor: data?.pageInfo.endCursor,
    };
  }

  /**
   * Fetch all products (handles pagination automatically)
   */
  async getAllProducts(
    onProgress?: (fetched: number, total: number) => void
  ): Promise<ShopifyGraphQLProduct[]> {
    console.log('[ShopifyClient] getAllProducts started');
    const total = await this.getProductCount();
    console.log('[ShopifyClient] Total products to fetch:', total);

    const allProducts: ShopifyGraphQLProduct[] = [];
    let cursor: string | undefined;
    let pageNum = 0;

    do {
      pageNum++;
      console.log('[ShopifyClient] Fetching page', pageNum, 'cursor:', cursor ? cursor.slice(0, 20) + '...' : 'none');

      const { products, hasNextPage, endCursor } = await this.getProducts(250, cursor);
      console.log('[ShopifyClient] Page', pageNum, 'returned', products.length, 'products, hasNextPage:', hasNextPage);

      allProducts.push(...products);

      if (onProgress) {
        onProgress(allProducts.length, total);
      }

      cursor = hasNextPage ? endCursor : undefined;

      // Rate limiting: wait 100ms between requests (reduced for faster sync)
      if (cursor) {
        console.log('[ShopifyClient] Waiting 100ms before next page...');
        await new Promise((r) => setTimeout(r, 100));
      }
    } while (cursor);

    console.log('[ShopifyClient] getAllProducts complete, total fetched:', allProducts.length);
    return allProducts;
  }

  /**
   * Fetch single product by ID
   */
  async getProductById(id: string): Promise<ShopifyGraphQLProduct | null> {
    // Ensure proper GraphQL ID format
    const gid = id.startsWith('gid://') ? id : `gid://shopify/Product/${id}`;

    const result = await this.execute<{ product: ShopifyGraphQLProduct }>(
      PRODUCT_BY_ID_QUERY,
      { id: gid }
    );

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data?.product ?? null;
  }

  /**
   * Start bulk operation for large catalogs
   */
  async startBulkProductsQuery(): Promise<string> {
    const result = await this.execute<{
      bulkOperationRunQuery: {
        bulkOperation: { id: string; status: string };
        userErrors: Array<{ field: string; message: string }>;
      };
    }>(BULK_OPERATION_QUERY);

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const { bulkOperation, userErrors } = result.data?.bulkOperationRunQuery ?? {};

    if (userErrors?.length) {
      throw new Error(`Bulk operation errors: ${JSON.stringify(userErrors)}`);
    }

    return bulkOperation?.id ?? '';
  }

  /**
   * Check bulk operation status
   */
  async getBulkOperationStatus(operationId: string): Promise<BulkOperationStatus> {
    const result = await this.execute<{ node: BulkOperationStatus }>(
      BULK_OPERATION_STATUS_QUERY,
      { id: operationId }
    );

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data?.node ?? { id: operationId, status: 'FAILED' };
  }

  /**
   * Register webhook subscription
   */
  async registerWebhook(
    topic: string,
    callbackUrl: string
  ): Promise<{ id: string; topic: string }> {
    // Convert topic format (e.g., 'products/create' -> 'PRODUCTS_CREATE')
    const topicEnum = topic.toUpperCase().replace('/', '_');

    const result = await this.execute<{
      webhookSubscriptionCreate: {
        webhookSubscription: { id: string; topic: string };
        userErrors: Array<{ field: string; message: string }>;
      };
    }>(REGISTER_WEBHOOKS_MUTATION, { topic: topicEnum, callbackUrl });

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    const { webhookSubscription, userErrors } =
      result.data?.webhookSubscriptionCreate ?? {};

    if (userErrors?.length) {
      throw new Error(`Webhook registration errors: ${JSON.stringify(userErrors)}`);
    }

    return webhookSubscription ?? { id: '', topic: '' };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createShopifyClient(config: ShopifyClientConfig): ShopifyGraphQLClient {
  return new ShopifyGraphQLClient(config);
}
