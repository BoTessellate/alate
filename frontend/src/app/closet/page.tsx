'use client';

import Link from 'next/link';
import { ArrowRight, Shirt, Globe } from 'lucide-react';

export default function ClosetPage() {
  return (
    <div style={{ backgroundColor: 'var(--background)' }} className="min-h-screen">
      {/* Hero Section */}
      <div className="px-8 py-20 max-w-4xl mx-auto text-center">
        <p
          className="text-sm tracking-[0.3em] uppercase mb-6"
          style={{
            color: 'var(--foreground-muted)',
            letterSpacing: '0.3em',
          }}
        >
          The Mood Layer Presents
        </p>

        <h1
          className="text-7xl md:text-8xl lg:text-9xl italic mb-6"
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            color: 'var(--foreground)',
            lineHeight: 1,
          }}
        >
          Closet
        </h1>

        <p
          className="text-lg md:text-xl max-w-lg mx-auto"
          style={{
            fontFamily: 'var(--font-cormorant)',
            color: 'var(--foreground-secondary)',
            fontWeight: 300,
            letterSpacing: '0.05em',
          }}
        >
          Your wardrobe, curated with intention
        </p>
      </div>

      {/* Options Grid */}
      <div className="px-8 py-12 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal */}
          <Link
            href="/closet/personal"
            className="group relative rounded-xl border p-8 transition-all duration-200 hover:shadow-lg"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-dark)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
              style={{ backgroundColor: 'var(--primary-dark)', opacity: 0.9 }}
            >
              <Shirt size={28} className="text-white" />
            </div>
            <h2
              className="text-2xl italic mb-2"
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              Personal
            </h2>
            <p className="mb-6" style={{ color: 'var(--foreground-secondary)' }}>
              Your saved items and wardrobe. Build your personal style library with pieces you own or love.
            </p>
            <div
              className="flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all"
              style={{ color: 'var(--primary-dark)' }}
            >
              <span>View your closet</span>
              <ArrowRight size={16} />
            </div>
          </Link>

          {/* Community */}
          <Link
            href="/closet/community"
            className="group relative rounded-xl border p-8 transition-all duration-200 hover:shadow-lg"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--secondary)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
              style={{ backgroundColor: 'var(--secondary)', opacity: 0.9 }}
            >
              <Globe size={28} className="text-white" />
            </div>
            <h2
              className="text-2xl italic mb-2"
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
              Community
            </h2>
            <p className="mb-6" style={{ color: 'var(--foreground-secondary)' }}>
              Explore what others are wearing. Get inspired by curated collections from the community.
            </p>
            <div
              className="flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all"
              style={{ color: 'var(--secondary)' }}
            >
              <span>Explore community</span>
              <ArrowRight size={16} />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
