'use client';

import { useState } from 'react';
import { Search, Grid3X3, Users, Heart } from 'lucide-react';

// Placeholder for community closet - will be connected to API later
export default function CommunityClosetPage() {
  const [collections, setCollections] = useState<any[]>([]);

  return (
    <div style={{ backgroundColor: 'var(--background)' }}>
      {/* Header Section */}
      <div className="px-8 pt-8 pb-6 max-w-7xl mx-auto flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
            Community
          </h1>
          <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Curated collections from the community
          </span>
        </div>
      </div>

      {/* Content area */}
      <div className="px-8 pb-8 max-w-7xl mx-auto">
        {collections.length === 0 ? (
          /* Empty State */
          <div
            className="text-center py-20 rounded-lg border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <Users
              size={48}
              className="mx-auto mb-4"
              style={{ color: 'var(--foreground-muted)' }}
            />
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              Community collections coming soon
            </h3>
            <p className="mb-6 max-w-md mx-auto" style={{ color: 'var(--foreground-secondary)' }}>
              We're building a space for the community to share their curated wardrobes and style inspiration.
            </p>
            <a
              href="/discover"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                backgroundColor: 'var(--secondary)',
                color: 'white',
              }}
            >
              <Search size={18} />
              Discover Items
            </a>
          </div>
        ) : (
          /* Collections Grid */
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                {collections.length} collection{collections.length !== 1 ? 's' : ''} shared
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {collections.map((collection) => (
                <div
                  key={collection.id}
                  className="group relative rounded-lg overflow-hidden border transition-shadow hover:shadow-lg"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="aspect-[4/3] bg-gray-100">
                    {collection.coverImage && (
                      <img
                        src={collection.coverImage}
                        alt={collection.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold mb-1" style={{ color: 'var(--foreground)' }}>
                      {collection.name}
                    </h3>
                    <p className="text-sm mb-3" style={{ color: 'var(--foreground-secondary)' }}>
                      by {collection.author}
                    </p>
                    <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                      <span>{collection.itemCount} items</span>
                      <span className="flex items-center gap-1">
                        <Heart size={14} />
                        {collection.likes}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
