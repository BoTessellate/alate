'use client';

import { useState } from 'react';
import { Upload, Link } from 'lucide-react';
import PhotoUploadContent from './PhotoUploadContent';
import ScrapeUrlContent from './ScrapeUrlContent';

/**
 * Unified Upload Content - combines Photo Upload and URL Scraping
 * Used inside SidePanel with tabbed interface
 */
export default function UploadContent() {
  const [activeTab, setActiveTab] = useState<'photo' | 'url'>('photo');

  return (
    <div className="flex flex-col h-full">
      {/* Tab Switcher */}
      <div
        className="flex border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <button
          onClick={() => setActiveTab('photo')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative"
          style={{
            color: activeTab === 'photo' ? 'var(--foreground)' : 'var(--foreground-muted)',
          }}
        >
          <Upload size={16} />
          Upload Photo
          {activeTab === 'photo' && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: 'var(--primary)' }}
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('url')}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative"
          style={{
            color: activeTab === 'url' ? 'var(--foreground)' : 'var(--foreground-muted)',
          }}
        >
          <Link size={16} />
          From URL
          {activeTab === 'url' && (
            <div
              className="absolute bottom-0 left-0 right-0 h-0.5"
              style={{ backgroundColor: 'var(--primary)' }}
            />
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'photo' ? (
          <PhotoUploadContent />
        ) : (
          <ScrapeUrlContent />
        )}
      </div>
    </div>
  );
}
