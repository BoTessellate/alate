---
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*)
description: Commit all changes and push to remote repository
---

## Context

- Current git status: !`git status --short`
- Recent commits for style reference: !`git log --oneline -3`
- Current branch: !`git branch --show-current`

## Your task

1. Run `git status` to see all untracked and modified files
2. Run `git diff` to see the changes that will be committed
3. Stage all relevant changes with `git add`
4. Create a well-formatted commit with:
   - Conventional commit format (feat/fix/chore/docs/refactor)
   - Clear description of changes
   - Footer with Claude Code attribution
5. Push to the remote repository

Follow the standard git commit guidelines from the system prompt. Use HEREDOC format for multi-line commit messages.
