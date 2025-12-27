import type { VercelRequest, VercelResponse } from '@vercel/node';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { applyMiddleware, validateUrl } from '../sdk/shared/middleware';
import { createModuleLogger } from '../sdk/shared/logger';

const log = createModuleLogger('scraper');

interface ScrapedData {
  title?: string;
  brandName?: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
}

interface ProductData {
  title: string;
  brandName: string;
  price: string;
  currency: string;
  imageUrl: string;
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

    // Image
    const ogImage = this.extractMeta('property', 'og:image');
    const twitterImage = this.extractMeta('name', 'twitter:image');
    result.imageUrl = ogImage || twitterImage || '';

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

    // Merge data with priority: JSON-LD > JavaScript > Meta Tags > HTML Patterns > URL
    const merged: ScrapedData = {
      title: jsonLD.title || jsData.title || metaTags.title || htmlPatterns.title || '',
      brandName: jsonLD.brandName || metaTags.brandName || urlData.brandName || '',
      price: jsonLD.price || jsData.price || metaTags.price || htmlPatterns.price || '',
      currency: jsonLD.currency || metaTags.currency || htmlPatterns.currency || '',
      imageUrl: jsonLD.imageUrl || metaTags.imageUrl || '',
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
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Apply CORS, rate limiting, and security headers
  const handled = applyMiddleware(req, res);
  if (handled) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  // SSRF protection: validate URL before scraping
  const urlValidation = validateUrl(url);
  if (!urlValidation.valid) {
    return res.status(400).json({ error: urlValidation.error });
  }

  let html: string;
  let usedPuppeteer = false;

  try {
    // First attempt: try simple fetch
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

    return res.status(200).json({
      ...scrapedData,
      _debug: {
        requestedUrl: url,
        finalUrl: usedPuppeteer ? url : response.url,
        htmlLength: html.length,
        hasPriceAmount,
        hasPriceCurrency,
        usedPuppeteer,
        htmlPreview: html.substring(0, 1000)
      }
    });
  } catch (error) {
    log.error({ url, error }, 'Error scraping URL');
    return res.status(500).json({
      error: 'Failed to scrape URL',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
