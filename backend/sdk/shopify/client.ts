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
`;

const PRODUCTS_COUNT_QUERY = `
  query GetProductsCount {
    productsCount {
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
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get total product count
   */
  async getProductCount(): Promise<number> {
    const result = await this.execute<{ productsCount: { count: number } }>(
      PRODUCTS_COUNT_QUERY
    );

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data?.productsCount.count ?? 0;
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
    const total = await this.getProductCount();
    const allProducts: ShopifyGraphQLProduct[] = [];
    let cursor: string | undefined;

    do {
      const { products, hasNextPage, endCursor } = await this.getProducts(250, cursor);
      allProducts.push(...products);

      if (onProgress) {
        onProgress(allProducts.length, total);
      }

      cursor = hasNextPage ? endCursor : undefined;

      // Rate limiting: wait 500ms between requests
      if (cursor) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } while (cursor);

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
