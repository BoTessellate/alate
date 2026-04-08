---
allowed-tools: Bash(git:*), Bash(npm:*), Bash(npx:*), Bash(gh:*)
description: Commit all changes, push to remote, and create pull request
---

# Commit & Push

Commit and push changes with verification. Ensures no broken code reaches the remote.

## ⚠️ Run `/preflight` First

For significant changes, run `/preflight` before this command. It catches:
- Pattern violations (console.log, any types, etc.)
- Architecture issues (large files, circular deps)
- Test integrity problems

`/commit-push` only runs basic build checks. `/preflight` runs full verification.

---

## Context

- Current branch: !`git branch --show-current`
- Current status: !`git status --short`
- Recent commits (style reference): !`git log --oneline -3`

---

## Workflow

### 1. Quick Verification (BLOCKING)

Run these checks before committing:

```bash
# TypeScript (both projects)
cd frontend && npx tsc --noEmit --skipLibCheck
cd backend && npx tsc --noEmit --skipLibCheck

# Lint
cd frontend && npm run lint
```

**If any fail:** Fix the issues first. Do not proceed with broken code.

### 2. Review Changes

```bash
# See what's changed
git status
git diff
```

Understand what you're committing before staging.

### 3. Stage & Commit

```bash
# Stage changes (be selective if needed)
git add .

# Commit with conventional format
git commit -m "$(cat <<'EOF'
type(scope): description

- Detail 1
- Detail 2

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

**Commit format:** See CLAUDE.md Labels & Naming for prefixes (`feat:`, `fix:`, `refactor:`, `chore:`)

### 4. Push

```bash
git push
```

If branch is new:
```bash
git push -u origin $(git branch --show-current)
```

### 5. Create Pull Request (AUTOMATIC)

After pushing, automatically create a PR to master:

```bash
gh pr create --title "type: brief description" --body "$(cat <<'EOF'
## Summary
[Brief overview of changes]

## Changes Made
- Change 1
- Change 2

## Test Plan
- [ ] Manual testing completed
- [ ] No breaking changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" --base master
```

**Required:** Generate meaningful PR title and body based on:
- Commit messages in this branch
- Files changed
- Overall purpose of the work

**Title format:** Use same convention as commits (`feat:`, `fix:`, `refactor:`, `chore:`)

**Body must include:**
- Summary section explaining what and why
- Changes Made section with bullet points
- Test Plan section (checklist format)
- Claude Code footer

---

## Quick Reference

```
0. PREFLIGHT (recommended) ─────────────
   │ Run /preflight for full checks
   └─── Especially for significant changes

1. VERIFY ──────────────────────────────
   │ TypeScript compiles
   │ Lint passes
   └─── ❌ Stop if failing

2. REVIEW ──────────────────────────────
   │ git status + git diff
   └─── Understand the changes

3. COMMIT ──────────────────────────────
   │ git add + git commit
   └─── Conventional format

4. PUSH ────────────────────────────────
   │ git push (or git push -u for new branch)
   └─── Pushed to remote

5. CREATE PR (AUTOMATIC) ───────────────
   │ gh pr create with meaningful title/body
   │ Auto-generated from commits + changes
   └─── ✅ PR ready for review
```

---

## When to Use This vs `/build-feature`

| Scenario | Command |
|----------|---------|
| Quick fix, small change | `/commit-push` |
| New feature with planning | `/build-feature` |
| Ad-hoc improvements | `/commit-push` |
| Work tracked by issue | `/build-feature` |

`/commit-push` is for changes that don't need full planning/PR workflow but still shouldn't break the build.
