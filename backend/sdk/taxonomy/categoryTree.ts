/**
 * Category Tree Module
 * Provides tag family lookups backed by tagGlossary.json
 */

import * as fs from 'fs';
import * as path from 'path';

export type TopCategory = string;
export type TagFamily = string;

interface GlossaryEntry {
  definition: string;
  synonyms: string[];
}

interface Glossary {
  tags: Record<string, Record<string, GlossaryEntry>>;
  global_aliases: Record<string, string>;
}

const glossaryPath = path.resolve(__dirname, '../../taxonomy/tagGlossary.json');
const glossary: Glossary = JSON.parse(fs.readFileSync(glossaryPath, 'utf-8'));

export const TAG_FAMILIES: Record<string, string[]> = {};
for (const [family, tags] of Object.entries(glossary.tags)) {
  TAG_FAMILIES[family] = Object.keys(tags);
}

export function getTagFamily(tag: string): TagFamily | null {
  const normalized = tag.toLowerCase().trim();
  for (const [family, tags] of Object.entries(TAG_FAMILIES)) {
    if (tags.includes(normalized)) {
      return family;
    }
  }
  return null;
}

export function groupTagsByFamily(tags: string[]): Record<TagFamily, string[]> {
  const result: Record<string, string[]> = {};
  for (const family of Object.keys(TAG_FAMILIES)) {
    result[family] = [];
  }
  for (const tag of tags) {
    const family = getTagFamily(tag);
    if (family) {
      result[family].push(tag);
    }
  }
  return result;
}
