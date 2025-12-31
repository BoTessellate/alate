'use client';

import Link from 'next/link';
import { Plus, LayoutGrid, BookHeart, Compass, ArrowRight, Sparkles } from 'lucide-react';

export default function Home() {
  const stats = [
    { label: 'Layers', value: '12', href: '/looks' },
    { label: 'Collections', value: '5', href: '/collections' },
    { label: 'Saved', value: '48', href: '/discover' },
  ];

  const recentLayers = [
    { id: 1, title: 'Summer Casual', items: 6, lastUpdated: '2h ago' },
    { id: 2, title: 'Office Chic', items: 8, lastUpdated: '1d ago' },
    { id: 3, title: 'Living Room Refresh', items: 5, lastUpdated: '3d ago' },
  ];

  return (
    <div className="min-h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Hero Section */}
      <div className="px-8 pt-8 pb-6 max-w-6xl mx-auto">
        {/* Header with inline stats */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
              Welcome back
            </h1>
            <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
              Ready to create something beautiful?
            </p>
          </div>

          {/* Compact inline stats */}
          <div className="flex items-center gap-6">
            {stats.map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className="flex items-center gap-2 group"
              >
                <span className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
                  {stat.value}
                </span>
                <span
                  className="text-sm transition-colors group-hover:text-[var(--primary)]"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  {stat.label}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Main CTA Card */}
        <Link
          href="/looks/create"
          className="block mb-6 p-6 rounded-2xl border transition-all duration-300 group relative overflow-hidden"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--primary)' }}
              >
                <Plus size={24} color="white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold mb-0.5" style={{ color: 'var(--foreground)' }}>
                  Create a new look
                </h2>
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  Style an outfit, design a room, or curate a collection
                </p>
              </div>
            </div>
            <ArrowRight
              size={20}
              className="transition-transform group-hover:translate-x-1"
              style={{ color: 'var(--foreground-muted)' }}
            />
          </div>
        </Link>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Layers - takes 2 columns */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
                Recent Layers
              </h2>
              <Link
                href="/looks"
                className="text-sm font-medium transition-colors flex items-center gap-1"
                style={{ color: 'var(--primary)' }}
              >
                View all
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {recentLayers.map((layer) => (
                <Link
                  key={layer.id}
                  href={`/looks/${layer.id}`}
                  className="group rounded-xl border overflow-hidden transition-all duration-200"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  <div
                    className="aspect-[4/3]"
                    style={{
                      backgroundColor: 'var(--background-secondary)',
                      backgroundImage: 'linear-gradient(135deg, var(--primary) 0%, var(--cream-dark) 100%)',
                      opacity: 0.4,
                    }}
                  />
                  <div className="p-3">
                    <h3 className="font-medium text-sm mb-1 truncate" style={{ color: 'var(--foreground)' }}>
                      {layer.title}
                    </h3>
                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      <span>{layer.items} items</span>
                      <span>{layer.lastUpdated}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar - Quick actions */}
          <div className="space-y-4">
            {/* Discover Card */}
            <Link
              href="/discover"
              className="block p-4 rounded-xl border transition-all duration-200 group"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(76, 112, 49, 0.15)' }}
                >
                  <Compass size={16} style={{ color: 'var(--primary)' }} />
                </div>
                <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                  Discover
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Explore trending products and find inspiration
              </p>
            </Link>

            {/* AI Feature Card */}
            <div
              className="p-4 rounded-xl border"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(196, 163, 90, 0.15)' }}
                >
                  <Sparkles size={16} style={{ color: 'var(--highlight)' }} />
                </div>
                <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                  AI Styling
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--foreground-muted)' }}>
                Get personalized recommendations based on your style
              </p>
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  backgroundColor: 'rgba(196, 163, 90, 0.15)',
                  color: 'var(--highlight)',
                }}
              >
                Coming soon
              </span>
            </div>

            {/* Collections Quick Access */}
            <Link
              href="/collections"
              className="block p-4 rounded-xl border transition-all duration-200 group"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(139, 107, 74, 0.15)' }}
                >
                  <BookHeart size={16} style={{ color: 'var(--secondary)' }} />
                </div>
                <span className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                  Collections
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                Browse your saved products and wishlists
              </p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
