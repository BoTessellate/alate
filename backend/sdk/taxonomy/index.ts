/**
 * Taxonomy SDK
 * Task 20: Category & Tag Taxonomy Builder
 *
 * Tag matching, normalization, and category validation
 */

export {
  loadTaxonomy,
  clearTaxonomyCache,
  getCategories,
  getSubcategories,
  getCategoryTags,
  getAllTags,
  getAliases,
  getAllAliases,
  normalizeTag,
  matchTag,
  validateCategory,
  validateSubcategory,
  normalizeTags,
  detectCategory,
  suggestTags,
  getRelatedTags,
  validateProductTaxonomy
} from './lookup';

export type {
  Taxonomy,
  CategoryDefinition,
  TagMatchResult,
  NormalizationResult
} from './lookup';

// Category Tree (Task 20)
export {
  TOP_CATEGORIES,
  CATEGORY_DISPLAY_NAMES,
  TAG_FAMILIES,
  getTagFamily,
  groupTagsByFamily,
  isValidCategory,
  isTagInFamily
} from './categoryTree';

export type {
  TopCategory,
  Subcategory,
  HomeSubcategory,
  FashionSubcategory,
  BeautySubcategory,
  ArtSubcategory,
  MaterialTag,
  OriginTag,
  UseCaseTag,
  SustainabilityTag,
  StyleTag,
  TagFamily,
  TaxonomyTag,
  CategoryTree,
  ProductTaxonomy
} from './categoryTree';
