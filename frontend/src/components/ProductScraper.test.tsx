// Integration tests for ProductScraper component
import { TestAppI18nProvider } from '@canva/app-i18n-kit';
import { TestAppUiProvider } from '@canva/app-ui-kit';
import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ProductScraper } from './ProductScraper';
import { scrapeProductUrl } from '../utils/urlScraper';
import { getNextAvailableCell, initializeGrid } from '../utils/gridManager';
import { addElementAtPoint, openDesign } from '@canva/design';
import { upload } from '@canva/asset';

jest.mock('../utils/urlScraper');
jest.mock('../utils/gridManager');
jest.mock('@canva/design');
jest.mock('@canva/asset');

function renderInTestProvider(node: ReactNode) {
  return render(
    <TestAppI18nProvider>
      <TestAppUiProvider>{node}</TestAppUiProvider>
    </TestAppI18nProvider>
  );
}

describe('ProductScraper Component', () => {
  const mockScrapeProductUrl = jest.mocked(scrapeProductUrl);
  const mockGetNextAvailableCell = jest.mocked(getNextAvailableCell);
  const mockAddElementAtPoint = jest.mocked(addElementAtPoint);
  const mockOpenDesign = jest.mocked(openDesign);
  const mockUpload = jest.mocked(upload);

  beforeEach(() => {
    jest.resetAllMocks();

    // Mock default grid cell
    mockGetNextAvailableCell.mockReturnValue({
      x: 100,
      y: 100,
      width: 400,
      height: 400,
      rotation: 0,
    });

    // Mock upload response
    mockUpload.mockResolvedValue({
      ref: 'mock-image-ref' as any,
      whenUploaded: () => Promise.resolve(),
    });

    // Mock addElementAtPoint responses
    mockAddElementAtPoint.mockResolvedValue({
      id: 'mock-element-id',
      type: 'image',
    } as any);

    // Mock openDesign with sync function
    mockOpenDesign.mockImplementation(async (_options, callback) => {
      await callback({
        page: {} as any,
        helpers: {
          group: jest.fn().mockResolvedValue(undefined),
        } as any,
        sync: jest.fn().mockResolvedValue(undefined),
      } as any);
    });
  });

  describe('Initial State', () => {
    it('should render with tip box', () => {
      const { getByText } = renderInTestProvider(<ProductScraper />);

      expect(getByText('💡 Pro Tip: Use Background Removal for a clean, professional look')).toBeInTheDocument();
    });

    it('should render URL input field', () => {
      const { getByPlaceholderText } = renderInTestProvider(<ProductScraper />);

      const input = getByPlaceholderText('https://example.com/product');
      expect(input).toBeInTheDocument();
    });

    it('should render scrape button', () => {
      const { getByRole } = renderInTestProvider(<ProductScraper />);

      const button = getByRole('button', { name: /Scrape Product Details/i });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled(); // Disabled when no URL
    });
  });

  describe('Product Scraping Flow', () => {
    const mockScrapedData = {
      title: 'Test Product',
      brandName: 'Test Brand',
      price: '99.99',
      currency: 'USD',
      imageUrl: 'https://example.com/image.jpg',
    };

    it('should scrape product data when button clicked', async () => {
      mockScrapeProductUrl.mockResolvedValue(mockScrapedData);

      const { getByPlaceholderText, getByRole, getByText } = renderInTestProvider(<ProductScraper />);

      // Enter URL
      const input = getByPlaceholderText('https://example.com/product');
      fireEvent.change(input, { target: { value: 'https://example.com/product' } });

      // Click scrape button
      const scrapeButton = getByRole('button', { name: /Scrape Product Details/i });
      fireEvent.click(scrapeButton);

      // Wait for scraping to complete
      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalledWith('https://example.com/product');
      });

      // Check scraped data is displayed
      await waitFor(() => {
        expect(getByText('Test Brand')).toBeInTheDocument();
        expect(getByText('USD 99.99')).toBeInTheDocument();
      });
    });

    it('should scrape on Enter key press', async () => {
      mockScrapeProductUrl.mockResolvedValue(mockScrapedData);

      const { getByPlaceholderText } = renderInTestProvider(<ProductScraper />);

      const input = getByPlaceholderText('https://example.com/product');
      fireEvent.change(input, { target: { value: 'https://example.com/product' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalledWith('https://example.com/product');
      });
    });

    it('should show loading state during scraping', async () => {
      let resolvePromise: any;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockScrapeProductUrl.mockReturnValue(promise as any);

      const { getByPlaceholderText, getByRole, getByText } = renderInTestProvider(<ProductScraper />);

      const input = getByPlaceholderText('https://example.com/product');
      fireEvent.change(input, { target: { value: 'https://example.com/product' } });

      const scrapeButton = getByRole('button', { name: /Scrape Product Details/i });
      fireEvent.click(scrapeButton);

      // Check loading state
      expect(getByText('Scraping...')).toBeInTheDocument();
      expect(getByText('Fetching product details...')).toBeInTheDocument();

      // Resolve promise
      resolvePromise(mockScrapedData);
    });

    it('should display product preview after scraping', async () => {
      mockScrapeProductUrl.mockResolvedValue(mockScrapedData);

      const { getByPlaceholderText, getByRole, getByAltText } = renderInTestProvider(<ProductScraper />);

      const input = getByPlaceholderText('https://example.com/product');
      fireEvent.change(input, { target: { value: 'https://example.com/product' } });

      const scrapeButton = getByRole('button', { name: /Scrape Product Details/i });
      fireEvent.click(scrapeButton);

      await waitFor(() => {
        const preview = getByAltText('Product preview');
        expect(preview).toBeInTheDocument();
        expect(preview).toHaveAttribute('src', 'https://example.com/image.jpg');
      });
    });
  });

  describe('Add to Canvas Flow', () => {
    const mockScrapedData = {
      brandName: 'Test Brand',
      price: '99.99',
      currency: 'USD',
      imageUrl: 'https://example.com/image.jpg',
    };

    beforeEach(async () => {
      mockScrapeProductUrl.mockResolvedValue(mockScrapedData);
    });

    it('should add product to canvas with all elements', async () => {
      const { getByPlaceholderText, getByRole } = renderInTestProvider(<ProductScraper />);

      // Scrape product first
      const input = getByPlaceholderText('https://example.com/product');
      fireEvent.change(input, { target: { value: 'https://example.com/product' } });
      const scrapeButton = getByRole('button', { name: /Scrape Product Details/i });
      fireEvent.click(scrapeButton);

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalled();
      });

      // Click "Add to Canvas"
      const addButton = getByRole('button', { name: /Add to Canvas/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        // Verify upload was called
        expect(mockUpload).toHaveBeenCalledWith({
          type: 'image',
          mimeType: 'image/jpeg',
          url: 'https://example.com/image.jpg',
          thumbnailUrl: 'https://example.com/image.jpg',
        });

        // Verify image element was added
        expect(mockAddElementAtPoint).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'image',
            ref: 'mock-image-ref',
          })
        );

        // Verify brand text element was added
        expect(mockAddElementAtPoint).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'text',
            children: ['Test Brand'],
          })
        );

        // Verify price text element was added
        expect(mockAddElementAtPoint).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'text',
            children: ['USD 99.99'],
          })
        );

        // Verify grouping was called
        expect(mockOpenDesign).toHaveBeenCalled();
      });
    });

    it('should use hero sizing when hero checkbox is selected', async () => {
      const { getByPlaceholderText, getByRole, getByLabelText } = renderInTestProvider(<ProductScraper />);

      // Scrape product
      const input = getByPlaceholderText('https://example.com/product');
      fireEvent.change(input, { target: { value: 'https://example.com/product' } });
      fireEvent.click(getByRole('button', { name: /Scrape Product Details/i }));

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalled();
      });

      // Enable hero mode
      const heroCheckbox = getByLabelText(/Mark as Hero Product/i);
      fireEvent.click(heroCheckbox);

      // Add to canvas
      const addButton = getByRole('button', { name: /Add to Canvas/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        // Verify hero sizing was requested
        expect(mockGetNextAvailableCell).toHaveBeenCalledWith(true);
      });
    });

    it('should exclude price when price checkbox is unchecked', async () => {
      const { getByPlaceholderText, getByRole, getByLabelText } = renderInTestProvider(<ProductScraper />);

      // Scrape product
      const input = getByPlaceholderText('https://example.com/product');
      fireEvent.change(input, { target: { value: 'https://example.com/product' } });
      fireEvent.click(getByRole('button', { name: /Scrape Product Details/i }));

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalled();
      });

      // Disable price
      const priceCheckbox = getByLabelText(/Include price tag/i);
      fireEvent.click(priceCheckbox); // Uncheck (it's checked by default)

      // Add to canvas
      const addButton = getByRole('button', { name: /Add to Canvas/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        // Verify price element was NOT added
        const priceCalls = (mockAddElementAtPoint as jest.Mock).mock.calls.filter(
          call => call[0].children && call[0].children[0].includes('USD')
        );
        expect(priceCalls.length).toBe(0);
      });
    });

    it('should show success message after adding to canvas', async () => {
      const { getByPlaceholderText, getByRole, getByText } = renderInTestProvider(<ProductScraper />);

      // Scrape and add
      const input = getByPlaceholderText('https://example.com/product');
      fireEvent.change(input, { target: { value: 'https://example.com/product' } });
      fireEvent.click(getByRole('button', { name: /Scrape Product Details/i }));

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalled();
      });

      const addButton = getByRole('button', { name: /Add to Canvas/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(getByText('✓ Product added successfully!')).toBeInTheDocument();
        expect(getByText('To remove the background:')).toBeInTheDocument();
        expect(getByText('1. Select the image on canvas')).toBeInTheDocument();
        expect(getByText('2. Click "Edit Image" in toolbar')).toBeInTheDocument();
        expect(getByText('3. Choose "Background Remover"')).toBeInTheDocument();
      });
    });
  });

  describe('Reset Flow', () => {
    const mockScrapedData = {
      brandName: 'Test Brand',
      price: '99.99',
      currency: 'USD',
      imageUrl: 'https://example.com/image.jpg',
    };

    it('should reset form when "Scrape Another Product" is clicked', async () => {
      mockScrapeProductUrl.mockResolvedValue(mockScrapedData);

      const { getByPlaceholderText, getByRole, queryByText } = renderInTestProvider(<ProductScraper />);

      // Scrape product
      const input = getByPlaceholderText('https://example.com/product') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'https://example.com/product' } });
      fireEvent.click(getByRole('button', { name: /Scrape Product Details/i }));

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalled();
      });

      // Click reset
      const resetButton = getByRole('button', { name: /Scrape Another Product/i });
      fireEvent.click(resetButton);

      // Verify form is cleared
      expect(input.value).toBe('');
      expect(queryByText('Test Brand')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle scraping errors gracefully', async () => {
      mockScrapeProductUrl.mockRejectedValue(new Error('Network error'));

      const { getByPlaceholderText, getByRole } = renderInTestProvider(<ProductScraper />);

      const input = getByPlaceholderText('https://example.com/product');
      fireEvent.change(input, { target: { value: 'https://example.com/product' } });

      const scrapeButton = getByRole('button', { name: /Scrape Product Details/i });
      fireEvent.click(scrapeButton);

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalled();
      });

      // App should still be functional
      expect(scrapeButton).not.toBeDisabled();
    });

    it('should handle canvas addition errors gracefully', async () => {
      mockScrapeProductUrl.mockResolvedValue({
        brandName: 'Test Brand',
        imageUrl: 'https://example.com/image.jpg',
      });

      mockUpload.mockRejectedValue(new Error('Upload failed'));

      const { getByPlaceholderText, getByRole } = renderInTestProvider(<ProductScraper />);

      // Scrape product
      const input = getByPlaceholderText('https://example.com/product');
      fireEvent.change(input, { target: { value: 'https://example.com/product' } });
      fireEvent.click(getByRole('button', { name: /Scrape Product Details/i }));

      await waitFor(() => {
        expect(mockScrapeProductUrl).toHaveBeenCalled();
      });

      // Try to add to canvas
      const addButton = getByRole('button', { name: /Add to Canvas/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(mockUpload).toHaveBeenCalled();
      });

      // Button should be enabled again after error
      await waitFor(() => {
        expect(addButton).not.toBeDisabled();
      });
    });
  });
});
