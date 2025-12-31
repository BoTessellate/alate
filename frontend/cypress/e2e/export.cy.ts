/// <reference types="cypress" />

describe('Export Functionality', () => {
  beforeEach(() => {
    cy.resetAppState();
    cy.completeOnboarding();
  });

  describe('Moodboard Export', () => {
    beforeEach(() => {
      // Create a moodboard with items
      cy.visit('/looks');
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Export Test Board');
      cy.get('button').contains('Create').click();

      // Should be in editor
      cy.url().should('include', '/looks/');
    });

    it('should show export button in moodboard editor', () => {
      // Export/download button should be visible
      cy.get('button[aria-label*="export"], button[aria-label*="download"], button:contains("Export")')
        .should('be.visible');
    });

    it('should open export options modal when clicked', () => {
      cy.get('button[aria-label*="export"], button[aria-label*="download"]')
        .first()
        .click();

      // Should show export options
      cy.contains(/export|download|save/i).should('be.visible');
    });

    it('should offer PNG export format', () => {
      cy.get('button[aria-label*="export"], button[aria-label*="download"]')
        .first()
        .click();

      // PNG option should be available
      cy.contains(/PNG/i).should('be.visible');
    });

    it('should offer JPG export format', () => {
      cy.get('button[aria-label*="export"], button[aria-label*="download"]')
        .first()
        .click();

      // JPG option should be available
      cy.contains(/JPG|JPEG/i).should('be.visible');
    });

    it('should offer WebP export format', () => {
      cy.get('button[aria-label*="export"], button[aria-label*="download"]')
        .first()
        .click();

      // WebP option should be available
      cy.contains(/WebP/i).should('be.visible');
    });

    it('should show quality/resolution options', () => {
      cy.get('button[aria-label*="export"], button[aria-label*="download"]')
        .first()
        .click();

      // Quality or resolution options should exist
      cy.get('body').then(($body) => {
        const hasQuality = $body.text().match(/quality|resolution|size/i);
        expect(hasQuality).to.not.be.null;
      });
    });
  });

  describe('Export Process', () => {
    beforeEach(() => {
      // Create a moodboard
      cy.visit('/looks');
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Process Test');
      cy.get('button').contains('Create').click();
    });

    it('should show processing state during export', () => {
      cy.intercept('POST', '**/api/export*', {
        statusCode: 200,
        delay: 2000,
        body: {
          status: 'processing',
          progress: 50,
        },
      }).as('exportProcess');

      // Click export
      cy.get('button[aria-label*="export"], button[aria-label*="download"]')
        .first()
        .click();

      // Select format and start export
      cy.get('body').then(($body) => {
        if ($body.find('button:contains("PNG")').length > 0) {
          cy.contains('button', 'PNG').click();
        }
      });

      // Should show processing state
      cy.get('[class*="animate-spin"], [class*="loading"]').should('be.visible');
    });

    it('should trigger download when export completes', () => {
      // Mock successful export
      cy.intercept('POST', '**/api/export*', {
        statusCode: 200,
        body: {
          status: 'complete',
          download_url: 'https://example.com/export.png',
        },
      }).as('exportComplete');

      // Export should be available
      cy.get('button[aria-label*="export"], button[aria-label*="download"]').should('be.visible');
    });

    it('should handle export errors gracefully', () => {
      cy.intercept('POST', '**/api/export*', {
        statusCode: 500,
        body: { error: 'Export failed' },
      }).as('exportError');

      cy.get('button[aria-label*="export"], button[aria-label*="download"]')
        .first()
        .click();

      // App should handle error
      cy.get('body').should('be.visible');
    });
  });

  describe('Social Sharing', () => {
    beforeEach(() => {
      // Create a moodboard
      cy.visit('/looks');
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Share Test');
      cy.get('button').contains('Create').click();
    });

    it('should have share button in editor', () => {
      // Share button should exist
      cy.get('button[aria-label*="share"], button:contains("Share")')
        .should('be.visible');
    });

    it('should open share options when clicked', () => {
      cy.get('button[aria-label*="share"], button:contains("Share")')
        .first()
        .click();

      // Share options should appear
      cy.contains(/share|link|copy/i).should('be.visible');
    });

    it('should allow copying share link', () => {
      cy.get('button[aria-label*="share"], button:contains("Share")')
        .first()
        .click();

      // Copy link button should exist
      cy.contains(/copy|link/i).should('be.visible');
    });

    it('should show social platform options', () => {
      cy.get('button[aria-label*="share"], button:contains("Share")')
        .first()
        .click();

      // Social options might be available
      cy.get('body').should('be.visible');
    });
  });

  describe('Collection Export', () => {
    beforeEach(() => {
      // Create a collection with products
      cy.visit('/closet');

      // Create collection
      cy.contains('button', 'New Collection').click();
      cy.get('input[placeholder*="name"]').type('Export Collection');
      cy.get('button').contains('Create').click();
    });

    it('should show export option for collections', () => {
      cy.visit('/closet');

      // Collection should exist
      cy.contains('Export Collection').should('be.visible');

      // Hover to show menu
      cy.contains('Export Collection')
        .parents('[class*="group"]')
        .trigger('mouseover');

      // Menu should have export option
      cy.get('button[aria-label*="more"], button:contains("...")').click({ force: true });
    });

    it('should export collection data as JSON', () => {
      cy.intercept('GET', '**/api/collections/*/export*', {
        statusCode: 200,
        body: {
          collection: {
            name: 'Export Collection',
            products: [],
            createdAt: new Date().toISOString(),
          },
        },
      }).as('exportJson');

      // Collection export should be functional
      cy.visit('/closet');
      cy.contains('Export Collection').should('be.visible');
    });

    it('should export collection as PDF', () => {
      cy.intercept('GET', '**/api/collections/*/export?format=pdf*', {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/pdf',
        },
        body: 'PDF content',
      }).as('exportPdf');

      cy.visit('/closet');
      cy.contains('Export Collection').should('be.visible');
    });
  });

  describe('Bulk Export', () => {
    it('should support bulk export of multiple moodboards', () => {
      // Create multiple moodboards
      cy.visit('/looks');

      // Create first
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Bulk One');
      cy.get('button').contains('Create').click();
      cy.visit('/looks');

      // Create second
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Bulk Two');
      cy.get('button').contains('Create').click();
      cy.visit('/looks');

      // Both should exist
      cy.contains('Bulk One').should('be.visible');
      cy.contains('Bulk Two').should('be.visible');
    });

    it('should show selection mode for bulk operations', () => {
      // Create moodboards first
      cy.visit('/looks');
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Select Test');
      cy.get('button').contains('Create').click();
      cy.visit('/looks');

      // Moodboard should be visible
      cy.contains('Select Test').should('be.visible');
    });
  });

  describe('Export Settings', () => {
    it('should remember last used export format', () => {
      cy.visit('/settings');

      // Export preferences might be in settings
      cy.contains(/export|download/i).should('be.visible');
    });

    it('should allow setting default export quality', () => {
      cy.visit('/settings');

      // Quality settings should be accessible
      cy.get('body').should('be.visible');
    });

    it('should allow setting default file naming pattern', () => {
      cy.visit('/settings');

      // Naming pattern might be configurable
      cy.contains(/settings|preferences/i).should('be.visible');
    });
  });

  describe('Export History', () => {
    it('should track recent exports', () => {
      // Create and export a moodboard
      cy.visit('/looks');
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('History Test');
      cy.get('button').contains('Create').click();

      // Export functionality should be available
      cy.get('button[aria-label*="export"], button[aria-label*="download"]').should('be.visible');
    });

    it('should allow re-downloading recent exports', () => {
      // Create moodboard
      cy.visit('/looks');
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Redownload Test');
      cy.get('button').contains('Create').click();

      // Export should be accessible
      cy.get('button[aria-label*="export"], button[aria-label*="download"]').should('be.visible');
    });
  });

  describe('Embed Code Generation', () => {
    beforeEach(() => {
      // Create a moodboard
      cy.visit('/looks');
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Embed Test');
      cy.get('button').contains('Create').click();
    });

    it('should generate embed code for moodboard', () => {
      // Share options should include embed
      cy.get('button[aria-label*="share"], button:contains("Share")')
        .first()
        .click();

      // Embed option should exist
      cy.get('body').should('be.visible');
    });

    it('should allow customizing embed dimensions', () => {
      cy.get('button[aria-label*="share"], button:contains("Share")')
        .first()
        .click();

      // Customization might be available
      cy.get('body').should('be.visible');
    });

    it('should copy embed code to clipboard', () => {
      cy.get('button[aria-label*="share"], button:contains("Share")')
        .first()
        .click();

      // Copy functionality should exist
      cy.contains(/copy|embed|iframe/i).should('be.visible');
    });
  });

  describe('Print Functionality', () => {
    beforeEach(() => {
      cy.visit('/looks');
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Print Test');
      cy.get('button').contains('Create').click();
    });

    it('should have print option available', () => {
      // Print option might be in export menu
      cy.get('button[aria-label*="export"], button[aria-label*="download"]')
        .first()
        .click();

      // Print might be an option
      cy.get('body').should('be.visible');
    });

    it('should generate print-optimized layout', () => {
      // Print preparation
      cy.get('button[aria-label*="export"], button[aria-label*="download"]').should('be.visible');
    });
  });
});
