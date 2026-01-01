'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import TopBar from './TopBar';
import ThemeProvider from './ThemeProvider';
import FloatingActionButton from './FloatingActionButton';
import { ErrorBoundary } from '@/components/ui';
import { useUserStore } from '@/stores/useUserStore';
import { Loader2 } from 'lucide-react';

// Lazy load the photo upload modal - only needed when user clicks upload
const PhotoUploadModal = dynamic(() => import('./PhotoUploadModal'), {
  loading: () => null,
});

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  // Use selector pattern for better performance
  const hasCompletedOnboarding = useUserStore(state => state.hasCompletedOnboarding);
  const [isHydrated, setIsHydrated] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Redirect to onboarding if not completed (except if already on onboarding page)
  useEffect(() => {
    if (isHydrated && pathname !== '/onboarding' && !hasCompletedOnboarding()) {
      router.replace('/onboarding');
    }
  }, [isHydrated, pathname, hasCompletedOnboarding, router]);

  // Show loading while hydrating
  if (!isHydrated) {
    return (
      <ThemeProvider>
        <div
          className="flex h-screen w-screen items-center justify-center"
          style={{ backgroundColor: 'var(--background)' }}
        >
          <Loader2
            size={32}
            className="animate-spin"
            style={{ color: 'var(--primary)' }}
          />
        </div>
      </ThemeProvider>
    );
  }

  // Render onboarding page without sidebar/topbar
  if (pathname === '/onboarding') {
    return (
      <ThemeProvider>
        <div
          className="h-screen w-screen overflow-hidden"
          style={{ backgroundColor: 'var(--background)' }}
        >
          <ErrorBoundary
            onError={(error) => console.error('[Onboarding] Error:', error.message)}
            showReset
          >
            {children}
          </ErrorBoundary>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
        {/* Skip link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'white',
          }}
        >
          Skip to main content
        </a>

        {/* Top bar with navigation */}
        <TopBar />

        {/* Scrollable content */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto focus:outline-none"
          style={{
            marginTop: 'calc(var(--topbar-height) + 20px)', // 20px for curved bottom
          }}
        >
          <ErrorBoundary
            onError={(error, errorInfo) => {
              console.error('[AppLayout] Page error:', error.message);
              console.error('[AppLayout] Component stack:', errorInfo.componentStack);
            }}
            showReset
          >
            {children}
          </ErrorBoundary>
        </main>

        {/* Floating Action Button - Upload Product Photo */}
        <FloatingActionButton />

        {/* Photo Upload Modal */}
        <PhotoUploadModal />
      </div>
    </ThemeProvider>
  );
}
