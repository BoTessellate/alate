'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  Layers2,
  BookHeart,
  Compass,
  Settings,
} from 'lucide-react';

const navigationItems = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Discover', href: '/discover', icon: Compass },
  { name: 'My Layers', href: '/looks', icon: Layers2 },
  { name: 'Collections', href: '/collections', icon: BookHeart },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      className="fixed left-0 top-0 h-full transition-all duration-300 ease-in-out z-40 flex"
      style={{
        width: isExpanded ? 'calc(var(--sidebar-expanded) + 20px)' : 'calc(var(--sidebar-width) + 20px)',
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Main sidebar content */}
      <div
        className="h-full transition-all duration-300 ease-in-out"
        style={{
          width: isExpanded ? 'var(--sidebar-expanded)' : 'var(--sidebar-width)',
          backgroundColor: 'var(--background-tertiary)',
        }}
      >
      {/* Logo */}
      <div
        className="flex items-center border-b relative transition-all duration-300"
        style={{
          height: 'var(--topbar-height)',
          borderColor: 'var(--border)',
          // Center logo when collapsed, left-align when expanded
          justifyContent: isExpanded ? 'flex-start' : 'center',
          paddingLeft: isExpanded ? '12px' : '0',
          paddingRight: isExpanded ? '12px' : '0',
        }}
      >
        {/* Custom logo: charcoal circle with green pill (light mode) */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: '#222222' }}
        >
          <div
            className="w-4 h-1.5 rounded-full"
            style={{ backgroundColor: '#546c22' }}
          />
        </div>
        {/* Text - absolutely positioned to not affect icon centering */}
        <span
          className="ml-3 font-semibold text-sm whitespace-nowrap transition-all duration-300 ease-in-out absolute"
          style={{
            color: 'var(--foreground)',
            opacity: isExpanded ? 1 : 0,
            transform: isExpanded ? 'translateX(0)' : 'translateX(-8px)',
            left: '52px', // 12px padding + 32px logo + 8px gap
            pointerEvents: isExpanded ? 'auto' : 'none',
          }}
        >
          The Mood Layer
        </span>
      </div>

      {/* Navigation */}
      <nav className="py-4">
        <ul className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center rounded-md transition-all duration-200 group relative mx-2"
                  style={{
                    backgroundColor: isActive ? 'var(--primary)' : 'transparent',
                    color: isActive ? 'white' : 'var(--foreground-secondary)',
                    height: '40px',
                    // Center icons when collapsed, left-align when expanded
                    justifyContent: isExpanded ? 'flex-start' : 'center',
                    paddingLeft: isExpanded ? '12px' : '0',
                    paddingRight: isExpanded ? '12px' : '0',
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
                  {/* Text - absolutely positioned to not affect icon centering */}
                  <span
                    className="text-sm font-medium whitespace-nowrap transition-all duration-300 ease-in-out absolute"
                    style={{
                      opacity: isExpanded ? 1 : 0,
                      transform: isExpanded ? 'translateX(0)' : 'translateX(-8px)',
                      left: '44px', // 8px margin + 12px padding + 20px icon + 4px gap
                      pointerEvents: isExpanded ? 'auto' : 'none',
                    }}
                  >
                    {item.name}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      </div>

      {/* Curved right edge - vertical arc bulging outward */}
      <div
        className="h-full transition-all duration-300 ease-in-out"
        style={{
          width: '20px',
          backgroundColor: 'var(--background-tertiary)',
          borderRadius: '0 100% 100% 0 / 0 50% 50% 0',
        }}
      />
    </aside>
  );
}
