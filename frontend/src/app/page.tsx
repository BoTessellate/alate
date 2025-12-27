'use client';

import Link from 'next/link';
import { Plus, LayoutGrid, Heart, Compass } from 'lucide-react';

export default function Home() {
  const stats = [
    { label: 'My Looks', value: '12', icon: LayoutGrid, color: 'var(--primary)', href: '/looks' },
    { label: 'Collections', value: '5', icon: Heart, color: 'var(--secondary)', href: '/collections' },
    { label: 'Discovered', value: '48', icon: Compass, color: 'var(--accent)', href: '/discover' },
  ];

  const quickActions = [
    {
      title: 'Create Look',
      description: 'Style a new outfit or room design',
      icon: Plus,
      href: '/looks/create',
      color: 'var(--primary)',
    },
    {
      title: 'Discover',
      description: 'Explore and save products you love',
      icon: Compass,
      href: '/discover',
      color: 'var(--accent)',
    },
  ];

  const recentLooks = [
    { id: 1, title: 'Summer Casual', items: 6, lastUpdated: '2 hours ago' },
    { id: 2, title: 'Office Chic', items: 8, lastUpdated: '1 day ago' },
    { id: 3, title: 'Living Room Refresh', items: 5, lastUpdated: '3 days ago' },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
          Welcome back
        </h1>
        <p style={{ color: 'var(--foreground-secondary)' }}>
          Here's what's happening with your looks today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="p-6 rounded-lg border transition-all duration-200"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = stat.color;
                e.currentTarget.style.backgroundColor = 'var(--surface-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.backgroundColor = 'var(--surface)';
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-sm font-medium"
                  style={{ color: 'var(--foreground-secondary)' }}
                >
                  {stat.label}
                </span>
                <Icon size={20} style={{ color: stat.color }} />
              </div>
              <p className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
                {stat.value}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <a
                key={action.title}
                href={action.href}
                className="group p-6 rounded-lg border transition-all duration-200"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = action.color;
                  e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.backgroundColor = 'var(--surface)';
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="p-3 rounded-lg"
                    style={{ backgroundColor: action.color + '20' }}
                  >
                    <Icon size={24} style={{ color: action.color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                      {action.title}
                    </h3>
                    <p style={{ color: 'var(--foreground-secondary)' }}>
                      {action.description}
                    </p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* Recent Creations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
            Recent Creations
          </h2>
          <a
            href="/looks"
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--primary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--primary-light)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--primary)';
            }}
          >
            View all
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recentLooks.map((look) => (
            <div
              key={look.id}
              className="group p-6 rounded-lg border cursor-pointer transition-all duration-200"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.backgroundColor = 'var(--surface-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.backgroundColor = 'var(--surface)';
              }}
            >
              <div
                className="w-full h-32 rounded-lg mb-4"
                style={{
                  backgroundColor: 'var(--background-secondary)',
                  backgroundImage: 'linear-gradient(135deg, var(--primary) 0%, var(--cream-dark) 100%)',
                  opacity: 0.5,
                }}
              />
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                {look.title}
              </h3>
              <div className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--foreground-secondary)' }}>
                  {look.items} items
                </span>
                <span style={{ color: 'var(--foreground-muted)' }}>
                  {look.lastUpdated}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
