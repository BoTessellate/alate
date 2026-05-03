import { filterUserFacingTags } from '../utils/tagFilter';

describe('filterUserFacingTags', () => {
  it('strips empty inputs', () => {
    expect(filterUserFacingTags(undefined)).toEqual([]);
    expect(filterUserFacingTags(null)).toEqual([]);
    expect(filterUserFacingTags([])).toEqual([]);
    expect(filterUserFacingTags(['', '   '])).toEqual([]);
  });

  it('strips sale codes', () => {
    const input = ['april26-sale-10', 'april26sale', 'sale', 'BlackFriday-Sale', 'Linen'];
    expect(filterUserFacingTags(input)).toEqual(['Linen']);
  });

  it('strips marketing labels', () => {
    expect(filterUserFacingTags(['best seller', 'Most Loved', 'trending', 'staff pick', 'Slim Fit'])).toEqual(['Slim Fit']);
  });

  it('strips collection / drop slugs', () => {
    expect(filterUserFacingTags(['DROP XXIV-1', 'Drop 12', 'SS24', 'aw2026', 'collection 3', 'going out'])).toEqual(['going out']);
  });

  it('strips pricing labels', () => {
    expect(filterUserFacingTags(['Full Price', '20% off', 'Under $50', 'budget', 'Linen'])).toEqual(['Linen']);
  });

  it('strips sizes (they live in the size pill)', () => {
    expect(filterUserFacingTags(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'one size', 'UK 10', 'Linen'])).toEqual(['Linen']);
  });

  it('strips mix+match / sets merchandising', () => {
    expect(filterUserFacingTags(['mix+match', 'mix + match', 'Sets', 'Set', 'Linen'])).toEqual(['Linen']);
  });

  it('preserves user-facing garment tags', () => {
    expect(filterUserFacingTags(['Linen', 'Slim Fit', 'Black', 'going out', 'vacation ready', 'occasionwear'])).toEqual([
      'Linen',
      'Slim Fit',
      'Black',
      'going out',
      'vacation ready',
      'occasionwear',
    ]);
  });

  it('strips a tag that duplicates the category', () => {
    expect(filterUserFacingTags(['Top', 'Linen', 'Slim Fit'], 'Top')).toEqual(['Linen', 'Slim Fit']);
    // Category match is case-insensitive
    expect(filterUserFacingTags(['top', 'linen'], 'Top')).toEqual(['linen']);
  });

  it('strips a tag that duplicates the material', () => {
    // Cordstudio (May 3 2026 user report — `poem-dress-f22-pnd-rt`):
    // a "100% cotton" product surfaced "100% cotton" as a tag chip
    // even though it was already shown in the MATERIAL row. Same
    // shape as the category dedup — case + whitespace + hyphen +
    // underscore insensitive.
    //
    // Note: "days12-14" is also dropped from the same Cordstudio tag
    // list, but by the existing SKU-shape noise pattern (4 letters +
    // 2 digits + dash + 2 digits matches `^[a-z]{1,4}[-_]?\d{1,4}
    // (?:[-_]\d{1,3})?$`), not by this material dedup. Tests for the
    // SKU pattern itself live further down ("strips SKU / design-code
    // shaped tags").
    expect(
      filterUserFacingTags(
        ['100% cotton', 'cotton dress for summer', 'casual dress for summer'],
        undefined,
        '100% cotton',
      ),
    ).toEqual(['cotton dress for summer', 'casual dress for summer']);
    // Match is case + whitespace insensitive (matches dedup key shape)
    expect(
      filterUserFacingTags(['100%cotton', 'Linen'], undefined, '100% Cotton'),
    ).toEqual(['Linen']);
    expect(
      filterUserFacingTags(['Linen Blend', 'breezy'], undefined, 'linen blend'),
    ).toEqual(['breezy']);
  });

  it('strips both category AND material when both are passed', () => {
    expect(
      filterUserFacingTags(['Dress', '100% Cotton', 'breezy', 'easystyle'], 'dress', '100% cotton'),
    ).toEqual(['breezy', 'easystyle']);
  });

  it('end-to-end on the Cordstudio poem-dress tag list', () => {
    // Verifies the full Cordstudio user-report shape (May 3 2026):
    // raw tags ['days12-14', 'casual dress for summer', 'cotton
    // dress for summer', 'dress', '100% cotton'] with category="dress"
    // and material="100% cotton" should leave ONLY the descriptive
    // free-form chips.
    expect(
      filterUserFacingTags(
        ['days12-14', 'casual dress for summer', 'cotton dress for summer', 'dress', '100% cotton'],
        'dress',
        '100% cotton',
      ),
    ).toEqual(['casual dress for summer', 'cotton dress for summer']);
  });

  it('end-to-end on a real summeraway tag list', () => {
    const raw = [
      'april26-sale-10',
      'april26sale',
      'best seller',
      'Black',
      'DROP XXIV-1',
      'Full Price',
      'going out',
      'holiday edit',
      'L',
      'Linen',
      'linen tops',
      'M',
      'mix+match',
      'Most Loved',
      'occasionwear',
      'S',
      'Sets',
      'Slim Fit',
      'Top',
      'vacation ready',
      'XL',
      'XS',
    ];
    expect(filterUserFacingTags(raw, 'Top')).toEqual([
      'Black',
      'going out',
      'holiday edit',
      'Linen',
      'linen tops',
      'occasionwear',
      'Slim Fit',
      'vacation ready',
    ]);
  });

  it('preserves order of input tags', () => {
    expect(filterUserFacingTags(['Slim Fit', 'Linen', 'Black'])).toEqual(['Slim Fit', 'Linen', 'Black']);
  });

  it('strips brand-internal slug tags containing punctuation markers', () => {
    // yamayoga's storefront emits tags like "yama*santi women" — that's
    // their internal sub-collection slug, not user-facing copy. Tags
    // with "*" / "::" / "|" are reliable signals of internal taxonomy.
    expect(filterUserFacingTags(['yama*santi women', 'Linen'])).toEqual(['Linen']);
    expect(filterUserFacingTags(['collection::summer', 'Slim Fit'])).toEqual(['Slim Fit']);
    expect(filterUserFacingTags(['brand|core', 'Black'])).toEqual(['Black']);
  });

  it('replaces underscores with spaces in surviving snake_case tags', () => {
    // yamayoga ships tags like "yoga_pilates" and "working_out" — these
    // pass the noise filter (no marketing keywords, no internal-slug
    // punctuation) but render badly with underscores intact.
    expect(filterUserFacingTags(['yoga_pilates'])).toEqual(['yoga pilates']);
    expect(filterUserFacingTags(['working_out', 'Linen'])).toEqual(['working out', 'Linen']);
  });

  it('drops "new_drop" / "new_arrival" merchandising tags before underscore polish', () => {
    // These match the merchandising-flag noise pattern and never reach
    // the underscore-replacement step. Lock the behavior in.
    expect(filterUserFacingTags(['new_drop', 'new_arrival', 'Linen'])).toEqual(['Linen']);
  });

  // Reistor + Oshin regression cases (May 2 2026 user testing). The
  // existing filter let through campaign codes, near-typos of "sale",
  // SKU-style design codes, and "new price" pricing labels. Each
  // pattern below is its own test so a future regression points at
  // the exact missing rule.

  it('strips resort / cruise / capsule season codes', () => {
    // Reistor: "resort24" — the brand's resort 2024 collection slug.
    // Mirrors how we already drop SS24 / AW2024.
    expect(filterUserFacingTags(['resort24', 'cruise2025', 'holiday-25', 'capsule24', 'Linen'])).toEqual(['Linen']);
  });

  it('strips "new price" / "regular price" / "marked down" pricing labels', () => {
    // Oshin: "new price" — merchandising flag for re-priced items.
    // Same family as the existing "Full Price" rule.
    expect(filterUserFacingTags(['new price', 'Regular Price', 'marked down', 'Linen'])).toEqual(['Linen']);
  });

  it('strips short SKU / design codes like "dc-01", "tm08-2", "sku123"', () => {
    // Oshin: "dc-01" — design code, not a garment attribute. Pattern:
    // 1-4 letters + optional separator + 1-4 digits, with optional
    // trailing -<digit> suffix. Excludes legit hyphenated tags like
    // "v-neck" (no digits) and "high-waisted".
    expect(filterUserFacingTags(['dc-01', 'tm08', 'sku123', 'AB-12-3', 'Linen'])).toEqual(['Linen']);
    // Negative cases: real garment tags survive.
    expect(filterUserFacingTags(['v-neck', 'high-waisted', 'off-shoulder', 'square-neck'])).toEqual([
      'v-neck', 'high-waisted', 'off-shoulder', 'square-neck',
    ]);
  });

  it('catches near-typos of "sale" like "salex", "sales", "saleitem"', () => {
    // Reistor: "salex" slipped past the word-bounded \bsale\b rule.
    // Broaden to catch the suffix variants merchants actually emit.
    expect(filterUserFacingTags(['salex', 'sales', 'saleitem', 'Linen'])).toEqual(['Linen']);
    // Negative case: don't false-positive on words that contain
    // "sale" as part of a real word (e.g. "wholesale" — unlikely as
    // a garment tag but cover the regression).
    expect(filterUserFacingTags(['wholesaler', 'Linen'])).toEqual(['wholesaler', 'Linen']);
  });

  it('strips "save N%" / "save up to N%" / "save upto N%" merchandising labels', () => {
    // Genes Le Coanet Hemant (May 3 2026 PM user report) shipped tags
    // like "save 50%" and "save upto 50%" — discount-amount labels,
    // not garment attributes.
    expect(
      filterUserFacingTags(['save 50%', 'save upto 50%', 'save up to 30%', 'Linen']),
    ).toEqual(['Linen']);
  });

  it('strips "onsale" (fused sale flag, no word boundary before "sale")', () => {
    // The existing `\bsale...\b` rule needs a word boundary on the
    // left, so "onsale" (no separator between "on" and "sale") slips
    // past. Add an explicit pattern for the fused form.
    expect(filterUserFacingTags(['onsale', 'on-sale', 'on_sale', 'Linen'])).toEqual(['Linen']);
  });

  it('strips "spring summer YY" / "spring/summer YY" season-year labels', () => {
    // Genes Le Coanet Hemant: "spring summer 23" (and family —
    // "fall winter 24", "ss 23", "spring/summer 2023") are
    // collection-season labels equivalent to the existing SS24 /
    // AW2024 pattern, just spelled out long-form.
    expect(
      filterUserFacingTags([
        'spring summer 23',
        'spring/summer 2023',
        'fall winter 24',
        'autumn winter 2024',
        'Linen',
      ]),
    ).toEqual(['Linen']);
    // Don't strip a single season word with no year — "summer" alone
    // is a legit garment tag (e.g. "summer dress").
    expect(filterUserFacingTags(['summer', 'spring', 'Linen'])).toEqual([
      'summer', 'spring', 'Linen',
    ]);
  });

  it('end-to-end on the Genes Le Coanet Hemant tag list', () => {
    // Verifies the full live-report tag list (May 3 2026 PM):
    // raw tags ["save 50%", "spring summer 23", "save upto 50%",
    // "onsale"] should yield ZERO surviving tags — every entry is
    // merchandising noise.
    expect(
      filterUserFacingTags(['save 50%', 'spring summer 23', 'save upto 50%', 'onsale']),
    ).toEqual([]);
  });

  it('dedupes near-identical tags case + space insensitively (organic cotton vs organiccotton)', () => {
    // Reistor emitted both "organic cotton" and "organiccotton" — same
    // attribute, two formattings. First occurrence wins; later dupes
    // dropped. Comparison is case + whitespace insensitive.
    expect(filterUserFacingTags(['organic cotton', 'organiccotton', 'Linen'])).toEqual([
      'organic cotton', 'Linen',
    ]);
    // Order-preserved: if the run-on form comes first, it wins.
    expect(filterUserFacingTags(['organiccotton', 'organic cotton', 'Linen'])).toEqual([
      'organiccotton', 'Linen',
    ]);
    // Case insensitive too.
    expect(filterUserFacingTags(['Cotton', 'COTTON', 'cotton'])).toEqual(['Cotton']);
  });

  it('strips "dawn to dusk" style brand campaign / lookbook names is NOT covered (regression spec)', () => {
    // Documenting the limit: free-form campaign names ("dawn to dusk",
    // "nightfall edit", "weekend ritual") aren't predictable enough to
    // pattern-match without false-positives on legit tags ("date night",
    // "weekend"). They remain user-visible. If this gets flagged in
    // testing again, the answer is brand-level overrides, not more
    // regex. Test locks the current behavior.
    expect(filterUserFacingTags(['dawn to dusk', 'Linen'])).toEqual(['dawn to dusk', 'Linen']);
  });

  it('end-to-end on the live Reistor tag list (May 2 2026 regression)', () => {
    const raw = ['cotton', 'dawn to dusk', 'organic cotton', 'organiccotton', 'resort24', 'salex'];
    expect(filterUserFacingTags(raw)).toEqual([
      'cotton',
      'dawn to dusk',
      'organic cotton',
    ]);
  });

  it('end-to-end on the live Oshin tag list (May 2 2026 regression)', () => {
    const raw = ['custom', 'dc-01', 'new price', 'women'];
    // "women" survives — the demographic filter is intentionally NOT
    // included (would false-positive on "for women" / "womens cut" /
    // similar legit attributes; brand-override is the better lever).
    expect(filterUserFacingTags(raw)).toEqual(['custom', 'women']);
  });
});
