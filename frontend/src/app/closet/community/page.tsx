'use client';

import { useState } from 'react';
import { Search, Users, Heart } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/ui';

// Placeholder for community closet - will be connected to API later
export default function CommunityClosetPage() {
  const [collections, setCollections] = useState<any[]>([]);

  return (
    <div style={{ backgroundColor: 'var(--background)' }}>
      {/* Header Section */}
      <PageHeader
        title="Community"
        subtitle="Curated collections from the community"
      />

      {/* Content area */}
      <div className="px-8 pb-8 max-w-7xl mx-auto">
        {collections.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Community collections coming soon"
            description="We're building a space for the community to share their curated wardrobes and style inspiration."
            action={{
              label: 'Discover Items',
              onClick: () => window.location.href = '/discover',
              icon: Search,
              variant: 'secondary',
            }}
          />
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
                    <h3
                      className="text-lg italic mb-1"
                      style={{
                        fontFamily: 'var(--font-cormorant)',
                        fontWeight: 500,
                        color: 'var(--foreground)',
                      }}
                    >
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
