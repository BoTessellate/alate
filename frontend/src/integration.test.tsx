// End-to-end integration tests for critical user journeys
import { TestAppI18nProvider } from '@canva/app-i18n-kit';
import { TestAppUiProvider } from '@canva/app-ui-kit';
import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { App } from './App';
import { scrapeProductUrl } from './utils/urlScraper';
import { getCurrentPageContext } from '@canva/design';
import { addElementAtPoint, openDesign } from '@canva/design';
import { upload } from '@canva/asset';

jest.mock('./utils/urlScraper');
jest.mock('@canva/design');
jest.mock('@canva/asset');
jest.mock('@canva/user', () => ({
  getTemporaryUploadUrl: jest.fn().mockResolvedValue('https://temp-upload.url'),
}));

function renderInTestProvider(node: ReactNode) {
  return render(
    <TestAppI18nProvider>
      <TestAppUiProvider>{node}</TestAppUiProvider>
    </TestAppI18nProvider>
  );
}

describe('End-to-End User Journeys', () => {
  const mockScrapeProductUrl = jest.mocked(scrapeProductUrl);
  const mockGetCurrentPageContext = jest.mocked(getCurrentPageContext);
  const mockAddElementAtPoint = jest.mocked(addElementAtPoint);
  const mockOpenDesign = jest.mocked(openDesign);
  const mockUpload = jest.mocked(upload);

  const mockPageContext = {
    dimensions: {
      width: 1200,
      height: 800,
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockGetCurrentPageContext.mockResolvedValue(mockPageContext as any);

    mockUpload.mockResolvedValue({
      ref: 'mock-image-ref' as any,
      whenUploaded: () => Promise.resolve(),
    });

    mockAddElementAtPoint.mockResolvedValue({
      id: 'mock-element-id',
      type: 'image',
    } as any);

    mockOpenDesign.mockImplementation(async (_options, callback) => {
      await callback({
        page: {
          elements: {
            toArray: () => [
              { type: 'shape', id: '1', left: 0, top: 0 },
              { type: 'shape', id: '2', left: 100, top: 100 },
              { type: 'text', id: '3', left: 200, top: 200 },
            ],
          },
        } as any,
        helpers: {
          group: jest.fn().mockResolvedValue(undefined),
        } as any,
        sync: jest.fn().mockResolvedValue(undefined),
      } as any);
    });
  });

  describe('Journey 1: Scrape and Add Product with All Features', () => {
    it('should complete full flow: scrape → customize → add to canvas → see success', async () => {
      const mockScrapedData = {
        title: 'Designer Chair',
        brandName: 'Modern Living',
        price: '299.99',
        currency: 'USD',
        imageUrl: 'https://example.com/chair.jpg',
      };

      mockScrapeProductUrl.mockResolvedValue(mockScrapedData);

      const { getByPlaceholderText, getByRole, getByText, getByLabelText } = renderInTestProvider(<App />);

      // STEP 1: Enter product URL
      const urlInput = getByPlaceholderText('https://example.com/product');
      fireEvent.change(urlInput, { target: { value: 'https://store.com/chair' } });

      // STEP 2: Scrape product
      const scrapeButton = getByRole('button', { name: /Scrape Product Details/i });
      fireEvent.click(scrapeButton);

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalledWith('https://store.com/chair');
      });

      // STEP 3: Verify product preview appears
      await waitFor(() => {
        expect(getByText('Modern Living')).toBeInTheDocument();
        expect(getByText('USD 299.99')).toBeInTheDocument();
      });

      // STEP 4: Mark as hero product
      const heroCheckbox = getByLabelText(/Mark as Hero Product/i);
      fireEvent.click(heroCheckbox);

      // STEP 5: Add to canvas
      const addButton = getByRole('button', { name: /Add to Canvas/i });
      fireEvent.click(addButton);

      // STEP 6: Verify canvas operations
      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledWith(
          expect.objectContaining({
            url: 'https://example.com/chair.jpg',
          })
        );

        expect(mockAddElementAtPoint).toHaveBeenCalledTimes(3); // image, brand, price
        expect(mockOpenDesign).toHaveBeenCalled(); // for grouping
      });

      // STEP 7: Verify success message with background removal instructions
      await waitFor(() => {
        expect(getByText('✓ Product added successfully!')).toBeInTheDocument();
        expect(getByText('To remove the background:')).toBeInTheDocument();
        expect(getByText('1. Select the image on canvas')).toBeInTheDocument();
      });
    });
  });

  describe('Journey 2: Quick Product Addition Without Price', () => {
    it('should add product without price tag when checkbox unchecked', async () => {
      const mockScrapedData = {
        brandName: 'Tech Co',
        price: '599.00',
        currency: 'EUR',
        imageUrl: 'https://example.com/gadget.jpg',
      };

      mockScrapeProductUrl.mockResolvedValue(mockScrapedData);

      const { getByPlaceholderText, getByRole, getByLabelText } = renderInTestProvider(<App />);

      // Scrape product
      const urlInput = getByPlaceholderText('https://example.com/product');
      fireEvent.change(urlInput, { target: { value: 'https://store.com/gadget' } });
      fireEvent.click(getByRole('button', { name: /Scrape Product Details/i }));

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalled();
      });

      // Uncheck price
      const priceCheckbox = getByLabelText(/Include price tag/i);
      fireEvent.click(priceCheckbox);

      // Add to canvas
      fireEvent.click(getByRole('button', { name: /Add to Canvas/i }));

      await waitFor(() => {
        // Should add image and brand only (2 elements, not 3)
        const calls = (mockAddElementAtPoint as jest.Mock).mock.calls;
        expect(calls.length).toBe(2);

        // Verify no price element was added
        const hasPrice = calls.some(call =>
          call[0].children && call[0].children[0].includes('EUR')
        );
        expect(hasPrice).toBe(false);
      });
    });
  });

  describe('Journey 3: Layout Rearrangement', () => {
    it('should rearrange existing items into new layout', async () => {
      const { getByRole, getByText, getByLabelText } = renderInTestProvider(<App />);

      // Wait for initial grid initialization
      await waitFor(() => {
        expect(mockGetCurrentPageContext).toHaveBeenCalled();
      });

      // STEP 1: Change layout to circular
      const layoutSelect = getByRole('button', { name: /Grid/i });
      fireEvent.click(layoutSelect);
      fireEvent.click(getByRole('option', { name: /Circular/i }));

      await waitFor(() => {
        expect(getByText(/Circular layout ready/i)).toBeInTheDocument();
      });

      // STEP 2: Rearrange items
      const rearrangeButton = getByRole('button', { name: /Rearrange Items on Canvas/i });
      fireEvent.click(rearrangeButton);

      // STEP 3: Verify rearrangement completed
      await waitFor(() => {
        expect(getByText('Items rearranged successfully!')).toBeInTheDocument();
      });

      // STEP 4: Verify openDesign was called to access canvas elements
      expect(mockOpenDesign).toHaveBeenCalled();
    });

    it('should adjust grid dimensions and rearrange', async () => {
      const { getByRole, getByLabelText } = renderInTestProvider(<App />);

      await waitFor(() => {
        expect(mockGetCurrentPageContext).toHaveBeenCalled();
      });

      // Change to 4x4 grid
      const columnsInput = getByLabelText('Columns') as HTMLInputElement;
      const rowsInput = getByLabelText('Rows') as HTMLInputElement;

      fireEvent.change(columnsInput, { target: { value: '4' } });
      fireEvent.change(rowsInput, { target: { value: '4' } });

      // Rearrange
      const rearrangeButton = getByRole('button', { name: /Rearrange Items on Canvas/i });
      fireEvent.click(rearrangeButton);

      await waitFor(() => {
        expect(mockOpenDesign).toHaveBeenCalled();
      });
    });
  });

  describe('Journey 4: Multiple Product Addition Workflow', () => {
    it('should add multiple products sequentially', async () => {
      const products = [
        {
          brandName: 'Brand A',
          imageUrl: 'https://example.com/a.jpg',
          price: '100',
          currency: 'USD',
        },
        {
          brandName: 'Brand B',
          imageUrl: 'https://example.com/b.jpg',
          price: '200',
          currency: 'USD',
        },
      ];

      const { getByPlaceholderText, getByRole } = renderInTestProvider(<App />);

      for (let i = 0; i < products.length; i++) {
        mockScrapeProductUrl.mockResolvedValueOnce(products[i]);

        // Scrape product
        const urlInput = getByPlaceholderText('https://example.com/product');
        fireEvent.change(urlInput, { target: { value: `https://store.com/product${i}` } });
        fireEvent.click(getByRole('button', { name: /Scrape Product Details/i }));

        await waitFor(() => {
          expect(mockScrapeProductUrl).toHaveBeenCalledWith(`https://store.com/product${i}`);
        });

        // Add to canvas
        const addButton = getByRole('button', { name: /Add to Canvas/i });
        fireEvent.click(addButton);

        await waitFor(() => {
          expect(mockAddElementAtPoint).toHaveBeenCalled();
        });

        // Reset for next product
        const resetButton = getByRole('button', { name: /Scrape Another Product/i });
        fireEvent.click(resetButton);
      }

      // Verify both products were added
      expect(mockAddElementAtPoint).toHaveBeenCalledTimes(6); // 3 elements per product × 2 products
    });
  });

  describe('Journey 5: Error Recovery', () => {
    it('should recover from scraping error and allow retry', async () => {
      mockScrapeProductUrl
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          brandName: 'Success Brand',
          imageUrl: 'https://example.com/success.jpg',
        });

      const { getByPlaceholderText, getByRole } = renderInTestProvider(<App />);

      const urlInput = getByPlaceholderText('https://example.com/product');
      const scrapeButton = getByRole('button', { name: /Scrape Product Details/i });

      // First attempt fails
      fireEvent.change(urlInput, { target: { value: 'https://store.com/product' } });
      fireEvent.click(scrapeButton);

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalledTimes(1);
      });

      // Button should still be clickable
      expect(scrapeButton).not.toBeDisabled();

      // Second attempt succeeds
      fireEvent.click(scrapeButton);

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalledTimes(2);
      });
    });

    it('should recover from canvas addition error', async () => {
      mockScrapeProductUrl.mockResolvedValue({
        brandName: 'Test Brand',
        imageUrl: 'https://example.com/test.jpg',
      });

      mockUpload
        .mockRejectedValueOnce(new Error('Upload failed'))
        .mockResolvedValueOnce({
          ref: 'success-ref' as any,
          whenUploaded: () => Promise.resolve(),
        });

      const { getByPlaceholderText, getByRole } = renderInTestProvider(<App />);

      // Scrape
      fireEvent.change(getByPlaceholderText('https://example.com/product'), {
        target: { value: 'https://store.com/product' },
      });
      fireEvent.click(getByRole('button', { name: /Scrape Product Details/i }));

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalled();
      });

      const addButton = getByRole('button', { name: /Add to Canvas/i });

      // First add attempt fails
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(1);
      });

      // Should be able to retry
      await waitFor(() => {
        expect(addButton).not.toBeDisabled();
      });

      // Second attempt succeeds
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(2);
      });
    });
  });
});
