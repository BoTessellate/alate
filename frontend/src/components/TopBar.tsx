'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, HelpCircle, User, X, Loader2, ChevronRight, Cloud, MessageSquare, Home, Compass, Layers2, Settings, AlignHorizontalSpaceAround } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getCurrencySymbol } from '@/utils/currency';
import { useLooksStore, parseSlugId } from '@/stores/useLooksStore';
import { useProductSearch } from '@/hooks/useProductSearch';
import BreadcrumbNav from './BreadcrumbNav';
import {
  getTopbarColors,
  TopbarIconButton,
  TopbarTextButton,
  Logo,
  AgentModeToggle,
} from './ui/topbar';

const navigationItems = [
  { name: 'Layers', href: '/looks', icon: Layers2 },
  { name: 'Closet', href: '/closet', icon: AlignHorizontalSpaceAround },
  { name: 'Discover', href: '/discover', icon: Compass },
];

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  // Use selector pattern for better performance - only re-render when specific values change
  const agentModeEnabled = useSettingsStore(state => state.agentModeEnabled);
  const setAgentMode = useSettingsStore(state => state.setAgentMode);
  const theme = useSettingsStore(state => state.theme);
  const currencyDisplayMode = useSettingsStore(state => state.currencyDisplayMode);
  const localCurrency = useSettingsStore(state => state.localCurrency);
  const setCurrencyDisplayMode = useSettingsStore(state => state.setCurrencyDisplayMode);
  const setLocalCurrency = useSettingsStore(state => state.setLocalCurrency);
  const userName = useSettingsStore(state => state.userName);
  const getMoodboardById = useLooksStore(state => state.getMoodboardById);
  const saveStatus = useLooksStore(state => state.saveStatus);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Use SWR-based search with automatic caching and deduplication
  const { products: searchResults, isSearching } = useProductSearch(searchQuery, {
    debounceMs: 300,
    limit: 10,
  });

  // Callback to update Look Editor products (will be set by Look Editor page)
  const onSearchSelect = useRef<((query: string) => void) | null>(null);

  // Track hydration to avoid SSR/client mismatch
  const [isHydrated, setIsHydrated] = useState(false);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Track effective theme for agent mode colors
  useEffect(() => {
    const updateEffectiveTheme = () => {
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setEffectiveTheme(prefersDark ? 'dark' : 'light');
      } else {
        setEffectiveTheme(theme as 'light' | 'dark');
      }
    };
    updateEffectiveTheme();

    // Listen for system theme changes when in system mode
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateEffectiveTheme);
    return () => mediaQuery.removeEventListener('change', updateEffectiveTheme);
  }, [theme]);

  // Check if we're on a look editor page
  const isLookEditorPage = pathname.startsWith('/looks/') && pathname !== '/looks';

  // Check if on My Looks page (not editor) for warm topbar
  const isLooksListPage = pathname === '/looks';
  const pathSegments = pathname.split('/').filter(Boolean);

  // Compute topbar colors once - used by all icon buttons
  const colors = getTopbarColors(isLooksListPage);

  // Get moodboard name if on editor page (only after hydration to avoid mismatch)
  let moodboardName: string | null = null;
  if (isHydrated && isLookEditorPage && pathSegments.length >= 2) {
    const slugId = pathSegments[1];
    const parsed = parseSlugId(slugId);
    if (parsed) {
      const moodboard = getMoodboardById(parsed.id);
      moodboardName = moodboard?.name || null;
    }
  }

  // Display name for user (from settings store)
  const displayName = userName || 'Guest';

  // Generate breadcrumbs with proper names - always start with user's space
  const breadcrumbs: { name: string; href: string; isLast: boolean }[] = [];

  // Always add user's space as the first breadcrumb
  const isHomePage = pathSegments.length === 0;
  breadcrumbs.push({ name: `${displayName}'s space`, href: '/', isLast: isHomePage });

  // Add the rest of the path segments
  pathSegments.forEach((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/');
    const isLast = index === pathSegments.length - 1;

    // Determine display name
    let name = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

    // If this is the moodboard slug segment and we have a moodboard name, use it
    if (index === 1 && pathSegments[0] === 'looks' && moodboardName) {
      name = moodboardName;
    }

    breadcrumbs.push({ name, href, isLast });
  });

  // Reset selected index when search results change
  useEffect(() => {
    setSelectedResultIndex(-1);
  }, [searchResults]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Close search on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearch(false);
        setSearchQuery(''); // This will clear results via SWR hook
      }
    };

    if (showSearch) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearch]);

  // Select a search result (navigate or filter products)
  const selectSearchResult = (query: string) => {
    if (isLookEditorPage) {
      // Dispatch custom event to update Look Editor products
      window.dispatchEvent(new CustomEvent('searchProducts', { detail: { query } }));
    } else {
      // Navigate to discover page with search
      router.push(`/discover?q=${encodeURIComponent(query)}`);
    }
    setShowSearch(false);
    setSearchQuery('');
    setSelectedResultIndex(-1);
  };

  // Handle search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    // If a result is selected, use that; otherwise use the query
    if (selectedResultIndex >= 0 && searchResults[selectedResultIndex]) {
      selectSearchResult(searchResults[selectedResultIndex].product_name);
    } else {
      selectSearchResult(searchQuery);
    }
  };

  // Handle keyboard navigation in search results
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!searchResults.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedResultIndex(prev =>
        prev < searchResults.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedResultIndex(prev =>
        prev > 0 ? prev - 1 : searchResults.length - 1
      );
    }
  };

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
      if (e.key === 'Escape') {
        setShowSearch(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // State for user dropdown
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // State for currency dropdown
  const [showCurrencyMenu, setShowCurrencyMenu] = useState(false);
  const currencyMenuRef = useRef<HTMLDivElement>(null);

  const currencies: Array<'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'AUD' | 'CAD'> = [
    'USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD'
  ];

  // Close user menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserMenu]);

  // Close currency menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (currencyMenuRef.current && !currencyMenuRef.current.contains(e.target as Node)) {
        setShowCurrencyMenu(false);
      }
    };

    if (showCurrencyMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCurrencyMenu]);

  // State for topbar expansion
  const [isTopBarExpanded, setIsTopBarExpanded] = useState(false);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-30 transition-all duration-300 ease-out"
      onMouseEnter={() => setIsTopBarExpanded(true)}
      onMouseLeave={() => setIsTopBarExpanded(false)}
    >
      {/* Main TopBar content */}
      <div
        className="flex items-center justify-between px-4 backdrop-blur-md transition-all duration-300 ease-out relative z-10"
        style={{
          height: isTopBarExpanded ? 'calc(var(--topbar-height) + 28px)' : 'var(--topbar-height)',
          backgroundColor: isLooksListPage ? 'var(--topbar-bg-warm)' : 'var(--topbar-bg)',
        }}
      >
      {/* Left side - Logo + Breadcrumb Navigation */}
      <div className="flex items-center gap-3">
        <Logo isWarmTopbar={isLooksListPage} effectiveTheme={effectiveTheme} />
        <BreadcrumbNav />
      </div>

      {/* Center - Navigation Icons */}
      <nav aria-label="Main navigation" className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-8">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          // Colors based on topbar theme
          const activeColor = isLooksListPage ? 'var(--charcoal)' : 'white';
          const inactiveColor = isLooksListPage ? 'rgba(34, 34, 34, 0.7)' : 'rgba(255, 255, 255, 0.75)';
          const activeBg = isLooksListPage ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.25)';
          const hoverBg = isLooksListPage ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.15)';

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative group flex flex-col items-center"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
                style={{
                  backgroundColor: isActive ? activeBg : 'transparent',
                  color: isActive ? activeColor : inactiveColor,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = hoverBg;
                    e.currentTarget.style.color = activeColor;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = inactiveColor;
                  }
                }}
              >
                <Icon size={20} />
              </div>
              {/* Tooltip text - appears below on hover */}
              <span
                className="absolute top-full mt-1 text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                style={{
                  color: isLooksListPage ? 'rgba(34, 34, 34, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                }}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Right side - Search and actions */}
      <div className="flex items-center gap-2">
        {/* Auto-save status indicator - only show on look editor page */}
        {isLookEditorPage && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: saveStatus === 'saved' ? 'white' : 'rgba(255, 255, 255, 0.7)',
            }}
          >
            {saveStatus === 'saving' && (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Saving...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Cloud size={12} />
                <span>Saved</span>
              </>
            )}
            {saveStatus === 'unsaved' && (
              <>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f59e0b' }} />
                <span>Unsaved changes</span>
              </>
            )}
          </div>
        )}

        {/* Search - Icon that expands on click */}
        <div ref={searchContainerRef} className="relative">
          <form onSubmit={handleSearchSubmit}>
            {showSearch ? (
              <div
                className="flex items-center gap-2 px-3 h-8 rounded-full"
                style={{
                  backgroundColor: 'var(--background)',
                  width: '280px',
                  transition: 'width 200ms ease-out',
                }}
              >
                <Search size={16} style={{ color: 'var(--foreground-muted)', flexShrink: 0 }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search a mood or product..."
                  className="flex-1 bg-transparent text-sm min-w-0"
                  style={{ color: 'var(--foreground)', border: 'none', outline: 'none', boxShadow: 'none' }}
                />
                {isSearching && (
                  <Loader2 size={14} className="animate-spin flex-shrink-0" style={{ color: 'var(--foreground-muted)' }} />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSearch(false);
                    setSearchQuery('');
                  }}
                  className="flex-shrink-0 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <TopbarIconButton
                icon={Search}
                aria-label="Search"
                title="Search (Ctrl+K)"
                onClick={() => setShowSearch(true)}
                colors={colors}
              />
            )}
          </form>

          {/* Search Results Dropdown with fade-in animation */}
          {showSearch && searchResults.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden max-h-80 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            >
              {searchResults.map((product, index) => (
                <button
                  key={product.id}
                  onClick={() => selectSearchResult(product.product_name)}
                  className="w-full flex items-center gap-3 p-2 text-left transition-colors duration-150"
                  style={{
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: index === selectedResultIndex ? 'var(--surface-light)' : 'transparent',
                  }}
                  onMouseEnter={() => setSelectedResultIndex(index)}
                >
                  {product.image_url && (
                    <img
                      src={product.image_url}
                      alt={product.product_name}
                      className="w-8 h-8 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {product.product_name.replace(/^TEST_/i, '').replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      {product.brand.replace(/^TEST_/i, '').replace(/_/g, ' ')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Currency Dropdown */}
        <div ref={currencyMenuRef} className="relative">
          <button
            onClick={() => setShowCurrencyMenu(!showCurrencyMenu)}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            style={{
              backgroundColor: colors.defaultBg,
              color: colors.text,
            }}
            aria-label="Select currency"
            aria-expanded={showCurrencyMenu}
            aria-haspopup="listbox"
            title="Currency"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.hoverBg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.defaultBg;
            }}
          >
            <span className="text-xs font-medium">
              {currencyDisplayMode === 'local' ? getCurrencySymbol(localCurrency) : '¤'}
            </span>
          </button>

          {/* Currency Dropdown Menu */}
          {showCurrencyMenu && (
            <div
              className="absolute top-full right-0 mt-2 py-1 rounded-lg border shadow-lg overflow-hidden z-50"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
                minWidth: '100px',
              }}
              role="listbox"
            >
              {/* Currency options */}
              {currencies.map((code) => (
                <button
                  key={code}
                  onClick={() => {
                    setCurrencyDisplayMode('local');
                    setLocalCurrency(code);
                    setShowCurrencyMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-sm transition-colors"
                  style={{
                    backgroundColor: currencyDisplayMode === 'local' && localCurrency === code ? 'var(--surface-light)' : 'transparent',
                    color: currencyDisplayMode === 'local' && localCurrency === code ? 'var(--foreground)' : 'var(--foreground-muted)',
                  }}
                  role="option"
                  aria-selected={currencyDisplayMode === 'local' && localCurrency === code}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = currencyDisplayMode === 'local' && localCurrency === code ? 'var(--surface-light)' : 'transparent';
                    e.currentTarget.style.color = currencyDisplayMode === 'local' && localCurrency === code ? 'var(--foreground)' : 'var(--foreground-muted)';
                  }}
                >
                  <span>{getCurrencySymbol(code)}</span>
                  <span>{code}</span>
                </button>
              ))}
              {/* Original prices option - at the end, italic style */}
              <button
                onClick={() => {
                  setCurrencyDisplayMode('original');
                  setShowCurrencyMenu(false);
                }}
                className="w-full px-3 py-1.5 text-sm text-left transition-colors italic border-t"
                style={{
                  color: currencyDisplayMode === 'original' ? 'var(--foreground)' : 'var(--foreground-muted)',
                  backgroundColor: currencyDisplayMode === 'original' ? 'var(--surface-light)' : 'transparent',
                  borderColor: 'var(--border)',
                }}
                role="option"
                aria-selected={currencyDisplayMode === 'original'}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                  e.currentTarget.style.color = 'var(--foreground)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = currencyDisplayMode === 'original' ? 'var(--surface-light)' : 'transparent';
                  e.currentTarget.style.color = currencyDisplayMode === 'original' ? 'var(--foreground)' : 'var(--foreground-muted)';
                }}
              >
                Original
              </button>
            </div>
          )}
        </div>

        {/* Agent Mode Toggle */}
        <AgentModeToggle
          isActive={agentModeEnabled}
          onToggle={() => setAgentMode(!agentModeEnabled)}
          effectiveTheme={effectiveTheme}
        />

        {/* Help */}
        <TopbarIconButton
          icon={HelpCircle}
          aria-label="Help"
          title="Help"
          colors={colors}
        />

        {/* Feedback */}
        <TopbarTextButton
          aria-label="Send feedback"
          title="Send Feedback"
          colors={colors}
        >
          Feedback
        </TopbarTextButton>

        {/* User Menu with Dropdown */}
        <div ref={userMenuRef} className="pl-2 relative" style={{ borderLeft: `1px solid ${colors.border}` }}>
          <TopbarIconButton
            icon={User}
            aria-label="User menu"
            aria-expanded={showUserMenu}
            aria-haspopup="menu"
            title="Account"
            onClick={() => setShowUserMenu(!showUserMenu)}
            colors={colors}
            variant="filled"
          />

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div
              role="menu"
              aria-label="User options"
              className="absolute top-full right-0 mt-2 w-48 rounded-lg border shadow-lg overflow-hidden z-50"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {displayName}
                </p>
                {userName && (
                  <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    Signed in
                  </p>
                )}
              </div>
              <div className="py-1" role="group">
                <Link
                  href="/settings"
                  role="menuitem"
                  className="flex items-center gap-2 px-3 py-2 text-sm transition-colors"
                  style={{ color: 'var(--foreground-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--foreground-secondary)';
                  }}
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings size={16} aria-hidden="true" />
                  <span>Settings</span>
                </Link>
              </div>
              <div className="py-1 border-t" role="group" style={{ borderColor: 'var(--border)' }}>
                <button
                  role="menuitem"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
                  style={{ color: 'var(--error)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Curved bottom edge - gentle arc */}
      <div
        className="w-full backdrop-blur-md"
        style={{
          height: '16px',
          backgroundColor: isLooksListPage ? 'var(--topbar-bg-warm)' : 'var(--topbar-bg)',
          borderRadius: '0 0 100% 100% / 0 0 100% 100%',
        }}
      />
    </header>
  );
}
