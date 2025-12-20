# Shared SDK Module

Common utilities, error handling, and validation for all Mood Layer SDK modules.

## Installation

The shared module is available to all SDK modules. Import from `../shared` or `../../shared`:

```typescript
import { ValidationError, validateBody, searchQuerySchema } from '../shared';
```

## Features

### Error Classes

Type-safe error handling with HTTP status codes:

```typescript
import {
  SDKError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  RateLimitError,
  ExternalServiceError,
  DatabaseError,
  ConfigurationError,
  TimeoutError,
  ConflictError,
  isSDKError,
  wrapError,
} from '../shared';

// Throw typed errors
throw new ValidationError('Invalid input', ['email: must be valid']);
throw new NotFoundError('Product', 'abc-123');
throw new RateLimitError('Too many requests', 60); // retry after 60s

// Check error type
if (isSDKError(error)) {
  console.log(error.code, error.statusCode);
}

// Wrap unknown errors
const wrapped = wrapError(unknownError, { requestId: 'req-123' });
```

### Validation Schemas (Zod)

Pre-built schemas for common data types:

```typescript
import {
  // Common
  paginationSchema,
  uuidSchema,
  urlSchema,
  hexColorSchema,

  // Product Enrichment
  productEnrichmentSchema,
  batchEnrichmentSchema,

  // Search
  searchQuerySchema,
  semanticSearchSchema,

  // Layout
  layoutArchetypeSchema,
  canvasSizeSchema,
  layoutRequestSchema,

  // Export
  exportFormatSchema,
  exportRequestSchema,
  socialPlatformSchema,
  socialExportSchema,

  // Theme
  colorPaletteSchema,
  typographySchema,
  themeExtractionSchema,

  // Moodboard
  moodboardItemSchema,
  moodboardSchema,

  // Plugin
  pluginPlatformSchema,
  pluginConnectionSchema,
  productSyncSchema,
} from '../shared';
```

### Validation Middleware

Express middleware for request validation:

```typescript
import { validateBody, validateQuery, validateParams } from '../shared';

// Validate request body
router.post('/products',
  validateBody(productEnrichmentSchema),
  async (req, res) => {
    // req.body is validated and typed
  }
);

// Validate query parameters
router.get('/search',
  validateQuery(searchQuerySchema),
  async (req, res) => {
    // req.query is validated and typed
  }
);

// Validate URL parameters
router.get('/products/:id',
  validateParams(z.object({ id: uuidSchema })),
  async (req, res) => {
    // req.params.id is a valid UUID
  }
);
```

### Error Handler Middleware

Centralized error handling for Express:

```typescript
import {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  timeoutHandler,
  requestIdMiddleware,
  corsMiddleware,
  securityHeadersMiddleware,
} from '../shared';

const app = express();

// Add middleware
app.use(requestIdMiddleware);
app.use(corsMiddleware());
app.use(securityHeadersMiddleware);
app.use(timeoutHandler(30000)); // 30s timeout

// Wrap async handlers
app.get('/api/products', asyncHandler(async (req, res) => {
  // Errors automatically passed to error handler
  const products = await getProducts();
  res.json(products);
}));

// 404 handler (before error handler)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);
```

### Direct Validation

For non-middleware validation:

```typescript
import { validate, safeParse } from '../shared';

// Throws ValidationError on failure
const data = await validate(canvasSizeSchema, { width: 800, height: 600 });

// Returns result object instead of throwing
const result = safeParse(uuidSchema, userInput);
if (result.success) {
  console.log(result.data);
} else {
  console.log(result.errors);
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Missing/invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT_ERROR` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `CONFIGURATION_ERROR` | 500 | Missing configuration |
| `EXTERNAL_SERVICE_ERROR` | 502 | External API failure |
| `TIMEOUT_ERROR` | 504 | Request timeout |

## Testing

Run tests:

```bash
npm test -- sdk/shared
```

## Files

- `errors.ts` - Custom error classes
- `validation.ts` - Zod schemas and middleware
- `errorHandler.ts` - Express error handling
- `index.ts` - Module exports
