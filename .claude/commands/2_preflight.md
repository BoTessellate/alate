---
description: Run preflight checks before committing to catch issues early
allowed-tools: Read, Glob, Grep, Bash(npm:*), Bash(npx:*), Bash(git:*), Bash(wc:*), Bash(ls:*)
---

# Preflight Check

Run all verification checks before committing. Catches issues that would otherwise slip through.

**Run this before `/commit-push`.**

---

## Checks to Run

### 1. Build Checks (BLOCKING)

```bash
# TypeScript - both projects must compile
cd frontend && npx tsc --noEmit --skipLibCheck
cd backend && npx tsc --noEmit --skipLibCheck

# Lint
cd frontend && npm run lint

# Build
cd frontend && npm run build
```

**All must pass. Stop here if any fail.**

---

### 2. Pattern Enforcement (BLOCKING)

Check for violations of project rules. See [CLAUDE.md](../../CLAUDE.md#code-style) for full rules.

#### 2a. No `console.log` in production code
```bash
# Search for console.log (excluding tests and node_modules)
grep -r "console\.log" frontend/src --include="*.ts" --include="*.tsx" | grep -v "\.test\." | grep -v "\.spec\."
```
**Violation:** Use a proper logger or remove debug statements.

#### 2b. No `any` type abuse
```bash
# Count explicit 'any' types (some are acceptable, flag if excessive)
grep -r ": any" frontend/src --include="*.ts" --include="*.tsx" | wc -l
```
**Threshold:** < 10 instances. If more, review each one.

#### 2c. No direct Supabase in frontend pages
```bash
# Frontend pages should use API, not direct Supabase
grep -r "supabase\." frontend/src/app --include="*.tsx" | grep -v "// allowed"
```
**Violation:** Use `@/lib/productsApi` or backend API instead.

#### 2d. Vercel function limit
```bash
# Count API endpoints (max 12 on Hobby plan)
ls backend/api/*.ts | wc -l
```
**Threshold:** ≤ 12 endpoints. If at limit, consolidate before adding new ones.

#### 2e. No stale TODOs
```bash
# Find TODOs (review if any are old/forgotten)
grep -r "TODO:" frontend/src backend/sdk --include="*.ts" --include="*.tsx"
```
**Action:** Address or remove stale TODOs.

#### 2f. API endpoints have logging
```bash
# Find API endpoints missing logging
grep -L "console.log\|console.error" backend/api/*.ts
```
**Violation:** New API endpoints must include structured logging. See [CLAUDE.md](../../CLAUDE.md#backend-logging).

---

### 3. Test Integrity (BLOCKING)

```bash
cd frontend && npm run test -- --passWithNoTests
```

**⚠️ CRITICAL WARNING: Test Trust Issues**

AI-written tests have a dangerous pattern:
- Tests often confirm what the code DOES, not what it SHOULD do
- When code breaks, AI may ALTER THE TEST to make it pass
- Green tests ≠ working code

**Rules:**
1. If a test fails, investigate WHY before touching the test
2. NEVER change a test just to make it green
3. Ask: "Does this test verify the REQUIREMENT or just the IMPLEMENTATION?"
4. Be suspicious of tests that pass immediately after AI writes them

---

### 4. Architecture Check (WARNING)

#### 4a. No circular dependencies
```bash
# Check for circular imports (manual review)
npx madge --circular frontend/src
```

#### 4b. No god files (>500 lines)
```bash
# Find large files
wc -l frontend/src/**/*.tsx frontend/src/**/*.ts 2>/dev/null | sort -n | tail -10
```
**Threshold:** Files > 500 lines should be split.

#### 4c. No orphan exports
```bash
# Find exports that might be unused (manual review needed)
grep -r "export function\|export const\|export class" backend/sdk --include="*.ts" | head -20
```

#### 4d. Documentation Check
```bash
# Check for complex functions without comments
# Look for functions >20 lines without explaining WHY
grep -B5 "function\|const.*=.*=>" frontend/src backend/sdk --include="*.ts" --include="*.tsx" | grep -v "//"
```

**Rule:** Complex logic (>20 lines, non-obvious algorithms) MUST have comments explaining WHY.

⚠️ **Manual check:** The grep above is superficial. Manually review complex functions (>20 lines) for WHY comments, not just WHAT comments.

---

## Output Format

```markdown
# Preflight Report

## ✅ Passed
- TypeScript compilation
- Lint
- Build
- Tests

## ⚠️ Warnings
| Check | Finding | Action |
|-------|---------|--------|
| any types | 15 found | Review and type properly |
| Large file | admin/page.tsx (800 lines) | Consider splitting |

## ❌ Failed (BLOCKING)
| Check | Error | Must Fix |
|-------|-------|----------|
| console.log | 3 found in ProductCard.tsx | Remove before commit |

## Verdict
🟢 PASS - Safe to commit
🟡 WARN - Review warnings, then commit
🔴 FAIL - Fix blocking issues first
```

---

## When to Run

- **Always** before `/commit-push`
- **Always** before creating a PR
- After significant changes
- When resuming work after a break

---

## Quick Reference

```
1. BUILD ────────────────────────────────
   │ TypeScript (frontend + backend)
   │ Lint
   │ Build
   └─── ❌ STOP if failing

2. PATTERNS ─────────────────────────────
   │ No console.log
   │ No any abuse
   │ No direct Supabase in frontend
   │ API count ≤ 12
   │ No stale TODOs
   └─── ❌ STOP if violating

3. TESTS ────────────────────────────────
   │ Tests pass
   │ ⚠️ Don't trust blindly
   │ ⚠️ Never alter test to make it pass
   └─── ❌ STOP if failing

4. ARCHITECTURE ─────────────────────────
   │ No circular deps
   │ No god files
   │ No orphan exports
   └─── ⚠️ Warning only
```

---

## Target

$ARGUMENTS
