'use client';

import Link from 'next/link';
import { User, Users, ArrowRight, Shirt, Globe } from 'lucide-react';

export default function ClosetPage() {
  return (
    <div style={{ backgroundColor: 'var(--background)' }} className="min-h-screen">
      {/* Header Section */}
      <div className="px-8 pt-8 pb-6 max-w-4xl mx-auto text-center">
        <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--foreground)' }}>
          Closet
        </h1>
        <p className="text-lg" style={{ color: 'var(--foreground-secondary)' }}>
          Your wardrobe, your way. Choose how you want to explore.
        </p>
      </div>

      {/* Options Grid */}
      <div className="px-8 pb-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Collection */}
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

          {/* Community Closet */}
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
