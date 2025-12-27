## Summary
<!-- Brief description of changes -->

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Refactoring
- [ ] Documentation

## Checklist

### Critical Checks (Read before merging!)

#### Backend Changes
- [ ] **API Function Count**: Still at 11 or fewer? (Vercel Hobby = 12 max)
- [ ] **secureAI.ts**: Did NOT remove AbortController timeout?
- [ ] **secureAI.ts**: Did NOT remove Anthropic direct API fallback?
- [ ] **shopify.ts**: Did NOT add X-Frame-Options header?
- [ ] **shopify.ts**: Did NOT call .text()/.json() twice on same Response?

#### If Unsure
Read the `CRITICAL ARCHITECTURE NOTES` comments at the top of:
- `backend/sdk/shared/secureAI.ts`
- `backend/api/shopify.ts`

### General
- [ ] TypeScript compiles without errors
- [ ] Tested locally
- [ ] No secrets/API keys committed

## Related Issues
<!-- Link any related issues: Fixes #123 -->
