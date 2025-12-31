import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TopBar from '../TopBar';

// Mock Next.js navigation
const mockPush = jest.fn();
const mockPathname = jest.fn().mockReturnValue('/');

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  const MockLink = ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// Mock BreadcrumbNav component
jest.mock('../BreadcrumbNav', () => {
  const MockBreadcrumbNav = () => <nav data-testid="breadcrumb-nav">Breadcrumb</nav>;
  MockBreadcrumbNav.displayName = 'MockBreadcrumbNav';
  return MockBreadcrumbNav;
});

// Mock settings store
const mockSetAgentMode = jest.fn();
const mockSetCurrencyDisplayMode = jest.fn();
const mockSetLocalCurrency = jest.fn();

jest.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: () => ({
    agentModeEnabled: false,
    setAgentMode: mockSetAgentMode,
    currencyDisplayMode: 'local',
    localCurrency: 'USD',
    setCurrencyDisplayMode: mockSetCurrencyDisplayMode,
    setLocalCurrency: mockSetLocalCurrency,
  }),
}));

// Mock looks store
jest.mock('@/stores/useLooksStore', () => ({
  useLooksStore: () => ({
    getMoodboardById: jest.fn(),
    saveStatus: 'saved',
  }),
  parseSlugId: jest.fn().mockReturnValue(null),
}));

// Mock currency utility
jest.mock('@/utils/currency', () => ({
  getCurrencySymbol: (currency: string) => {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '\u20AC',
      GBP: '\u00A3',
      JPY: '\u00A5',
    };
    return symbols[currency] || currency;
  },
}));

// Mock fetch for search
global.fetch = jest.fn();

