/**
 * Fit Guidance SDK
 * Predicts fit issues based on product attributes and user body measurements.
 *
 * Uses detailed per-body-part measurements (shoulders, bust, waist, hips, thighs, torso)
 * rather than a single "body type" label. When model height is available from the product
 * page, height-relative warnings become much more specific.
 */

export interface AvatarMeasurements {
  height_cm: number;
  shoulders: 'narrow' | 'average' | 'broad';
  bust: 'small' | 'medium' | 'large' | 'extra-large';
  waist: 'defined' | 'average' | 'undefined';
  /** Midsection projection at and below the natural waist. Distinct
   *  from `waist` (which is silhouette curve, not depth). Optional —
   *  legacy avatars persisted before April 29 2026 don't carry it. */
  tummy?: 'flat' | 'slight' | 'soft' | 'full';
  hips: 'narrow' | 'average' | 'wide' | 'extra-wide';
  thighs: 'slim' | 'average' | 'muscular' | 'full';
  torso_length: 'short' | 'average' | 'long';
}

export interface ProductData {
  id: string;
  product_name: string;
  category: string;
  material?: string;
  tags?: string[];
  model_height_cm?: number;
  description?: string;
}

export interface FitWarning {
  severity: 'minor' | 'moderate' | 'major';
  message: string;
}

export type SizeLabel = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface SizeRecommendation {
  size: SizeLabel;
  confidence: 'high' | 'medium' | 'low';
  note?: string;
}

export interface CalibrationData {
  bust_cm: number;
  waist_cm: number;
  hips_cm: number;
  shoulders_cm: number;
}

/** Map cm measurements to the same 1-4 scoring scale used by label lookups */
function cmToBustScore(cm: number): number {
  if (cm < 84) return 1;
  if (cm < 94) return 2;
  if (cm < 104) return 3;
  return 4;
}

function cmToHipScore(cm: number): number {
  if (cm < 88) return 1;
  if (cm < 98) return 2;
  if (cm < 108) return 3;
  return 4;
}

function cmToShoulderScore(cm: number): number {
  if (cm < 38) return 1;
  if (cm < 42) return 2;
  return 3;
}

/**
 * Recommends a standard clothing size based on avatar measurements.
 * Uses bust and hips as primary signals, shoulders as tiebreaker.
 * When calibration data (cm) is available, uses that instead of label-based guesses.
 */
export function recommendSize(
  avatar: AvatarMeasurements,
  calibration?: CalibrationData,
  garmentCount?: number,
): SizeRecommendation {
  let bustScore: number;
  let hipScore: number;
  let shoulderScore: number;

  if (calibration) {
    // Use real cm measurements from garment calibration
    bustScore = cmToBustScore(calibration.bust_cm);
    hipScore = cmToHipScore(calibration.hips_cm);
    shoulderScore = cmToShoulderScore(calibration.shoulders_cm);
  } else {
    // Fall back to label-based scoring
    bustScore = { 'small': 1, 'medium': 2, 'large': 3, 'extra-large': 4 }[avatar.bust] ?? 2;
    hipScore = { 'narrow': 1, 'average': 2, 'wide': 3, 'extra-wide': 4 }[avatar.hips] ?? 2;
    shoulderScore = { 'narrow': 1, 'average': 2, 'broad': 3 }[avatar.shoulders] ?? 2;
  }

  // Use weighted average: bust and hips are equal primary signals, shoulders as secondary
  // This avoids one extreme measurement (e.g. extra-wide hips + small bust) over-sizing
  const primaryAvg = (bustScore + hipScore) / 2;
  const avg = (primaryAvg * 2 + shoulderScore) / 3;

  let size: SizeLabel;
  if (avg <= 1.25) size = 'XS';
  else if (avg <= 1.75) size = 'S';
  else if (avg <= 2.5) size = 'M';
  else if (avg <= 3.25) size = 'L';
  else if (avg <= 3.75) size = 'XL';
  else size = 'XXL';

  // Confidence: high if bust and hip agree, low if they diverge significantly
  const divergence = Math.abs(bustScore - hipScore);
  let confidence: 'high' | 'medium' | 'low' = divergence >= 2 ? 'low' : divergence === 1 ? 'medium' : 'high';

  // Boost confidence when calibrated with 3+ garments
  if (calibration && garmentCount && garmentCount >= 3) {
    confidence = 'high';
  }

  // Add a note if bust and hips suggest different sizes (common fit issue)
  let note: string | undefined;
  if (divergence >= 2) {
    if (bustScore > hipScore) {
      note = 'Your bust is proportionally fuller than your hips — you may need to size up for tops and size down for bottoms';
    } else {
      note = 'Your hips are proportionally fuller than your bust — you may need to size up for bottoms and size down for tops';
    }
  }

  if (calibration) {
    const source = garmentCount ? `Based on ${garmentCount} garment${garmentCount > 1 ? 's' : ''} you added` : 'Based on your calibration data';
    note = note ? `${note}. ${source}` : source;
  }

  return { size, confidence, note };
}

