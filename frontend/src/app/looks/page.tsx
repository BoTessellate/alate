'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MoreHorizontal, Trash2, Edit2, Grid3X3 } from 'lucide-react';
import { useLooksStore, generateMoodboardPath } from '@/stores/useLooksStore';
import {
  Button,
  Card,
  Modal,
  ModalContent,
  ModalFooter,
  Input,
  PageHeader,
  EmptyState,
  DropdownItem,
  DropdownDivider,
} from '@/components/ui';

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

  // Loading state
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
              <Card key={i}>
                <div className="aspect-square" style={{ backgroundColor: 'var(--background-secondary)' }} />
                <div className="p-2.5">
                  <div className="h-4 w-24 rounded mb-1" style={{ backgroundColor: 'var(--background-secondary)' }} />
                  <div className="h-3 w-16 rounded" style={{ backgroundColor: 'var(--background-secondary)' }} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'var(--background)' }}>
      {/* Header */}
      <PageHeader
        title="Layers"
        subtitle="Create and organize your mood layers"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowCreateModal(true)}>
            New Layer
          </Button>
        }
      />

      {/* Content */}
      <div className="px-8 pb-8 max-w-7xl mx-auto">
        {/* Empty State */}
        {moodboards.length === 0 && (
          <EmptyState
            icon={Grid3X3}
            title="No layers yet"
            description="Create your first mood layer to start collecting inspiration."
            action={{
              label: 'Create Layer',
              onClick: () => setShowCreateModal(true),
              icon: Plus,
            }}
          />
        )}

        {/* Moodboards Grid */}
        {moodboards.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {moodboards.map((moodboard) => {
              const coverImages = getCoverImages(moodboard);

              return (
                <Card
                  key={moodboard.id}
                  variant="interactive"
                  onClick={() => handleMoodboardClick(moodboard)}
                  className="group"
                >
                  {/* Cover Image Grid */}
                  <div
                    className="aspect-square relative"
                    style={{ backgroundColor: 'var(--background-secondary)' }}
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
                        {Array.from({ length: Math.max(0, 4 - coverImages.length) }).map((_, idx) => (
                          <div
                            key={`empty-${idx}`}
                            className="w-full h-full"
                            style={{ backgroundColor: 'var(--border)' }}
                          />
                        ))}
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
                        style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white' }}
                      >
                        <MoreHorizontal size={14} />
                      </button>

                      {/* Dropdown Menu */}
                      {activeMenu === moodboard.id && (
                        <div
                          className="absolute top-8 right-0 w-32 rounded-lg overflow-hidden shadow-lg z-10 py-1"
                          style={{
                            backgroundColor: 'var(--surface)',
                            border: '1px solid var(--border)',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownItem
                            icon={<Edit2 size={12} />}
                            onClick={() => handleStartRename(moodboard)}
                            closeOnClick={false}
                          >
                            Rename
                          </DropdownItem>
                          <DropdownItem
                            icon={<Trash2 size={12} />}
                            variant="destructive"
                            onClick={() => handleDeleteMoodboard(moodboard.id)}
                            closeOnClick={false}
                          >
                            Delete
                          </DropdownItem>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Moodboard Info */}
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
                        style={{ color: 'var(--foreground)', borderColor: 'var(--primary)' }}
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
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Layer Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Layer"
        size="sm"
      >
        <ModalContent className="space-y-4">
          <Input
            label="Name"
            value={newMoodboardName}
            onChange={(e) => setNewMoodboardName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newMoodboardName.trim()) {
                handleCreateMoodboard();
              }
            }}
            placeholder="e.g., Summer Vibes"
            autoFocus
          />
          <Input
            label="Description (optional)"
            value={newMoodboardDescription}
            onChange={(e) => setNewMoodboardDescription(e.target.value)}
            placeholder="What's this layer about?"
          />
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateMoodboard}
            disabled={!newMoodboardName.trim()}
          >
            Create
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
