'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, HelpCircle, User, X, Loader2, ChevronRight, Cloud, MessageSquare, Home, Compass, LayoutGrid, Heart, Settings } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getCurrencySymbol } from '@/utils/currency';
import { useLooksStore, parseSlugId } from '@/stores/useLooksStore';

interface Product {
  id: string;
  product_name: string;
  brand: string;
  image_url: string;
  price: number;
  currency?: string;
}

const API_BASE_URL = 'https://backend-tml.vercel.app';

const navigationItems = [
  { name: 'Discover', href: '/discover', icon: Compass },
  { name: 'My Looks', href: '/looks', icon: LayoutGrid },
  { name: 'Collections', href: '/collections', icon: Heart },
];

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { aiModeEnabled, setAiMode, currencyDisplayMode, localCurrency, setCurrencyDisplayMode, setLocalCurrency } = useSettingsStore();
  const { getLookById, saveStatus } = useLooksStore();

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Callback to update Look Editor products (will be set by Look Editor page)
  const onSearchSelect = useRef<((query: string) => void) | null>(null);

  // Track hydration to avoid SSR/client mismatch
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Check if we're on a look editor page
  const isLookEditorPage = pathname.startsWith('/looks/') && pathname !== '/looks';
  const pathSegments = pathname.split('/').filter(Boolean);

  // Get look name if on editor page (only after hydration to avoid mismatch)
  let lookName: string | null = null;
  if (isHydrated && isLookEditorPage && pathSegments.length >= 2) {
    const slugId = pathSegments[1];
    const parsed = parseSlugId(slugId);
    if (parsed) {
      const look = getLookById(parsed.id);
      lookName = look?.name || null;
    }
  }

  // User name (this would come from auth/user store in production)
  const userName = 'John Doe';

  // Generate breadcrumbs with proper names - always start with user's space
  const breadcrumbs: { name: string; href: string; isLast: boolean }[] = [];

  // Always add user's space as the first breadcrumb
  const isHomePage = pathSegments.length === 0;
  breadcrumbs.push({ name: `${userName}'s space`, href: '/', isLast: isHomePage });

  // Add the rest of the path segments
  pathSegments.forEach((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/');
    const isLast = index === pathSegments.length - 1;

    // Determine display name
    let name = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ');

    // If this is the look slug segment and we have a look name, use it
    if (index === 1 && pathSegments[0] === 'looks' && lookName) {
      name = lookName;
    }

    breadcrumbs.push({ name, href, isLast });
  });

  // Handle search - use GET endpoint with q parameter
  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSelectedResultIndex(-1);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}&limit=10`
      );

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.products || []);
        setSelectedResultIndex(-1);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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
        setSearchQuery('');
        setSearchResults([]);
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
    setSearchResults([]);
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
        setSearchResults([]);
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
          backgroundColor: 'var(--topbar-bg)',
        }}
      >
      {/* Left side - Logo */}
      <div className="flex items-center">
        {/* Clickable Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#f6e9cf' }}
          >
            <div
              className="w-4 h-1.5 rounded-full"
              style={{ backgroundColor: '#4a7c4e' }}
            />
          </div>
          <span
            className="font-semibold text-sm"
            style={{ color: '#f6e9cf' }}
          >
            The Mood Layer
          </span>
        </Link>
      </div>

      {/* Center - Navigation Icons */}
      <nav className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-8">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative group flex flex-col items-center"
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200"
                style={{
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
                  color: isActive ? 'white' : 'rgba(255, 255, 255, 0.75)',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.color = 'white';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)';
                  }
                }}
              >
                <Icon size={20} />
              </div>
              {/* Tooltip text - appears below on hover */}
              <span
                className="absolute top-full mt-1 text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
                style={{
                  color: 'rgba(255, 255, 255, 0.7)',
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

        {/* Search - Unified component with smooth transition */}
        <div ref={searchContainerRef} className="relative">
          <form onSubmit={handleSearchSubmit}>
            <div
              onClick={() => !showSearch && setShowSearch(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full cursor-text"
              style={{
                backgroundColor: showSearch ? 'var(--background)' : 'rgba(255, 255, 255, 0.15)',
                width: showSearch ? '256px' : 'auto',
                transition: 'width 200ms ease-out, background-color 200ms ease-out',
              }}
            >
              <Search size={14} style={{ color: showSearch ? 'var(--foreground-muted)' : 'rgba(255, 255, 255, 0.7)', flexShrink: 0 }} />
              {showSearch ? (
                <>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search products..."
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
                      setSearchResults([]);
                    }}
                    className="flex-shrink-0 transition-opacity hover:opacity-70"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Search...</span>
                  <kbd
                    className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ml-auto"
                    style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      color: 'rgba(255, 255, 255, 0.7)',
                    }}
                  >
                    <span className="text-xs">⌘</span>K
                  </kbd>
                </>
              )}
            </div>
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
            className="flex items-center gap-1 px-2 py-1 rounded-full transition-colors"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            }}
          >
            <span className="text-sm font-medium">
              {currencyDisplayMode === 'local' ? getCurrencySymbol(localCurrency) : 'Original'}
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
            >
              {/* Original prices option */}
              {currencyDisplayMode !== 'original' && (
                <button
                  onClick={() => {
                    setCurrencyDisplayMode('original');
                    setShowCurrencyMenu(false);
                  }}
                  className="w-full px-3 py-1.5 text-sm text-left transition-colors"
                  style={{ color: 'var(--foreground-muted)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--foreground-muted)';
                  }}
                >
                  Original
                </button>
              )}
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
            </div>
          )}
        </div>

        {/* AI Mode Toggle - Logo style icon */}
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all group"
          style={{
            backgroundColor: aiModeEnabled ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.15)',
          }}
          onClick={() => setAiMode(!aiModeEnabled)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = aiModeEnabled ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.15)';
          }}
          aria-label="AI Mode"
          aria-pressed={aiModeEnabled}
          title={aiModeEnabled ? 'AI Mode enabled' : 'Enable AI Mode'}
        >
          {/* Custom logo-style icon: pill bar inside circle */}
          <div
            className="ai-pill w-4 h-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: aiModeEnabled ? 'white' : 'rgba(255, 255, 255, 0.6)',
            }}
          />
        </button>

        {/* Help */}
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ color: 'rgba(255, 255, 255, 0.75)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)';
          }}
          aria-label="Help"
        >
          <HelpCircle size={16} />
        </button>

        {/* Feedback */}
        <button
          className="h-8 rounded-full flex items-center justify-center px-3 transition-colors"
          style={{ color: 'rgba(255, 255, 255, 0.75)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)';
          }}
          aria-label="Feedback"
        >
          <span className="text-xs font-medium">Feedback</span>
        </button>

        {/* User Menu with Dropdown */}
        <div ref={userMenuRef} className="pl-2 relative" style={{ borderLeft: '1px solid rgba(255, 255, 255, 0.2)' }}>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onClick={() => setShowUserMenu(!showUserMenu)}
            aria-label="User menu"
            aria-expanded={showUserMenu}
          >
            <User size={14} />
          </button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <div
              className="absolute top-full right-0 mt-2 w-48 rounded-lg border shadow-lg overflow-hidden z-50"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                  {userName}
                </p>
                <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                  user@example.com
                </p>
              </div>
              <div className="py-1">
                <Link
                  href="/settings"
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
                  <Settings size={16} />
                  <span>Settings</span>
                </Link>
              </div>
              <div className="py-1 border-t" style={{ borderColor: 'var(--border)' }}>
                <button
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
          backgroundColor: 'var(--topbar-bg)',
          borderRadius: '0 0 100% 100% / 0 0 100% 100%',
        }}
      />
    </header>
  );
}
