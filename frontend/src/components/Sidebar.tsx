'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  LayoutGrid,
  Heart,
  Compass,
  Settings,
} from 'lucide-react';

const navigationItems = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Discover', href: '/discover', icon: Compass },
  { name: 'My Looks', href: '/looks', icon: LayoutGrid },
  { name: 'Collections', href: '/collections', icon: Heart },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      className="fixed left-0 top-0 h-full transition-all duration-300 ease-in-out z-40"
      style={{
        width: isExpanded ? 'var(--sidebar-expanded)' : 'var(--sidebar-width)',
        backgroundColor: 'var(--background-tertiary)',
        borderRight: '1px solid var(--border)',
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo */}
      <div
        className="flex items-center px-3 border-b"
        style={{
          height: 'var(--topbar-height)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Custom logo: cream circle with green pill */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#f6e9cf' }}
        >
          <div
            className="w-4 h-1.5 rounded-full"
            style={{ backgroundColor: '#4a7c4e' }}
          />
        </div>
        {isExpanded && (
          <span
            className="ml-3 font-semibold text-sm whitespace-nowrap"
            style={{ color: 'var(--foreground)' }}
          >
            The Mood Layer
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="py-4">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.href} className="px-2">
                <Link
                  href={item.href}
                  className="flex items-center rounded-md transition-all duration-200 group relative"
                  style={{
                    backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                    color: isActive ? 'white' : 'var(--foreground-secondary)',
                    height: '40px',
                    paddingLeft: isExpanded ? '12px' : '0',
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'var(--surface)';
                      e.currentTarget.style.color = 'var(--foreground)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--foreground-secondary)';
                    }
                  }}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  {isExpanded && (
                    <span className="ml-3 text-sm font-medium whitespace-nowrap">
                      {item.name}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
