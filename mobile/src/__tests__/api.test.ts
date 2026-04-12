/**
 * Unit tests: src/services/api.ts
 *
 * Focus is on error paths — happy paths are already covered implicitly by
 * the integration flow tests (firstTimeUserJourney / recurringFitCheck). The
 * business-critical behaviours here are:
 *
 *   1. Never throw from the public api — every exported function returns a
 *      `{ success: false, error }` shape so screens can render an inline
 *      error instead of an unhandled promise rejection / crash.
 *   2. HTTP non-2xx must be translated into a stable error shape.
 *   3. Network failure (fetch rejects) must not leak through.
 *   4. Malformed JSON / missing fields must degrade gracefully.
 *   5. Timeout (AbortError) must surface the "Request timed out" message.
 *
 * Fetch is mocked per-test so we stay completely offline — no real network.
 */

import {
  scrapeProduct,
  enrichProduct,
  checkFit,
  calibrateGarment,
  nudgeBrand,
  extractBrandFromUrl,
} from '../services/api';
import type { Avatar } from '../store/avatarStore';

const SAMPLE_AVATAR: Avatar = {
  height_cm: 168,
  shoulders: 'average',
  bust: 'medium',
  waist: 'average',
  hips: 'average',
  thighs: 'average',
  torso_length: 'average',
};

const SAMPLE_PRODUCT = {
  id: 'prod-1',
  product_name: 'Test dress',
  category: 'dresses',
};

/**
 * Helper: build a fake fetch response without needing node-fetch or whatwg.
 * We only use `.ok`, `.status`, and `.json()` inside api.ts.
 */
function mockFetchResponse(body: unknown, { ok = true, status = 200 } = {}) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

function mockFetchJsonError({ status = 500 } = {}) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.reject(new Error('not json')),
  } as unknown as Response);
}

