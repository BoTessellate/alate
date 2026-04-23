/**
 * Development-only seed data for the fit history store.
 *
 * Loaded once on app start in __DEV__ mode when history is empty, so the
 * cover-flow has something to scroll through without having to actually
 * run product scrapes against a live device. 15 entries across the three
 * fit verdicts (5 great / 5 moderate / 5 poor) with a spread of brands,
 * prices, and image categories so visual review is realistic.
 *
 * In production this file isn't imported — the call site is guarded by
 * __DEV__ so Metro minifier strips it from release bundles.
 */

import type { FitHistoryEntry } from './store/fitHistoryStore';

type SeedEntry = Omit<FitHistoryEntry, 'id'>;

// Unsplash Source URLs — stable, free, no API key. Seed with a slug so
// each card gets a consistent-but-different clothing image across reloads.
const img = (slug: string, size = 900) =>
  `https://images.unsplash.com/${slug}?auto=format&fit=crop&w=${size}&q=70`;

const nowMinus = (daysAgo: number): string =>
  new Date(Date.now() - daysAgo * 86400000).toISOString();

export const DEV_FIT_ENTRIES: SeedEntry[] = [
  // --- Great fits (5) -----------------------------------------------------
  {
    url: 'https://www.asos.com/dev-seed/1',
    brand: 'ASOS',
    productName: 'Relaxed Oversized Crew Neck Sweatshirt',
    productImage: img('photo-1521572163474-6864f9cf17ab'),
    fitScore: 'great',
    warnings: [],
    checkedAt: nowMinus(0),
    sizeRecommendation: { size: 'M', confidence: 'high' },
    category: 'tops',
    material: 'cotton blend',
    price: { amount: 32, currency: 'GBP' },
    tags: ['casual', 'loungewear'],
  },
  {
    url: 'https://www.uniqlo.com/dev-seed/2',
    brand: 'UNIQLO',
    productName: 'Airism Cotton Oversized T-Shirt',
    productImage: img('photo-1583743814966-8936f5b7be1a'),
    fitScore: 'great',
    warnings: [],
    checkedAt: nowMinus(1),
    sizeRecommendation: { size: 'S', confidence: 'high' },
    category: 'tops',
    material: 'cotton',
    price: { amount: 19.9, currency: 'GBP' },
    tags: ['summer', 'basics'],
  },
  {
    url: 'https://www.zara.com/dev-seed/3',
    brand: 'ZARA',
    productName: 'Linen Blend Wide Leg Trousers',
    productImage: img('photo-1594938298603-c8148c4dae35'),
    fitScore: 'great',
    warnings: [],
    checkedAt: nowMinus(2),
    sizeRecommendation: { size: '28', confidence: 'medium' },
    category: 'bottoms',
    material: 'linen blend',
    price: { amount: 45.99, currency: 'GBP' },
    tags: ['summer', 'smart-casual'],
  },
  {
    url: 'https://www.cos.com/dev-seed/4',
    brand: 'COS',
    productName: 'Oversized Merino Wool Jumper',
    productImage: img('photo-1434389677669-e08b4cac3105'),
    fitScore: 'great',
    warnings: [],
    checkedAt: nowMinus(3),
    sizeRecommendation: { size: 'L', confidence: 'high' },
    category: 'tops',
    material: 'merino wool',
    price: { amount: 95, currency: 'GBP' },
    tags: ['winter', 'smart-casual'],
  },
  {
    url: 'https://www.arket.com/dev-seed/5',
    brand: 'ARKET',
    productName: 'Cropped Denim Jacket',
    productImage: img('photo-1551028719-00167b16eac5'),
    fitScore: 'great',
    warnings: [],
    checkedAt: nowMinus(5),
    sizeRecommendation: { size: 'S', confidence: 'high' },
    category: 'outerwear',
    material: 'denim',
    price: { amount: 89, currency: 'EUR' },
    tags: ['spring', 'casual'],
  },

  // --- Moderate (concerns) — 5 -------------------------------------------
  {
    url: 'https://www.mango.com/dev-seed/6',
    brand: 'MANGO',
    productName: 'High Waist Straight Leg Jeans',
    productImage: img('photo-1542272604-787c3835535d'),
    fitScore: 'moderate',
    warnings: [
      { severity: 'moderate', message: 'Waist may feel tight — consider sizing up' },
    ],
    checkedAt: nowMinus(6),
    sizeRecommendation: { size: '28', confidence: 'medium' },
    category: 'bottoms',
    material: 'denim',
    price: { amount: 49.99, currency: 'GBP' },
    tags: ['everyday'],
  },
  {
    url: 'https://www.massimodutti.com/dev-seed/7',
    brand: 'MASSIMO DUTTI',
    productName: 'Silk Blend Wrap Blouse',
    productImage: img('photo-1525507119028-ed4c629a60a3'),
    fitScore: 'moderate',
    warnings: [
      { severity: 'minor', message: 'Bust may be loose on your frame' },
    ],
    checkedAt: nowMinus(7),
    sizeRecommendation: { size: 'S', confidence: 'low' },
    category: 'tops',
    material: 'silk blend',
    price: { amount: 69.95, currency: 'GBP' },
    tags: ['workwear'],
  },
  {
    url: 'https://www.hm.com/dev-seed/8',
    brand: 'H&M',
    productName: 'Pleated A-Line Midi Skirt',
    productImage: img('photo-1583496661160-fb5886a0aaaa'),
    fitScore: 'moderate',
    warnings: [
      { severity: 'moderate', message: 'Length may be longer than expected' },
    ],
    checkedAt: nowMinus(9),
    sizeRecommendation: { size: 'M', confidence: 'medium' },
    category: 'bottoms',
    material: 'polyester',
    price: { amount: 24.99, currency: 'GBP' },
    tags: ['dressy'],
  },
  {
    url: 'https://www.weekday.com/dev-seed/9',
    brand: 'WEEKDAY',
    productName: 'Relaxed Fit Cargo Trousers',
    productImage: img('photo-1473966968600-fa801b3d4a6d'),
    fitScore: 'moderate',
    warnings: [
      { severity: 'minor', message: 'Hip measurement at the edge of your range' },
    ],
    checkedAt: nowMinus(10),
    sizeRecommendation: { size: '30', confidence: 'medium' },
    category: 'bottoms',
    material: 'cotton twill',
    price: { amount: 60, currency: 'EUR' },
    tags: ['streetwear'],
  },
  {
    url: 'https://www.aritzia.com/dev-seed/10',
    brand: 'ARITZIA',
    productName: 'Super Puff Mid Jacket',
    productImage: img('photo-1544441893-675973e31985'),
    fitScore: 'moderate',
    warnings: [
      { severity: 'moderate', message: 'Sleeve length may run short' },
    ],
    checkedAt: nowMinus(12),
    sizeRecommendation: { size: 'XS', confidence: 'low' },
    category: 'outerwear',
    material: 'nylon + down',
    price: { amount: 250, currency: 'USD' },
    tags: ['winter'],
  },

  // --- Poor fits (5) ------------------------------------------------------
  {
    url: 'https://www.fashionnova.com/dev-seed/11',
    brand: 'FASHION NOVA',
    productName: 'Bodycon Mini Dress',
    productImage: img('photo-1566174053879-31528523f8ae'),
    fitScore: 'poor',
    warnings: [
      { severity: 'major', message: 'Runs small — two sizes up recommended' },
      { severity: 'moderate', message: 'Not recommended for your body shape' },
    ],
    checkedAt: nowMinus(14),
    sizeRecommendation: { size: 'L', confidence: 'low' },
    category: 'dresses',
    material: 'polyester blend',
    price: { amount: 34.99, currency: 'USD' },
    tags: ['going-out'],
  },
  {
    url: 'https://www.prettylittlething.com/dev-seed/12',
    brand: 'PLT',
    productName: 'Ribbed Crop Top',
    productImage: img('photo-1515886657613-9f3515b0c78f'),
    fitScore: 'poor',
    warnings: [
      { severity: 'major', message: 'Crop length too short for torso measurement' },
    ],
    checkedAt: nowMinus(15),
    sizeRecommendation: { size: 'M', confidence: 'low' },
    category: 'tops',
    material: 'rib knit',
    price: { amount: 12, currency: 'GBP' },
    tags: ['going-out'],
  },
  {
    url: 'https://www.shein.com/dev-seed/13',
    brand: 'SHEIN',
    productName: 'Tie Back Floral Maxi Dress',
    productImage: img('photo-1539008835657-9e8e9680c956'),
    fitScore: 'poor',
    warnings: [
      { severity: 'major', message: 'Bust measurement significantly off' },
      { severity: 'major', message: 'Length exceeds your height range' },
    ],
    checkedAt: nowMinus(17),
    sizeRecommendation: { size: 'S', confidence: 'low' },
    category: 'dresses',
    material: 'polyester',
    price: { amount: 18.99, currency: 'USD' },
    tags: ['holiday'],
  },
  {
    url: 'https://www.revolve.com/dev-seed/14',
    brand: 'REVOLVE',
    productName: 'Structured Blazer',
    productImage: img('photo-1591047139829-d91aecb6caea'),
    fitScore: 'poor',
    warnings: [
      { severity: 'major', message: 'Shoulder width does not match your profile' },
    ],
    checkedAt: nowMinus(19),
    sizeRecommendation: { size: 'M', confidence: 'low' },
    category: 'outerwear',
    material: 'wool blend',
    price: { amount: 298, currency: 'USD' },
    tags: ['workwear'],
  },
  {
    url: 'https://www.topshop.com/dev-seed/15',
    brand: 'TOPSHOP',
    productName: 'Skinny Fit Leather Trousers',
    productImage: img('photo-1509631179647-0177331693ae'),
    fitScore: 'poor',
    warnings: [
      { severity: 'major', message: 'Thigh measurement out of range' },
      { severity: 'moderate', message: 'Hip opening may be tight' },
    ],
    checkedAt: nowMinus(22),
    sizeRecommendation: { size: '30', confidence: 'low' },
    category: 'bottoms',
    material: 'faux leather',
    price: { amount: 55, currency: 'GBP' },
    tags: ['going-out'],
  },
];
