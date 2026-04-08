---
description: Initialize working context for Alate development
allowed-tools: Read, Glob, Grep, Bash(git:*), Bash(npx tsc:*), Bash(gh:*)
---

# 0. Prime - Session Initialization

Load project context before starting work. Run this at the beginning of each session.

---

## Workflow

### 1. Check Pending Work

Check for open PRs from previous sessions:

```bash
gh pr list --state open --author @me
```

**If pending work exists:**
- Check CI status: `gh pr checks [PR-number]`
- If CI passed → ready to merge or continue
- If CI failed → fix issues
- If awaiting review → remind user

### 2. Check Current Git State

```bash
# Current status
git status --short

# Recent commits for context
git log --oneline -5

# Current branch
git branch --show-current
```

### 3. Check Working Directory

**CRITICAL:** Check for in-progress work:

```bash
ls -la ".claude/working directory/"
```

See [WORKING_DIRECTORY.md](../WORKING_DIRECTORY.md) for template and usage.

**If files found:**
- Read each file to understand what was in progress
- Show user the incomplete implementation
- Ask: continue this work or start fresh?
- If work is done but file remains, remind user to delete it

### 4. Check for Uncommitted Work

If uncommitted changes exist:
- Ask user if they want to commit them first
- Or continue working on them

### 5. Review Key Documentation

Read these docs to understand current project state and constraints:

- **[CLAUDE.md](../../CLAUDE.md)** - Primary project guidelines (structure, deployment, database, AI)
- **[TECH_DEBT.md](../../TECH_DEBT.md)** - Known limitations and planned migrations
- **[NAMING.md](../../NAMING.md)** - Naming conventions for files, functions, APIs
- **[frontend/CLAUDE.md](../../frontend/CLAUDE.md)** - Frontend-specific UI guidelines
- **[backend/SECURITY.md](../../backend/SECURITY.md)** - Security patterns and requirements

### 6. Verify Environment Health

```bash
# TypeScript compiles (both projects)
cd frontend && npx tsc --noEmit --skipLibCheck
cd backend && npx tsc --noEmit --skipLibCheck
```

If compilation fails, note blockers for user.

---

## Output Format

```markdown
## Session Context

### In-Progress Work (Working Directory)
- [List files in .claude/working directory/ with summary]
- [Or "None - no incomplete implementations"]

### Pending Work (GitHub)
- [List open PRs with status]
- [Or "None"]

### Current State
- **Branch:** [branch name]
- **Uncommitted changes:** [yes/no, summary if yes]
- **Recent commits:** [last 3 commits]

### Environment Health
- **Frontend TypeScript:** ✅/❌
- **Backend TypeScript:** ✅/❌

### Blockers
- [Any issues that need resolution]
- [Or "None - ready to work"]

### Recommended Next Step
[Suggest: continue feature, fix blocker, start new work, etc.]
```

---

## When to Run

- Start of every development session
- After switching branches
- When resuming work after a break

---

## Target

$ARGUMENTS