describe('api service', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Fresh spy per test — jest.resetAllMocks is not enough because fetch is
    // attached to the global object, not a jest module mock.
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  // ------------------------------------------------------------------
  // scrapeProduct
  // ------------------------------------------------------------------
  describe('scrapeProduct', () => {
    it('returns normalised product data on success', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchResponse({
          success: true,
          data: {
            title: 'Linen shirt',
            imageUrl: 'https://cdn.example.com/a.jpg',
            price: { amount: 49, currency: 'GBP' },
            brandName: 'ACME',
          },
        })
      );

      const result = await scrapeProduct('https://shop.example.com/p/1');

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        name: 'Linen shirt',
        image: 'https://cdn.example.com/a.jpg',
        description: undefined,
        price: { amount: 49, currency: 'GBP' },
        brand: 'ACME',
        availableSizes: undefined,
      });
    });

    it('returns failure when server reports success:false', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchResponse({ success: false, error: 'Not supported' })
      );

      const result = await scrapeProduct('https://shop.example.com/p/2');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Not supported');
    });

    it('returns failure when data payload is missing', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchResponse({ success: true })
      );

      const result = await scrapeProduct('https://shop.example.com/p/3');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to scrape product');
    });

    it('surfaces HTTP status when backend returns non-2xx with no body', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchJsonError({ status: 503 })
      );

      const result = await scrapeProduct('https://shop.example.com/p/4');

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 503');
    });

    it('uses server-provided error message on non-2xx', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchResponse(
          { message: 'Scrape quota exceeded' },
          { ok: false, status: 429 }
        )
      );

      const result = await scrapeProduct('https://shop.example.com/p/5');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Scrape quota exceeded');
    });

    it('never throws on network failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new TypeError('Network request failed')
      );

      const result = await scrapeProduct('https://shop.example.com/p/6');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network request failed');
    });

    it('surfaces "Request timed out" when fetch is aborted', async () => {
      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValueOnce(abortErr);

      const result = await scrapeProduct('https://shop.example.com/p/7');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timed out');
    });

    it('sends the X-Client header so the backend can identify callers', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchResponse({ success: true, data: { title: 'x' } })
      );

      await scrapeProduct('https://shop.example.com/p/8');

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      expect(init.headers['X-Client']).toBe('Alate/1.0');
      expect(init.method).toBe('POST');
    });
  });

  // ------------------------------------------------------------------
  // enrichProduct
  // ------------------------------------------------------------------
  describe('enrichProduct', () => {
    it('passes through backend product payload on success', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchResponse({
          success: true,
          product: {
            id: 'p-1',
            name: 'Silk dress',
            category: 'dresses',
            material: 'silk',
            tags: ['evening', 'midi'],
          },
        })
      );

      const result = await enrichProduct({ name: 'Silk dress' });

      expect(result.success).toBe(true);
      expect(result.product?.category).toBe('dresses');
      expect(result.product?.tags).toEqual(['evening', 'midi']);
    });

    it('returns failure shape on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('ECONNRESET')
      );

      const result = await enrichProduct({ name: 'x' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('ECONNRESET');
    });

    it('returns failure shape on HTTP 500', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchJsonError({ status: 500 })
      );

      const result = await enrichProduct({ name: 'x' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('HTTP 500');
    });
  });

  // ------------------------------------------------------------------
  // checkFit
  // ------------------------------------------------------------------
  describe('checkFit', () => {
    it('posts calibration + garment_count when calibration supplied', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchResponse({
          success: true,
          fit_score: 'great',
          warnings: [],
        })
      );

      const cal = {
        bust_cm: 92,
        waist_cm: 72,
        hips_cm: 98,
        shoulders_cm: 40,
      };
      await checkFit(SAMPLE_PRODUCT, SAMPLE_AVATAR, cal, 3);

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.calibration).toEqual(cal);
      expect(body.garment_count).toBe(3);
      expect(body.product.product_name).toBe('Test dress');
    });

    it('omits calibration when not provided', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchResponse({ success: true, fit_score: 'moderate' })
      );

      await checkFit(SAMPLE_PRODUCT, SAMPLE_AVATAR);

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.calibration).toBeUndefined();
      expect(body.garment_count).toBeUndefined();
    });

    it('defaults garment_count to 0 when calibration given without count', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchResponse({ success: true, fit_score: 'great' })
      );

      await checkFit(
        SAMPLE_PRODUCT,
        SAMPLE_AVATAR,
        { bust_cm: 90, waist_cm: 70, hips_cm: 96, shoulders_cm: 39 }
      );

      const [, init] = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(init.body as string);
      expect(body.garment_count).toBe(0);
    });

    it('returns failure shape on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('offline')
      );

      const result = await checkFit(SAMPLE_PRODUCT, SAMPLE_AVATAR);

      expect(result.success).toBe(false);
      expect(result.error).toBe('offline');
    });

    it('returns failure shape on HTTP error with server message', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchResponse(
          { message: 'Avatar missing measurements' },
          { ok: false, status: 400 }
        )
      );

      const result = await checkFit(SAMPLE_PRODUCT, SAMPLE_AVATAR);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Avatar missing measurements');
    });

    it('returns failure with generic message when error is non-Error', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce('string-rejection');

      const result = await checkFit(SAMPLE_PRODUCT, SAMPLE_AVATAR);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });
  });

  // ------------------------------------------------------------------
  // calibrateGarment
  // ------------------------------------------------------------------
  describe('calibrateGarment', () => {
    it('returns estimated cm on success', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchResponse({
          success: true,
          estimated_cm: {
            bust_cm: 90,
            waist_cm: 72,
            hips_cm: 96,
            shoulders_cm: 39,
          },
        })
      );

      const result = await calibrateGarment({
        brand: 'ACME',
        size: 'M',
        fit: 'perfect',
        avatar: SAMPLE_AVATAR,
      });

      expect(result.success).toBe(true);
      expect(result.estimated_cm?.bust_cm).toBe(90);
    });

    it('returns failure shape on timeout', async () => {
      const abortErr = new Error('aborted');
      abortErr.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValueOnce(abortErr);

      const result = await calibrateGarment({
        brand: 'ACME',
        size: 'M',
        fit: 'perfect',
        avatar: SAMPLE_AVATAR,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timed out');
    });
  });

  // ------------------------------------------------------------------
  // nudgeBrand
  // ------------------------------------------------------------------
  describe('nudgeBrand', () => {
    it('forwards server response on success', async () => {
      (global.fetch as jest.Mock).mockReturnValueOnce(
        mockFetchResponse({ success: true })
      );

      const result = await nudgeBrand('asos.com', 'Asos');

      expect(result.success).toBe(true);
    });

    it('returns stable failure shape when fetch rejects', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('DNS failure')
      );

      const result = await nudgeBrand('asos.com', 'Asos');

      expect(result).toEqual({ success: false, error: 'Failed to send nudge' });
    });
  });

  // ------------------------------------------------------------------
  // extractBrandFromUrl (pure utility)
  // ------------------------------------------------------------------
  describe('extractBrandFromUrl', () => {
    it('extracts brand from simple domain', () => {
      expect(extractBrandFromUrl('https://asos.com/p/123')).toEqual({
        brandName: 'Asos',
        brandDomain: 'asos.com',
      });
    });

    it('strips www. prefix', () => {
      expect(extractBrandFromUrl('https://www.zalando.co.uk/p/1')).toEqual({
        brandName: 'Zalando',
        brandDomain: 'zalando.co.uk',
      });
    });

    it('returns null on invalid url', () => {
      expect(extractBrandFromUrl('not a url')).toBeNull();
    });

    it('returns null on empty string', () => {
      expect(extractBrandFromUrl('')).toBeNull();
    });
  });
});
