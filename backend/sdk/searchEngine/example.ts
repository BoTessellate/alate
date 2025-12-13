/**
 * Search Engine SDK - Usage Examples
 * Demonstrates tag-based and prompt-based product search
 */

import * as dotenv from 'dotenv';
import { createTagSearchEngine } from './searchByTag';
import { createPromptSearchEngine } from './searchByPrompt';

// Load environment variables
dotenv.config();

async function runSearchExamples() {
  console.log('🔍 Search Engine SDK - Usage Examples\n');
  console.log('='.repeat(60));

  // Initialize engines
  const tagSearchEngine = createTagSearchEngine(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_KEY!
  );

  const promptSearchEngine = createPromptSearchEngine(
    process.env.ANTHROPIC_API_KEY!,
    tagSearchEngine
  );

  // EXAMPLE 1: Tag-based search
  console.log('\n📌 EXAMPLE 1: Tag-Based Search');
  console.log('-'.repeat(60));

  const tagResult = await tagSearchEngine.searchByTag({
    category: 'home',
    tags: ['boho', 'coastal'],
    region: 'India',
    limit: 5
  });

  console.log(`Found ${tagResult.count} products`);
  tagResult.results.forEach((product, i) => {
    console.log(`\n${i + 1}. ${product.product_name}`);
    console.log(`   Brand: ${product.brand}`);
    console.log(`   Tags: ${product.tags?.join(', ')}`);
    console.log(`   Region: ${product.region}`);
  });

  // EXAMPLE 2: Search by single tag
  console.log('\n\n📌 EXAMPLE 2: Search by Single Tag');
  console.log('-'.repeat(60));

  const singleTagResult = await tagSearchEngine.searchByOneTag('handwoven', 5);
  console.log(`Found ${singleTagResult.count} handwoven products`);

  // EXAMPLE 3: Prompt-based search
  console.log('\n\n📌 EXAMPLE 3: Prompt-Based Search (Natural Language)');
  console.log('-'.repeat(60));

  const promptQuery = 'Summer picnic edit for home accessories, pastel tones';
  console.log(`Query: "${promptQuery}"\n`);

  const promptResult = await promptSearchEngine.searchByPrompt({
    prompt: promptQuery,
    limit: 5
  });

  console.log('Claude parsed this as:');
  console.log(`  Category: ${promptResult.parsedParams?.category}`);
  console.log(`  Tags: ${promptResult.parsedParams?.tags.join(', ')}`);
  console.log(`  Region: ${promptResult.parsedParams?.region || 'any'}`);
  console.log(`  Reasoning: ${promptResult.parsedParams?.reasoning}\n`);

  console.log(`Found ${promptResult.count} matching products`);
  promptResult.results.slice(0, 3).forEach((product, i) => {
    console.log(`\n${i + 1}. ${product.product_name}`);
    console.log(`   Tags: ${product.tags?.join(', ')}`);
    console.log(`   Tone: ${product.tone}`);
  });

  // EXAMPLE 4: Traditional Indian wedding query
  console.log('\n\n📌 EXAMPLE 4: Cultural Context Search');
  console.log('-'.repeat(60));

  const culturalQuery = 'Traditional Indian wedding saree';
  console.log(`Query: "${culturalQuery}"\n`);

  const culturalResult = await promptSearchEngine.searchByPrompt({
    prompt: culturalQuery,
    limit: 3
  });

  console.log('Parsed as:');
  console.log(`  Category: ${culturalResult.parsedParams?.category}`);
  console.log(`  Tags: ${culturalResult.parsedParams?.tags.join(', ')}`);
  console.log(`  Region: ${culturalResult.parsedParams?.region}\n`);

  console.log(`Found ${culturalResult.count} results`);

  // EXAMPLE 5: Advanced search with sorting
  console.log('\n\n📌 EXAMPLE 5: Advanced Search with Sorting');
  console.log('-'.repeat(60));

  const advancedResult = await tagSearchEngine.advancedSearch(
    { category: 'fashion', tags: ['traditional'] },
    'price',
    'desc'
  );

  console.log(`Found ${advancedResult.count} traditional fashion products (sorted by price desc)`);
  advancedResult.results.slice(0, 3).forEach((product, i) => {
    console.log(`\n${i + 1}. ${product.product_name} - ₹${product.price}`);
  });

  // EXAMPLE 6: Search with suggestions (no match scenario)
  console.log('\n\n📌 EXAMPLE 6: Search with AI Suggestions');
  console.log('-'.repeat(60));

  const noMatchQuery = 'Futuristic holographic quantum furniture';
  console.log(`Query: "${noMatchQuery}"\n`);

  const suggestionsResult = await promptSearchEngine.searchWithSuggestions({
    prompt: noMatchQuery,
    limit: 5
  });

  if (suggestionsResult.count === 0) {
    console.log('No direct matches found.');
    console.log('AI suggested alternative search:');
    console.log(suggestionsResult.parsedParams?.reasoning);
  } else {
    console.log(`Found ${suggestionsResult.count} suggested products`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✨ All examples completed successfully!\n');
}

// Run examples if executed directly
if (require.main === module) {
  runSearchExamples().catch(console.error);
}

export { runSearchExamples };
