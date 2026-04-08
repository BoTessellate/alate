---
description: Validate system consistency after changes
allowed-tools: Read, Glob, Grep, Bash(git diff:*), Bash(npx tsc:*), Bash(npm run test:*)
---

# Consistency Check

Validate that the system is internally consistent after changes. Run this after significant work to catch drift before it causes problems.

## Checks to Perform

### 1. SDK Export Alignment

Verify SDK exports match what API routes expect:

```
backend/sdk/*/index.ts          → Check exports
backend/api/**/*.ts             → Check imports
```

**What to look for:**
- Functions exported but not used
- Functions imported but not exported
- Type mismatches at boundaries

### 2. TypeScript Compilation

```bash
npx tsc --noEmit --skipLibCheck
```

**Must pass with zero errors.**

### 3. Database Schema Alignment

Check that code references match actual schema:

```
backend/sdk/migrations/*.sql    → Schema definitions
backend/sdk/**/*.ts             → Table/column references
```

**What to look for:**
- References to columns that don't exist
- Missing migrations for new columns
- Mismatched column types

### 4. Environment Variables

Compare:
```
.env.example                    → Expected variables
backend/sdk/**/*.ts             → process.env.* usage
```

**What to look for:**
- Variables used but not in .env.example
- Variables in .env.example but unused

### 5. Taxonomy Consistency

Check that AI prompts use valid taxonomy terms:

```
backend/sdk/taxonomy/           → Valid terms
backend/sdk/productEnrichment/  → Prompt references
```

### 6. User Journey Documentation

Verify USER_JOURNEYS.md matches implementation:

```
.claude/USER_JOURNEYS.md         → Documented flows
backend/sdk/**/*.ts              → Actual implementation
```

### 8. Test Coverage

```bash
npm run test
```

**Must pass with zero failures.**

## Output Format

```markdown
# Consistency Check Report

## Passed
- TypeScript compilation
- Test suite
- Environment variables

## Warnings
| Issue | Location | Suggested Fix |
|-------|----------|---------------|

## Errors (Must Fix)
| Issue | Location | Impact |
|-------|----------|--------|

## Actions Required
1. [action 1]
2. [action 2]
```

## When to Run

- After completing `/implement-feature`
- Before committing significant changes
- After merging branches
- Weekly maintenance

## Target

$ARGUMENTS
