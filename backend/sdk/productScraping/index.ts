/**
 * Product Scraping SDK
 * Extracted from backend/api/scrape.ts for reuse in ai.ts
 */

import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { validateUrl } from '../shared/middleware';
import { createModuleLogger } from '../shared/logger';
import { tryShopifyJSON } from './shopifyFetch';

// TODO: [AFFILIATE-APIS] Integrate affiliate APIs for large brands (Gucci, Zara, H&M, etc.)
// Current simple fetch + Puppeteer fails for bot-protected sites (504 timeouts).
// Options: Farfetch Affiliate API, SSENSE, Net-a-Porter partner programs.
// Fallback flow: affiliate API → simple fetch → manual entry form.
// See Claude.md "Notes for Later" and todo list for full context.

const log = createModuleLogger('scraper');

export interface ScrapedData {
  title?: string;
  brandName?: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
  description?: string;
  availableSizes?: string[];
  // Fields populated by the Shopify direct-fetch layer when the URL is
  // a Shopify storefront. Optional on every other path so we don't
  // break callers that don't need them.
  category?: string;
  tags?: string[];
  material?: string;
  compareAtPrice?: string;
}

interface ProductData {
  title: string;
  brandName: string;
  price: string;
  currency: string;
  imageUrl: string;
  description: string;
  availableSizes: string[];
}

// Layered extraction strategy - graceful degradation from structured to unstructured data
class ProductExtractor {
  private html: string;
  private url: string;

  constructor(html: string, url: string) {
    this.html = html;
    this.url = url;
  }

