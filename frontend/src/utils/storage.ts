import { ImageBrandData } from '../types';

const STORAGE_KEY = 'moodboard_brand_data';

export function saveBrandData(data: ImageBrandData[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // Error handling
  }
}

export function loadBrandData(): ImageBrandData[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
}

export function exportBrandData(): string {
  const data = loadBrandData();
  return JSON.stringify(data, null, 2);
}

export function getTaggedImageCount(): number {
  return loadBrandData().length;
}

export const FREE_TIER_LIMIT = 10;

export function canAddMoreTags(): boolean {
  return getTaggedImageCount() < FREE_TIER_LIMIT;
}
