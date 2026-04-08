# Backend Scripts

PowerShell scripts for common development tasks.

## Available Scripts

### run-tests.ps1
Run Vitest unit tests.

```powershell
# Run all tests
.\scripts\run-tests.ps1

# Watch mode
.\scripts\run-tests.ps1 -Watch

# With coverage
.\scripts\run-tests.ps1 -Coverage

# Open Vitest UI
.\scripts\run-tests.ps1 -UI

# Filter by test name
.\scripts\run-tests.ps1 -Filter "enrichment"
```

### generate-coverage.ps1
Generate test coverage report.

```powershell
# Generate coverage report
.\scripts\generate-coverage.ps1

# Generate HTML report
.\scripts\generate-coverage.ps1 -Html
```

### deploy.ps1
Deploy to Vercel.

```powershell
# Deploy to production
.\scripts\deploy.ps1

# Force rebuild
.\scripts\deploy.ps1 -Force

# Preview deployment
.\scripts\deploy.ps1 -Preview
```

### dev.ps1
Start the local development server.

```powershell
# Start on default port (3001)
.\scripts\dev.ps1

# Start on custom port
.\scripts\dev.ps1 -Port 3002
```

## Usage from npm

You can also run these via npm scripts:

```bash
npm test              # Run Vitest tests
npm run test:coverage # Run with coverage
npm run dev           # Start Vercel dev server
npm run deploy        # Deploy to Vercel
```

## Existing Migration Scripts

The following scripts are also available in this folder:

- `run-migration.js` - Apply SQL migrations
- `populate-product-urls.js` - Generate product URLs
