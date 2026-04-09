/**
 * Infers a human-readable product category from the product name/description
 * when the enrichment API returns something generic like "general" or "clothing".
 */

const CATEGORY_RULES: Array<{ keywords: string[]; label: string }> = [
  { keywords: ['dress', 'gown', 'frock'], label: 'Dress' },
  { keywords: ['jumpsuit', 'romper', 'playsuit', 'dungaree'], label: 'Jumpsuit' },
  { keywords: ['skirt', 'mini skirt', 'midi skirt', 'maxi skirt'], label: 'Skirt' },
  { keywords: ['shorts', 'short pant'], label: 'Shorts' },
  { keywords: ['jean', 'denim', 'trouser', 'pant', 'chino', 'jogger', 'legging'], label: 'Trousers' },
  { keywords: ['blazer', 'suit jacket', 'suit'], label: 'Blazer / Suit' },
  { keywords: ['coat', 'trench', 'parka', 'anorak', 'puffer'], label: 'Coat' },
  { keywords: ['jacket', 'windbreaker', 'bomber'], label: 'Jacket' },
  { keywords: ['hoodie', 'sweatshirt', 'sweater', 'jumper', 'pullover', 'knitwear', 'knit'], label: 'Knitwear' },
  { keywords: ['cardigan'], label: 'Cardigan' },
  { keywords: ['blouse', 'shirt', 'tee', 't-shirt', 'top', 'cami', 'camisole', 'crop'], label: 'Top' },
  { keywords: ['bikini', 'swimsuit', 'swimwear', 'bathing suit', 'one-piece'], label: 'Swimwear' },
  { keywords: ['lingerie', 'bra', 'underwear', 'knicker', 'brief'], label: 'Lingerie' },
  { keywords: ['sneaker', 'trainer', 'shoe', 'boot', 'heel', 'sandal', 'mule', 'loafer'], label: 'Footwear' },
  { keywords: ['bag', 'tote', 'purse', 'clutch', 'backpack', 'handbag', 'crossbody'], label: 'Bags' },
  { keywords: ['scarf', 'hat', 'cap', 'beanie', 'belt', 'glove', 'sock'], label: 'Accessories' },
];

const GENERIC = new Set(['general', 'clothing', 'other', 'unknown', '']);

export function inferCategory(
  existingCategory: string | undefined,
  productName: string | undefined,
  description?: string,
): string | undefined {
  // If we already have a good category, use it
  if (existingCategory && !GENERIC.has(existingCategory.toLowerCase().trim())) {
    return existingCategory;
  }

  const source = `${productName ?? ''} ${description ?? ''}`.toLowerCase();
  if (!source.trim()) return undefined;

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => source.includes(kw))) {
      return rule.label;
    }
  }

  return undefined; // genuinely unknown — don't show anything
}
