#!/bin/sh

# Husky Installation Script
# Run this once to set up git hooks

echo "🔧 Setting up Husky git hooks..."

# Check if we're in a git repository
if [ ! -d .git ]; then
  echo "❌ Error: Not a git repository"
  echo "Run 'git init' first"
  exit 1
fi

# Install husky
npm install --save-dev husky

# Initialize husky
npx husky install

# Create pre-commit hook
npx husky add .husky/pre-commit "sh .husky/pre-commit"

# Make hooks executable
chmod +x .husky/pre-commit

echo "✅ Husky hooks installed successfully!"
echo ""
echo "Pre-commit hook will now run before each commit to check:"
echo "  - TypeScript errors"
echo "  - ESLint errors"
echo "  - 'any' type usage"
echo "  - console.log statements"
echo "  - TODO comment format"
echo ""
echo "To bypass checks (not recommended): git commit --no-verify"
# Test change
