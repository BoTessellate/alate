## Summary
<!-- Brief description of what this PR does -->

## Related Issue
<!-- Link to the issue this PR addresses -->
Closes #

## Changes
- [ ] Change 1
- [ ] Change 2
- [ ] Change 3

## Screenshots/Demo
<!-- Add screenshots or GIFs if this includes UI changes -->

## Automated Test Coverage

<!-- ✅ Run tests for impacted code areas and critical user flows -->
<!-- 📘 See [AUTOMATED_TESTING.md](../AUTOMATED_TESTING.md) for comprehensive guide -->

**Run these tests based on your changes:**

**If you changed backend/api/admin.ts:**
```bash
npx playwright test integration/admin-endpoints.spec.ts
```

**If you changed backend/api/search.ts or related products:**
```bash
npx playwright test integration/related-products.spec.ts
```

**If you changed Shopify integration (backend/api/shopify*.ts):**
```bash
npx playwright test integration/shopify-integration.spec.ts
```

**If you changed scraping (backend/api/ai.ts action=scrape or ScrapeUrlContent.tsx):**
```bash
npx playwright test workflows/url-scrape-workflow.spec.ts
```

**If you changed flat lay (layoutAI/* or FlatLayPreview):**
```bash
npx playwright test workflows/flat-lay-preview.spec.ts
```

**If you changed photo upload (usePhotoUpload or ImageUpload components):**
```bash
npx playwright test workflows/photo-upload-workflow.spec.ts
```

**If you changed error handling or API clients:**
```bash
npx playwright test robustness/api-failures.spec.ts
```

**Always run (critical user flows):**
```bash
# Core search and product discovery
npx playwright test integration/related-products.spec.ts

# Basic navigation and page loads
npx playwright test workflows/
```

**Before deployment:**
```bash
# Smoke tests verify deployment succeeded
npx playwright test deployment/smoke-tests.spec.ts
```

**Pre-commit Hooks** (run automatically on `git commit`):
- ✅ TypeScript compiles without errors
- ✅ ESLint passes
- ✅ No secrets/API keys committed
- ✅ Vercel function limit not exceeded (12 max)
- ✅ Architecture rules enforced (no direct Supabase in frontend)

> 💡 **Tip:** Run tests locally before pushing. Faster feedback than waiting for CI.

## Breaking Changes
<!-- List any breaking changes, or write "None" -->

None

## Checklist
- [ ] Code follows BDD principles (tests verify expected behavior, not implementation)
- [ ] All automated tests passing
- [ ] Inline code comments added for complex logic
- [ ] Documentation updated (CLAUDE.md, API docs, etc.)
- [ ] No console.log in production code
- [ ] Self-reviewed the code

