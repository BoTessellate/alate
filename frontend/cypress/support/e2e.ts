// ***********************************************************
// This support file is processed and loaded automatically before
// your test files. This is a great place to put global configuration
// and behavior that modifies Cypress.
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands';

// Import Testing Library commands
import '@testing-library/cypress/add-commands';

// Prevent Cypress from failing tests on uncaught exceptions
// This is useful for Next.js apps that may have hydration warnings
Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignore React hydration errors
  if (err.message.includes('Hydration failed')) {
    return false;
  }
  if (err.message.includes('Text content does not match')) {
    return false;
  }
  if (err.message.includes('There was an error while hydrating')) {
    return false;
  }
  // Ignore ResizeObserver errors (common in responsive apps)
  if (err.message.includes('ResizeObserver loop')) {
    return false;
  }
  // Let other errors fail the test
  return true;
});

// Before each test, reset the app state
beforeEach(() => {
  // Clear cookies and localStorage
  cy.clearCookies();
  cy.clearLocalStorage();
});

// Add custom logging for better debugging
Cypress.on('log:added', (log) => {
  if (log.displayName === 'xhr' || log.displayName === 'fetch') {
    // Log API calls for debugging
    console.log(`${log.displayName}: ${log.url}`);
  }
});
