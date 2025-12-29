'use client';

import { Plus } from 'lucide-react';
import { useUploadStore } from '@/stores/useUploadStore';

/**
 * Floating Action Button for uploading product photos
 * Fixed position, bottom-right, visible on all pages
 */
export default function FloatingActionButton() {
  const openModal = useUploadStore((state) => state.openModal);

  return (
    <button
      onClick={openModal}
      className="fixed z-50 flex items-center justify-center rounded-full shadow-lg transition-all duration-200 cursor-pointer"
      style={{
        width: '56px',
        height: '56px',
        backgroundColor: 'var(--primary)',
        // Position: bottom-right, accounting for sidebar on desktop
        bottom: '24px',
        right: '24px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.backgroundColor = 'var(--primary-light)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.backgroundColor = 'var(--primary)';
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.95)';
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      title="Upload Product Photo"
      aria-label="Upload Product Photo"
    >
      <Plus size={28} color="white" strokeWidth={2.5} />
    </button>
  );
}