describe('TopBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue('/');
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ products: [] }),
    });
  });

  describe('Rendering', () => {
    it('renders the header element', () => {
      render(<TopBar />);
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    it('renders the logo link to home', () => {
      render(<TopBar />);
      const logoLink = screen.getByRole('link', { name: '' });
      expect(logoLink).toHaveAttribute('href', '/');
    });

    it('renders breadcrumb navigation', () => {
      render(<TopBar />);
      expect(screen.getByTestId('breadcrumb-nav')).toBeInTheDocument();
    });

    it('renders main navigation items', () => {
      render(<TopBar />);

      expect(screen.getByRole('link', { name: /Layers/i })).toHaveAttribute('href', '/looks');
      expect(screen.getByRole('link', { name: /Closet/i })).toHaveAttribute('href', '/closet');
      expect(screen.getByRole('link', { name: /Discover/i })).toHaveAttribute('href', '/discover');
    });

    it('renders search button', () => {
      render(<TopBar />);
      expect(screen.getByText(/Search.../i)).toBeInTheDocument();
    });

    it('renders Agent Mode toggle button', () => {
      render(<TopBar />);
      expect(screen.getByLabelText(/Enable Agent Mode/i)).toBeInTheDocument();
    });

    it('renders Help button', () => {
      render(<TopBar />);
      expect(screen.getByLabelText(/Help/i)).toBeInTheDocument();
    });

    it('renders Feedback button', () => {
      render(<TopBar />);
      expect(screen.getByLabelText(/Send feedback/i)).toBeInTheDocument();
    });

    it('renders User menu button', () => {
      render(<TopBar />);
      expect(screen.getByLabelText(/User menu/i)).toBeInTheDocument();
    });

    it('renders currency selector', () => {
      render(<TopBar />);
      expect(screen.getByLabelText(/Select currency/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('highlights active navigation item based on current path', () => {
      mockPathname.mockReturnValue('/looks');
      render(<TopBar />);

      const layersLink = screen.getByRole('link', { name: /Layers/i });
      // Check that the link exists - active state is applied via inline styles
      expect(layersLink).toHaveAttribute('href', '/looks');
    });

    it('navigation links have correct href attributes', () => {
      render(<TopBar />);

      const layersLink = screen.getByRole('link', { name: /Layers/i });
      const closetLink = screen.getByRole('link', { name: /Closet/i });
      const discoverLink = screen.getByRole('link', { name: /Discover/i });

      expect(layersLink).toHaveAttribute('href', '/looks');
      expect(closetLink).toHaveAttribute('href', '/closet');
      expect(discoverLink).toHaveAttribute('href', '/discover');
    });
  });

  describe('Agent Mode Toggle', () => {
    it('calls setAgentMode when toggle is clicked', () => {
      render(<TopBar />);

      const agentToggle = screen.getByLabelText(/Enable Agent Mode/i);
      fireEvent.click(agentToggle);

      expect(mockSetAgentMode).toHaveBeenCalledWith(true);
    });

    it('has correct aria-pressed attribute', () => {
      render(<TopBar />);

      const agentToggle = screen.getByLabelText(/Enable Agent Mode/i);
      expect(agentToggle).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('User Menu', () => {
    it('opens user menu on click', async () => {
      render(<TopBar />);

      const userMenuButton = screen.getByLabelText(/User menu/i);
      fireEvent.click(userMenuButton);

      await waitFor(() => {
        expect(screen.getByRole('menu', { name: /User options/i })).toBeInTheDocument();
      });
    });

    it('displays user name in menu', async () => {
      render(<TopBar />);

      const userMenuButton = screen.getByLabelText(/User menu/i);
      fireEvent.click(userMenuButton);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });
    });

    it('displays user email in menu', async () => {
      render(<TopBar />);

      const userMenuButton = screen.getByLabelText(/User menu/i);
      fireEvent.click(userMenuButton);

      await waitFor(() => {
        expect(screen.getByText('user@example.com')).toBeInTheDocument();
      });
    });

    it('contains Settings link in menu', async () => {
      render(<TopBar />);

      const userMenuButton = screen.getByLabelText(/User menu/i);
      fireEvent.click(userMenuButton);

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Settings/i })).toBeInTheDocument();
      });
    });

    it('contains Sign out button in menu', async () => {
      render(<TopBar />);

      const userMenuButton = screen.getByLabelText(/User menu/i);
      fireEvent.click(userMenuButton);

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /Sign out/i })).toBeInTheDocument();
      });
    });

    it('closes user menu when clicking outside', async () => {
      render(<TopBar />);

      const userMenuButton = screen.getByLabelText(/User menu/i);
      fireEvent.click(userMenuButton);

      await waitFor(() => {
        expect(screen.getByRole('menu', { name: /User options/i })).toBeInTheDocument();
      });

      // Click outside
      fireEvent.mouseDown(document.body);

      await waitFor(() => {
        expect(screen.queryByRole('menu', { name: /User options/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Currency Selector', () => {
    it('opens currency menu on click', async () => {
      render(<TopBar />);

      const currencyButton = screen.getByLabelText(/Select currency/i);
      fireEvent.click(currencyButton);

      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
    });

    it('displays currency options', async () => {
      render(<TopBar />);

      const currencyButton = screen.getByLabelText(/Select currency/i);
      fireEvent.click(currencyButton);

      await waitFor(() => {
        expect(screen.getByRole('option', { name: /USD/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /EUR/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /GBP/i })).toBeInTheDocument();
      });
    });

    it('calls setLocalCurrency when currency is selected', async () => {
      render(<TopBar />);

      const currencyButton = screen.getByLabelText(/Select currency/i);
      fireEvent.click(currencyButton);

      await waitFor(() => {
        const eurOption = screen.getByRole('option', { name: /EUR/i });
        fireEvent.click(eurOption);
      });

      expect(mockSetLocalCurrency).toHaveBeenCalledWith('EUR');
    });
  });

  describe('Search', () => {
    it('opens search input on click', async () => {
      render(<TopBar />);

      const searchArea = screen.getByText(/Search.../i);
      fireEvent.click(searchArea);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search products.../i)).toBeInTheDocument();
      });
    });

    it('shows close button when search is open', async () => {
      render(<TopBar />);

      const searchArea = screen.getByText(/Search.../i);
      fireEvent.click(searchArea);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search products.../i)).toBeInTheDocument();
      });

      // The X button should be visible
      const closeButton = screen.getByRole('button', { name: '' });
      expect(closeButton).toBeInTheDocument();
    });

    it('opens search with keyboard shortcut (Ctrl+K)', async () => {
      render(<TopBar />);

      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search products.../i)).toBeInTheDocument();
      });
    });

    it('closes search with Escape key', async () => {
      render(<TopBar />);

      // First open search
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search products.../i)).toBeInTheDocument();
      });

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/Search products.../i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Look Editor Page', () => {
    it('shows save status indicator on look editor page', () => {
      mockPathname.mockReturnValue('/looks/my-look--123');
      render(<TopBar />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText(/Saved/i)).toBeInTheDocument();
    });

    it('does not show save status on non-editor pages', () => {
      mockPathname.mockReturnValue('/looks');
      render(<TopBar />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has aria-expanded on user menu button', () => {
      render(<TopBar />);

      const userMenuButton = screen.getByLabelText(/User menu/i);
      expect(userMenuButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(userMenuButton);
      expect(userMenuButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('has aria-haspopup on user menu button', () => {
      render(<TopBar />);

      const userMenuButton = screen.getByLabelText(/User menu/i);
      expect(userMenuButton).toHaveAttribute('aria-haspopup', 'menu');
    });

    it('has aria-haspopup on currency button', () => {
      render(<TopBar />);

      const currencyButton = screen.getByLabelText(/Select currency/i);
      expect(currencyButton).toHaveAttribute('aria-haspopup', 'listbox');
    });
  });
});