  // Layer 1: JSON-LD structured data (most reliable)
  private extractFromJSONLD(): Partial<ProductData> {
    const result: Partial<ProductData> = {};
    const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = scriptRegex.exec(this.html)) !== null) {
      try {
        const jsonContent = match[1].trim();
        const data = JSON.parse(jsonContent);

        // Handle both single Product and array of items
        const product = data['@type'] === 'Product' ? data :
                       (Array.isArray(data) ? data.find((item: any) => item['@type'] === 'Product') : null);

        if (product) {
          if (product.name) result.title = product.name;
          if (product.description) result.description = String(product.description).slice(0, 500);
          if (product.brand?.name) result.brandName = product.brand.name;
          if (product.image) {
            let imageData = Array.isArray(product.image) ? product.image[0] : product.image;
            // Handle ImageObject vs plain string URL
            if (typeof imageData === 'object' && imageData !== null) {
              result.imageUrl = imageData.url || imageData.image || imageData.contentUrl || '';
            } else if (typeof imageData === 'string') {
              result.imageUrl = imageData;
            }
          }

          // Extract offers
          if (product.offers) {
            const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
            if (offer.price) result.price = String(offer.price);
            if (offer.priceCurrency) result.currency = offer.priceCurrency;
          }

          // If we found a complete product, return it
          if (result.title && result.price) break;
        }
      } catch (e) {
        // Silent fail, try next script tag
      }
    }

    return result;
  }

  // Layer 2: Meta tags (Open Graph, Twitter, Schema.org)
  private extractFromMetaTags(): Partial<ProductData> {
    const result: Partial<ProductData> = {};

    // Title extraction priority: og:title > twitter:title > page title
    const ogTitle = this.extractMeta('property', 'og:title');
    const twitterTitle = this.extractMeta('name', 'twitter:title');
    const pageTitle = this.html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    result.title = ogTitle || twitterTitle || pageTitle || '';

    // Brand/Site name
    const ogSiteName = this.extractMeta('property', 'og:site_name');
    const twitterSite = this.extractMeta('name', 'twitter:site');
    result.brandName = ogSiteName || twitterSite || '';

    // Image — prefer og:image:secure_url over og:image. Many Shopify
    // and WordPress stores serve og:image as http:// but also provide
    // an https:// secure variant. React Native Android blocks
    // cleartext http images by default, so using the secure URL fixes
    // "blank image card" bugs on any misconfigured storefront — not
    // just Shopify. Fallback chain: secure_url → og:image → twitter.
    const ogImageSecure = this.extractMeta('property', 'og:image:secure_url');
    const ogImage = this.extractMeta('property', 'og:image');
    const twitterImage = this.extractMeta('name', 'twitter:image');
    result.imageUrl = ogImageSecure || ogImage || twitterImage || '';

    // Description
    const ogDescription = this.extractMeta('property', 'og:description');
    const metaDescription = this.extractMeta('name', 'description');
    const twitterDescription = this.extractMeta('name', 'twitter:description');
    const rawDesc = ogDescription || metaDescription || twitterDescription || '';
    if (rawDesc) result.description = rawDesc.slice(0, 500);

    // Price (Open Graph product tags)
    let ogPrice = this.extractMeta('property', 'og:price:amount') ||
                  this.extractMeta('property', 'product:price:amount');
    const ogCurrency = this.extractMeta('property', 'og:price:currency') ||
                      this.extractMeta('property', 'product:price:currency');

    log.debug({ ogPrice, ogCurrency }, 'Meta tag price data');

    // Clean price - remove commas
    if (ogPrice) {
      ogPrice = ogPrice.replace(/,/g, '');
      result.price = ogPrice;
    }
    if (ogCurrency) result.currency = ogCurrency;

    // Schema.org microdata
    const schemaPrice = this.extractMeta('itemprop', 'price');
    const schemaCurrency = this.extractMeta('itemprop', 'priceCurrency');
    if (!result.price && schemaPrice) result.price = schemaPrice;
    if (!result.currency && schemaCurrency) result.currency = schemaCurrency;

    return result;
  }

  // Layer 2.5: JavaScript embedded data (Shopify, Next.js, etc.)
  private extractFromJavaScript(): Partial<ProductData> {
    const result: Partial<ProductData> = {};

    // Shopify product JSON in JavaScript variables
    const shopifyMatch = this.html.match(/var\s+product\s*=\s*({[^;]+});/);
    if (shopifyMatch) {
      try {
        const product = JSON.parse(shopifyMatch[1]);
        if (product.title) result.title = product.title;
        if (product.price && typeof product.price === 'number') {
          // Shopify stores price in cents
          result.price = String(product.price / 100);
        }
        // Currency is usually in a separate variable or meta tag
      } catch (e) {
        // Failed to parse
      }
    }

    // Next.js __NEXT_DATA__ (for sites like Amala Earth)
    const nextDataMatch = this.html.match(/<script id="__NEXT_DATA__" type="application\/json">({.+?})<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        // Next.js data structure varies, but we can extract product ID for now
        // This would need API call to get full data - beyond scope of static scraping
      } catch (e) {
        // Failed to parse
      }
    }

    return result;
  }

  // Layer 3: Common HTML patterns (least reliable, most flexible)
  private extractFromHTMLPatterns(): Partial<ProductData> {
    const result: Partial<ProductData> = {};

    // Price patterns - common class names and data attributes
    const pricePatterns = [
      // Class-based selectors
      /class=["'][^"']*\b(?:price|product-price|final-price|sale-price|amount)\b[^"']*["'][^>]*>[\s\n]*(?:<[^>]+>)*\s*([₹$£€¥]?\s*[\d,]+\.?\d*)/gi,
      // Data attributes
      /data-(?:price|product-price|amount)=["']([^"']+)["']/gi,
      // Common e-commerce platform patterns
      /<span[^>]*class=["'][^"']*money[^"']*["'][^>]*>([^<]+)<\/span>/gi,
      // Generic price with currency symbol
      /(?:price|cost|amount)[^>]*>[\s\n]*(?:<[^>]+>)*\s*([₹$£€¥]\s*[\d,]+\.?\d*)/gi,
    ];

    for (const pattern of pricePatterns) {
      const matches = [...this.html.matchAll(pattern)];
      for (const match of matches) {
        const text = match[1]?.trim();
        if (text) {
          const priceMatch = text.match(/([\d,]+\.?\d*)/);
          const currencyMatch = text.match(/([₹$£€¥])/);

          if (priceMatch) {
            result.price = priceMatch[1].replace(/,/g, '');

            if (currencyMatch) {
              const currencyMap: { [key: string]: string } = {
                '₹': 'INR', '$': 'USD', '£': 'GBP', '€': 'EUR', '¥': 'JPY'
              };
              result.currency = currencyMap[currencyMatch[1]] || '';
            }

            log.debug({ price: result.price, currency: result.currency }, 'Found price in HTML patterns');

            // If we found a valid price, break
            if (result.price) break;
          }
        }
      }
      if (result.price) break;
    }

    // Product title patterns
    if (!result.title) {
      const titlePatterns = [
        /<h1[^>]*class=["'][^"']*product[^"']*["'][^>]*>([^<]+)<\/h1>/i,
        /<h1[^>]*>([^<]+)<\/h1>/i,
      ];

      for (const pattern of titlePatterns) {
        const match = this.html.match(pattern);
        if (match?.[1]) {
          result.title = match[1].trim();
          break;
        }
      }
    }

    return result;
  }

  // Layer 4: URL-based fallbacks
  private extractFromURL(): Partial<ProductData> {
    const result: Partial<ProductData> = {};

    try {
      const urlObj = new URL(this.url);
      const hostname = urlObj.hostname.replace('www.', '');
      const brandFromDomain = hostname.split('.')[0];
      result.brandName = brandFromDomain.charAt(0).toUpperCase() + brandFromDomain.slice(1);

      // Infer currency from country-specific TLDs
      const tld = hostname.split('.').pop()?.toLowerCase();
      const tldCurrencyMap: { [key: string]: string } = {
        'in': 'INR', 'uk': 'GBP', 'eu': 'EUR', 'de': 'EUR', 'fr': 'EUR',
        'it': 'EUR', 'es': 'EUR', 'jp': 'JPY', 'cn': 'CNY', 'au': 'AUD',
        'ca': 'CAD', 'br': 'BRL', 'mx': 'MXN', 'kr': 'KRW', 'sg': 'SGD',
        'ae': 'AED', 'sa': 'SAR', 'za': 'ZAR', 'ru': 'RUB', 'se': 'SEK',
        'no': 'NOK', 'dk': 'DKK', 'ch': 'CHF', 'nz': 'NZD', 'hk': 'HKD',
        'th': 'THB', 'my': 'MYR', 'id': 'IDR', 'ph': 'PHP', 'vn': 'VND',
        'pl': 'PLN', 'tr': 'TRY',
      };

      if (tld && tldCurrencyMap[tld]) {
        result.currency = tldCurrencyMap[tld];
        log.debug({ tld, currency: result.currency }, 'Inferred currency from TLD');
      }
    } catch (e) {
      // Invalid URL
    }

    return result;
  }

  // Helper to extract meta tag content
  private extractMeta(attr: string, value: string): string {
    const regex = new RegExp(`<meta[^>]*${attr}=["']${value.replace(/:/g, ':')}["'][^>]*content=["']([^"']*)["']`, 'i');
    const reverseRegex = new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${value.replace(/:/g, ':')}["']`, 'i');

    const match = this.html.match(regex) || this.html.match(reverseRegex);
    return match?.[1]?.trim() || '';
  }

  // Normalize a raw size token into a canonical label (e.g. "small" → "S")
  private normalizeSizeToken(raw: string): string | null {
    const s = raw.trim().toUpperCase();
    if (!s || s.length > 8) return null;
    const MAP: Record<string, string> = {
      'EXTRA SMALL': 'XS', 'XS': 'XS',
      'SMALL': 'S', 'S': 'S',
      'MEDIUM': 'M', 'M': 'M',
      'LARGE': 'L', 'L': 'L',
      'EXTRA LARGE': 'XL', 'XL': 'XL',
      'XXL': 'XXL', '2XL': 'XXL',
      'XXXL': 'XXXL', '3XL': 'XXXL',
    };
    return MAP[s] ?? null;
  }

  // Extract available sizes from page using multiple strategies
  private extractSizes(): string[] {
    const found: string[] = [];
    const seen = new Set<string>();

    const add = (raw: string) => {
      const norm = this.normalizeSizeToken(raw);
      if (norm && !seen.has(norm)) { seen.add(norm); found.push(norm); }
    };

    // Strategy 1: JSON-LD hasVariant with size/additionalProperty
    const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = ldRegex.exec(this.html)) !== null) {
      try {
        const data = JSON.parse(m[1].trim());
        const product = data['@type'] === 'Product' ? data
          : Array.isArray(data) ? data.find((x: any) => x['@type'] === 'Product') : null;
        if (!product) continue;
        const variants: any[] = Array.isArray(product.hasVariant) ? product.hasVariant : [];
        for (const v of variants) {
          // hasVariant with additionalProperty
          if (Array.isArray(v.additionalProperty)) {
            for (const p of v.additionalProperty) {
              if (typeof p.name === 'string' && /size/i.test(p.name) && p.value) {
                add(String(p.value));
              }
            }
          }
          // hasVariant with size property
          if (v.size) add(String(v.size));
          if (v.name) add(String(v.name));
        }
        // offers array with eligibleQuantity / size in name
        const offers: any[] = Array.isArray(product.offers) ? product.offers : [];
        for (const o of offers) {
          if (o.name) add(String(o.name));
        }
      } catch { /* skip */ }
    }

    if (found.length) return found;

    // Strategy 2: Shopify product JSON in JS
    const shopifyMatch = this.html.match(/var\s+product\s*=\s*(\{[\s\S]+?\});[\s\n]*(?:\/\/|var |<)/);
    if (shopifyMatch) {
      try {
        const product = JSON.parse(shopifyMatch[1]);
        if (Array.isArray(product.options)) {
          const sizeOptionIdx = product.options.findIndex((o: any) =>
            typeof o === 'string' ? /size/i.test(o) : /size/i.test(o.name || '')
          );
          if (sizeOptionIdx >= 0 && Array.isArray(product.variants)) {
            const key = `option${sizeOptionIdx + 1}` as 'option1' | 'option2' | 'option3';
            for (const v of product.variants) {
              if (v[key] && v.available !== false) add(String(v[key]));
            }
          }
        }
      } catch { /* skip */ }
    }

    if (found.length) return found;

    // Strategy 3: HTML button/input/option elements with size values
    const sizePatterns = [
      /data-size=["']([^"']+)["']/gi,
      /data-value=["']([XxSsMmLl]{1,4})["']/gi,
      /<button[^>]*\bsize\b[^>]*>([^<]{1,6})<\/button>/gi,
      /<option[^>]*value=["']([XxSsMmLlXx]{1,4})["'][^>]*>/gi,
    ];
    for (const re of sizePatterns) {
      for (const hit of this.html.matchAll(re)) {
        add(hit[1]);
      }
    }

    return found;
  }

  // Orchestrate all extraction layers
  public extract(): ScrapedData {
    // Layer 1: JSON-LD (highest priority)
    const jsonLD = this.extractFromJSONLD();
    log.debug({ layer: 'JSON-LD', data: jsonLD }, 'Extraction layer 1 complete');

    // Layer 2: Meta tags
    const metaTags = this.extractFromMetaTags();
    log.debug({ layer: 'Meta Tags', data: metaTags }, 'Extraction layer 2 complete');

    // Layer 2.5: JavaScript data
    const jsData = this.extractFromJavaScript();
    log.debug({ layer: 'JavaScript', data: jsData }, 'Extraction layer 2.5 complete');

    // Layer 3: HTML patterns
    const htmlPatterns = this.extractFromHTMLPatterns();
    log.debug({ layer: 'HTML Patterns', data: htmlPatterns }, 'Extraction layer 3 complete');

    // Layer 4: URL fallbacks
    const urlData = this.extractFromURL();
    log.debug({ layer: 'URL', data: urlData }, 'Extraction layer 4 complete');

    // Extract sizes
    const sizes = this.extractSizes();

    // Merge data with priority: JSON-LD > JavaScript > Meta Tags > HTML Patterns > URL
    const merged: ScrapedData = {
      title: jsonLD.title || jsData.title || metaTags.title || htmlPatterns.title || '',
      brandName: jsonLD.brandName || metaTags.brandName || urlData.brandName || '',
      price: jsonLD.price || jsData.price || metaTags.price || htmlPatterns.price || '',
      currency: jsonLD.currency || metaTags.currency || htmlPatterns.currency || urlData.currency || '',
      imageUrl: jsonLD.imageUrl || metaTags.imageUrl || '',
      description: jsonLD.description || metaTags.description || '',
      availableSizes: sizes.length ? sizes : undefined,
    };

    log.info({ merged }, 'Final merged extraction result');

    return merged;
  }
}

// Fetch HTML using Puppeteer (for bot-protected sites)
async function fetchWithPuppeteer(url: string): Promise<string> {
  let browser;
  try {
    log.info({ url }, 'Launching Puppeteer browser');

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: (chromium as any).defaultViewport ?? { width: 1920, height: 1080 },
      executablePath: await chromium.executablePath(),
      headless: (chromium as any).headless ?? true,
    });

    const page = await browser.newPage();

    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Alate/1.0 (+https://alate.app)');

    log.debug({ url }, 'Navigating to URL');
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    const html = await page.content();
    log.info({ url, htmlLength: html.length }, 'Successfully fetched HTML with Puppeteer');

    return html;
  } catch (error) {
    log.error({ url, error }, 'Puppeteer fetch failed');
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Scrape product data from URL
 *
 * @param url - Product URL to scrape
 * @returns Scraped product data with debug info
 */
export async function scrapeProduct(url: string): Promise<{
  data: ScrapedData;
  debug: {
    requestedUrl: string;
    finalUrl: string;
    htmlLength: number;
    hasPriceAmount: boolean;
    hasPriceCurrency: boolean;
    usedPuppeteer: boolean;
    htmlPreview: string;
  };
}> {
  // SSRF protection: validate URL before scraping
  const urlValidation = validateUrl(url);
  if (!urlValidation.valid) {
    throw new Error(urlValidation.error || 'Invalid URL');
  }

  // Priority 0: Shopify direct-fetch. Every Shopify storefront exposes
  // its product JSON at `/products/<handle>.json`. If that endpoint
  // returns a well-formed payload, we get authoritative category /
  // tags / material / images / sizes without touching puppeteer or
  // Claude-based enrichment. Silently returns null for non-Shopify
  // sites; we fall through to HTML extraction below.
  try {
    const shopifyResult = await tryShopifyJSON(new URL(url));
    if (shopifyResult && shopifyResult.title) {
      log.info({ url }, 'Using Shopify direct-fetch result (skipping HTML extraction)');
      return {
        data: {
          title: shopifyResult.title,
          brandName: shopifyResult.brandName,
          price: shopifyResult.price,
          currency: shopifyResult.currency,
          imageUrl: shopifyResult.imageUrl,
          description: shopifyResult.description,
          availableSizes: shopifyResult.availableSizes,
          category: shopifyResult.category,
          tags: shopifyResult.tags,
          material: shopifyResult.material,
          compareAtPrice: shopifyResult.compareAtPrice,
        },
        debug: {
          requestedUrl: url,
          finalUrl: url,
          htmlLength: 0,
          hasPriceAmount: !!shopifyResult.price,
          hasPriceCurrency: !!shopifyResult.currency,
          usedPuppeteer: false,
          htmlPreview: '[Shopify direct-fetch — no HTML processed]',
        },
      };
    }
  } catch (error) {
    // Shopify helper never throws itself, but defend against unexpected
    // exceptions (e.g. URL parse failures slipping past validateUrl) so
    // the HTML path still runs.
    log.warn({ url, error: (error as Error).message }, 'Shopify direct-fetch threw unexpectedly');
  }

  let html: string;
  let usedPuppeteer = false;

  // First attempt: try simple fetch
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Alate/1.0 (+https://alate.app)',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none'
    },
    redirect: 'follow'
  });

  log.debug({
    status: response.status,
    finalUrl: response.url,
    contentType: response.headers.get('content-type')
  }, 'Fetch response received');

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  html = await response.text();

  // Check if we got redirected to a different page (bot detection)
  const urlObj = new URL(url);
  const responseUrlObj = new URL(response.url);

  // Normalize URLs for comparison (remove trailing slashes, compare paths)
  const requestedPath = urlObj.pathname.replace(/\/$/, '');
  const responsePath = responseUrlObj.pathname.replace(/\/$/, '');

  const wasRedirected = urlObj.hostname === responseUrlObj.hostname && requestedPath !== responsePath && responsePath === '';

  if (wasRedirected) {
    log.info({ url }, 'Redirect detected, retrying with Puppeteer');
    html = await fetchWithPuppeteer(url);
    usedPuppeteer = true;
  }

  // Use the elegant layered extractor
  const extractor = new ProductExtractor(html, url);
  const scrapedData = extractor.extract();

  log.info({ url, scrapedData }, 'Scraping completed');

  // Debug: check if price tags exist in HTML
  const hasPriceAmount = html.includes('og:price:amount');
  const hasPriceCurrency = html.includes('og:price:currency');
  log.debug({ hasPriceAmount, hasPriceCurrency }, 'HTML price tag presence');

  return {
    data: scrapedData,
    debug: {
      requestedUrl: url,
      finalUrl: usedPuppeteer ? url : response.url,
      htmlLength: html.length,
      hasPriceAmount,
      hasPriceCurrency,
      usedPuppeteer,
      htmlPreview: html.substring(0, 1000)
    }
  };
}
