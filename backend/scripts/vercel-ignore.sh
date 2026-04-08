#!/bin/bash

# Vercel Ignored Build Step
# Returns exit 0 to SKIP build, exit 1 to PROCEED with build
# https://vercel.com/docs/projects/overview#ignored-build-step

echo "Checking if build should be skipped..."

# Always build for production (main/master)
if [[ "$VERCEL_GIT_COMMIT_REF" == "main" || "$VERCEL_GIT_COMMIT_REF" == "master" ]]; then
  # Check commit message for skip indicators
  COMMIT_MSG=$(git log -1 --pretty=%B)

  # Skip builds for docs-only or CI-only commits
  if echo "$COMMIT_MSG" | grep -qiE "^docs(\(.*\))?:"; then
    echo "Skipping: docs-only commit"
    exit 0
  fi

  if echo "$COMMIT_MSG" | grep -qiE "^ci(\(.*\))?:"; then
    echo "Skipping: CI-only commit"
    exit 0
  fi

  # Check if only non-deployable files changed
  CHANGED_FILES=$(git diff --name-only HEAD~1 2>/dev/null || echo "")

  # If only these patterns changed, skip build
  SKIP_PATTERNS="\.md$|\.github/|^docs/|^\.vscode/|^scripts/|CLAUDE|README|LICENSE|\.gitignore"

  # Check if ALL changed files match skip patterns
  NON_SKIP_FILES=$(echo "$CHANGED_FILES" | grep -vE "$SKIP_PATTERNS" | grep "^backend/" || true)

  if [ -z "$NON_SKIP_FILES" ]; then
    echo "Skipping: No deployable backend files changed"
    echo "Changed files:"
    echo "$CHANGED_FILES"
    exit 0
  fi

  echo "Proceeding with build. Changed backend files:"
  echo "$NON_SKIP_FILES"
  exit 1
fi

# For feature branches, always build (for preview deployments)
echo "Proceeding: Feature branch build"
exit 1
