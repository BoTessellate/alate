'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ChevronsUpDown, Compass, Layers2, PersonStanding, AlignHorizontalSpaceAround, Grid3X3 } from 'lucide-react';
import { useLooksStore, generateMoodboardPath } from '@/stores/useLooksStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface BreadcrumbSegment {
  label: string;
  href?: string;
  options?: {
    label: string;
    href: string;
    icon?: React.ComponentType<{ size?: number }>;
  }[];
}

// Root level options (switching between main sections)
const ROOT_OPTIONS = [
  { label: 'Layers', href: '/looks', icon: Layers2 },
  { label: 'Closet', href: '/closet', icon: AlignHorizontalSpaceAround },
  { label: 'Discover', href: '/discover', icon: Compass },
];

// Closet sub-navigation
const CLOSET_CHILDREN = [
  { label: 'Discover', href: '/discover', icon: Compass },
  { label: 'Personal Collection', href: '/closet/personal', icon: PersonStanding },
];

export default function BreadcrumbNav() {
  const pathname = usePathname();
  const { moodboards, getMoodboardBySlug } = useLooksStore();
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

  // Build breadcrumb segments based on current path
  const buildBreadcrumbs = (): BreadcrumbSegment[] => {
    const segments: BreadcrumbSegment[] = [];

    // First segment: User's Mood Layer or The Mood Layer
    segments.push({
      label: displayName ? `${displayName}'s Mood Layer` : 'The Mood Layer',
      href: '/',
      options: ROOT_OPTIONS,
    });

    // Home page - just show root
    if (pathname === '/' || pathname === '') {
      return segments;
    }

    // LOOKS SECTION
    if (pathname.startsWith('/looks')) {
      // Build moodboard options for dropdown
      const looksOptions = moodboards.map(mb => ({
        label: mb.name,
        href: `/looks/${generateMoodboardPath(mb.name, mb.id)}`,
        icon: Grid3X3,
      }));

      // Add "Layers" as section with dropdown to moodboards
      segments.push({
        label: 'Layers',
        href: '/looks',
        options: looksOptions.length > 0 ? looksOptions : undefined,
      });

      // /looks page - shows all moodboards
      if (pathname === '/looks') {
        return segments;
      }

      // /looks/discover - discover looks page
      if (pathname === '/looks/discover') {
        segments.push({
          label: 'Discover',
          href: '/looks/discover',
        });
        return segments;
      }

      const pathParts = pathname.split('/').filter(Boolean);

      // /looks/[moodboardSlug] - moodboard editor
      if (pathParts.length === 2) {
        const moodboardSlug = pathParts[1];
        if (moodboardSlug && isHydrated) {
          const moodboard = getMoodboardBySlug(moodboardSlug);
          if (moodboard) {
            // Get all moodboards as options for dropdown
            const moodboardOptions = moodboards.map(mb => ({
              label: mb.name,
              href: `/looks/${generateMoodboardPath(mb.name, mb.id)}`,
              icon: Grid3X3,
            }));

            segments.push({
              label: moodboard.name,
              href: pathname,
              options: moodboardOptions.length > 1 ? moodboardOptions : undefined,
            });
          }
        }
        return segments;
      }
    }

    // DISCOVER PAGE (at root level)
    if (pathname === '/discover') {
      segments.push({
        label: 'Discover',
        href: '/discover',
      });
      return segments;
    }

    // CLOSET SECTION
    if (pathname.startsWith('/closet')) {
      segments.push({
        label: 'Closet',
        href: '/closet',
        options: CLOSET_CHILDREN,
      });

      if (pathname === '/closet/personal') {
        segments.push({
          label: 'Personal Collection',
          href: '/closet/personal',
          options: CLOSET_CHILDREN,
        });
      }
      return segments;
    }

    // SETTINGS SECTION
    if (pathname === '/settings') {
      segments.push({
        label: 'Account Settings',
        href: '/settings',
      });
      return segments;
    }

    return segments;
  };

  const breadcrumbs = buildBreadcrumbs();

  // Check if current page is in looks section for theming
  const isLooksListPage = pathname === '/looks';

  // Colors based on topbar theme
  const textColor = isLooksListPage ? 'var(--charcoal)' : '#f6e9cf';
  const textColorMuted = isLooksListPage ? 'rgba(34, 34, 34, 0.5)' : 'rgba(246, 233, 207, 0.5)';
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
            {segment.options && segment.options.length > 0 && index !== breadcrumbs.length - 1 ? (
              // Segment with dropdown (not shown for last item)
              <button
                onClick={() => setOpenDropdown(openDropdown === index ? null : index)}
                className="flex items-center gap-1 px-2 py-1 text-sm font-medium group/breadcrumb"
                style={{
                  color: textColor,
                }}
              >
                <span>{segment.label}</span>
                <div
                  className="w-5 h-5 rounded flex items-center justify-center transition-colors"
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
                >
                  <ChevronsUpDown
                    size={14}
                    style={{ opacity: 0.6 }}
                  />
                </div>
              </button>
            ) : (
              // Simple segment (no dropdown)
              <Link
                href={segment.href || '#'}
                className="px-2 py-1 rounded-md transition-colors text-sm font-medium"
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
                      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors group/item"
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
