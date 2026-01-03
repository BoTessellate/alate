---
description: Stage, commit and push changes to git with a well-crafted commit message
allowed-tools: Bash(git:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*)
---

# Git Commit and Push

## Current State

Examine the current git state:

1. Check git status to see all changes
2. Check staged changes (if any)
3. Check recent commit history for message style consistency

## Your Task

1. **Review all changes** - both staged and unstaged
2. **Stage relevant files** - use `git add` for files that should be included
3. **Create a descriptive commit message** following this format:

```
<type>(<scope>): <subject>

<body - what changed and why>

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

Types: feat, fix, docs, style, refactor, test, chore
Scope: component or area affected (e.g., chat, auth, api)

4. **Execute the commit** using a HEREDOC for proper formatting:
```bash
git commit -m "$(cat <<'EOF'
Your commit message here
EOF
)"
```

5. **Push to remote** - push to the current branch

## Guidelines

- Keep subject line under 50 characters
- Use present tense ("Add feature" not "Added feature")
- Explain WHAT changed and WHY in the body
- Group related changes logically
- Don't commit .env files or secrets
- If there are unrelated changes, ask user if they want to commit everything or select specific files

## Additional Context

$ARGUMENTS