// Helper: check if any tag matches a keyword
function hasTag(tags: string[], ...keywords: string[]): boolean {
  return tags.some(tag => {
    const t = tag.toLowerCase();
    return keywords.some(k => t.includes(k));
  });
}

// Keyword maps for category inference from product name
const CATEGORY_KEYWORDS: { category: string; keywords: string[] }[] = [
  { category: 'pants',    keywords: ['pant', 'trouser', 'jeans', 'denim', 'legging', 'chino', 'jogger', 'cargo', 'shorts', 'short'] },
  { category: 'dress',    keywords: ['dress', 'gown', 'sundress', 'midi', 'maxi'] },
  { category: 'skirt',    keywords: ['skirt'] },
  { category: 'top',      keywords: ['top', 'shirt', 'blouse', 'tee', 't-shirt', 'tank', 'cami', 'crop', 'bodysuit', 'sweater', 'sweatshirt', 'hoodie', 'cardigan', 'jacket', 'coat', 'blazer', 'vest', 'bra'] },
  { category: 'jumpsuit', keywords: ['jumpsuit', 'romper', 'playsuit', 'overall'] },
];

/**
 * Infers a usable category from the product name when enrichment returns "general".
 * Returns the original category unchanged if it's already specific.
 */
function resolveCategoryFromName(category: string, productName: string): string {
  const isGeneric = !category || category.toLowerCase() === 'general' || category.toLowerCase() === 'clothing';
  if (!isGeneric) return category;

  const name = productName.toLowerCase();
  for (const { category: cat, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some(k => name.includes(k))) return cat;
  }

  return category;
}

const MATERIAL_KEYWORDS: string[] = [
  'cotton', 'denim', 'linen', 'polyester', 'nylon', 'silk', 'wool', 'cashmere',
  'viscose', 'rayon', 'velvet', 'satin', 'chiffon', 'spandex', 'elastane', 'lycra',
  'modal', 'bamboo', 'jersey', 'crepe', 'leather', 'suede', 'canvas', 'tweed',
];

// Fit-relevant tag phrases to scan for in description text.
// Values match what hasTag() checks against product.tags.
const TAG_PHRASES: { tag: string; phrases: string[] }[] = [
  { tag: 'slim fit',       phrases: ['slim fit', 'slim-fit'] },
  { tag: 'fitted',         phrases: ['fitted', 'figure-hugging', 'form-fitting'] },
  { tag: 'bodycon',        phrases: ['bodycon', 'body-con'] },
  { tag: 'oversized',      phrases: ['oversized', 'over-sized'] },
  { tag: 'relaxed',        phrases: ['relaxed fit', 'relaxed-fit', 'relaxed'] },
  { tag: 'loose',          phrases: ['loose fit', 'loose-fit'] },
  { tag: 'boxy',           phrases: ['boxy'] },
  { tag: 'wide-leg',       phrases: ['wide leg', 'wide-leg', 'palazzo'] },
  { tag: 'skinny',         phrases: ['skinny', 'slim-leg'] },
  { tag: 'straight',       phrases: ['straight leg', 'straight-leg'] },
  { tag: 'tapered',        phrases: ['tapered'] },
  { tag: 'cropped',        phrases: ['cropped', 'crop top', 'crop length'] },
  { tag: 'mini',           phrases: ['mini'] },
  { tag: 'midi',           phrases: ['midi'] },
  { tag: 'maxi',           phrases: ['maxi', 'floor-length', 'floor length'] },
  { tag: 'high-waisted',   phrases: ['high waist', 'high-waist', 'high rise', 'high-rise'] },
  { tag: 'low-rise',       phrases: ['low rise', 'low-rise'] },
  { tag: 'a-line',         phrases: ['a-line', 'a line'] },
  { tag: 'flared',         phrases: ['flared', 'flare'] },
  { tag: 'pencil',         phrases: ['pencil'] },
  { tag: 'belted',         phrases: ['belted', 'cinched', 'tie waist', 'tie-waist'] },
  { tag: 'wrap',           phrases: ['wrap'] },
  { tag: 'v-neck',         phrases: ['v-neck', 'v neck', 'vneck'] },
  { tag: 'off-shoulder',   phrases: ['off-shoulder', 'off shoulder'] },
  { tag: 'strapless',      phrases: ['strapless', 'bandeau'] },
  { tag: 'button-front',   phrases: ['button-front', 'button front', 'button-down', 'button-up'] },
  { tag: 'elastic',        phrases: ['elastic waist', 'elasticated waist', 'drawstring'] },
  { tag: 'stretch',        phrases: ['stretch', 'stretchy'] },
  { tag: 'ankle',          phrases: ['ankle length', 'ankle-length', 'ankle crop'] },
  { tag: 'drop-shoulder',  phrases: ['drop shoulder', 'drop-shoulder'] },
];

