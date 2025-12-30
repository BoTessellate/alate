'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import TopBar from './TopBar';
import ThemeProvider from './ThemeProvider';
import FloatingActionButton from './FloatingActionButton';
import PhotoUploadModal from './PhotoUploadModal';
import { useUserStore } from '@/stores/useUserStore';
import { Loader2 } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { hasCompletedOnboarding } = useUserStore();
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
          {children}
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ backgroundColor: 'var(--background)' }}>
        {/* Top bar with navigation */}
        <TopBar />

        {/* Scrollable content */}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            marginTop: 'calc(var(--topbar-height) + 20px)', // 20px for curved bottom
          }}
        >
          {children}
        </main>

        {/* Floating Action Button - Upload Product Photo */}
        <FloatingActionButton />

        {/* Photo Upload Modal */}
        <PhotoUploadModal />
      </div>
    </ThemeProvider>
  );
}
