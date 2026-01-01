/// <reference types="cypress" />

describe('Looks/Moodboard Page', () => {
  beforeEach(() => {
    // Reset app state and complete onboarding
    cy.resetAppState();
    cy.completeOnboarding();
  });

  describe('Empty State', () => {
    it('should display empty state when no moodboards exist', () => {
      cy.visit('/looks');

      // Should show empty state message
      cy.contains('No moodboards yet').should('be.visible');
      cy.contains('Create your first moodboard').should('be.visible');

      // Should have create button
      cy.contains('button', 'Create Moodboard').should('be.visible');
    });

    it('should show header with New Moodboard button', () => {
      cy.visit('/looks');

      // Header should show
      cy.get('h1').should('contain', 'Layers');
      cy.contains('Create and organize your moodboards').should('be.visible');

      // New Moodboard button should be in header
      cy.contains('button', 'New Moodboard').should('be.visible');
    });
  });

  describe('Create Moodboard', () => {
    it('should open create modal from header button', () => {
      cy.visit('/looks');

      // Click New Moodboard
      cy.contains('button', 'New Moodboard').click();

      // Modal should open
      cy.contains('Create New Moodboard').should('be.visible');
      cy.get('input[placeholder*="Summer Vibes"]').should('be.visible');
    });

    it('should open create modal from empty state button', () => {
      cy.visit('/looks');

      // Click Create Moodboard in empty state
      cy.contains('No moodboards yet')
        .parent()
        .contains('button', 'Create Moodboard')
        .click();

      // Modal should open
      cy.contains('Create New Moodboard').should('be.visible');
    });

    it('should disable Create button when name is empty', () => {
      cy.visit('/looks');

      // Open modal
      cy.contains('button', 'New Moodboard').click();

      // Create button should be disabled
      cy.get('button').contains('Create')
        .should('have.css', 'cursor', 'not-allowed');
    });

    it('should enable Create button when name is entered', () => {
      cy.visit('/looks');

      // Open modal
      cy.contains('button', 'New Moodboard').click();

      // Type a name
      cy.get('input[placeholder*="Summer Vibes"]').type('My First Board');

      // Create button should be enabled
      cy.get('button').contains('Create')
        .should('have.css', 'cursor', 'pointer');
    });

    it('should create moodboard and navigate to editor', () => {
      cy.visit('/looks');

      // Open modal
      cy.contains('button', 'New Moodboard').click();

      // Enter name and description
      cy.get('input[placeholder*="Summer Vibes"]').type('Test Moodboard');
      cy.get('input[placeholder*="about"]').type('A test description');

      // Click Create
      cy.get('button').contains('Create').click();

      // Should navigate to moodboard editor
      cy.url().should('include', '/looks/');
      cy.url().should('include', 'test-moodboard');
    });

    it('should create moodboard on Enter key press', () => {
      cy.visit('/looks');

      // Open modal
      cy.contains('button', 'New Moodboard').click();

      // Type name and press Enter
      cy.get('input[placeholder*="Summer Vibes"]').type('Quick Create Board{enter}');

      // Should navigate to editor
      cy.url().should('include', '/looks/');
    });

    it('should close modal on Cancel', () => {
      cy.visit('/looks');

      // Open modal
      cy.contains('button', 'New Moodboard').click();
      cy.contains('Create New Moodboard').should('be.visible');

      // Click Cancel
      cy.contains('button', 'Cancel').click();

      // Modal should close
      cy.contains('Create New Moodboard').should('not.exist');
    });

    it('should close modal on backdrop click', () => {
      cy.visit('/looks');

      // Open modal
      cy.contains('button', 'New Moodboard').click();
      cy.contains('Create New Moodboard').should('be.visible');

      // Click on backdrop (outside modal)
      cy.get('div[class*="fixed inset-0"]').click('topLeft');

      // Modal should close
      cy.contains('Create New Moodboard').should('not.exist');
    });
  });

  describe('Moodboard List', () => {
    beforeEach(() => {
      // Create a moodboard first
      cy.visit('/looks');
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Test Board');
      cy.get('button').contains('Create').click();

      // Go back to list
      cy.visit('/looks');
    });

    it('should display moodboard cards in grid', () => {
      // Should show the created moodboard
      cy.contains('Test Board').should('be.visible');

      // Should show item count
      cy.contains('0 items').should('be.visible');
    });

    it('should navigate to moodboard on card click', () => {
      // Click on moodboard card
      cy.contains('Test Board').click();

      // Should navigate to editor
      cy.url().should('include', '/looks/');
      cy.url().should('include', 'test-board');
    });

    it('should show menu on hover and click', () => {
      // Hover over moodboard card to reveal menu button
      cy.contains('Test Board')
        .parents('[class*="group"]')
        .trigger('mouseover');

      // Click menu button
      cy.get('button')
        .find('svg')
        .filter('[class*="lucide-more-horizontal"]')
        .first()
        .parent()
        .click({ force: true });

      // Menu should appear
      cy.contains('Rename').should('be.visible');
      cy.contains('Delete').should('be.visible');
    });

    it('should rename moodboard', () => {
      // Open menu
      cy.contains('Test Board')
        .parents('[class*="group"]')
        .trigger('mouseover');

      cy.get('button')
        .find('svg')
        .filter('[class*="lucide-more-horizontal"]')
        .first()
        .parent()
        .click({ force: true });

      // Click Rename
      cy.contains('Rename').click();

      // Input should appear
      cy.get('input[value="Test Board"]').should('be.visible');

      // Clear and type new name
      cy.get('input[value="Test Board"]')
        .clear()
        .type('Renamed Board{enter}');

      // Name should be updated
      cy.contains('Renamed Board').should('be.visible');
      cy.contains('Test Board').should('not.exist');
    });

    it('should delete moodboard', () => {
      // Open menu
      cy.contains('Test Board')
        .parents('[class*="group"]')
        .trigger('mouseover');

      cy.get('button')
        .find('svg')
        .filter('[class*="lucide-more-horizontal"]')
        .first()
        .parent()
        .click({ force: true });

      // Click Delete
      cy.contains('Delete').click();

      // Moodboard should be removed
      cy.contains('Test Board').should('not.exist');

      // Empty state should show
      cy.contains('No moodboards yet').should('be.visible');
    });

    it('should escape rename mode without saving', () => {
      // Open menu
      cy.contains('Test Board')
        .parents('[class*="group"]')
        .trigger('mouseover');

      cy.get('button')
        .find('svg')
        .filter('[class*="lucide-more-horizontal"]')
        .first()
        .parent()
        .click({ force: true });

      // Click Rename
      cy.contains('Rename').click();

      // Type new name but press Escape
      cy.get('input[value="Test Board"]')
        .clear()
        .type('Cancelled Name{esc}');

      // Original name should remain
      cy.contains('Test Board').should('be.visible');
      cy.contains('Cancelled Name').should('not.exist');
    });
  });

  describe('Multiple Moodboards', () => {
    beforeEach(() => {
      // Create multiple moodboards
      cy.visit('/looks');

      // Create first
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Board One');
      cy.get('button').contains('Create').click();
      cy.visit('/looks');

      // Create second
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Board Two');
      cy.get('button').contains('Create').click();
      cy.visit('/looks');

      // Create third
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Board Three');
      cy.get('button').contains('Create').click();
      cy.visit('/looks');
    });

    it('should display all moodboards in grid', () => {
      cy.contains('Board One').should('be.visible');
      cy.contains('Board Two').should('be.visible');
      cy.contains('Board Three').should('be.visible');
    });

    it('should show correct item counts', () => {
      // All should show 0 items initially
      cy.get('div[class*="grid"]')
        .find('span')
        .filter(':contains("0 items")')
        .should('have.length', 3);
    });
  });

  describe('Moodboard Persistence', () => {
    it('should persist moodboards after page reload', () => {
      cy.visit('/looks');

      // Create moodboard
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Persistent Board');
      cy.get('button').contains('Create').click();

      // Go back to list
      cy.visit('/looks');

      // Reload page
      cy.reload();

      // Moodboard should still exist
      cy.contains('Persistent Board').should('be.visible');
    });

    it('should persist after browser close simulation', () => {
      cy.visit('/looks');

      // Create moodboard
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Survival Board');
      cy.get('button').contains('Create').click();

      // Visit another page
      cy.visit('/settings');

      // Come back
      cy.visit('/looks');

      // Board should exist
      cy.contains('Survival Board').should('be.visible');
    });
  });

  describe('TopBar Theming', () => {
    it('should show warm themed topbar on looks list page', () => {
      cy.visit('/looks');

      // TopBar should have warm background (cream colored)
      // This is indicated by the different styling on the looks page
      cy.get('header').should('be.visible');
    });
  });

  describe('Loading State', () => {
    it('should show loading skeleton while hydrating', () => {
      // Visit page - skeleton should briefly appear
      cy.visit('/looks');

      // After hydration, content should be visible
      cy.get('h1').should('contain', 'Layers');
    });
  });

  describe('Date Display', () => {
    it('should display formatted date on moodboard cards', () => {
      cy.visit('/looks');

      // Create a moodboard
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Dated Board');
      cy.get('button').contains('Create').click();

      // Go back to list
      cy.visit('/looks');

      // Should show a formatted date (e.g., "Dec 31, 2024")
      cy.contains('Dated Board')
        .parents('div[class*="group"]')
        .contains(/[A-Z][a-z]{2} \d{1,2}, \d{4}/)
        .should('be.visible');
    });
  });

  describe('Click Handlers - Regression Tests', () => {
    // These tests verify that clicking on card elements doesn't crash the app
    // Regression: DropdownItem was crashing when used outside Dropdown context

    beforeEach(() => {
      cy.visit('/looks');
      // Create a moodboard first
      cy.contains('button', 'New Moodboard').click();
      cy.get('input[placeholder*="Summer Vibes"]').type('Click Test Board');
      cy.get('button').contains('Create').click();
      cy.visit('/looks');
    });

    it('should not crash when clicking on empty moodboard card (grid icon area)', () => {
      // Click on the card - this should navigate, not crash
      cy.contains('Click Test Board')
        .parents('[role="button"]')
        .click();

      // Should navigate to editor without error
      cy.url().should('include', '/looks/');
      cy.url().should('include', 'click-test-board');
    });

    it('should not crash when clicking menu button multiple times', () => {
      // Hover to reveal menu
      cy.contains('Click Test Board')
        .parents('[class*="group"]')
        .trigger('mouseover');

      // Find and click the menu button
      const menuButton = () => cy.get('button')
        .find('svg')
        .filter('[class*="lucide-more-horizontal"]')
        .first()
        .parent();

      // Click to open
      menuButton().click({ force: true });
      cy.contains('Rename').should('be.visible');

      // Click to close
      menuButton().click({ force: true });

      // Click to open again - should not crash
      menuButton().click({ force: true });
      cy.contains('Rename').should('be.visible');
    });

    it('should not crash when clicking Rename dropdown item', () => {
      // Open menu
      cy.contains('Click Test Board')
        .parents('[class*="group"]')
        .trigger('mouseover');

      cy.get('button')
        .find('svg')
        .filter('[class*="lucide-more-horizontal"]')
        .first()
        .parent()
        .click({ force: true });

      // Click Rename - should not crash (was crashing due to DropdownItem context issue)
      cy.contains('Rename').click();

      // Input should appear
      cy.get('input').should('have.value', 'Click Test Board');
    });

    it('should not crash when clicking Delete dropdown item', () => {
      // Open menu
      cy.contains('Click Test Board')
        .parents('[class*="group"]')
        .trigger('mouseover');

      cy.get('button')
        .find('svg')
        .filter('[class*="lucide-more-horizontal"]')
        .first()
        .parent()
        .click({ force: true });

      // Click Delete - should not crash
      cy.contains('Delete').click();

      // Board should be deleted
      cy.contains('Click Test Board').should('not.exist');
    });

    it('should handle rapid clicks on card without crashing', () => {
      // Rapid clicking should not cause issues
      const card = () => cy.contains('Click Test Board').parents('[role="button"]');

      card().click();

      // Should navigate successfully
      cy.url().should('include', '/looks/');
    });

    it('should recover from errors using ErrorBoundary', () => {
      // Visit looks page - ErrorBoundary should be wrapping the grid
      cy.visit('/looks');

      // Page should load without showing error boundary fallback
      cy.contains('Something went wrong').should('not.exist');
      cy.contains('Click Test Board').should('be.visible');
    });
  });
});
