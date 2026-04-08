---
description: Audit code implementation for functionality, UI/UX, and code quality
allowed-tools: Read, Glob, Grep, Bash(npm run build:*), Bash(npm run lint:*), Bash(git diff:*), Bash(git status:*)
---

# Code Audit

Perform a comprehensive audit of recent changes or specified files, focusing on three key areas.

## Scope

If a path is provided in $ARGUMENTS, audit that specific file or directory.
Otherwise, audit the most recently modified files (check git status).

## Audit Dimensions

### 1. Functionality Review

- **Logic correctness**: Does the code do what it's supposed to?
- **Edge cases**: Are boundary conditions handled?
- **Error handling**: Are errors caught, logged, and user-friendly?
- **Data flow**: Is state managed correctly? Any race conditions?
- **API contracts**: Do inputs/outputs match expectations?
- **Security**: Any XSS, injection, or auth vulnerabilities?

### 2. UI/UX Review

- **User experience**: Is the interaction intuitive?
- **Visual consistency**: Does it match the design system?
- **Responsiveness**: Works on mobile, tablet, desktop?
- **Loading states**: Are there spinners/skeletons during async ops?
- **Error states**: Are errors displayed helpfully to users?
- **Accessibility**: Keyboard navigation, ARIA labels, color contrast?
- **Animations**: Smooth, purposeful, not distracting?

### 3. Code Quality Review

- **Readability**: Can another developer understand this quickly?
- **Naming**: Are variables, functions, components named clearly?
- **DRY principle**: Any duplicated code that should be abstracted?
- **Component structure**: Is it modular and reusable?
- **TypeScript**: Proper types, no `any` abuse?
- **Performance**: Unnecessary re-renders? Memory leaks? Large bundles?
- **Testing**: Are critical paths covered?

## Audit Process

1. Identify files to audit (from $ARGUMENTS or recent changes)
2. Read and analyze each file thoroughly
3. Run build/lint if applicable to catch compile errors
4. Document findings by severity

## Output Format

```markdown
# 🔍 Audit Report

## Files Audited
- [list of files]

## ✅ What's Working Well
- [positive findings]

## 🔴 Critical Issues (Must Fix)
| Issue | File:Line | Impact | Suggested Fix |
|-------|-----------|--------|---------------|

## 🟡 Warnings (Should Fix)
| Issue | File:Line | Impact | Suggested Fix |
|-------|-----------|--------|---------------|

## 💡 Suggestions (Nice to Have)
- [improvements that would enhance quality]

## 📊 Summary
- Functionality: [score/assessment]
- UI/UX: [score/assessment]
- Code Quality: [score/assessment]

## Recommended Actions
1. [prioritized action items]
```

## Guidelines

- Be specific with file paths and line numbers
- Provide actionable fixes, not just criticism
- Consider the context (is this MVP or production code?)
- Prioritize user-facing issues over code style
- If you find critical security issues, flag them prominently

## Target

$ARGUMENTS
