'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, BookHeart, Compass, ArrowRight, Sparkles, Grid3X3, Shirt, TrendingDown, Clock } from 'lucide-react';
import { useLooksStore, generateMoodboardPath } from '@/stores/useLooksStore';
import { useSettingsStore, type LocalCurrency } from '@/stores/useSettingsStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import { Card, SectionHeader, WeatherWidget } from '@/components/ui';

// Currency symbols map
const CURRENCY_SYMBOLS: Record<LocalCurrency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
};

// Get time of day context for layer suggestions
const getTimeContext = (hour: number): { period: string; suggestion: string } => {
  if (hour >= 5 && hour < 9) return { period: 'Early Morning', suggestion: 'workout, commute' };
  if (hour >= 9 && hour < 12) return { period: 'Morning', suggestion: 'work, meetings' };
  if (hour >= 12 && hour < 14) return { period: 'Midday', suggestion: 'lunch, errands' };
  if (hour >= 14 && hour < 17) return { period: 'Afternoon', suggestion: 'work, study' };
  if (hour >= 17 && hour < 20) return { period: 'Evening', suggestion: 'dinner, dates' };
  if (hour >= 20 && hour < 23) return { period: 'Night', suggestion: 'lounge, events' };
  return { period: 'Late Night', suggestion: 'home, rest' };
};

