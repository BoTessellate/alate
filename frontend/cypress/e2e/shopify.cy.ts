/// <reference types="cypress" />

describe('Shopify Integration', () => {
  beforeEach(() => {
    cy.resetAppState();
    cy.completeOnboarding();
  });

  describe('Shopify Connect Button', () => {
    it('should display Shopify connect option in settings', () => {
      cy.visit('/settings');

      // Should show integrations section
      cy.contains('Integrations').should('be.visible');

      // Should have Shopify connect button
      cy.contains('Shopify').should('be.visible');
      cy.contains('Connect').should('be.visible');
    });

    it('should show Shopify icon in connect button', () => {
      cy.visit('/settings');

      // Shopify section should have proper branding
      cy.contains('Shopify')
        .parents('div')
        .first()
        .should('be.visible');
    });
  });

  describe('OAuth Flow Initiation', () => {
    it('should redirect to Shopify OAuth when connect is clicked', () => {
      // Intercept the OAuth redirect
      cy.intercept('GET', '**/api/shopify/auth*', {
        statusCode: 302,
        headers: {
          'Location': 'https://accounts.shopify.com/oauth/authorize',
        },
      }).as('shopifyAuth');

      cy.visit('/settings');

      // Click connect button
      cy.contains('Shopify')
        .parents('div')
        .contains('button', 'Connect')
        .click();

      // Should attempt OAuth
      cy.wait('@shopifyAuth');
    });

    it('should show loading state while connecting', () => {
      // Intercept with delay
      cy.intercept('GET', '**/api/shopify/auth*', {
        statusCode: 200,
        delay: 1000,
        body: { url: 'https://shopify.com/oauth' },
      }).as('shopifyAuth');

      cy.visit('/settings');

      cy.contains('Shopify')
        .parents('div')
        .contains('button', 'Connect')
        .click();

      // Should show loading indicator
      cy.get('[class*="animate-spin"]').should('be.visible');
    });
  });

  describe('OAuth Callback Handling', () => {
    it('should handle successful OAuth callback', () => {
      // Simulate OAuth callback
      cy.intercept('GET', '**/api/shopify/callback*', {
        statusCode: 200,
        body: {
          success: true,
          shop: 'test-store.myshopify.com',
          accessToken: 'mock-token',
        },
      }).as('shopifyCallback');

      // Visit callback URL with mock params
      cy.visit('/settings?shopify_connected=true&shop=test-store.myshopify.com');

      // Should show success message
      cy.contains('Connected').should('be.visible');
    });

    it('should handle OAuth error gracefully', () => {
      // Visit with error params
      cy.visit('/settings?shopify_error=access_denied');

      // Should show error message
      cy.contains(/error|denied|failed/i).should('be.visible');
    });

    it('should handle invalid state parameter', () => {
      // Intercept callback with state mismatch
      cy.intercept('GET', '**/api/shopify/callback*', {
        statusCode: 400,
        body: { error: 'Invalid state parameter' },
      }).as('shopifyCallback');

      cy.visit('/settings?code=mock-code&state=invalid');

      // Should show error
      cy.contains(/invalid|error/i).should('be.visible');
    });
  });

  describe('Connected Store Display', () => {
    beforeEach(() => {
      // Set up connected store state
      cy.window().then((win) => {
        const shopifyState = {
          state: {
            connected: true,
            shop: 'my-store.myshopify.com',
            lastSync: new Date().toISOString(),
          },
          version: 0,
        };
        win.localStorage.setItem('shopify-storage', JSON.stringify(shopifyState));
      });
    });

    it('should display connected store name', () => {
      cy.visit('/settings');

      cy.contains('my-store.myshopify.com').should('be.visible');
    });

    it('should show disconnect option for connected store', () => {
      cy.visit('/settings');

      cy.contains('Disconnect').should('be.visible');
    });

    it('should show last sync time', () => {
      cy.visit('/settings');

      cy.contains(/last synced|synced/i).should('be.visible');
    });
  });

  describe('Disconnect Flow', () => {
    beforeEach(() => {
      // Set up connected store state
      cy.window().then((win) => {
        const shopifyState = {
          state: {
            connected: true,
            shop: 'my-store.myshopify.com',
          },
          version: 0,
        };
        win.localStorage.setItem('shopify-storage', JSON.stringify(shopifyState));
      });
    });

    it('should show confirmation before disconnecting', () => {
      cy.visit('/settings');

      cy.contains('button', 'Disconnect').click();

      // Should show confirmation dialog
      cy.contains(/are you sure|confirm/i).should('be.visible');
    });

    it('should disconnect store when confirmed', () => {
      cy.intercept('POST', '**/api/shopify/disconnect*', {
        statusCode: 200,
        body: { success: true },
      }).as('disconnect');

      cy.visit('/settings');

      cy.contains('button', 'Disconnect').click();

      // Confirm disconnect
      cy.contains('button', 'Confirm').click();

      // Should show connect button again
      cy.contains('Connect').should('be.visible');
    });

    it('should cancel disconnect when declined', () => {
      cy.visit('/settings');

      cy.contains('button', 'Disconnect').click();

      // Cancel
      cy.contains('button', 'Cancel').click();

      // Should still show disconnect button
      cy.contains('button', 'Disconnect').should('be.visible');
    });
  });

  describe('Product Sync', () => {
    beforeEach(() => {
      // Set up connected store state
      cy.window().then((win) => {
        const shopifyState = {
          state: {
            connected: true,
            shop: 'my-store.myshopify.com',
          },
          version: 0,
        };
        win.localStorage.setItem('shopify-storage', JSON.stringify(shopifyState));
      });
    });

    it('should show sync button for connected store', () => {
      cy.visit('/settings');

      cy.contains('button', 'Sync').should('be.visible');
    });

    it('should show sync progress when syncing', () => {
      cy.intercept('POST', '**/api/shopify/sync*', {
        statusCode: 200,
        delay: 2000,
        body: { status: 'syncing', progress: 50 },
      }).as('sync');

      cy.visit('/settings');

      cy.contains('button', 'Sync').click();

      // Should show syncing state
      cy.contains(/syncing|progress/i).should('be.visible');
    });

    it('should show success after sync completes', () => {
      cy.intercept('POST', '**/api/shopify/sync*', {
        statusCode: 200,
        body: {
          status: 'complete',
          productsImported: 25,
        },
      }).as('sync');

      cy.visit('/settings');

      cy.contains('button', 'Sync').click();

      cy.wait('@sync');

      // Should show success with count
      cy.contains(/25|products|imported/i).should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors during OAuth', () => {
      cy.intercept('GET', '**/api/shopify/auth*', {
        forceNetworkError: true,
      }).as('networkError');

      cy.visit('/settings');

      cy.contains('Shopify')
        .parents('div')
        .contains('button', 'Connect')
        .click();

      // Should show error message
      cy.contains(/network|connection|error/i).should('be.visible');
    });

    it('should handle API rate limiting', () => {
      cy.intercept('POST', '**/api/shopify/sync*', {
        statusCode: 429,
        body: { error: 'Rate limited', retryAfter: 60 },
      }).as('rateLimited');

      // Set up connected state
      cy.window().then((win) => {
        win.localStorage.setItem('shopify-storage', JSON.stringify({
          state: { connected: true, shop: 'test.myshopify.com' },
          version: 0,
        }));
      });

      cy.visit('/settings');

      cy.contains('button', 'Sync').click();

      cy.wait('@rateLimited');

      // Should show rate limit message
      cy.contains(/rate limit|try again|wait/i).should('be.visible');
    });
  });
});
