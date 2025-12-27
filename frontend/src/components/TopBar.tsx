'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search, HelpCircle, User, X, Loader2, ChevronRight, Cloud, MessageSquare } from 'lucide-react';
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

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { aiModeEnabled, setAiMode, currencyDisplayMode, localCurrency } = useSettingsStore();
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

  return (
    <header
      className="fixed top-0 right-0 z-30 flex items-center justify-between px-4"
      style={{
        height: 'var(--topbar-height)',
        left: 'var(--sidebar-width)',
        backgroundColor: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Left side - Breadcrumbs (Supabase style) */}
      <div className="flex items-center gap-1">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.href} className="flex items-center">
            {index > 0 && (
              <ChevronRight size={14} style={{ color: 'var(--foreground-muted)' }} className="mx-1" />
            )}
            {crumb.isLast ? (
              <span
                className="text-sm font-medium px-2 py-1"
                style={{ color: 'var(--foreground)' }}
              >
                {crumb.name}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-sm font-medium px-2 py-1 rounded transition-colors"
                style={{ color: 'var(--foreground-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                  e.currentTarget.style.color = 'var(--foreground)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--foreground-secondary)';
                }}
              >
                {crumb.name}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Right side - Search and actions */}
      <div className="flex items-center gap-2">
        {/* Auto-save status indicator - only show on look editor page */}
        {isLookEditorPage && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
            style={{
              backgroundColor: 'var(--surface-light)',
              color: saveStatus === 'saved' ? 'var(--primary)' : 'var(--foreground-muted)',
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
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--warning, #f59e0b)' }} />
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
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-text"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: showSearch ? 'var(--primary)' : 'var(--border)',
                width: showSearch ? '256px' : 'auto',
                transition: 'width 200ms ease-out, border-color 200ms ease-out, box-shadow 200ms ease-out',
                boxShadow: showSearch ? '0 0 0 1px var(--primary)' : 'none',
              }}
            >
              <Search size={14} style={{ color: 'var(--foreground-muted)', flexShrink: 0 }} />
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
                  <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>Search...</span>
                  <kbd
                    className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs ml-auto"
                    style={{
                      backgroundColor: 'var(--surface-light)',
                      color: 'var(--foreground-muted)',
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

        {/* Currency Indicator */}
        <Link
          href="/settings"
          className="flex items-center gap-1 px-2 py-1 rounded-full transition-colors"
          style={{
            backgroundColor: currencyDisplayMode === 'local' ? 'rgba(76, 112, 49, 0.15)' : 'var(--surface-light)',
            color: currencyDisplayMode === 'local' ? 'var(--primary)' : 'var(--foreground-muted)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = currencyDisplayMode === 'local' ? 'rgba(76, 112, 49, 0.15)' : 'var(--surface-light)';
          }}
          title={currencyDisplayMode === 'local' ? `Showing approximate prices in ${localCurrency} for today` : 'Showing original currencies'}
        >
          <span className="text-sm font-medium">
            {currencyDisplayMode === 'local' ? getCurrencySymbol(localCurrency) : '$'}
          </span>
          {currencyDisplayMode === 'local' && (
            <span className="text-xs">{localCurrency}</span>
          )}
        </Link>

        {/* AI Mode Toggle - Logo style icon */}
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center transition-all group"
          style={{
            backgroundColor: aiModeEnabled ? '#4a7c4e' : 'var(--surface-light)',
            border: aiModeEnabled ? 'none' : '1px solid var(--border)',
          }}
          onClick={() => setAiMode(!aiModeEnabled)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = aiModeEnabled ? '#5a8c5e' : '#4a7c4e';
            if (!aiModeEnabled) {
              e.currentTarget.style.borderColor = '#4a7c4e';
              const pill = e.currentTarget.querySelector('.ai-pill') as HTMLElement;
              if (pill) pill.style.backgroundColor = 'white';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = aiModeEnabled ? '#4a7c4e' : 'var(--surface-light)';
            if (!aiModeEnabled) {
              e.currentTarget.style.borderColor = 'var(--border)';
              const pill = e.currentTarget.querySelector('.ai-pill') as HTMLElement;
              if (pill) pill.style.backgroundColor = '#4a7c4e';
            }
          }}
          aria-label="AI Mode"
          aria-pressed={aiModeEnabled}
          title={aiModeEnabled ? 'AI Mode enabled' : 'Enable AI Mode'}
        >
          {/* Custom logo-style icon: pill bar inside circle */}
          <div
            className="ai-pill w-4 h-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: aiModeEnabled ? 'white' : '#4a7c4e',
            }}
          />
        </button>

        {/* Help */}
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ color: 'var(--foreground-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-light)';
            e.currentTarget.style.color = 'var(--foreground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--foreground-secondary)';
          }}
          aria-label="Help"
        >
          <HelpCircle size={16} />
        </button>

        {/* Feedback */}
        <button
          className="h-8 rounded-full flex items-center justify-center px-3 transition-colors"
          style={{ color: 'var(--foreground-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--surface-light)';
            e.currentTarget.style.color = 'var(--foreground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--foreground-secondary)';
          }}
          aria-label="Feedback"
        >
          <span className="text-xs font-medium">Feedback</span>
        </button>

        {/* User */}
        <div className="pl-2" style={{ borderLeft: '1px solid var(--border)' }}>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'white',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--primary)';
            }}
            aria-label="User menu"
          >
            <User size={14} />
          </button>
        </div>
      </div>
    </header>
  );
}
