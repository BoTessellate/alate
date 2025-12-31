# Frontend Scripts

PowerShell scripts for common development tasks.

## Available Scripts

### run-tests.ps1
Run Jest unit tests.

```powershell
# Run all tests
.\scripts\run-tests.ps1

# Watch mode
.\scripts\run-tests.ps1 -Watch

# With coverage
.\scripts\run-tests.ps1 -Coverage

# Filter by test name
.\scripts\run-tests.ps1 -Filter "ProductCard"
```

### run-e2e.ps1
Run Cypress E2E tests.

```powershell
# Run all E2E tests headlessly
.\scripts\run-e2e.ps1

# Open Cypress Test Runner
.\scripts\run-e2e.ps1 -Open

# Run headed (visible browser)
.\scripts\run-e2e.ps1 -Headed

# Specific browser
.\scripts\run-e2e.ps1 -Browser firefox

# Run specific spec
.\scripts\run-e2e.ps1 -Spec "cypress/e2e/settings.cy.ts"
```

### generate-coverage.ps1
Generate test coverage report for the admin dashboard.

```powershell
# Generate coverage report
.\scripts\generate-coverage.ps1
```

This creates `public/test-coverage.json` which is read by the admin page.

### dev.ps1
Start the development server.

```powershell
# Start on default port (3000)
.\scripts\dev.ps1

# Start on custom port
.\scripts\dev.ps1 -Port 3001

# Enable Turbopack
.\scripts\dev.ps1 -Turbo
```

## Usage from npm

You can also run these via npm scripts:

```bash
npm test              # Run Jest tests
npm run cy:open       # Open Cypress
npm run cy:run        # Run Cypress headlessly
npm run test:coverage # Run with coverage
npm run dev           # Start dev server
```
