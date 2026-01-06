/**
 * Time-to-Mood Mapping Configuration
 * Maps time periods to product attributes for contextual suggestions
 */

export interface TimeMoodConfig {
  period: string;
  title: string;
  subtitle: string;
  vibeLayer: string[];
  tags: string[];
  tones: string[];
  pairsWithCategories: string[];
}

export const TIME_MOOD_MAP: Record<string, TimeMoodConfig> = {
  'Early Morning': {
    period: 'Early Morning',
    title: 'Early Morning Edit',
    subtitle: 'Start your day right',
    vibeLayer: ['workout-active', 'cozy-morning', 'casual-comfort'],
    tags: ['workout', 'casual', 'comfortable', 'athleisure', 'loungewear', 'activewear', 'relaxed'],
    tones: ['warm', 'neutral', 'calm', 'soft'],
    pairsWithCategories: ['comfortable-basics', 'wellness', 'activewear', 'sneakers'],
  },
  'Morning': {
    period: 'Morning',
    title: 'Morning Inspiration',
    subtitle: 'Ready for the day ahead',
    vibeLayer: ['power-dressing', 'smart-casual', 'professional'],
    tags: ['work', 'professional', 'smart-casual', 'polished', 'office', 'tailored', 'structured'],
    tones: ['cool', 'neutral', 'sophisticated', 'refined'],
    pairsWithCategories: ['structured-bags', 'minimal-jewelry', 'tailored-pieces', 'elegant-footwear'],
  },
  'Midday': {
    period: 'Midday',
    title: 'Midday Picks',
    subtitle: 'Versatile for any occasion',
    vibeLayer: ['smart-casual', 'weekend-retreat', 'day-to-night'],
    tags: ['lunch', 'casual', 'versatile', 'relaxed', 'effortless', 'transitional'],
    tones: ['warm', 'neutral', 'balanced'],
    pairsWithCategories: ['statement-accessories', 'classic-handbags', 'versatile-shoes'],
  },
  'Afternoon': {
    period: 'Afternoon',
    title: 'Afternoon Selection',
    subtitle: 'Focus and finesse',
    vibeLayer: ['smart-casual', 'power-dressing', 'focused'],
    tags: ['work', 'study', 'professional', 'focused', 'productive', 'smart'],
    tones: ['neutral', 'sophisticated', 'calm'],
    pairsWithCategories: ['structured-bags', 'elegant-footwear', 'refined-accessories'],
  },
  'Evening': {
    period: 'Evening',
    title: 'For Your Evening',
    subtitle: 'Elegance awaits',
    vibeLayer: ['evening-sophistication', 'garden-party', 'dinner-date', 'special-occasion'],
    tags: ['dinner', 'elegant', 'evening', 'date', 'formal', 'sophisticated', 'romantic', 'dressy'],
    tones: ['luxurious refinement', 'warm', 'rich', 'dramatic', 'elegant'],
    pairsWithCategories: ['statement-jewelry', 'evening-bags', 'elegant-footwear', 'clutches'],
  },
  'Night': {
    period: 'Night',
    title: 'Night Edit',
    subtitle: 'Unwind in style',
    vibeLayer: ['cozy-evening', 'weekend-retreat', 'relaxed-luxury'],
    tags: ['lounge', 'comfortable', 'cozy', 'home', 'relaxed', 'soft', 'evening'],
    tones: ['warm', 'calm', 'soft', 'cozy'],
    pairsWithCategories: ['ambient-candles', 'soft-textiles', 'comfortable-basics', 'loungewear'],
  },
  'Late Night': {
    period: 'Late Night',
    title: 'Late Night Comfort',
    subtitle: 'Rest and recharge',
    vibeLayer: ['cozy-evening', 'home-comfort'],
    tags: ['home', 'rest', 'lounge', 'sleepwear', 'comfortable', 'soft'],
    tones: ['calm', 'soft', 'cozy', 'gentle'],
    pairsWithCategories: ['soft-textiles', 'wellness', 'comfortable-basics'],
  },
};

/**
 * Get mood configuration for a given time period
 */
export function getMoodConfig(period: string): TimeMoodConfig {
  return TIME_MOOD_MAP[period] || TIME_MOOD_MAP['Morning'];
}

/**
 * Check if a product matches the current mood configuration
 */
export function productMatchesMood(
  product: { tags?: string[]; tone?: string; vibe_layer?: string },
  config: TimeMoodConfig
): number {
  let score = 0;

  // Check tags match
  if (product.tags) {
    const matchingTags = product.tags.filter(tag =>
      config.tags.some(configTag =>
        tag.toLowerCase().includes(configTag.toLowerCase()) ||
        configTag.toLowerCase().includes(tag.toLowerCase())
      )
    );
    score += matchingTags.length * 2;
  }

  // Check tone match
  if (product.tone) {
    const toneMatches = config.tones.some(t =>
      product.tone!.toLowerCase().includes(t.toLowerCase())
    );
    if (toneMatches) score += 3;
  }

  // Check vibe_layer match
  if (product.vibe_layer) {
    const vibeMatches = config.vibeLayer.some(v =>
      product.vibe_layer!.toLowerCase().includes(v.toLowerCase()) ||
      v.toLowerCase().includes(product.vibe_layer!.toLowerCase())
    );
    if (vibeMatches) score += 5;
  }

  return score;
}
