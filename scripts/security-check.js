#!/usr/bin/env node
/**
 * Pre-Commit Security Check
 *
 * Scans staged files for potential secrets before committing.
 * Run this before `git commit` to ensure no secrets are exposed.
 *
 * Usage:
 *   node scripts/security-check.js
 *   npm run security-check (if added to package.json)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Patterns that indicate potential secrets
const SECRET_PATTERNS = [
  // JWT tokens (Supabase keys start with eyJ)
  { pattern: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, name: 'JWT Token (likely Supabase key)' },

  // OpenAI API keys
  { pattern: /sk-[a-zA-Z0-9]{20,}/g, name: 'OpenAI API Key' },

  // Anthropic API keys
  { pattern: /sk-ant-[a-zA-Z0-9-]+/g, name: 'Anthropic API Key' },

  // Database passwords in connection strings
  { pattern: /postgresql:\/\/[^:]+:[^@]+@/g, name: 'Database Connection String with Password' },

  // Generic API keys
  { pattern: /api[_-]?key\s*[=:]\s*['"][a-zA-Z0-9_-]{20,}['"]/gi, name: 'API Key Assignment' },

  // Generic secrets
  { pattern: /secret\s*[=:]\s*['"][a-zA-Z0-9_\/+=]{20,}['"]/gi, name: 'Secret Assignment' },

  // Note: Removed UUID pattern - too many false positives with test data and auto-generated IDs

  // AWS keys
  { pattern: /AKIA[A-Z0-9]{16}/g, name: 'AWS Access Key' },

  // Private keys
  { pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, name: 'Private Key' },
];

// Files/directories to skip
const SKIP_PATTERNS = [
  /node_modules/,
  /\.git/,
  /\.env$/,
  /\.env\.local$/,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.md$/,  // Skip markdown files (documentation)
];

// Files that are expected to have patterns (false positives)
const ALLOWED_FILES = [
  'security-check.js',  // This file
  '.env.example',
  'SECURITY.md',
];

console.log('🔍 Security Check - Scanning for potential secrets...\n');

let foundIssues = [];
let scannedFiles = 0;

// Get list of files to check
function getFilesToCheck() {
  try {
    // Get staged files
    const staged = execSync('git diff --cached --name-only', { encoding: 'utf-8' })
      .split('\n')
      .filter(f => f.trim());

    // Get modified files
    const modified = execSync('git diff --name-only', { encoding: 'utf-8' })
      .split('\n')
      .filter(f => f.trim());

    // Get untracked files
    const untracked = execSync('git ls-files --others --exclude-standard', { encoding: 'utf-8' })
      .split('\n')
      .filter(f => f.trim());

    return [...new Set([...staged, ...modified, ...untracked])];
  } catch (e) {
    console.error('Error getting git files:', e.message);
    return [];
  }
}

function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
}

function isAllowedFile(filePath) {
  return ALLOWED_FILES.some(allowed => filePath.endsWith(allowed));
}

function scanFile(filePath) {
  if (shouldSkipFile(filePath) || isAllowedFile(filePath)) {
    return [];
  }

  const fullPath = path.resolve(filePath);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  const stat = fs.statSync(fullPath);
  if (stat.isDirectory() || stat.size > 1024 * 1024) { // Skip dirs and files > 1MB
    return [];
  }

  let content;
  try {
    content = fs.readFileSync(fullPath, 'utf-8');
  } catch (e) {
    return [];
  }

  scannedFiles++;
  const issues = [];

  SECRET_PATTERNS.forEach(({ pattern, name }) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Skip if it's clearly a placeholder or help text
        if (match.includes('your_') || match.includes('YOUR_') ||
            match.includes('xxx') || match.includes('XXX') ||
            match.includes('placeholder') || match.includes('example') ||
            match.includes('[PASSWORD]') || match.includes('[YOUR-PASSWORD]') ||
            match.includes('PASSWORD@') || match.includes(':PASSWORD@')) {
          return;
        }

        // Mask the secret for display
        const masked = match.length > 20
          ? match.substring(0, 10) + '...' + match.substring(match.length - 5)
          : match.substring(0, 5) + '...';

        issues.push({
          file: filePath,
          type: name,
          match: masked
        });
      });
    }
  });

  return issues;
}

// Run the scan
const files = getFilesToCheck();
console.log(`Found ${files.length} files to check...\n`);

files.forEach(file => {
  const issues = scanFile(file);
  foundIssues = foundIssues.concat(issues);
});

// Report results
console.log(`\n📊 Scanned ${scannedFiles} files\n`);

if (foundIssues.length === 0) {
  console.log('✅ No potential secrets found!\n');
  console.log('Safe to commit. Remember to:\n');
  console.log('  1. Double-check .env is in .gitignore');
  console.log('  2. Verify no sensitive URLs in documentation');
  console.log('  3. Review any new API-related code\n');
  process.exit(0);
} else {
  console.log('⚠️  POTENTIAL SECRETS FOUND:\n');

  foundIssues.forEach((issue, i) => {
    console.log(`  ${i + 1}. ${issue.file}`);
    console.log(`     Type: ${issue.type}`);
    console.log(`     Value: ${issue.match}`);
    console.log('');
  });

  console.log('❌ Please review these files before committing!\n');
  console.log('If these are false positives, add the file to ALLOWED_FILES in this script.\n');
  process.exit(1);
}
