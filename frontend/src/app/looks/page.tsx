'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MoreHorizontal, Trash2, Edit2, Grid3X3 } from 'lucide-react';
import { useLooksStore, generateMoodboardPath } from '@/stores/useLooksStore';

export default function LooksPage() {
  const router = useRouter();
  const { moodboards, createMoodboard, deleteMoodboard, updateMoodboard } = useLooksStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newMoodboardName, setNewMoodboardName] = useState('');
  const [newMoodboardDescription, setNewMoodboardDescription] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMenu]);

  const handleCreateMoodboard = () => {
    if (!newMoodboardName.trim()) return;
    const newMoodboard = createMoodboard(newMoodboardName.trim(), newMoodboardDescription.trim() || undefined);
    setNewMoodboardName('');
    setNewMoodboardDescription('');
    setShowCreateModal(false);
    // Navigate to the new moodboard editor
    router.push(`/looks/${generateMoodboardPath(newMoodboard.name, newMoodboard.id)}`);
  };

  const handleDeleteMoodboard = (id: string) => {
    deleteMoodboard(id);
    setActiveMenu(null);
  };

  const handleStartRename = (moodboard: { id: string; name: string }) => {
    setEditingId(moodboard.id);
    setEditingName(moodboard.name);
    setActiveMenu(null);
  };

  const handleSaveRename = () => {
    if (editingId && editingName.trim()) {
      updateMoodboard(editingId, { name: editingName.trim() });
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleMoodboardClick = (moodboard: { id: string; name: string }) => {
    if (editingId !== moodboard.id) {
      router.push(`/looks/${generateMoodboardPath(moodboard.name, moodboard.id)}`);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get cover images from moodboard items (first 4 images)
  const getCoverImages = (moodboard: { items: { type: string; src?: string }[] }) => {
    const images: string[] = [];
    for (const item of moodboard.items) {
      if (item.type === 'image' && item.src && images.length < 4) {
        images.push(item.src);
      }
      if (images.length >= 4) break;
    }
    return images;
  };

  // Show loading while hydrating
  if (!isHydrated) {
    return (
      <div style={{ backgroundColor: 'var(--background)' }}>
        <div className="px-8 pt-8 pb-6 max-w-7xl mx-auto">
          <div className="animate-pulse flex items-baseline gap-3">
            <div className="h-9 w-24 rounded" style={{ backgroundColor: 'var(--surface)' }} />
            <div className="h-5 w-64 rounded" style={{ backgroundColor: 'var(--surface)' }} />
          </div>
        </div>
        <div className="px-8 pb-8 max-w-7xl mx-auto">
          <div className="animate-pulse grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="rounded-lg overflow-hidden"
                style={{ backgroundColor: 'var(--surface)' }}
              >
                <div className="aspect-square" style={{ backgroundColor: 'var(--background-secondary)' }} />
                <div className="p-2.5">
                  <div className="h-4 w-24 rounded mb-1" style={{ backgroundColor: 'var(--background-secondary)' }} />
                  <div className="h-3 w-16 rounded" style={{ backgroundColor: 'var(--background-secondary)' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--background)' }}>
      {/* Header Section - matches Discover page */}
      <div className="px-8 pt-8 pb-6 max-w-7xl mx-auto flex items-baseline justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--foreground)' }}>
            Layers
          </h1>
          <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            Create and organize your moodboards
          </span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors cursor-pointer"
          style={{
            backgroundColor: 'var(--primary)',
            color: 'white',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary-light)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--primary)';
          }}
        >
          <Plus size={20} />
          New Moodboard
        </button>
      </div>

      {/* Content area */}
      <div className="px-8 pb-8 max-w-7xl mx-auto">

      {/* Empty State */}
      {moodboards.length === 0 && (
        <div
          className="text-center py-20 rounded-lg border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <Grid3X3
            size={48}
            className="mx-auto mb-4"
            style={{ color: 'var(--foreground-muted)' }}
          />
          <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
            No moodboards yet
          </h3>
          <p className="mb-6" style={{ color: 'var(--foreground-secondary)' }}>
            Create your first moodboard to start collecting inspiration.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'white',
            }}
          >
            <Plus size={18} />
            Create Moodboard
          </button>
        </div>
      )}

      {/* Moodboards Grid */}
      {moodboards.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {moodboards.map((moodboard) => {
            const coverImages = getCoverImages(moodboard);

            return (
              <div
                key={moodboard.id}
                onClick={() => handleMoodboardClick(moodboard)}
                className="group rounded-lg border overflow-hidden transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                }}
              >
                {/* Cover Image Grid - Square aspect ratio */}
                <div
                  className="aspect-square relative"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                  }}
                >
                  {coverImages.length > 0 ? (
                    <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                      {coverImages.slice(0, 4).map((img, idx) => (
                        <div
                          key={idx}
                          className="w-full h-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${img})` }}
                        />
                      ))}
                      {/* Fill remaining slots if less than 4 images */}
                      {Array.from({ length: Math.max(0, 4 - coverImages.length) }).map(
                        (_, idx) => (
                          <div
                            key={`empty-${idx}`}
                            className="w-full h-full"
                            style={{ backgroundColor: 'var(--border)' }}
                          />
                        )
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Grid3X3
                        size={32}
                        style={{ color: 'var(--foreground-muted)', opacity: 0.5 }}
                      />
                    </div>
                  )}

                  {/* Menu Button */}
                  <div className="absolute top-1.5 right-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === moodboard.id ? null : moodboard.id);
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        color: 'white',
                      }}
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {/* Dropdown Menu */}
                    {activeMenu === moodboard.id && (
                      <div
                        className="absolute top-8 right-0 w-32 rounded-lg overflow-hidden shadow-lg z-10"
                        style={{
                          backgroundColor: 'var(--surface)',
                          border: '1px solid var(--border)',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRename(moodboard);
                          }}
                          className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors cursor-pointer"
                          style={{ color: 'var(--foreground)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Edit2 size={12} />
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMoodboard(moodboard.id);
                          }}
                          className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 transition-colors cursor-pointer"
                          style={{ color: 'var(--error)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Moodboard Info - Compact */}
                <div className="p-2.5">
                  {editingId === moodboard.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={handleSaveRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename();
                        if (e.key === 'Escape') {
                          setEditingId(null);
                          setEditingName('');
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-sm mb-0.5 w-full bg-transparent border-b outline-none"
                      style={{
                        color: 'var(--foreground)',
                        borderColor: 'var(--primary)',
                      }}
                      autoFocus
                    />
                  ) : (
                    <h3
                      className="font-medium text-sm mb-0.5 truncate"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {moodboard.name}
                    </h3>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--foreground-muted)' }}>
                      {moodboard.items.length} item{moodboard.items.length !== 1 ? 's' : ''}
                    </span>
                    <span style={{ color: 'var(--foreground-muted)' }}>
                      {formatDate(moodboard.updatedAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>

      {/* Create Moodboard Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-md p-6 rounded-lg mx-4"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--foreground)' }}>
              Create New Moodboard
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--foreground)' }}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={newMoodboardName}
                  onChange={(e) => setNewMoodboardName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newMoodboardName.trim()) {
                      handleCreateMoodboard();
                    }
                  }}
                  placeholder="e.g., Summer Vibes"
                  className="w-full p-3 rounded-lg border outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                  autoFocus
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--foreground)' }}
                >
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newMoodboardDescription}
                  onChange={(e) => setNewMoodboardDescription(e.target.value)}
                  placeholder="What's this moodboard about?"
                  className="w-full p-3 rounded-lg border outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 rounded-lg font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--surface-light)',
                  color: 'var(--foreground)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMoodboard}
                disabled={!newMoodboardName.trim()}
                className="flex-1 py-2.5 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: newMoodboardName.trim()
                    ? 'var(--primary)'
                    : 'var(--surface-light)',
                  color: newMoodboardName.trim() ? 'white' : 'var(--foreground-muted)',
                  cursor: newMoodboardName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
