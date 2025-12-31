import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    video: false,
    screenshotOnRunFailure: true,
    // Retry failed tests
    retries: {
      runMode: 2,
      openMode: 0,
    },
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
    // Spec file pattern
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    // Support file
    supportFile: 'cypress/support/e2e.ts',
  },
  // Component testing (optional, for future)
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
  },
});
