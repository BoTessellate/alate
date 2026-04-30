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
});
