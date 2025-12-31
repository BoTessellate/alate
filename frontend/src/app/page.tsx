'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, BookHeart, Compass, ArrowRight, Sparkles, Grid3X3 } from 'lucide-react';
import { useLooksStore, generateMoodboardPath } from '@/stores/useLooksStore';

export default function Home() {
  const { moodboards } = useLooksStore();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Get recent layers (up to 3, sorted by updatedAt)
  const recentLayers = isHydrated
    ? [...moodboards]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 3)
    : [];

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get cover images from moodboard items (first 4 images)
  const getCoverImages = (items: { type: string; src?: string }[]) => {
    const images: string[] = [];
    for (const item of items) {
      if (item.type === 'image' && item.src && images.length < 4) {
        images.push(item.src);
      }
      if (images.length >= 4) break;
    }
    return images;
  };

  return (
    <div className="min-h-full" style={{ backgroundColor: 'var(--background)' }}>
      {/* Hero Section */}
      <div className="px-8 pt-8 pb-6 max-w-6xl mx-auto">
        {/* Page Header - inline pattern */}
        <div className="flex items-baseline gap-3 mb-8">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
            Welcome back
          </h1>
          <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Ready to create something beautiful?
          </span>
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
                  Create a new layer
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
          {/* Curated Layers - takes 2 columns, only show if there are layers */}
          <div className="lg:col-span-2">
            {recentLayers.length > 0 ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium uppercase tracking-wide" style={{ color: 'var(--foreground-muted)' }}>
                    Curated Layers
                  </h2>
                  <Link
                    href="/looks"
                    className="text-sm font-medium transition-all flex items-center gap-1"
                    style={{ color: 'var(--primary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--primary-dark)';
                      e.currentTarget.style.transform = 'translateX(2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--primary)';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                    onMouseDown={(e) => {
                      e.currentTarget.style.transform = 'translateX(1px) scale(0.98)';
                    }}
                    onMouseUp={(e) => {
                      e.currentTarget.style.transform = 'translateX(2px)';
                    }}
                  >
                    View all
                    <ArrowRight size={14} />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {recentLayers.map((layer) => {
                    const coverImages = getCoverImages(layer.items);
                    return (
                      <Link
                        key={layer.id}
                        href={`/looks/${generateMoodboardPath(layer.name, layer.id)}`}
                        className="group rounded-lg border overflow-hidden transition-all duration-200"
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
                        {/* Cover Image Grid - Square aspect ratio (matches Layers page) */}
                        <div
                          className="aspect-square relative"
                          style={{ backgroundColor: 'var(--background-secondary)' }}
                        >
                          {coverImages.length > 0 ? (
                            <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                              {coverImages.slice(0, 4).map((img, idx) => (
                                <div
                                  key={idx}
                                  className="w-full h-full bg-cover bg-center"
                                  style={{ backgroundImage: `url(${img})` }}
                                />
                              ))}
                              {/* Fill remaining slots if less than 4 images */}
                              {Array.from({ length: Math.max(0, 4 - coverImages.length) }).map(
                                (_, idx) => (
                                  <div
                                    key={`empty-${idx}`}
                                    className="w-full h-full"
                                    style={{ backgroundColor: 'var(--border)' }}
                                  />
                                )
                              )}
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Grid3X3
                                size={32}
                                style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}
                              />
                            </div>
                          )}
                        </div>
                        {/* Moodboard Info - Compact (matches Layers page) */}
                        <div className="p-2.5">
                          <h3 className="font-medium text-sm mb-0.5 truncate" style={{ color: 'var(--foreground)' }}>
                            {layer.name}
                          </h3>
                          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--foreground-muted)' }}>
                            <span>{layer.items.length} item{layer.items.length !== 1 ? 's' : ''}</span>
                            <span>{formatRelativeTime(layer.updatedAt)}</span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              // Empty state - show nothing, just take up space for layout
              <div />
            )}
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
