/// <reference types="cypress" />

describe('TopBar Navigation', () => {
  beforeEach(() => {
    // Reset app state and complete onboarding
    cy.resetAppState();
    cy.completeOnboarding();

    // Stub search API
    cy.stubSearchAPI([
      {
        id: 'test-1',
        product_name: 'Modern Chair',
        brand: 'Nordic Design',
        image_url: 'https://via.placeholder.com/100',
        price: 299.99,
        currency: 'USD',
      },
      {
        id: 'test-2',
        product_name: 'Vintage Lamp',
        brand: 'Retro Home',
        image_url: 'https://via.placeholder.com/100',
        price: 149.99,
        currency: 'USD',
      },
    ]);
  });

  describe('Navigation Links', () => {
    it('should display navigation items in TopBar', () => {
      cy.visit('/');

      // Check navigation icons/links exist
      cy.get('header nav').should('be.visible');

      // Look for navigation links
      cy.get('header nav a').should('have.length.at.least', 3);
    });

    it('should navigate to Layers/Looks page', () => {
      cy.visit('/');

      // Click on Layers navigation
      cy.get('header nav a[href="/looks"]').click();

      // Should be on looks page
      cy.url().should('include', '/looks');
      cy.get('h1').should('contain', 'Layers');
    });

    it('should navigate to Closet page', () => {
      cy.visit('/');

      // Click on Closet navigation
      cy.get('header nav a[href="/closet"]').click();

      // Should be on closet page
      cy.url().should('include', '/closet');
    });

    it('should navigate to Discover page', () => {
      cy.visit('/');

      // Click on Discover navigation
      cy.get('header nav a[href="/discover"]').click();

      // Should be on discover page
      cy.url().should('include', '/discover');
    });

    it('should highlight active navigation item', () => {
      cy.visit('/looks');

      // The Layers/Looks link should appear active (has different background)
      cy.get('header nav a[href="/looks"]')
        .find('div[class*="rounded-full"]')
        .should('have.css', 'background-color')
        .and('not.eq', 'rgba(0, 0, 0, 0)'); // Not transparent
    });

    it('should navigate home when clicking logo', () => {
      cy.visit('/settings');

      // Click logo (link to home)
      cy.get('header a[href="/"]').first().click();

      // Should be on home page
      cy.url().should('eq', Cypress.config().baseUrl + '/');
    });
  });

  describe('Search Functionality', () => {
    it('should display search bar', () => {
      cy.visit('/');

      // Search element should exist
      cy.get('header').contains('Search...').should('be.visible');
    });

    it('should expand search on click', () => {
      cy.visit('/');

      // Click on search
      cy.get('header').contains('Search...').click();

      // Input should appear
      cy.get('header input[placeholder="Search products..."]').should('be.visible');
    });

    it('should show search results when typing', () => {
      cy.visit('/');

      // Open search
      cy.get('header').contains('Search...').click();

      // Type search query
      cy.get('header input[placeholder="Search products..."]').type('chair');

      // Wait for API response
      cy.wait('@searchAPI');

      // Results should appear
      cy.contains('Modern Chair').should('be.visible');
    });

    it('should close search when clicking X', () => {
      cy.visit('/');

      // Open search
      cy.get('header').contains('Search...').click();

      // Input should be visible
      cy.get('header input[placeholder="Search products..."]').should('be.visible');

      // Click X button to close
      cy.get('header form').find('button').last().click();

      // Search should collapse back
      cy.get('header input[placeholder="Search products..."]').should('not.exist');
    });

    it('should open search with keyboard shortcut Ctrl+K', () => {
      cy.visit('/');

      // Press Ctrl+K
      cy.get('body').type('{ctrl}k');

      // Search input should appear
      cy.get('header input[placeholder="Search products..."]').should('be.visible');
    });

    it('should close search with Escape key', () => {
      cy.visit('/');

      // Open search
      cy.get('header').contains('Search...').click();

      // Press Escape
      cy.get('body').type('{esc}');

      // Search should close
      cy.get('header input[placeholder="Search products..."]').should('not.exist');
    });

    it('should navigate to discover with search query on submit', () => {
      cy.visit('/');

      // Open search
      cy.get('header').contains('Search...').click();

      // Type and submit
      cy.get('header input[placeholder="Search products..."]')
        .type('modern furniture{enter}');

      // Should navigate to discover with query
      cy.url().should('include', '/discover');
      cy.url().should('include', 'q=');
    });

    it('should allow keyboard navigation in search results', () => {
      cy.visit('/');

      // Open search and type
      cy.get('header').contains('Search...').click();
      cy.get('header input[placeholder="Search products..."]').type('chair');

      // Wait for results
      cy.wait('@searchAPI');

      // Use arrow keys to navigate
      cy.get('header input[placeholder="Search products..."]')
        .type('{downarrow}');

      // First result should be highlighted
      cy.contains('Modern Chair')
        .parent()
        .parent()
        .should('have.css', 'background-color')
        .and('not.eq', 'rgba(0, 0, 0, 0)');
    });
  });

  describe('User Menu', () => {
    it('should display user menu button', () => {
      cy.visit('/');

      // User button should exist
      cy.get('header button[aria-label="User menu"]').should('be.visible');
    });

    it('should open user dropdown on click', () => {
      cy.visit('/');

      // Click user menu
      cy.get('header button[aria-label="User menu"]').click();

      // Dropdown should appear with options
      cy.get('[role="menu"]').should('be.visible');
      cy.contains('Settings').should('be.visible');
      cy.contains('Sign out').should('be.visible');
    });

    it('should navigate to settings from user menu', () => {
      cy.visit('/');

      // Open user menu
      cy.get('header button[aria-label="User menu"]').click();

      // Click Settings
      cy.get('[role="menu"]').contains('Settings').click();

      // Should be on settings page
      cy.url().should('include', '/settings');
    });

    it('should close user menu when clicking outside', () => {
      cy.visit('/');

      // Open user menu
      cy.get('header button[aria-label="User menu"]').click();

      // Menu should be visible
      cy.get('[role="menu"]').should('be.visible');

      // Click outside (on body)
      cy.get('body').click('bottomLeft');

      // Menu should close
      cy.get('[role="menu"]').should('not.exist');
    });
  });

  describe('Currency Selector', () => {
    it('should display currency selector', () => {
      cy.visit('/');

      // Currency button should exist
      cy.get('header button[aria-label="Select currency"]').should('be.visible');
    });

    it('should open currency dropdown', () => {
      cy.visit('/');

      // Click currency selector
      cy.get('header button[aria-label="Select currency"]').click();

      // Dropdown should appear with currency options
      cy.get('[role="listbox"]').should('be.visible');
      cy.contains('USD').should('be.visible');
      cy.contains('EUR').should('be.visible');
    });

    it('should select different currency', () => {
      cy.visit('/');

      // Open currency dropdown
      cy.get('header button[aria-label="Select currency"]').click();

      // Select EUR
      cy.get('[role="listbox"]').contains('EUR').click();

      // Dropdown should close
      cy.get('[role="listbox"]').should('not.exist');

      // Currency should be updated (shows euro symbol)
      cy.get('header button[aria-label="Select currency"]').should('be.visible');
    });
  });

  describe('Agent Mode Toggle', () => {
    it('should display Agent mode toggle', () => {
      cy.visit('/');

      // Agent toggle button should exist
      cy.get('header button[aria-label*="Agent Mode"]').should('be.visible');
    });

    it('should toggle Agent mode', () => {
      cy.visit('/');

      // Get initial state
      cy.get('header button[aria-label*="Agent Mode"]')
        .invoke('attr', 'aria-pressed')
        .then((initialState) => {
          // Click toggle
          cy.get('header button[aria-label*="Agent Mode"]').click();

          // State should change
          cy.get('header button[aria-label*="Agent Mode"]')
            .invoke('attr', 'aria-pressed')
            .should('not.eq', initialState);
        });
    });
  });

  describe('Help and Feedback', () => {
    it('should display help button', () => {
      cy.visit('/');

      // Help button should exist
      cy.get('header button[aria-label="Help"]').should('be.visible');
    });

    it('should display feedback button', () => {
      cy.visit('/');

      // Feedback button should exist
      cy.get('header').contains('Feedback').should('be.visible');
    });
  });

  describe('Responsive Behavior', () => {
    it('should work on tablet viewport', () => {
      cy.viewport(768, 1024);
      cy.visit('/');

      // Navigation should still be visible
      cy.get('header nav').should('be.visible');

      // User menu should work
      cy.get('header button[aria-label="User menu"]').click();
      cy.get('[role="menu"]').should('be.visible');
    });

    it('should work on mobile viewport', () => {
      cy.viewport(375, 667);
      cy.visit('/');

      // Header should still be visible
      cy.get('header').should('be.visible');
    });
  });
});
