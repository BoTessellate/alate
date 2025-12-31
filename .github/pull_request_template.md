## Summary
<!-- Brief description of changes -->

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Refactoring (no functional changes)
- [ ] Documentation update
- [ ] CI/CD changes
- [ ] Dependency updates

## Changes Made
<!-- List the specific changes made in this PR -->
-

## Testing
<!-- Describe how you tested these changes -->
- [ ] Unit tests pass (`npm test`)
- [ ] E2E tests pass (if applicable)
- [ ] Manually tested locally
- [ ] Tested on mobile (if mobile changes)

## Screenshots/Recordings
<!-- If applicable, add screenshots or recordings to help explain your changes -->

## Checklist

### General
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation (if needed)
- [ ] My changes generate no new warnings
- [ ] TypeScript compiles without errors
- [ ] No secrets/API keys committed

### Critical Checks (Read before merging!)

#### Backend Changes
- [ ] **API Function Count**: Still at 11 or fewer? (Vercel Hobby = 12 max)
- [ ] **secureAI.ts**: Did NOT remove AbortController timeout?
- [ ] **secureAI.ts**: Did NOT remove Anthropic direct API fallback?
- [ ] **shopify.ts**: Did NOT add X-Frame-Options header?
- [ ] **shopify.ts**: Did NOT call .text()/.json() twice on same Response?

#### Frontend Changes
- [ ] Uses CSS variables for theming (not hardcoded colors)
- [ ] Components use proper TypeScript types
- [ ] New components have proper error boundaries (if needed)

#### If Unsure
Read the `CRITICAL ARCHITECTURE NOTES` comments at the top of:
- `backend/sdk/shared/secureAI.ts`
- `backend/api/shopify.ts`

## CI Status
<!-- The following checks must pass before merging -->
- [ ] `frontend-lint` - ESLint check passed
- [ ] `frontend-test` - Unit tests passed
- [ ] `frontend-build` - Next.js build succeeded
- [ ] `backend-test` - Backend tests passed
- [ ] `backend-typecheck` - TypeScript compilation passed

## Related Issues
<!-- Link any related issues: Fixes #123, Closes #456 -->

## Additional Notes
<!-- Any additional information that reviewers should know -->
