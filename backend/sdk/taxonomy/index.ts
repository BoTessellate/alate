/**
 * Taxonomy Module
 * Tag matching and normalization backed by tagGlossary.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { TAG_FAMILIES, getTagFamily } from './categoryTree';

export interface TagMatchResult {
  isValid: boolean;
  canonical: string;
  confidence: number;
}

export interface NormalizationResult {
  canonical_tags: string[];
  unmatched_tags: string[];
  category: string | null;
  subcategory: string | null;
}

interface GlossaryEntry {
  definition: string;
  synonyms: string[];
}

interface Glossary {
  tags: Record<string, Record<string, GlossaryEntry>>;
  global_aliases: Record<string, string>;
}

let glossaryCache: Glossary | null = null;

function loadGlossary(): Glossary {
  if (!glossaryCache) {
    const glossaryPath = path.resolve(__dirname, '../../taxonomy/tagGlossary.json');
    glossaryCache = JSON.parse(fs.readFileSync(glossaryPath, 'utf-8'));
  }
  return glossaryCache!;
}

function getAllCanonicalTags(): Set<string> {
  const tags = new Set<string>();
  const glossary = loadGlossary();
  for (const familyTags of Object.values(glossary.tags)) {
    for (const tag of Object.keys(familyTags)) {
      tags.add(tag);
    }
  }
  return tags;
}

function resolveAlias(input: string): string {
  const glossary = loadGlossary();
  const normalized = input.toLowerCase().trim();

  if (glossary.global_aliases[normalized]) {
    return glossary.global_aliases[normalized];
  }

  for (const familyTags of Object.values(glossary.tags)) {
    for (const [canonicalTag, entry] of Object.entries(familyTags)) {
      if (entry.synonyms.some(s => s.toLowerCase() === normalized)) {
        return canonicalTag;
      }
    }
  }

  return normalized;
}

export function normalizeTag(tag: string): string {
  return resolveAlias(tag.toLowerCase().trim());
}

export function matchTag(tag: string, _category?: string): TagMatchResult {
  const resolved = resolveAlias(tag.toLowerCase().trim());
  const isValid = getAllCanonicalTags().has(resolved);

  return {
    isValid,
    canonical: resolved,
    confidence: isValid ? 1.0 : 0.0
  };
}

export function normalizeTags(tags: string[], category?: string): NormalizationResult {
  const canonicalTags: string[] = [];
  const unmatchedTags: string[] = [];
  const knownTags = getAllCanonicalTags();

  for (const tag of tags) {
    const resolved = resolveAlias(tag.toLowerCase().trim());
    if (knownTags.has(resolved)) {
      canonicalTags.push(resolved);
    } else {
      unmatchedTags.push(resolved);
    }
  }

  return {
    canonical_tags: canonicalTags,
    unmatched_tags: unmatchedTags,
    category: category || null,
    subcategory: null,
  };
}

export function validateCategory(category: string): string | null {
  return category.toLowerCase().trim() || null;
}

export function detectCategory(_tags: string[]): string | null {
  return null;
}

export function suggestTags(tag: string, _category?: string, max: number = 3): string[] {
  const knownTags = getAllCanonicalTags();
  const normalized = tag.toLowerCase().trim();
  const suggestions: string[] = [];

  for (const known of knownTags) {
    if (known.includes(normalized) || normalized.includes(known)) {
      suggestions.push(known);
      if (suggestions.length >= max) break;
    }
  }

  return suggestions;
}

export function getRelatedTags(tag: string): string[] {
  const family = getTagFamily(tag);
  if (!family || !TAG_FAMILIES[family]) return [];
  return TAG_FAMILIES[family].filter(t => t !== tag);
}
