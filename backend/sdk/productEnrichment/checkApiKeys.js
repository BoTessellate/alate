/**
 * Validate API Keys Configuration
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

console.log('🔑 Checking API Keys Configuration\n');
console.log('='.repeat(60));

// Check Anthropic API Key
if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
  console.log('\n❌ ANTHROPIC_API_KEY: NOT CONFIGURED');
  console.log('   Current value: ' + (process.env.ANTHROPIC_API_KEY || 'undefined'));
  console.log('\n📝 To configure:');
  console.log('   1. Get your API key from: https://console.anthropic.com/');
  console.log('   2. Update .env file: ANTHROPIC_API_KEY=sk-ant-...');
  console.log('   3. Restart the test');
} else {
  console.log('\n✅ ANTHROPIC_API_KEY: CONFIGURED');
  console.log('   Length: ' + process.env.ANTHROPIC_API_KEY.length + ' characters');
  console.log('   Starts with: ' + process.env.ANTHROPIC_API_KEY.substring(0, 10) + '...');
}

// Check Supabase URL
if (!process.env.SUPABASE_URL) {
  console.log('\n❌ SUPABASE_URL: NOT CONFIGURED');
} else {
  console.log('\n✅ SUPABASE_URL: CONFIGURED');
  console.log('   Value: ' + process.env.SUPABASE_URL);
}

// Check Supabase Key
if (!process.env.SUPABASE_KEY) {
  console.log('\n❌ SUPABASE_KEY: NOT CONFIGURED');
} else {
  console.log('\n✅ SUPABASE_KEY: CONFIGURED');
  console.log('   Length: ' + process.env.SUPABASE_KEY.length + ' characters');
}

console.log('\n' + '='.repeat(60));

// Summary
const allConfigured =
  process.env.ANTHROPIC_API_KEY &&
  process.env.ANTHROPIC_API_KEY !== 'your_anthropic_api_key_here' &&
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_KEY;

if (allConfigured) {
  console.log('\n🎉 All API keys configured! Ready to run tests.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Some API keys are missing. Please configure them before running tests.\n');
  process.exit(1);
}
