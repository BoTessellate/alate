'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronsUpDown, Compass, Layers2, AlignHorizontalSpaceAround, Grid3X3 } from 'lucide-react';
import { useLooksStore, generateMoodboardPath } from '@/stores/useLooksStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import {
  buildBreadcrumbs,
  type BreadcrumbContext,
  type BreadcrumbIcons,
} from '@/utils/breadcrumbs';

// Icons for breadcrumb logic
const BREADCRUMB_ICONS: BreadcrumbIcons = {
  Layers2,
  Compass,
  AlignHorizontalSpaceAround,
  Grid3X3,
};

export default function BreadcrumbNav() {
  const pathname = usePathname();
  const { moodboards, getMoodboardBySlug } = useLooksStore();
  const { collections } = useCollectionsStore();
  const { userName, isLoggedIn } = useSettingsStore();

  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const dropdownRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openDropdown !== null) {
        const ref = dropdownRefs.current[openDropdown];
        if (ref && !ref.contains(e.target as Node)) {
          setOpenDropdown(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

  // Display name for breadcrumb
  const displayName = isLoggedIn && userName ? userName : null;

  // Get current moodboard if on a moodboard page
  const pathParts = pathname.split('/').filter(Boolean);
  const moodboardSlug = pathParts[0] === 'looks' && pathParts.length === 2 ? pathParts[1] : null;
  const currentMoodboard = moodboardSlug && isHydrated ? getMoodboardBySlug(moodboardSlug) : null;

  // Get current collection if on a collection detail page
  const collectionId = pathParts[0] === 'collections' && pathParts.length === 2 ? pathParts[1] : null;
  const currentCollection = collectionId && isHydrated
    ? collections.find(c => c.id === collectionId)
    : null;

  // Build context for breadcrumb logic
  const context: BreadcrumbContext = {
    pathname,
    displayName,
    moodboards: moodboards.map(mb => ({ id: mb.id, name: mb.name })),
    currentMoodboard: currentMoodboard ? { name: currentMoodboard.name } : null,
    collections: collections.map(c => ({ id: c.id, name: c.name })),
    currentCollection: currentCollection ? { name: currentCollection.name } : null,
    isHydrated,
  };

  // Use the shared breadcrumb logic
  const breadcrumbs = buildBreadcrumbs(context, BREADCRUMB_ICONS);

  // Check if current page is in looks section for theming
  const isLooksListPage = pathname === '/looks';

  // Colors based on topbar theme
  const textColor = isLooksListPage ? 'var(--charcoal)' : 'var(--cream)';
  const textColorMuted = isLooksListPage ? 'rgba(34, 34, 34, 0.5)' : 'rgba(244, 239, 237, 0.5)';
  const hoverBg = isLooksListPage ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.15)';
  const dropdownBg = 'var(--surface)';
  const dropdownBorder = 'var(--border)';

  return (
    <nav className="flex items-center gap-0.5" aria-label="Breadcrumb">
      {breadcrumbs.map((segment, index) => (
        <div key={index} className="flex items-center">
          {/* Separator */}
          {index > 0 && (
            <span
              className="mx-1.5 text-sm select-none"
              style={{ color: textColorMuted }}
            >
              /
            </span>
          )}

          {/* Segment */}
          <div
            ref={el => { dropdownRefs.current[index] = el; }}
            className="relative"
          >
            {segment.options && segment.options.length > 0 ? (
              // Segment with dropdown - text is clickable link, icon toggles dropdown
              <div className="flex items-center gap-0.5">
                <Link
                  href={segment.href || '#'}
                  className="px-2 py-1 rounded-md transition-colors text-sm font-medium outline-none focus:outline-none"
                  style={{ color: textColor }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {segment.label}
                </Link>
                <button
                  onClick={() => setOpenDropdown(openDropdown === index ? null : index)}
                  className="w-5 h-5 rounded flex items-center justify-center transition-colors outline-none focus:outline-none"
                  style={{
                    backgroundColor: openDropdown === index ? hoverBg : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (openDropdown !== index) {
                      e.currentTarget.style.backgroundColor = hoverBg;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (openDropdown !== index) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                  aria-label={`Show ${segment.label} options`}
                >
                  <ChevronsUpDown
                    size={14}
                    style={{ opacity: 0.6, color: textColor }}
                  />
                </button>
              </div>
            ) : (
              // Simple segment (no dropdown)
              <Link
                href={segment.href || '#'}
                className="px-2 py-1 rounded-md transition-colors text-sm font-medium outline-none focus:outline-none"
                style={{ color: textColor }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = hoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {segment.label}
              </Link>
            )}

            {/* Dropdown Menu */}
            {segment.options && openDropdown === index && (
              <div
                className="absolute top-full left-0 mt-1 min-w-[200px] rounded-lg shadow-xl border z-50 py-1 overflow-hidden"
                style={{
                  backgroundColor: dropdownBg,
                  borderColor: dropdownBorder,
                }}
              >
                {segment.options.map((option, optIndex) => {
                  const Icon = option.icon;
                  const isActive = pathname === option.href ||
                    (option.href !== '/' && pathname.startsWith(option.href));

                  return (
                    <Link
                      key={optIndex}
                      href={option.href}
                      onClick={() => setOpenDropdown(null)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors group/item outline-none focus:outline-none"
                      style={{
                        color: 'var(--foreground)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {Icon && (
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center transition-colors"
                          style={{
                            backgroundColor: isActive ? 'rgba(76, 112, 49, 0.15)' : 'transparent',
                            color: isActive ? 'var(--primary)' : 'var(--foreground-muted)',
                          }}
                        >
                          <Icon size={16} />
                        </div>
                      )}
                      <span>{option.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}
    </nav>
  );
}
