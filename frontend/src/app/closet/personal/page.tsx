'use client';

import { useState } from 'react';
import { Plus, Search, Grid3X3, MoreHorizontal } from 'lucide-react';
import { Button, EmptyState, PageHeader } from '@/components/ui';

// Placeholder for personal collection - will be connected to a store later
export default function PersonalCollectionPage() {
  const [items, setItems] = useState<any[]>([]);

  return (
    <div style={{ backgroundColor: 'var(--background)' }}>
      {/* Header Section */}
      <PageHeader
        title="Personal"
        subtitle="Your saved items and wardrobe"
        actions={
          <Button variant="primary" icon={Plus}>
            Add Item
          </Button>
        }
      />

      {/* Content area */}
      <div className="px-8 pb-8 max-w-7xl mx-auto">
        {items.length === 0 ? (
          <EmptyState
            icon={Grid3X3}
            title="Your closet is empty"
            description="Start building your personal collection by discovering items."
            action={{
              label: 'Discover Items',
              onClick: () => window.location.href = '/discover',
              icon: Search,
            }}
          />
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
