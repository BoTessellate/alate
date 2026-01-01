/// <reference types="cypress" />
import '@testing-library/cypress/add-commands';

/**
 * Shared Test Selectors - Import from source of truth
 * When component selectors change, update src/constants/testSelectors.ts
 * Tests will automatically use the new values.
 */
export const SELECTORS = {
  search: {
    trigger: 'button[aria-label="Search"]',
    input: 'input[placeholder="Search a mood or product..."]',
    placeholder: 'Search a mood or product...',
  },
  navigation: {
    layersLink: 'header nav a[href="/looks"]',
    closetLink: 'header nav a[href="/closet"]',
    discoverLink: 'header nav a[href="/discover"]',
  },
  userMenu: {
    trigger: 'button[aria-label="User menu"]',
    dropdown: '[role="menu"]',
  },
  currency: {
    trigger: 'button[aria-label="Select currency"]',
    dropdown: '[role="listbox"]',
  },
  agentMode: {
    trigger: 'button[aria-label*="Agent Mode"]',
  },
  help: {
    trigger: 'button[aria-label="Help"]',
  },
} as const;

// Custom command to clear localStorage and reset app state
Cypress.Commands.add('resetAppState', () => {
  cy.window().then((win) => {
    win.localStorage.clear();
    win.sessionStorage.clear();
  });
});

// Custom command to set onboarding as completed
Cypress.Commands.add('completeOnboarding', () => {
  cy.window().then((win) => {
    const userState = {
      state: {
        styleCategories: ['minimalist', 'modern'],
        styleTags: ['clean', 'neutral', 'elegant'],
        onboardingCompleted: true,
      },
      version: 0,
    };
    win.localStorage.setItem('user-storage', JSON.stringify(userState));
  });
});

// Custom command to set theme preference
Cypress.Commands.add('setTheme', (theme: 'light' | 'dark' | 'system') => {
  cy.window().then((win) => {
    const existingSettings = win.localStorage.getItem('settings-storage');
    let settings = existingSettings ? JSON.parse(existingSettings) : { state: {}, version: 0 };
    settings.state.theme = theme;
    win.localStorage.setItem('settings-storage', JSON.stringify(settings));
  });
});

// Custom command to wait for hydration
Cypress.Commands.add('waitForHydration', () => {
  // Wait for React to hydrate by checking for common hydration indicators
  cy.get('body').should('not.have.class', 'loading');
  // Also wait for any loading spinners to disappear
  cy.get('[class*="animate-spin"]').should('not.exist');
});

// Custom command to intercept and stub API calls
Cypress.Commands.add('stubSearchAPI', (products = []) => {
  cy.intercept('GET', '**/api/search*', {
    statusCode: 200,
    body: { products, total: products.length },
  }).as('searchAPI');
});

// Custom command for clicking elements that might be covered
Cypress.Commands.add('forceClick', { prevSubject: 'element' }, (subject) => {
  cy.wrap(subject).click({ force: true });
});

// Type declarations for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Clear localStorage and sessionStorage to reset app state
       */
      resetAppState(): Chainable<void>;

      /**
       * Set onboarding as completed in localStorage
       */
      completeOnboarding(): Chainable<void>;

      /**
       * Set theme preference in localStorage
       * @param theme - 'light' | 'dark' | 'system'
       */
      setTheme(theme: 'light' | 'dark' | 'system'): Chainable<void>;

      /**
       * Wait for React hydration to complete
       */
      waitForHydration(): Chainable<void>;

      /**
       * Intercept and stub the search API
       * @param products - Array of product objects to return
       */
      stubSearchAPI(products?: Array<{
        id: string;
        product_name: string;
        brand: string;
        image_url: string;
        price: number;
        currency?: string;
      }>): Chainable<void>;

      /**
       * Force click on an element even if covered
       */
      forceClick(): Chainable<void>;
    }
  }
}

export {};
