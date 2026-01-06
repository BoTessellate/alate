'use client';

import { useRouter } from 'next/navigation';
import { RefreshCw, ArrowRight, Sparkles } from 'lucide-react';
import { useLooksStore, generateMoodboardPath } from '@/stores/useLooksStore';
import { Collection } from '@/types';
import { Card, SectionHeader } from '@/components/ui';
import { useMiniMoodboard } from './useMiniMoodboard';
import { MiniMoodboardItem } from './MiniMoodboardItem';

interface MiniMoodboardProps {
  timePeriod: string | undefined;
  collections: Collection[];
}

/**
 * Time-based mini moodboard preview component
 * Displays products matching the current time of day's mood
 */
export function MiniMoodboard({ timePeriod, collections }: MiniMoodboardProps) {
  const router = useRouter();
  const { createMoodboard, updateMoodboardItems } = useLooksStore();

  const {
    products,
    complementaryProducts,
    loading,
    moodConfig,
    isEmpty,
    refresh,
  } = useMiniMoodboard(timePeriod);

  // Create full moodboard with these items
  const openFullMoodboard = () => {
    if (products.length === 0) return;

    const title = `${moodConfig?.title || 'Inspiration'} - ${new Date().toLocaleDateString()}`;
    const moodboard = createMoodboard(title);

    // Convert products to canvas items
    const allProducts = [...products, ...complementaryProducts];
    const canvasItems = allProducts.map((product, idx) => ({
      id: `item-${Date.now()}-${idx}`,
      type: 'image' as const,
      x: 80 + (idx % 3) * 200,
      y: 80 + Math.floor(idx / 3) * 200,
      width: 160,
      height: 160,
      rotation: 0,
      zIndex: idx,
      content: product.image_url,
      src: product.image_url,
      alt: product.product_name,
      productName: product.product_name,
      productBrand: product.brand,
      productPrice: product.price,
      productCurrency: product.currency,
    }));

    updateMoodboardItems(moodboard.id, canvasItems);
    router.push(`/looks/${generateMoodboardPath(moodboard.name, moodboard.id)}`);
  };

  // Don't render if no time period
  if (!timePeriod) {
    return null;
  }

  // Check if user has any products in their closet
  const hasProducts = collections.some(col => col.products.length > 0);

  // Loading state
  if (loading) {
    return (
      <Card variant="elevated" className="p-6">
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
          <div className="grid grid-cols-4 gap-3 h-[200px]">
            <div className="col-span-2 row-span-2 bg-gray-200 rounded-lg" />
            <div className="bg-gray-200 rounded-lg" />
            <div className="bg-gray-200 rounded-lg" />
            <div className="bg-gray-200 rounded-lg" />
            <div className="bg-gray-200 rounded-lg" />
          </div>
        </div>
      </Card>
    );
  }

  // Empty state - no products in closet or no matching products
  if (!hasProducts || isEmpty) {
    return (
      <Card variant="elevated" className="p-6">
        <SectionHeader
          title={moodConfig?.title || 'Inspiration'}
          subtitle={moodConfig?.subtitle}
          italic
          size="md"
        />
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Sparkles className="w-8 h-8 text-gray-300 mb-3" />
          {!hasProducts ? (
            <>
              <p className="text-gray-500 text-sm mb-1">
                Community boards coming soon
              </p>
              <p className="text-gray-400 text-xs mb-3">
                Add items to your closet for personalized suggestions
              </p>
            </>
          ) : (
            <p className="text-gray-500 text-sm mb-2">
              No items match this mood yet
            </p>
          )}
          <button
            onClick={() => router.push('/discover')}
            className="text-sm text-[var(--primary)] hover:underline flex items-center gap-1"
          >
            Browse Discover
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <SectionHeader
          title={moodConfig?.title || 'Inspiration'}
          subtitle={moodConfig?.subtitle}
          italic
          size="md"
        />
        <button
          onClick={refresh}
          className="
            p-2 rounded-full
            text-gray-400 hover:text-gray-600
            hover:bg-gray-100
            transition-colors
          "
          title="Refresh suggestions"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-4 gap-3 h-[200px] mb-4">
        {/* Hero item (first product) */}
        {products[0] && (
          <MiniMoodboardItem
            product={products[0]}
            size="hero"
          />
        )}

        {/* Smaller items */}
        {products.slice(1, 5).map(product => (
          <MiniMoodboardItem
            key={product.id}
            product={product}
            size="small"
          />
        ))}
      </div>

      {/* Complementary items row (if any) */}
      {complementaryProducts.length > 0 && (
        <div className="flex gap-3 mb-4">
          {complementaryProducts.map(product => (
            <div key={product.id} className="w-20 h-20 flex-shrink-0">
              <MiniMoodboardItem
                product={product}
                size="small"
                isComplementary
                className="h-full"
              />
            </div>
          ))}
          <div className="flex items-center text-xs text-gray-400 pl-2">
            Complete the look
          </div>
        </div>
      )}

      {/* CTA Button */}
      <button
        onClick={openFullMoodboard}
        className="
          w-full py-2.5 px-4
          flex items-center justify-center gap-2
          text-sm font-medium
          text-[var(--primary)]
          hover:bg-[var(--primary)]/5
          rounded-lg
          transition-colors
        "
      >
        Create full moodboard with these items
        <ArrowRight className="w-4 h-4" />
      </button>
    </Card>
  );
}
