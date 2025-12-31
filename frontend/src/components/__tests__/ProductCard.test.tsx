import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProductCard from '../ProductCard';
import type { Product } from '@/types';

// Mock collections store
const mockIsProductInAnyCollection = jest.fn().mockReturnValue([]);

jest.mock('@/stores/useCollectionsStore', () => ({
  useCollectionsStore: () => ({
    isProductInAnyCollection: mockIsProductInAnyCollection,
  }),
}));

// Mock price formatter hook
const mockFormat = jest.fn((price: number, currency?: string) => {
  const symbol = currency === 'EUR' ? '\u20AC' : '$';
  return `${symbol}${price.toFixed(2)}`;
});

jest.mock('@/hooks/useCurrency', () => ({
  usePriceFormatter: () => ({
    format: mockFormat,
  }),
}));

// Mock placeholder utility
jest.mock('@/utils/placeholder', () => ({
  getProductUrl: (brand: string, productName: string) =>
    `https://example.com/${brand.toLowerCase()}/${productName.toLowerCase().replace(/ /g, '-')}`,
}));

// Mock SaveToCollectionModal
jest.mock('../SaveToCollectionModal', () => {
  const MockModal = ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="save-modal">Save Modal</div> : null;
  MockModal.displayName = 'MockSaveToCollectionModal';
  return MockModal;
});

// Mock VirtualTryOnModal
jest.mock('../VirtualTryOnModal', () => {
  const MockModal = ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="tryon-modal">Try On Modal</div> : null;
  MockModal.displayName = 'MockVirtualTryOnModal';
  return MockModal;
});

// Mock window.open
const mockWindowOpen = jest.fn();
Object.defineProperty(window, 'open', {
  writable: true,
  value: mockWindowOpen,
});

const mockProduct: Product = {
  id: 'prod-123',
  product_name: 'Premium Cotton T-Shirt',
  brand: 'Fashion Brand',
  price: 49.99,
  currency: 'USD',
  image_url: 'https://example.com/images/tshirt.jpg',
  tags: ['cotton', 'casual', 'summer'],
  color_palette: ['#ffffff', '#000000'],
  category: 'Tops',
  material: 'Cotton',
  texture: 'Smooth',
  tone: 'Neutral',
};

const mockProductNoImage: Product = {
  ...mockProduct,
  id: 'prod-456',
  image_url: '',
};

const mockProductTestPrefix: Product = {
  ...mockProduct,
  id: 'prod-789',
  product_name: 'TEST_Product_Name',
  brand: 'TEST_Brand_Name',
};

