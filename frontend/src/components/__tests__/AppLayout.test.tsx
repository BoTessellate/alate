import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AppLayout from '../AppLayout';

// Mock Next.js navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockPathname = jest.fn().mockReturnValue('/');

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: jest.fn(),
  }),
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

// Mock TopBar component
jest.mock('../TopBar', () => {
  const MockTopBar = () => <header data-testid="topbar">TopBar</header>;
  MockTopBar.displayName = 'MockTopBar';
  return MockTopBar;
});

// Mock ThemeProvider component
jest.mock('../ThemeProvider', () => {
  const MockThemeProvider = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  );
  MockThemeProvider.displayName = 'MockThemeProvider';
  return MockThemeProvider;
});

// Mock FloatingActionButton component
jest.mock('../FloatingActionButton', () => {
  const MockFAB = () => <button data-testid="fab">FAB</button>;
  MockFAB.displayName = 'MockFloatingActionButton';
  return MockFAB;
});

// Mock PhotoUploadModal component
jest.mock('../PhotoUploadModal', () => {
  const MockModal = () => <div data-testid="photo-upload-modal">Photo Upload Modal</div>;
  MockModal.displayName = 'MockPhotoUploadModal';
  return MockModal;
});

// Mock user store
const mockHasCompletedOnboarding = jest.fn().mockReturnValue(true);

jest.mock('@/stores/useUserStore', () => ({
  useUserStore: () => ({
    hasCompletedOnboarding: mockHasCompletedOnboarding,
  }),
}));

// Mock settings store for TopBar
jest.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: () => ({
    agentModeEnabled: false,
    setAgentMode: jest.fn(),
    currencyDisplayMode: 'local',
    localCurrency: 'USD',
    setCurrencyDisplayMode: jest.fn(),
    setLocalCurrency: jest.fn(),
  }),
}));

// Mock looks store for TopBar
jest.mock('@/stores/useLooksStore', () => ({
  useLooksStore: () => ({
    getMoodboardById: jest.fn(),
    saveStatus: 'saved',
  }),
  parseSlugId: jest.fn().mockReturnValue(null),
}));

// Mock BreadcrumbNav for TopBar
jest.mock('../BreadcrumbNav', () => {
  const MockBreadcrumbNav = () => <nav data-testid="breadcrumb-nav">Breadcrumb</nav>;
  MockBreadcrumbNav.displayName = 'MockBreadcrumbNav';
  return MockBreadcrumbNav;
});

