'use client';

import Link from 'next/link';
import { ArrowRight, Shirt, Globe } from 'lucide-react';

const HERO_BG_URL = 'https://ancuwmmivgdvommzigwv.supabase.co/storage/v1/object/sign/digital%20assets/orange-pink%20tessellate.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9iNWFkYWFkOS01Y2YyLTRmNzQtYmU5Yi0wYTdjMjdhMDE2NzIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJkaWdpdGFsIGFzc2V0cy9vcmFuZ2UtcGluayB0ZXNzZWxsYXRlLnBuZyIsImlhdCI6MTc2NzI1ODA0MywiZXhwIjoxNzk4Nzk0MDQzfQ.63awLEQS0BRy-IqezYCHvljLIQ0jmJ7qgIsnpWm314A';

export default function ClosetPage() {
  return (
    <div style={{ backgroundColor: 'var(--background)' }} className="min-h-screen">
      {/* Hero Section with Background Image */}
      <div className="relative overflow-hidden">
        {/* Background Image with enhanced saturation and sharpness */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${HERO_BG_URL})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'saturate(1.3) contrast(1.1)',
          }}
        />

        {/* Overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.3) 50%, rgba(0, 0, 0, 0.5) 100%)',
          }}
        />

        {/* Hero Content */}
        <div className="relative z-10 px-8 py-24 max-w-4xl mx-auto text-center">
          <p
            className="text-sm tracking-[0.3em] uppercase mb-6"
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontFamily: 'var(--font-geist-sans)',
              letterSpacing: '0.3em',
            }}
          >
            The Mood Layer Presents
          </p>

          <h1
            className="text-7xl md:text-8xl lg:text-9xl font-light mb-6"
            style={{
              fontFamily: 'var(--font-cormorant)',
              color: 'white',
              textShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
              lineHeight: 1,
            }}
          >
            Closet
          </h1>

          <p
            className="text-lg md:text-xl max-w-lg mx-auto"
            style={{
              fontFamily: 'var(--font-cormorant)',
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: 300,
              letterSpacing: '0.05em',
            }}
          >
            Your wardrobe, curated with intention
          </p>
        </div>
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
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mb-5"
              style={{ backgroundColor: 'var(--primary)', opacity: 0.9 }}
            >
              <Shirt size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
              Personal
            </h2>
            <p className="mb-6" style={{ color: 'var(--foreground-secondary)' }}>
              Your saved items and wardrobe. Build your personal style library with pieces you own or love.
            </p>
            <div
              className="flex items-center gap-2 text-sm font-medium group-hover:gap-3 transition-all"
              style={{ color: 'var(--primary)' }}
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
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
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