export default function Home() {
  const { moodboards } = useLooksStore();
  const userName = useSettingsStore(state => state.userName);
  const localCurrency = useSettingsStore(state => state.localCurrency);
  const { collections } = useCollectionsStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setIsHydrated(true);
    setCurrentTime(new Date());

    // Update time every minute
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Calculate total items in closet (all products across all collections)
  const totalClosetItems = isHydrated
    ? collections.reduce((total, col) => total + col.products.length, 0)
    : 0;

  // Placeholder for average price per wear (to be implemented later)
  const avgPricePerWear = 42.50; // Placeholder value
  const currencySymbol = CURRENCY_SYMBOLS[localCurrency] || '$';

  // Time context for layer suggestions
  const timeContext = currentTime ? getTimeContext(currentTime.getHours()) : null;
  const formattedTime = currentTime
    ? currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

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
      <div className="px-8 py-16 max-w-6xl mx-auto text-center">
        <p
          className="text-sm tracking-[0.3em] uppercase mb-4"
          style={{
            color: 'var(--foreground-muted)',
            letterSpacing: '0.3em',
          }}
        >
          {isHydrated && userName ? `Welcome Back, ${userName}` : 'Welcome Back'}
        </p>

        <h1
          className="text-6xl md:text-7xl lg:text-8xl italic mb-4"
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            color: 'var(--foreground)',
            lineHeight: 1,
          }}
        >
          The Mood Layer
        </h1>

        <p
          className="text-lg md:text-xl max-w-lg mx-auto mb-8"
          style={{
            fontFamily: 'var(--font-cormorant)',
            color: 'var(--foreground-secondary)',
            fontWeight: 300,
            letterSpacing: '0.05em',
          }}
        >
          is ready with something beautiful for you
        </p>
      </div>

      {/* Stats Bar - Transparent with animated stat items */}
      <div className="py-6">
        <div className="px-8 max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            {/* Left side - Weather & Time */}
            <div className="flex items-center gap-6">
              {/* Weather - with hover animation */}
              <div
                className="group flex items-center gap-4 px-4 py-3 rounded-lg border transition-all duration-200 cursor-default hover:-translate-y-0.5"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: 'var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-dark)';
                  e.currentTarget.style.boxShadow = '0 8px 25px -5px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <WeatherWidget />
              </div>

              {/* Time of Day - with hover animation */}
              {formattedTime && timeContext && (
                <div
                  className="group flex items-center gap-4 px-4 py-3 rounded-lg border transition-all duration-200 cursor-default hover:-translate-y-0.5"
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'var(--border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary-dark)';
                    e.currentTarget.style.boxShadow = '0 8px 25px -5px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <Clock size={20} style={{ color: 'var(--foreground-muted)' }} />
                  <span
                    className="text-2xl"
                    style={{
                      color: 'var(--foreground)',
                      fontFamily: 'var(--font-cormorant)',
                      fontWeight: 400,
                      lineHeight: 1,
                    }}
                  >
                    {formattedTime}
                  </span>
                  <div className="flex flex-col">
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--foreground)', lineHeight: 1.2 }}
                    >
                      {timeContext.period}
                    </span>
                    <span
                      className="text-xs"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      {timeContext.suggestion}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Right side - Closet Stats */}
            <div className="flex items-center gap-6">
              {/* Closet Items - with hover animation */}
              <div
                className="group flex items-center gap-4 px-4 py-3 rounded-lg border transition-all duration-200 cursor-default hover:-translate-y-0.5"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: 'var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-dark)';
                  e.currentTarget.style.boxShadow = '0 8px 25px -5px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <Shirt size={20} style={{ color: 'var(--foreground-muted)' }} />
                <span
                  className="text-2xl"
                  style={{
                    color: 'var(--foreground)',
                    fontFamily: 'var(--font-cormorant)',
                    fontWeight: 400,
                    lineHeight: 1,
                  }}
                >
                  {isHydrated ? totalClosetItems : '—'}
                </span>
                <div className="flex flex-col">
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--foreground)', lineHeight: 1.2 }}
                  >
                    Items
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    in closet
                  </span>
                </div>
              </div>

              {/* Avg Price Per Wear - with hover animation */}
              <div
                className="group flex items-center gap-4 px-4 py-3 rounded-lg border transition-all duration-200 cursor-default hover:-translate-y-0.5"
                style={{
                  backgroundColor: 'transparent',
                  borderColor: 'var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary-dark)';
                  e.currentTarget.style.boxShadow = '0 8px 25px -5px rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <TrendingDown size={20} style={{ color: 'var(--foreground-muted)' }} />
                <span
                  className="text-2xl"
                  style={{
                    color: 'var(--foreground)',
                    fontFamily: 'var(--font-cormorant)',
                    fontWeight: 400,
                    lineHeight: 1,
                  }}
                >
                  {isHydrated ? `${currencySymbol}${avgPricePerWear.toFixed(0)}` : '—'}
                </span>
                <div className="flex flex-col">
                  <span
                    className="text-sm font-medium"
                    style={{ color: 'var(--foreground)', lineHeight: 1.2 }}
                  >
                    Avg cost
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    per wear
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 pb-24 max-w-6xl mx-auto">

        {/* Main CTA Card */}
        <Card
          variant="elevated"
          onClick={() => window.location.href = '/looks/create'}
          className="mb-6 p-6 rounded-2xl group"
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
                <h2
                  className="text-xl italic mb-0.5"
                  style={{
                    fontFamily: 'var(--font-cormorant)',
                    fontWeight: 500,
                    color: 'var(--foreground)',
                  }}
                >
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
        </Card>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Curated Layers - takes 2 columns */}
          <div className="lg:col-span-2">
            {recentLayers.length > 0 ? (
              <>
                <SectionHeader
                  title="Curated Layers"
                  italic
                  actions={
                    <Link
                      href="/looks"
                      className="text-sm font-medium transition-colors flex items-center gap-1"
                      style={{ color: 'var(--primary)' }}
                    >
                      View all
                      <ArrowRight size={14} />
                    </Link>
                  }
                  className="mb-4"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {recentLayers.map((layer) => {
                    const coverImages = getCoverImages(layer.items);
                    return (
                      <Card
                        key={layer.id}
                        variant="interactive"
                        onClick={() => window.location.href = `/looks/${generateMoodboardPath(layer.name, layer.id)}`}
                      >
                        {/* Cover Image Grid */}
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
                        {/* Moodboard Info */}
                        <div className="p-2.5">
                          <h3 className="font-medium text-sm mb-0.5 truncate" style={{ color: 'var(--foreground)' }}>
                            {layer.name}
                          </h3>
                          <div className="flex items-center justify-between text-xs" style={{ color: 'var(--foreground-muted)' }}>
                            <span>{layer.items.length} item{layer.items.length !== 1 ? 's' : ''}</span>
                            <span>{formatRelativeTime(layer.updatedAt)}</span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            ) : (
              <div />
            )}
          </div>

          {/* Sidebar - Quick actions */}
          <div className="space-y-4">
            {/* Discover Card */}
            <Card
              variant="interactive"
              onClick={() => window.location.href = '/discover'}
              padding="md"
              className="rounded-xl"
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
            </Card>

            {/* AI Feature Card */}
            <Card padding="md" className="rounded-xl" hoverHighlight={false}>
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
            </Card>

            {/* Collections Quick Access */}
            <Card
              variant="interactive"
              onClick={() => window.location.href = '/collections'}
              padding="md"
              className="rounded-xl"
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
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
