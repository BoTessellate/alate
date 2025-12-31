'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClosetPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to personal collection by default
    router.replace('/closet/personal');
  }, [router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--background)' }}
    >
      <div className="animate-pulse text-center">
        <p style={{ color: 'var(--foreground-muted)' }}>Loading...</p>
      </div>
    </div>
  );
}