/**
 * Extracts the dominant material from free-form description text.
 * Returns the first recognised material keyword found, or undefined.
 */
function resolveMaterialFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  return MATERIAL_KEYWORDS.find(m => lower.includes(m));
}

/**
 * Extracts fit-relevant tags from free-form description text.
 * Only returns tags not already present in the existing tags array.
 */
function resolveTagsFromText(text: string, existingTags: string[]): string[] {
  const lower = text.toLowerCase();
  const existing = new Set(existingTags.map(t => t.toLowerCase()));
  const found: string[] = [];

  for (const { tag, phrases } of TAG_PHRASES) {
    if (!existing.has(tag) && phrases.some(p => lower.includes(p))) {
      found.push(tag);
    }
  }

  return found;
}

/**
 * Predicts potential fit issues based on product and avatar data
 */
export function predictFit(product: ProductData, avatar: AvatarMeasurements): FitWarning[] {
  const warnings: FitWarning[] = [];
  const description = product.description || '';

  // Resolve category from name, then description as fallback
  const category = resolveCategoryFromName(
    resolveCategoryFromName(product.category || '', product.product_name),
    description
  ).toLowerCase();

  // Use enriched material if available, else infer from description
  const material = (product.material || resolveMaterialFromText(description) || '').toLowerCase();

  // Merge enriched tags with any extras inferred from description
  const baseTags = product.tags || [];
  const tags = [...baseTags, ...resolveTagsFromText(description, baseTags)];
  const modelHeight = product.model_height_cm;

  const isStretch = hasTag(tags, 'stretch', 'elastic', 'spandex', 'elastane', 'lycra')
    || material.includes('stretch') || material.includes('spandex') || material.includes('elastane');
  const isCotton = material.includes('cotton') || material.includes('denim') || material.includes('linen');
  const isDress = category.includes('dress');
  const isSkirt = category.includes('skirt');
  const isPants = category.includes('pants') || category.includes('trouser') || category.includes('jeans');
  const isTop = category.includes('top') || category.includes('shirt') || category.includes('blouse');
  const isFitted = hasTag(tags, 'slim', 'fitted', 'bodycon', 'tight', 'figure-hugging');
  const isOversized = hasTag(tags, 'oversized', 'loose', 'relaxed', 'boxy');
  const isMini = hasTag(tags, 'mini') || product.product_name.toLowerCase().includes('mini');
  const isCropped = hasTag(tags, 'cropped', 'crop');
  const isMaxi = hasTag(tags, 'maxi', 'long', 'floor-length');

  // =========================================================================
  // HEIGHT + MODEL HEIGHT RULES
  // =========================================================================

  // If model height is known, give specific height-relative warnings
  if (modelHeight && avatar.height_cm > modelHeight + 5) {
    const diff = avatar.height_cm - modelHeight;
    const diffInches = Math.round(diff / 2.54);

    if (isDress || isSkirt) {
      warnings.push({
        severity: isMini ? 'major' : 'moderate',
        message: `Model is ${Math.round(modelHeight / 2.54 * 10) / 10}" — you're ~${diffInches}" taller, so the hemline will sit higher on you`,
      });
    }

    if (isPants && !hasTag(tags, 'ankle', 'cropped')) {
      warnings.push({
        severity: 'minor',
        message: `Model is ${Math.round(modelHeight / 2.54 * 10) / 10}" — pants may run short on you by ~${Math.round(diff * 0.4)}cm`,
      });
    }
  }

  // Generic tall + dress/mini (no model height available)
  if (!modelHeight && avatar.height_cm > 175) {
    if ((isDress || isSkirt) && isMini) {
      warnings.push({
        severity: 'major',
        message: 'Mini styles tend to run very short on taller frames',
      });
    } else if ((isDress || isSkirt) && !isMaxi) {
      warnings.push({
        severity: 'moderate',
        message: 'May be shorter on you than shown — consider sizing up for length',
      });
    }
    if (isCropped) {
      warnings.push({
        severity: 'moderate',
        message: 'Cropped style may sit very high on your frame',
      });
    }
  }

  // Short + pants hemming
  if (avatar.height_cm < 160 && isPants) {
    warnings.push({
      severity: 'minor',
      message: 'May require hemming for a clean break',
    });
  }

  // Short + maxi dress pooling
  if (avatar.height_cm < 160 && (isDress || isSkirt) && isMaxi) {
    warnings.push({
      severity: 'minor',
      message: 'Maxi length may pool at the floor — consider petite sizing if available',
    });
  }

  // =========================================================================
  // SHOULDER RULES
  // =========================================================================

  if (avatar.shoulders === 'broad') {
    if (isFitted && isTop) {
      warnings.push({
        severity: 'moderate',
        message: 'Fitted cut may be snug across the shoulders — consider sizing up',
      });
    }
    if (hasTag(tags, 'raglan', 'drop-shoulder')) {
      warnings.push({
        severity: 'minor',
        message: 'Drop-shoulder styles tend to work well for broader shoulders',
      });
    }
  }

  if (avatar.shoulders === 'narrow') {
    if (isOversized && isTop) {
      warnings.push({
        severity: 'minor',
        message: 'Oversized fit may slip off narrow shoulders',
      });
    }
    if (hasTag(tags, 'off-shoulder', 'one-shoulder', 'strapless')) {
      warnings.push({
        severity: 'moderate',
        message: 'Strapless/off-shoulder styles may need adjusting for narrow shoulders',
      });
    }
  }

  // =========================================================================
  // BUST RULES
  // =========================================================================

  if (avatar.bust === 'large' || avatar.bust === 'extra-large') {
    if (isFitted && !isStretch) {
      warnings.push({
        severity: 'moderate',
        message: 'Fitted non-stretch fabric may feel tight across the bust',
      });
    }
    if (hasTag(tags, 'button-up', 'button-down', 'button front')) {
      warnings.push({
        severity: 'moderate',
        message: 'Button-front styles may gap across a fuller bust',
      });
    }
    if (hasTag(tags, 'wrap', 'v-neck', 'surplice')) {
      warnings.push({
        severity: 'minor',
        message: 'Wrap/V-neck styles generally flatter a fuller bust — good choice',
      });
    }
  }

  if (avatar.bust === 'small') {
    if (hasTag(tags, 'bandeau', 'strapless') && isDress) {
      warnings.push({
        severity: 'minor',
        message: 'Strapless styles may need adhesive support with a smaller bust',
      });
    }
  }

  // =========================================================================
  // WAIST RULES
  // =========================================================================

  if (avatar.waist === 'undefined') {
    if (hasTag(tags, 'belted', 'cinched', 'waist-defining')) {
      warnings.push({
        severity: 'minor',
        message: 'Belted/cinched styles can create waist definition — may work well',
      });
    }
    if (isFitted && (isDress || isSkirt) && !isStretch) {
      warnings.push({
        severity: 'minor',
        message: 'Fitted waist in non-stretch fabric may not drape smoothly',
      });
    }
  }

  if (avatar.waist === 'defined') {
    if (isOversized && (isDress || isTop)) {
      warnings.push({
        severity: 'minor',
        message: 'Boxy/oversized fit will hide waist definition — add a belt to cinch if desired',
      });
    }
  }

  // =========================================================================
  // TUMMY RULES
  //
  // The tummy field captures abdominal projection at and below the
  // natural waist. Non-stretch waistband-fitted garments (high-rise
  // trousers, pencil skirts, fitted A-line dresses, bodycon) sit on
  // top of the abdomen, so a "soft" or "full" tummy with no fabric
  // give means the waistband digs in or the placket gaps. We keep
  // the warning out of the way for stretch fabrics and oversized
  // cuts where the garment accommodates volume on its own.
  // =========================================================================

  const isHighRise = hasTag(tags, 'high-waisted', 'high-rise', 'high waist');
  const isPencilSkirt = isSkirt && hasTag(tags, 'pencil');
  const isBodycon = hasTag(tags, 'bodycon', 'body-con');

  if ((avatar.tummy === 'soft' || avatar.tummy === 'full') && !isStretch && !isOversized) {
    const sev: 'minor' | 'moderate' = avatar.tummy === 'full' ? 'moderate' : 'minor';

    if (isPants && (isFitted || isHighRise)) {
      warnings.push({
        severity: sev,
        message: 'Non-stretch fitted waistband may feel snug across the tummy — consider sizing up at the waist',
      });
    }
    if (isPencilSkirt) {
      warnings.push({
        severity: sev,
        message: 'Pencil skirts in non-stretch fabric tend to pull at the tummy — sizing up at the waist helps',
      });
    }
    if (isBodycon && (isDress || isTop)) {
      warnings.push({
        severity: sev,
        message: 'Bodycon styles in non-stretch fabric will trace the midsection closely',
      });
    }
    if (isFitted && isDress && !isStretch) {
      warnings.push({
        severity: sev,
        message: 'Fitted non-stretch dress may pull across the midsection — empire or A-line cuts tend to flatter',
      });
    }
  }

  // =========================================================================
  // HIP RULES
  // =========================================================================

  if (avatar.hips === 'wide' || avatar.hips === 'extra-wide') {
    if (isFitted && (isDress || isSkirt || isPants) && !isStretch) {
      warnings.push({
        severity: 'moderate',
        message: 'Non-stretch fitted cut may be tight across the hips — consider sizing up',
      });
    }
    if (hasTag(tags, 'pencil', 'bodycon') && (isDress || isSkirt)) {
      warnings.push({
        severity: 'moderate',
        message: 'Pencil/bodycon styles tend to be restrictive on wider hips',
      });
    }
    if (hasTag(tags, 'a-line', 'flared', 'skater')) {
      warnings.push({
        severity: 'minor',
        message: 'A-line/flared styles are great for wider hips — good choice',
      });
    }
  }

  if (avatar.hips === 'narrow') {
    if (hasTag(tags, 'a-line', 'flared', 'peplum')) {
      warnings.push({
        severity: 'minor',
        message: 'A-line/peplum styles add volume at the hip for a balanced silhouette',
      });
    }
  }

  // =========================================================================
  // THIGH RULES
  // =========================================================================

  if (avatar.thighs === 'muscular' || avatar.thighs === 'full') {
    if (hasTag(tags, 'skinny', 'slim-leg', 'slim fit') && isPants) {
      warnings.push({
        severity: 'moderate',
        message: 'Skinny/slim-leg cut may be tight on fuller thighs — try straight or tapered',
      });
    }
    if (isMini && (isDress || isSkirt)) {
      warnings.push({
        severity: 'minor',
        message: 'Mini length will sit at the widest part of the thigh',
      });
    }
  }

  if (avatar.thighs === 'slim') {
    if (hasTag(tags, 'wide-leg', 'palazzo', 'flare') && isPants) {
      warnings.push({
        severity: 'minor',
        message: 'Wide-leg styles may look voluminous on slimmer thighs — can be a statement look',
      });
    }
  }

  // =========================================================================
  // TORSO LENGTH RULES
  // =========================================================================

  if (avatar.torso_length === 'long') {
    if (isCropped && isTop) {
      warnings.push({
        severity: 'moderate',
        message: 'Cropped tops will show more midriff on a longer torso',
      });
    }
    if (hasTag(tags, 'high-waisted', 'high-rise', 'high waist') && isPants) {
      warnings.push({
        severity: 'minor',
        message: 'High-waisted styles balance a long torso well — good choice',
      });
    }
  }

  if (avatar.torso_length === 'short') {
    if (hasTag(tags, 'high-waisted', 'high-rise', 'high waist') && isPants) {
      warnings.push({
        severity: 'minor',
        message: 'High-rise may feel constricting on a shorter torso',
      });
    }
    if (hasTag(tags, 'tucked', 'tuck-in') || (isCropped && isTop)) {
      warnings.push({
        severity: 'minor',
        message: 'Cropped/tucked-in styles help elongate a shorter torso',
      });
    }
  }

  // =========================================================================
  // MATERIAL RULES (body-agnostic but still useful)
  // =========================================================================

  if (isCotton && !isStretch) {
    if ((avatar.bust === 'large' || avatar.bust === 'extra-large')
      || (avatar.hips === 'wide' || avatar.hips === 'extra-wide')) {
      warnings.push({
        severity: 'minor',
        message: 'Non-stretch natural fabric — may need a size up for comfort at the fullest point',
      });
    }
  }

  return warnings;
}

export default { predictFit };
