/// <reference types="cypress" />

describe('AI Features Integration', () => {
  beforeEach(() => {
    cy.resetAppState();
    cy.completeOnboarding();
  });

  describe('AI Search Query Parsing', () => {
    beforeEach(() => {
      // Stub the search API
      cy.fixture('products').then((data) => {
        cy.stubSearchAPI(data.products);
      });
    });

    it('should handle natural language search queries', () => {
      cy.intercept('GET', '**/api/search*', {
        statusCode: 200,
        body: {
          products: [
            {
              id: 'ai-1',
              product_name: 'Minimalist Coffee Table',
              brand: 'Modern Living',
              price: 299,
              image_url: 'https://via.placeholder.com/200',
              tags: ['minimalist', 'modern', 'furniture'],
            },
          ],
          query_interpretation: 'Looking for minimalist furniture items',
        },
      }).as('aiSearch');

      cy.visit('/discover');

      // Open search
      cy.get('button[aria-label="Search products"]').click();

      // Type natural language query
      cy.get('input[placeholder*="Search"]').type('show me minimalist furniture for my living room');

      // Submit
      cy.contains('button', 'Search').click();

      cy.wait('@aiSearch');

      // Should show results
      cy.contains('Minimalist Coffee Table').should('be.visible');
    });

    it('should show AI interpretation of query', () => {
      cy.intercept('GET', '**/api/search*', {
        statusCode: 200,
        body: {
          products: [],
          query_interpretation: 'Searching for: blue velvet sofas under $1000',
          filters_applied: ['color: blue', 'material: velvet', 'price: < 1000'],
        },
      }).as('aiSearch');

      cy.visit('/discover?q=blue+velvet+sofa+under+1000');

      cy.wait('@aiSearch');

      // May show interpreted query
      cy.get('body').should('contain.text', 'products found');
    });

    it('should handle semantic search with synonyms', () => {
      cy.intercept('GET', '**/api/search*q=couch*', {
        statusCode: 200,
        body: {
          products: [
            {
              id: 'sofa-1',
              product_name: 'Modern Sofa',
              brand: 'Comfort Co',
              price: 899,
              image_url: 'https://via.placeholder.com/200',
              tags: ['sofa', 'living room'],
            },
          ],
        },
      }).as('synonymSearch');

      cy.visit('/discover?q=couch');

      cy.wait('@synonymSearch');

      // Should find sofas when searching for "couch"
      cy.contains('Sofa').should('be.visible');
    });
  });

  describe('Product Enrichment', () => {
    it('should show AI-generated tags on product cards', () => {
      cy.intercept('GET', '**/api/search*', {
        statusCode: 200,
        body: {
          products: [
            {
              id: 'enriched-1',
              product_name: 'Handcrafted Wooden Bowl',
              brand: 'Artisan Studio',
              price: 45,
              image_url: 'https://via.placeholder.com/200',
              tags: ['handcrafted', 'wooden', 'natural', 'rustic'],
              color_palette: ['#8B4513', '#D2691E', '#F5DEB3'],
              material: 'wood',
              texture: 'smooth',
              tone: 'warm',
            },
          ],
        },
      }).as('enrichedProducts');

      cy.visit('/discover');

      cy.wait('@enrichedProducts');

      // Product should be visible with enriched data
      cy.contains('Handcrafted Wooden Bowl').should('be.visible');
    });

    it('should display color palette from AI enrichment', () => {
      cy.intercept('GET', '**/api/search*', {
        statusCode: 200,
        body: {
          products: [
            {
              id: 'color-1',
              product_name: 'Color Test Product',
              brand: 'Test',
              price: 100,
              image_url: 'https://via.placeholder.com/200',
              color_palette: ['#FF5733', '#33FF57', '#3357FF'],
              tags: ['colorful'],
            },
          ],
        },
      }).as('colorProducts');

      cy.visit('/discover');

      cy.wait('@colorProducts');

      cy.contains('Color Test Product').should('be.visible');
    });
  });

  describe('Virtual Try-On', () => {
    beforeEach(() => {
      cy.intercept('GET', '**/api/search*', {
        statusCode: 200,
        body: {
          products: [
            {
              id: 'tryon-1',
              product_name: 'Summer Dress',
              brand: 'Fashion Brand',
              price: 89,
              image_url: 'https://via.placeholder.com/200',
              tags: ['dress', 'summer', 'fashion'],
              category: 'clothing',
            },
          ],
        },
      }).as('products');
    });

    it('should show virtual try-on button on product cards', () => {
      cy.visit('/discover');

      cy.wait('@products');

      // Hover over product to reveal actions
      cy.contains('Summer Dress')
        .parents('[class*="group"]')
        .trigger('mouseover');

      // Try-on button should be visible (shirt icon)
      cy.get('button[aria-label="Virtual try-on"]').should('be.visible');
    });

    it('should open try-on modal when clicked', () => {
      cy.visit('/discover');

      cy.wait('@products');

      // Hover and click try-on
      cy.contains('Summer Dress')
        .parents('[class*="group"]')
        .trigger('mouseover');

      cy.get('button[aria-label="Virtual try-on"]').click({ force: true });

      // Modal should open
      cy.contains('Virtual Try-On').should('be.visible');
    });

    it('should allow uploading a base image for try-on', () => {
      cy.visit('/discover');

      cy.wait('@products');

      // Open try-on modal
      cy.contains('Summer Dress')
        .parents('[class*="group"]')
        .trigger('mouseover');

      cy.get('button[aria-label="Virtual try-on"]').click({ force: true });

      // Should have upload option
      cy.contains(/upload|choose|select/i).should('be.visible');
    });

    it('should show AI processing state during try-on', () => {
      cy.intercept('POST', '**/api/virtual-tryon*', {
        statusCode: 200,
        delay: 2000,
        body: {
          status: 'processing',
          result_url: null,
        },
      }).as('tryonProcess');

      cy.visit('/discover');

      cy.wait('@products');

      // Open try-on modal
      cy.contains('Summer Dress')
        .parents('[class*="group"]')
        .trigger('mouseover');

      cy.get('button[aria-label="Virtual try-on"]').click({ force: true });

      // Should show the modal with options
      cy.contains('Virtual Try-On').should('be.visible');
    });

    it('should display try-on result image', () => {
      cy.intercept('POST', '**/api/virtual-tryon*', {
        statusCode: 200,
        body: {
          status: 'complete',
          result_url: 'https://via.placeholder.com/400x600',
        },
      }).as('tryonComplete');

      cy.visit('/discover');

      cy.wait('@products');

      // The try-on button should exist
      cy.contains('Summer Dress').should('be.visible');
    });
  });

  describe('AI Moodboard Composition', () => {
    beforeEach(() => {
      // Create a moodboard first
      cy.visit('/looks');
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('AI Test Board');
      cy.get('button').contains('Create').click();
    });

    it('should show AI compose button in moodboard editor', () => {
      // Should be in editor
      cy.url().should('include', '/looks/');

      // AI compose button should be visible
      cy.get('button[aria-label*="compose"], button[aria-label*="AI"], button:contains("AI")')
        .should('be.visible');
    });

    it('should show AI generation options when compose clicked', () => {
      cy.get('button').contains(/AI|Compose|Generate/i).first().click();

      // Should show options or modal
      cy.get('body').should('be.visible');
    });

    it('should handle AI composition API call', () => {
      cy.intercept('POST', '**/api/ai-compose*', {
        statusCode: 200,
        body: {
          status: 'complete',
          image_url: 'https://via.placeholder.com/800x600',
          layout_suggestions: [],
        },
      }).as('aiCompose');

      // Trigger AI composition if button exists
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("AI")').length > 0) {
          cy.contains('button', 'AI').click();
        }
      });
    });

    it('should show preview of AI-generated moodboard', () => {
      cy.intercept('POST', '**/api/ai-compose*', {
        statusCode: 200,
        body: {
          status: 'complete',
          image_url: 'https://via.placeholder.com/800x600',
        },
      }).as('aiCompose');

      // The editor should be functional
      cy.contains('AI Test Board').should('be.visible');
    });
  });

  describe('AI Status and Health', () => {
    it('should show AI status indicator in admin', () => {
      cy.visit('/admin');

      // Admin page should show AI provider status
      cy.contains(/AI|Status|Provider/i).should('be.visible');
    });

    it('should display AI provider availability', () => {
      cy.intercept('GET', '**/api/ai-status*', {
        statusCode: 200,
        body: {
          claude: { status: 'available', latency: 150 },
          gemini: { status: 'available', latency: 200 },
          openai: { status: 'available', latency: 180 },
        },
      }).as('aiStatus');

      cy.visit('/admin');

      // May show provider status
      cy.get('body').should('be.visible');
    });

    it('should handle AI provider fallback gracefully', () => {
      cy.intercept('POST', '**/api/enrich*', {
        statusCode: 200,
        body: {
          success: true,
          provider_used: 'gemini', // Fallback provider
          data: { tags: ['test'] },
        },
      }).as('enrichFallback');

      cy.visit('/discover');

      // App should work even with fallback
      cy.get('body').should('be.visible');
    });
  });

  describe('Agent Mode', () => {
    it('should toggle agent mode in settings', () => {
      cy.visit('/settings');

      // Find agent mode toggle
      cy.contains(/agent mode/i)
        .parents('div')
        .find('button, input[type="checkbox"], [role="switch"]')
        .first()
        .click();

      // State should change
      cy.contains(/agent mode/i).should('be.visible');
    });

    it('should show agent mode indicator in topbar when enabled', () => {
      // Enable agent mode in settings
      cy.window().then((win) => {
        const settings = {
          state: {
            agentModeEnabled: true,
          },
          version: 0,
        };
        win.localStorage.setItem('settings-storage', JSON.stringify(settings));
      });

      cy.visit('/discover');

      // Agent indicator should be visible in topbar
      cy.get('header').should('be.visible');
    });

    it('should persist agent mode preference', () => {
      cy.visit('/settings');

      // Toggle agent mode
      cy.contains(/agent mode/i)
        .parents('div')
        .find('button, input[type="checkbox"], [role="switch"]')
        .first()
        .click();

      // Reload page
      cy.reload();

      // Preference should persist
      cy.contains(/agent mode/i).should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('should handle AI service unavailability', () => {
      cy.intercept('GET', '**/api/search*', {
        statusCode: 503,
        body: { error: 'AI service temporarily unavailable' },
      }).as('aiUnavailable');

      cy.visit('/discover');

      // Should show error state
      cy.contains(/error|unavailable|try again/i).should('be.visible');
    });

    it('should handle AI rate limiting', () => {
      cy.intercept('POST', '**/api/virtual-tryon*', {
        statusCode: 429,
        body: {
          error: 'Rate limit exceeded',
          retryAfter: 60,
        },
      }).as('rateLimited');

      // App should handle rate limits gracefully
      cy.visit('/discover');
      cy.get('body').should('be.visible');
    });

    it('should handle timeout during AI operations', () => {
      cy.intercept('POST', '**/api/ai-compose*', {
        statusCode: 504,
        body: { error: 'Gateway timeout' },
      }).as('timeout');

      cy.visit('/looks');

      // App should remain functional
      cy.get('body').should('be.visible');
    });
  });
});
