'use client';

import { useState } from 'react';
import { Plus, Search, Grid3X3, MoreHorizontal } from 'lucide-react';

// Placeholder for personal collection - will be connected to a store later
export default function PersonalCollectionPage() {
  const [items, setItems] = useState<any[]>([]);

  return (
    <div style={{ backgroundColor: 'var(--background)' }}>
      {/* Header Section - matches Discover/Looks page */}
      <div className="px-8 pt-8 pb-6 max-w-7xl mx-auto flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
            Personal Collection
          </h1>
          <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Your saved items and wardrobe
          </span>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors cursor-pointer"
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
        >
          <Plus size={20} />
          Add Item
        </button>
      </div>

      {/* Content area */}
      <div className="px-8 pb-8 max-w-7xl mx-auto">
        {items.length === 0 ? (
          /* Empty State */
          <div
            className="text-center py-20 rounded-lg border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <Grid3X3
              size={48}
              className="mx-auto mb-4"
              style={{ color: 'var(--foreground-muted)' }}
            />
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              Your closet is empty
            </h3>
            <p className="mb-6" style={{ color: 'var(--foreground-secondary)' }}>
              Start building your personal collection by discovering items.
            </p>
            <a
              href="/discover"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'var(--primary)',
                color: 'white',
              }}
            >
              <Search size={18} />
              Discover Items
            </a>
          </div>
        ) : (
          /* Items Grid */
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                {items.length} item{items.length !== 1 ? 's' : ''} in your collection
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-lg overflow-hidden aspect-square border"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div
                    className="absolute inset-x-0 bottom-0 p-3"
                    style={{
                      background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
                    }}
                  >
                    <p className="text-sm font-medium text-white truncate">{item.name}</p>
                  </div>
                  <button
                    className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      color: 'white',
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