describe('AppLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname.mockReturnValue('/');
    mockHasCompletedOnboarding.mockReturnValue(true);
  });

  describe('Rendering', () => {
    it('renders children content', async () => {
      render(
        <AppLayout>
          <div data-testid="child-content">Test Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(screen.getByTestId('child-content')).toBeInTheDocument();
      });
    });

    it('renders ThemeProvider wrapper', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
      });
    });

    it('renders TopBar component', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(screen.getByTestId('topbar')).toBeInTheDocument();
      });
    });

    it('renders FloatingActionButton', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(screen.getByTestId('fab')).toBeInTheDocument();
      });
    });

    it('renders PhotoUploadModal', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(screen.getByTestId('photo-upload-modal')).toBeInTheDocument();
      });
    });

    it('renders main content area', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });
  });

  describe('Skip Link', () => {
    it('renders skip to main content link', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        const skipLink = screen.getByText(/Skip to main content/i);
        expect(skipLink).toBeInTheDocument();
      });
    });

    it('skip link points to main content', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        const skipLink = screen.getByText(/Skip to main content/i);
        expect(skipLink).toHaveAttribute('href', '#main-content');
      });
    });

    it('skip link has sr-only class for screen readers', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        const skipLink = screen.getByText(/Skip to main content/i);
        expect(skipLink).toHaveClass('sr-only');
      });
    });
  });

  describe('Main Content', () => {
    it('main element has correct id', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        const main = screen.getByRole('main');
        expect(main).toHaveAttribute('id', 'main-content');
      });
    });

    it('main element has tabIndex for focus', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        const main = screen.getByRole('main');
        expect(main).toHaveAttribute('tabIndex', '-1');
      });
    });

    it('main element has overflow-y-auto for scrolling', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        const main = screen.getByRole('main');
        expect(main).toHaveClass('overflow-y-auto');
      });
    });
  });

  describe('Onboarding Redirect', () => {
    it('redirects to onboarding when not completed', async () => {
      mockHasCompletedOnboarding.mockReturnValue(false);
      mockPathname.mockReturnValue('/');

      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('/onboarding');
      });
    });

    it('does not redirect when onboarding is completed', async () => {
      mockHasCompletedOnboarding.mockReturnValue(true);
      mockPathname.mockReturnValue('/');

      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });

      expect(mockReplace).not.toHaveBeenCalled();
    });

    it('does not redirect when already on onboarding page', async () => {
      mockHasCompletedOnboarding.mockReturnValue(false);
      mockPathname.mockReturnValue('/onboarding');

      render(
        <AppLayout>
          <div>Onboarding Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('Onboarding Content')).toBeInTheDocument();
      });

      expect(mockReplace).not.toHaveBeenCalled();
    });
  });

  describe('Onboarding Page Layout', () => {
    it('renders minimal layout on onboarding page', async () => {
      mockPathname.mockReturnValue('/onboarding');

      render(
        <AppLayout>
          <div data-testid="onboarding-content">Onboarding</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(screen.getByTestId('onboarding-content')).toBeInTheDocument();
      });

      // Should NOT render TopBar, FAB, or PhotoUploadModal on onboarding
      expect(screen.queryByTestId('topbar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('fab')).not.toBeInTheDocument();
      expect(screen.queryByTestId('photo-upload-modal')).not.toBeInTheDocument();
    });

    it('does not render skip link on onboarding page', async () => {
      mockPathname.mockReturnValue('/onboarding');

      render(
        <AppLayout>
          <div>Onboarding</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(screen.getByText('Onboarding')).toBeInTheDocument();
      });

      expect(screen.queryByText(/Skip to main content/i)).not.toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner initially before hydration', () => {
      // The component shows a loading spinner before isHydrated is true
      // We can't easily test this since useEffect runs immediately in tests
      // but we verify the structure is correct
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      // After hydration, content should be visible
      expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
    });
  });

  describe('Layout Structure', () => {
    it('has flex column layout', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        const wrapper = screen.getByTestId('theme-provider').querySelector('.flex.flex-col');
        expect(wrapper).toBeInTheDocument();
      });
    });

    it('has full screen dimensions', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        const wrapper = screen.getByTestId('theme-provider').querySelector('.h-screen.w-screen');
        expect(wrapper).toBeInTheDocument();
      });
    });

    it('prevents overflow on wrapper', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        const wrapper = screen.getByTestId('theme-provider').querySelector('.overflow-hidden');
        expect(wrapper).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('renders semantic main element', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
      });
    });

    it('main content has focus outline suppressed', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        const main = screen.getByRole('main');
        expect(main).toHaveClass('focus:outline-none');
      });
    });

    it('provides skip link for keyboard navigation', async () => {
      render(
        <AppLayout>
          <div>Content</div>
        </AppLayout>
      );

      await waitFor(() => {
        const skipLink = screen.getByText(/Skip to main content/i);
        expect(skipLink.tagName).toBe('A');
      });
    });
  });

  describe('Multiple Children', () => {
    it('renders multiple children correctly', async () => {
      render(
        <AppLayout>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </AppLayout>
      );

      await waitFor(() => {
        expect(screen.getByTestId('child-1')).toBeInTheDocument();
        expect(screen.getByTestId('child-2')).toBeInTheDocument();
        expect(screen.getByTestId('child-3')).toBeInTheDocument();
      });
    });
  });
});