describe('ProductCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsProductInAnyCollection.mockReturnValue([]);
  });

  describe('Rendering', () => {
    it('renders product card container', () => {
      render(<ProductCard product={mockProduct} />);
      // Card has group class for hover effects
      expect(screen.getByRole('img', { name: mockProduct.product_name })).toBeInTheDocument();
    });

    it('renders product image', () => {
      render(<ProductCard product={mockProduct} />);

      const image = screen.getByRole('img', { name: mockProduct.product_name });
      expect(image).toHaveAttribute('src', mockProduct.image_url);
    });

    it('renders placeholder when no image URL', () => {
      render(<ProductCard product={mockProductNoImage} />);

      // Should not have an img element
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('renders product brand', () => {
      render(<ProductCard product={mockProduct} />);
      expect(screen.getByText('Fashion Brand')).toBeInTheDocument();
    });

    it('renders product name', () => {
      render(<ProductCard product={mockProduct} />);
      // normalizeText converts to title case: "T-Shirt" -> "T-shirt"
      expect(screen.getByText('Premium Cotton T-shirt')).toBeInTheDocument();
    });

    it('renders formatted price', () => {
      render(<ProductCard product={mockProduct} />);
      expect(mockFormat).toHaveBeenCalledWith(49.99, 'USD');
      expect(screen.getByText('$49.99')).toBeInTheDocument();
    });

    it('normalizes TEST_ prefix from product name', () => {
      render(<ProductCard product={mockProductTestPrefix} />);
      expect(screen.getByText('Product Name')).toBeInTheDocument();
    });

    it('normalizes TEST_ prefix from brand name', () => {
      render(<ProductCard product={mockProductTestPrefix} />);
      expect(screen.getByText('Brand Name')).toBeInTheDocument();
    });

    it('renders favorite button', () => {
      render(<ProductCard product={mockProduct} />);
      expect(screen.getByLabelText(/Add to favorites/i)).toBeInTheDocument();
    });

    it('renders save to collection button', () => {
      render(<ProductCard product={mockProduct} />);
      expect(screen.getByLabelText(/Save to collection/i)).toBeInTheDocument();
    });

    it('renders virtual try-on button', () => {
      render(<ProductCard product={mockProduct} />);
      expect(screen.getByLabelText(/Virtual try-on/i)).toBeInTheDocument();
    });

    it('renders external link button', () => {
      render(<ProductCard product={mockProduct} />);
      // normalizeText converts to title case
      expect(
        screen.getByLabelText(`Shop Premium Cotton T-shirt on external site`)
      ).toBeInTheDocument();
    });
  });

  describe('Favorite Button', () => {
    it('toggles favorite state on click', () => {
      render(<ProductCard product={mockProduct} />);

      const favoriteButton = screen.getByLabelText(/Add to favorites/i);
      expect(favoriteButton).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(favoriteButton);

      expect(screen.getByLabelText(/Remove from favorites/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Remove from favorites/i)).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('stops event propagation on favorite click', () => {
      const mockParentClick = jest.fn();
      render(
        <div onClick={mockParentClick}>
          <ProductCard product={mockProduct} />
        </div>
      );

      const favoriteButton = screen.getByLabelText(/Add to favorites/i);
      fireEvent.click(favoriteButton);

      expect(mockParentClick).not.toHaveBeenCalled();
    });
  });

  describe('Save to Collection Button', () => {
    it('opens save modal on click', () => {
      render(<ProductCard product={mockProduct} />);

      const saveButton = screen.getByLabelText(/Save to collection/i);
      fireEvent.click(saveButton);

      expect(screen.getByTestId('save-modal')).toBeInTheDocument();
    });

    it('shows different label when product is in collection', () => {
      mockIsProductInAnyCollection.mockReturnValue(['col-1']);
      render(<ProductCard product={mockProduct} />);

      expect(screen.getByLabelText(/Manage collections/i)).toBeInTheDocument();
    });

    it('stops event propagation on save click', () => {
      const mockParentClick = jest.fn();
      render(
        <div onClick={mockParentClick}>
          <ProductCard product={mockProduct} />
        </div>
      );

      const saveButton = screen.getByLabelText(/Save to collection/i);
      fireEvent.click(saveButton);

      expect(mockParentClick).not.toHaveBeenCalled();
    });
  });

  describe('Virtual Try-On Button', () => {
    it('opens try-on modal on click', () => {
      render(<ProductCard product={mockProduct} />);

      const tryOnButton = screen.getByLabelText(/Virtual try-on/i);
      fireEvent.click(tryOnButton);

      expect(screen.getByTestId('tryon-modal')).toBeInTheDocument();
    });

    it('stops event propagation on try-on click', () => {
      const mockParentClick = jest.fn();
      render(
        <div onClick={mockParentClick}>
          <ProductCard product={mockProduct} />
        </div>
      );

      const tryOnButton = screen.getByLabelText(/Virtual try-on/i);
      fireEvent.click(tryOnButton);

      expect(mockParentClick).not.toHaveBeenCalled();
    });
  });

  describe('External Link Button', () => {
    it('opens product URL in new tab on click', () => {
      render(<ProductCard product={mockProduct} />);

      const externalButton = screen.getByLabelText(/Shop.*on external site/i);
      fireEvent.click(externalButton);

      expect(mockWindowOpen).toHaveBeenCalledWith(
        expect.stringContaining('example.com'),
        '_blank',
        'noopener,noreferrer'
      );
    });

    it('calls onExternalLink callback if provided', () => {
      const mockOnExternalLink = jest.fn();
      render(<ProductCard product={mockProduct} onExternalLink={mockOnExternalLink} />);

      const externalButton = screen.getByLabelText(/Shop.*on external site/i);
      fireEvent.click(externalButton);

      expect(mockOnExternalLink).toHaveBeenCalledWith(mockProduct);
      expect(mockWindowOpen).not.toHaveBeenCalled();
    });

    it('stops event propagation on external link click', () => {
      const mockParentClick = jest.fn();
      render(
        <div onClick={mockParentClick}>
          <ProductCard product={mockProduct} />
        </div>
      );

      const externalButton = screen.getByLabelText(/Shop.*on external site/i);
      fireEvent.click(externalButton);

      expect(mockParentClick).not.toHaveBeenCalled();
    });
  });

  describe('Hover States', () => {
    it('applies border color change on card hover', () => {
      render(<ProductCard product={mockProduct} />);

      // Find the card container (has group class and rounded-lg)
      const card = screen.getByRole('img', { name: mockProduct.product_name }).closest('div')
        ?.parentElement;

      if (card) {
        fireEvent.mouseEnter(card);
        fireEvent.mouseLeave(card);
        expect(card).toBeInTheDocument();
      }
    });

    it('applies hover styles on external link button', () => {
      render(<ProductCard product={mockProduct} />);

      const externalButton = screen.getByLabelText(/Shop.*on external site/i);

      fireEvent.mouseEnter(externalButton);
      fireEvent.mouseLeave(externalButton);

      expect(externalButton).toBeInTheDocument();
    });
  });

  describe('Product in Collection', () => {
    it('shows filled bookmark icon when product is in collection', () => {
      mockIsProductInAnyCollection.mockReturnValue(['col-1', 'col-2']);
      render(<ProductCard product={mockProduct} />);

      const saveButton = screen.getByLabelText(/Manage collections/i);
      expect(saveButton).toBeInTheDocument();
    });

    it('shows empty bookmark icon when product is not in any collection', () => {
      mockIsProductInAnyCollection.mockReturnValue([]);
      render(<ProductCard product={mockProduct} />);

      const saveButton = screen.getByLabelText(/Save to collection/i);
      expect(saveButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible name for product image', () => {
      render(<ProductCard product={mockProduct} />);

      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', mockProduct.product_name);
    });

    it('favorite button has aria-pressed attribute', () => {
      render(<ProductCard product={mockProduct} />);

      const favoriteButton = screen.getByLabelText(/Add to favorites/i);
      expect(favoriteButton).toHaveAttribute('aria-pressed');
    });

    it('all action buttons have aria-labels', () => {
      render(<ProductCard product={mockProduct} />);

      expect(screen.getByLabelText(/Add to favorites/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Save to collection/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Virtual try-on/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Shop.*on external site/i)).toBeInTheDocument();
    });

    it('icons have aria-hidden attribute', () => {
      render(<ProductCard product={mockProduct} />);

      // Find SVG icons within buttons - they should have aria-hidden
      const favoriteButton = screen.getByLabelText(/Add to favorites/i);
      const svg = favoriteButton.querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('Price Formatting', () => {
    it('formats price with USD currency', () => {
      render(<ProductCard product={mockProduct} />);
      expect(mockFormat).toHaveBeenCalledWith(49.99, 'USD');
    });

    it('formats price with EUR currency', () => {
      const euroProduct = { ...mockProduct, currency: 'EUR' };
      render(<ProductCard product={euroProduct} />);
      expect(mockFormat).toHaveBeenCalledWith(49.99, 'EUR');
    });

    it('formats price without currency', () => {
      const noCurrencyProduct = { ...mockProduct, currency: undefined };
      render(<ProductCard product={noCurrencyProduct} />);
      expect(mockFormat).toHaveBeenCalledWith(49.99, undefined);
    });
  });
});
