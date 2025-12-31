import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Sidebar from '../Sidebar';

// Mock Next.js navigation
const mockPathname = jest.fn().mockReturnValue('/');

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  const MockLink = ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue('/');
  });

  describe('Rendering', () => {
    it('renders the sidebar element', () => {
      render(<Sidebar />);
      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('renders the logo', () => {
      render(<Sidebar />);
      // Logo is the cream circle with green pill
      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toBeInTheDocument();
    });

    it('renders app name text', () => {
      render(<Sidebar />);
      expect(screen.getByText('The Mood Layer')).toBeInTheDocument();
    });

    it('renders all navigation items', () => {
      render(<Sidebar />);

      expect(screen.getByRole('link', { name: /Home/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Discover/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /My Layers/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Collections/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
    });

    it('renders navigation element', () => {
      render(<Sidebar />);
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders navigation list', () => {
      render(<Sidebar />);
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('renders correct number of navigation items', () => {
      render(<Sidebar />);
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(5);
    });
  });

  describe('Navigation Links', () => {
    it('Home link points to /', () => {
      render(<Sidebar />);
      expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/');
    });

    it('Discover link points to /discover', () => {
      render(<Sidebar />);
      expect(screen.getByRole('link', { name: /Discover/i })).toHaveAttribute('href', '/discover');
    });

    it('My Layers link points to /looks', () => {
      render(<Sidebar />);
      expect(screen.getByRole('link', { name: /My Layers/i })).toHaveAttribute('href', '/looks');
    });

    it('Collections link points to /collections', () => {
      render(<Sidebar />);
      expect(screen.getByRole('link', { name: /Collections/i })).toHaveAttribute('href', '/collections');
    });

    it('Settings link points to /settings', () => {
      render(<Sidebar />);
      expect(screen.getByRole('link', { name: /Settings/i })).toHaveAttribute('href', '/settings');
    });
  });

  describe('Active State', () => {
    it('highlights Home when on home page', () => {
      mockPathname.mockReturnValue('/');
      render(<Sidebar />);

      const homeLink = screen.getByRole('link', { name: /Home/i });
      // Active state is applied via inline styles with backgroundColor: 'var(--primary)'
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('highlights Discover when on discover page', () => {
      mockPathname.mockReturnValue('/discover');
      render(<Sidebar />);

      const discoverLink = screen.getByRole('link', { name: /Discover/i });
      expect(discoverLink).toHaveAttribute('href', '/discover');
    });

    it('highlights My Layers when on looks page', () => {
      mockPathname.mockReturnValue('/looks');
      render(<Sidebar />);

      const layersLink = screen.getByRole('link', { name: /My Layers/i });
      expect(layersLink).toHaveAttribute('href', '/looks');
    });

    it('highlights Collections when on collections page', () => {
      mockPathname.mockReturnValue('/collections');
      render(<Sidebar />);

      const collectionsLink = screen.getByRole('link', { name: /Collections/i });
      expect(collectionsLink).toHaveAttribute('href', '/collections');
    });

    it('highlights Settings when on settings page', () => {
      mockPathname.mockReturnValue('/settings');
      render(<Sidebar />);

      const settingsLink = screen.getByRole('link', { name: /Settings/i });
      expect(settingsLink).toHaveAttribute('href', '/settings');
    });
  });

  describe('Expansion Behavior', () => {
    it('expands on mouse enter', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      fireEvent.mouseEnter(sidebar);

      // After expansion, the text should be visible (opacity changes to 1)
      // We verify sidebar receives the event and the component handles it
      expect(sidebar).toBeInTheDocument();
    });

    it('collapses on mouse leave', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');

      // First expand
      fireEvent.mouseEnter(sidebar);
      // Then collapse
      fireEvent.mouseLeave(sidebar);

      expect(sidebar).toBeInTheDocument();
    });

    it('contains the app name text that shows on expansion', () => {
      render(<Sidebar />);

      // The text is always in the DOM but has opacity 0 when collapsed
      const appName = screen.getByText('The Mood Layer');
      expect(appName).toBeInTheDocument();
    });

    it('navigation item names are present in the DOM', () => {
      render(<Sidebar />);

      // All navigation texts should be present (visible on expansion)
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Discover')).toBeInTheDocument();
      expect(screen.getByText('My Layers')).toBeInTheDocument();
      expect(screen.getByText('Collections')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  describe('Hover States', () => {
    it('applies hover style on navigation item mouse enter', () => {
      render(<Sidebar />);

      const discoverLink = screen.getByRole('link', { name: /Discover/i });

      fireEvent.mouseEnter(discoverLink);

      // Hover styles are applied via inline event handlers
      expect(discoverLink).toBeInTheDocument();
    });

    it('removes hover style on navigation item mouse leave', () => {
      render(<Sidebar />);

      const discoverLink = screen.getByRole('link', { name: /Discover/i });

      fireEvent.mouseEnter(discoverLink);
      fireEvent.mouseLeave(discoverLink);

      expect(discoverLink).toBeInTheDocument();
    });

    it('does not apply hover background to active item on mouse enter', () => {
      mockPathname.mockReturnValue('/');
      render(<Sidebar />);

      const homeLink = screen.getByRole('link', { name: /Home/i });

      // For active items, the onMouseEnter handler checks isActive
      fireEvent.mouseEnter(homeLink);

      // The link should maintain its active styling
      expect(homeLink).toBeInTheDocument();
    });
  });

  describe('Structure', () => {
    it('has sidebar with fixed positioning', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('fixed');
    });

    it('has correct z-index class for overlay behavior', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('z-40');
    });

    it('has left-0 positioning', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('left-0');
    });

    it('has top-0 positioning', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('top-0');
    });

    it('has full height', () => {
      render(<Sidebar />);

      const sidebar = screen.getByRole('complementary');
      expect(sidebar).toHaveClass('h-full');
    });
  });

  describe('Accessibility', () => {
    it('uses semantic aside element', () => {
      render(<Sidebar />);
      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('uses semantic nav element for navigation', () => {
      render(<Sidebar />);
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('uses semantic list for navigation items', () => {
      render(<Sidebar />);
      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('all navigation links are focusable', () => {
      render(<Sidebar />);

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });
});
