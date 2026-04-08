---
description: Build a feature with structured planning and checkpoints
allowed-tools: Read, Glob, Grep, Edit, Write, Bash(git:*), Bash(npm:*), Bash(npx:*), Bash(gh:*)
---

# Build Feature

Two user checkpoints: approve plan, then approve finished work.

---

## ⚠️ CRITICAL WARNINGS - Read Before Starting

### Don't Trust AI-Written Tests
- Tests may confirm what code DOES, not what it SHOULD do
- If a test fails, investigate WHY before changing the test
- NEVER alter a test just to make it green
- Be suspicious of tests that pass immediately after writing

### Don't Perpetually Refactor
- Refactor only when: scope is clear AND code is too hard to extend
- Sometimes working code is good enough - ship it
- Set a refactor budget - don't refactor forever
- Watch for: duplicate implementations doing 80% same work
- A full rewrite may be better than endless tweaking

### Don't Create Drift-Prone Documentation
**Inline docs required** - See [CLAUDE.md](../../CLAUDE.md#inline-documentation-mandatory) for rules.

---

## Work Types

| Type | Branch | Coverage | PR |
|------|--------|----------|-----|
| **feature** | `feature/` | 80% | Required |
| **bug** | `fix/` | 90% | Required |
| **refactor** | `refactor/` | 90% | Required |
| **chore** | `chore/` | 0% | Skip |

**Usage:** `/build-feature [type] [description]`

Default: **feature**

---

## Phase 1: Planning [USER APPROVAL]

### 1a. Create Issue
```bash
gh issue create --title "[prefix]: [description]" --body "..."
```
Title prefixes: `feat:`, `fix:`, `refactor:`, `chore:` (see CLAUDE.md Labels & Naming)
Include: Summary, Acceptance Criteria, Affected Journeys, Out of Scope.

### 1b. Research
1. Which SDKs involved? Read them
2. What patterns exist? Check `backend/sdk/` for existing patterns and exports
3. Find similar code in the codebase
4. Scan TODOs: `grep -r "TODO:" [affected-dirs]`

### 1c. Write Plan
Create `.claude/working directory/[FEATURE_NAME].md` with:
- Problem statement
- Solution overview
- Acceptance criteria
- Implementation steps (files, changes, tests per step)
- Risk assessment
- Existing TODOs in affected files

**See:** `.claude/WORKING_DIRECTORY.md` for template format

### 1d. Present Plan
Show user: summary, key decisions, files to change, questions.

**⏸️ STOP - Wait for user approval before coding.**

---

## Phase 2: Implementation [AUTONOMOUS]

### 2a. Create Branch
```bash
git checkout -b [type]/[desc]-[issue]
```

### 2b. Implement
Follow plan exactly. Write tests alongside code.

**Required Tests by Change Type:**

| Change Type | Required Tests |
|-------------|----------------|
| **UI components** | Unit test for props/state, E2E test for user interaction |
| **Labels/copy** | E2E test asserting exact text |
| **Visual styling** | E2E test for CSS properties (border, shadow, position) |
| **State management** | Unit test for store behavior, E2E for state persistence |
| **API integration** | Unit test with mocks, E2E with stubbed endpoints |
| **User flows** | E2E test covering full journey |

**Test Standards:**
- Unit tests: Test behavior, not implementation details
- E2E tests: Test what user sees/does, not internal state
- Visual tests: Assert on computed styles or inline styles
- State tests: Verify persistence across mode changes/navigation
- Animation timing: Add `cy.wait()` after close/toggle actions before checking reopened state (animations take ~300-500ms)

### 2c. Run Preflight
```bash
# Run /preflight command for full verification
```
This runs: TypeScript, lint, build, pattern checks, tests.

**All must pass. See `/preflight` for details.**

**For UI changes:** Write Playwright tests and run against local build:
```bash
cd frontend && npm run start &  # Start production server
npx playwright test [relevant-spec] --project=chromium
```

Playwright tests must verify:
- No page errors (crashes, infinite loops)
- No console errors during interactions
- Layout correctness (element positions, grid ratios)
- Multi-step flows complete without errors
- Visual elements render as expected

### 2d. Self-Check
- [ ] All acceptance criteria implemented
- [ ] Each criterion has automated test coverage
- [ ] Edge cases handled
- [ ] No debug code left (no console.log)
- [ ] No unused imports
- [ ] Existing tests still pass (no regressions)
- [ ] Tests assert on user-visible behavior (not internal state)
- [ ] ⚠️ Did NOT alter any existing test just to make it pass
- [ ] ⚠️ Tests verify REQUIREMENTS, not just current implementation

### 2e. Push & CI
```bash
git add . && git commit -m "[prefix]: [desc]" && git push -u origin [branch]
gh pr create --draft --title "[prefix]: [desc]" --body "WIP"
gh pr checks [PR] --watch
```

Fix CI failures (max 3 iterations).

**After successful push:** Update working file with progress.

### 2f. Coverage
```bash
cd frontend && npm run test -- --coverage --passWithNoTests
```
Verify: feature 80%, bug/refactor 90%.

### 2g. Update Progress File
Mark criteria complete with file:line references.

---

## Phase 3: Delivery [USER APPROVAL]

### 3a. Ready PR
```bash
gh pr ready [PR]
```
Update body: summary, changes, verification results, test plan for user.

### 3b. Update Docs (if needed)
- `.claude/USER_JOURNEYS.md` - Update implementation status, add file references
- `CLAUDE.md` - Add new patterns/gotchas if discovered
- **Inline code comments** - Document WHY for complex logic

### 3c. Present to User
Show: PR link, what was built, local verification results, manual test steps for UAT.

**⏸️ STOP - Wait for user to test and approve.**

### 3d. Merge & Cleanup
```bash
gh pr merge [PR] --squash --delete-branch
```

**CRITICAL: Clean up working directory after merge:**
```bash
# Delete the feature's working file
rm ".claude/working directory/[FEATURE_NAME].md"

# If working directory is empty, good. If stale files exist, clean them:
ls ".claude/working directory/"
# Remove any files for features that are already merged
```

This keeps working directory clean - only active work visible.

---

## Guard Rails (for bug fixes)

**ALLOWED:**
- Fix implementation bugs
- Improve error handling
- Add logging
- Fix type errors

**NOT ALLOWED:**
- Change user journey steps
- Alter feature contracts
- Add new features
- Scope creep

---

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Merge with failing CI | Breaks main |
| Skip tests | Tech debt, regressions go unnoticed |
| Test internal state only | Refactors break tests unnecessarily |
| Hardcode test values | Tests break when copy changes |
| Ask mid-implementation | Plan should cover it |
| Present unverified work | Wastes user's time |
| Deviate silently | User approved specific plan |
| Skip visual tests for UI | Styling regressions go unnoticed |
| **Alter test to make it pass** | Hides bugs, defeats purpose of testing |
| **Trust green tests blindly** | AI writes tests that confirm code, not requirements |
| **Refactor endlessly** | Ship working code; perfect is enemy of done |
| **Create separate doc files** | They drift; document in code instead |
| **Skip /preflight** | Pattern violations slip through |

---

## Quick Reference

```
PHASE 1: PLANNING ────────────────────────
│ Create issue → Research → Write plan
└─── ⏸️ User approves plan

PHASE 2: IMPLEMENTATION ──────────────────
│ Branch → Code → Test → Verify → Push
└─── 🔄 Autonomous

PHASE 3: DELIVERY ────────────────────────
│ Ready PR → Docs → Present
└─── ⏸️ User approves merge
```

## Target

$ARGUMENTS
