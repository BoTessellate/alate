/**
 * Mock Data for Playwright Layout Tests
 *
 * Reused from Cypress fixtures for consistency.
 * This data is used to mock API responses during layout tests.
 */

export const mockProducts = [
  {
    id: 'test-product-1',
    product_name: 'Modern Minimalist Chair',
    brand: 'Nordic Design',
    image_url: 'https://via.placeholder.com/200',
    price: 299.99,
    currency: 'USD',
    tags: ['modern', 'minimalist', 'furniture'],
  },
  {
    id: 'test-product-2',
    product_name: 'Vintage Leather Bag',
    brand: 'Heritage Goods',
    image_url: 'https://via.placeholder.com/200',
    price: 189.0,
    currency: 'USD',
    tags: ['vintage', 'leather', 'accessories'],
  },
  {
    id: 'test-product-3',
    product_name: 'Natural Wood Table',
    brand: 'Artisan Workshop',
    image_url: 'https://via.placeholder.com/200',
    price: 549.0,
    currency: 'USD',
    tags: ['natural', 'wood', 'furniture'],
  },
  {
    id: 'test-product-4',
    product_name: 'Elegant Floor Lamp',
    brand: 'Light Studio',
    image_url: 'https://via.placeholder.com/200',
    price: 179.0,
    currency: 'USD',
    tags: ['elegant', 'lighting', 'modern'],
  },
];

export const mockCollections = [
  {
    id: 'test-collection-1',
    name: 'Living Room Essentials',
    slug: 'living-room-essentials',
    description: 'Curated furniture for your living space',
    items: mockProducts.slice(0, 2),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'test-collection-2',
    name: 'Office Space',
    slug: 'office-space',
    description: 'Professional workspace items',
    items: mockProducts.slice(2, 4),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const mockMoodboards = [
  {
    id: 'test-moodboard-1',
    name: 'Modern Home',
    slug: 'modern-home',
    items: mockProducts.map((p, i) => ({
      id: `item-${i}`,
      product: p,
      x: 100 + i * 200,
      y: 100,
      width: 150,
      height: 150,
      rotation: 0,
      zIndex: i,
    })),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export const mockUser = {
  id: 'test-user-1',
  email: 'test@example.com',
  display_name: 'Test User',
  stylePreferences: {
    selectedCategories: ['furniture', 'decor'],
    selectedTags: ['modern', 'minimalist'],
  },
  settings: {
    theme: 'light',
    currency: 'USD',
    priceRange: { min: 0, max: 1000 },
  },
};

/**
 * API route patterns for mocking
 */
export const API_ROUTES = {
  products: '**/api/products**',
  search: '**/api/search**',
  collections: '**/api/collections**',
  moodboards: '**/api/looks**',
  user: '**/api/user**',
} as const;

/**
 * Skip onboarding by setting localStorage
 * Must be called after page.goto() to establish the origin
 *
 * The app uses Zustand persist middleware with key 'tml-user-storage'
 * The format is: { state: {...}, version: 0 }
 */
export async function skipOnboarding(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    // Set the Zustand persist store for user preferences
    // This matches the format used by useUserStore.ts
    const userStorage = {
      state: {
        stylePreferences: {
          selectedTags: ['modern', 'minimalist'],
          selectedCategories: ['furniture', 'decor'],
          completedOnboarding: true,
          onboardingCompletedAt: new Date().toISOString(),
        },
      },
      version: 0,
    };
    localStorage.setItem('tml-user-storage', JSON.stringify(userStorage));

    // Also set settings store if it exists
    const settingsStorage = {
      state: {
        theme: 'light',
        currency: 'USD',
        priceRange: { min: 0, max: 10000 },
      },
      version: 0,
    };
    localStorage.setItem('tml-settings-storage', JSON.stringify(settingsStorage));
  });
}

/**
 * Setup function to prepare page for testing
 * Sets up mock routes and localStorage, then navigates to the target URL
 */
export async function setupTestPage(page: import('@playwright/test').Page, url: string = '/') {
  // Setup mock routes first
  await setupMockRoutes(page);

  // Navigate to establish origin, then set localStorage
  await page.goto('/');
  await skipOnboarding(page);

  // Now navigate to actual target (or reload if it's home)
  if (url !== '/') {
    await page.goto(url);
  } else {
    await page.reload();
  }

  await page.waitForLoadState('networkidle');
}

/**
 * Setup function to mock all API routes
 */
export async function setupMockRoutes(page: import('@playwright/test').Page) {
  // Mock products endpoint
  await page.route(API_ROUTES.products, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockProducts),
    });
  });

  // Mock search endpoint
  await page.route(API_ROUTES.search, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockProducts),
    });
  });

  // Mock collections endpoint
  await page.route(API_ROUTES.collections, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCollections),
    });
  });

  // Mock moodboards endpoint
  await page.route(API_ROUTES.moodboards, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockMoodboards),
    });
  });

  // Mock user endpoint
  await page.route(API_ROUTES.user, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUser),
    });
  });
}
