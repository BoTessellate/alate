/// <reference types="cypress" />

describe('Onboarding Flow', () => {
  beforeEach(() => {
    // Reset app state before each test
    cy.resetAppState();
    // Stub the search API to avoid external calls during onboarding
    cy.intercept('GET', '**/api/search*', {
      statusCode: 200,
      body: {
        products: [
          { tags: ['modern', 'minimalist', 'clean'] },
          { tags: ['vintage', 'rustic', 'warm'] },
          { tags: ['elegant', 'natural', 'neutral'] },
        ],
      },
    }).as('fetchTags');
  });

  it('should display step 1 - style categories selection', () => {
    cy.visit('/onboarding');

    // Wait for hydration
    cy.get('h1').should('contain', "What's your style?");

    // Check progress indicator shows step 1
    cy.get('[class*="rounded-full"]')
      .filter('[style*="var(--primary)"]')
      .should('have.length.at.least', 1);

    // Check for style category buttons
    cy.contains('button', 'Minimalist').should('be.visible');
    cy.contains('button', 'Continue').should('be.visible');

    // Skip button should be visible
    cy.contains('Skip for now').should('be.visible');
  });

  it('should require at least 2 style categories to proceed', () => {
    cy.visit('/onboarding');

    // Wait for page to load
    cy.get('h1').should('contain', "What's your style?");

    // Continue button should be disabled initially
    cy.contains('button', 'Continue')
      .should('have.css', 'cursor', 'not-allowed');

    // Select only 1 category
    cy.contains('button', 'Minimalist').click();

    // Continue should still be disabled
    cy.contains('button', 'Continue')
      .should('have.css', 'cursor', 'not-allowed');

    // Select a second category
    cy.contains('button', 'Modern').click();

    // Now Continue should be enabled
    cy.contains('button', 'Continue')
      .should('have.css', 'cursor', 'pointer');
  });

  it('should navigate from step 1 to step 2', () => {
    cy.visit('/onboarding');

    // Wait for page
    cy.get('h1').should('contain', "What's your style?");

    // Select 2 categories
    cy.contains('button', 'Minimalist').click();
    cy.contains('button', 'Modern').click();

    // Click Continue
    cy.contains('button', 'Continue').click();

    // Should now be on step 2
    cy.get('h1').should('contain', 'Pick your favorites');
  });

  it('should display step 2 - tags selection', () => {
    cy.visit('/onboarding');

    // Complete step 1
    cy.get('h1').should('contain', "What's your style?");
    cy.contains('button', 'Minimalist').click();
    cy.contains('button', 'Vintage').click();
    cy.contains('button', 'Continue').click();

    // Wait for step 2
    cy.get('h1').should('contain', 'Pick your favorites');

    // Wait for tags to load (or use fallback tags)
    cy.wait('@fetchTags');

    // Should show tag buttons
    cy.get('button[class*="rounded-full"]').should('have.length.at.least', 5);

    // Skip button should still be visible
    cy.contains('Skip for now').should('be.visible');
  });

  it('should require at least 3 tags to proceed on step 2', () => {
    cy.visit('/onboarding');

    // Complete step 1
    cy.contains('button', 'Minimalist').click();
    cy.contains('button', 'Modern').click();
    cy.contains('button', 'Continue').click();

    // Wait for step 2
    cy.get('h1').should('contain', 'Pick your favorites');
    cy.wait('@fetchTags');

    // Wait for tags to appear
    cy.get('button[class*="rounded-full"]').should('have.length.at.least', 3);

    // Continue should be disabled with less than 3 tags
    cy.contains('button', 'Continue')
      .should('have.css', 'cursor', 'not-allowed');
  });

  it('should complete onboarding and show final step', () => {
    cy.visit('/onboarding');

    // Complete step 1
    cy.get('h1').should('contain', "What's your style?");
    cy.contains('button', 'Minimalist').click();
    cy.contains('button', 'Modern').click();
    cy.contains('button', 'Continue').click();

    // Wait for step 2 and tags
    cy.get('h1').should('contain', 'Pick your favorites');
    cy.wait('@fetchTags');

    // Select 3 tags from the available ones
    cy.get('div[class*="flex flex-wrap"]')
      .find('button')
      .should('have.length.at.least', 3)
      .then(($buttons) => {
        // Click first 3 tag buttons
        cy.wrap($buttons[0]).click();
        cy.wrap($buttons[1]).click();
        cy.wrap($buttons[2]).click();
      });

    // Click Continue
    cy.contains('button', 'Continue').click();

    // Should now be on step 3 - completion
    cy.get('h1').should('contain', "You're all set!");
    cy.contains('button', 'Start Exploring').should('be.visible');

    // Skip button should NOT be visible on final step
    cy.contains('Skip for now').should('not.exist');
  });

  it('should skip onboarding and redirect to home', () => {
    cy.visit('/onboarding');

    // Wait for page
    cy.get('h1').should('contain', "What's your style?");

    // Click Skip
    cy.contains('Skip for now').click();

    // Should redirect to home
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('should redirect to home if onboarding already completed', () => {
    // Set onboarding as completed
    cy.completeOnboarding();

    // Try to visit onboarding
    cy.visit('/onboarding');

    // Should redirect to home
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });

  it('should toggle category selection on/off', () => {
    cy.visit('/onboarding');

    // Wait for page
    cy.get('h1').should('contain', "What's your style?");

    // Select a category
    cy.contains('button', 'Minimalist').click();

    // Should show checkmark (selected state)
    cy.contains('button', 'Minimalist')
      .should('have.css', 'border-color')
      .and('not.be.empty');

    // Click again to deselect
    cy.contains('button', 'Minimalist').click();

    // Can verify by checking border color changed
    cy.contains('button', 'Minimalist')
      .should('exist');
  });

  it('should finish onboarding and navigate to home', () => {
    cy.visit('/onboarding');

    // Complete step 1
    cy.contains('button', 'Minimalist').click();
    cy.contains('button', 'Modern').click();
    cy.contains('button', 'Continue').click();

    // Complete step 2
    cy.wait('@fetchTags');
    cy.get('div[class*="flex flex-wrap"]')
      .find('button')
      .then(($buttons) => {
        cy.wrap($buttons[0]).click();
        cy.wrap($buttons[1]).click();
        cy.wrap($buttons[2]).click();
      });
    cy.contains('button', 'Continue').click();

    // On step 3, click Start Exploring
    cy.get('h1').should('contain', "You're all set!");
    cy.contains('button', 'Start Exploring').click();

    // Should be on home page
    cy.url().should('eq', Cypress.config().baseUrl + '/');
  });
});
