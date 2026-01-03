'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, MoreHorizontal, Trash2, Edit2, FolderOpen, FolderPlus } from 'lucide-react';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import {
  Button,
  Card,
  Modal,
  ModalContent,
  ModalFooter,
  Input,
  Textarea,
  PageHeader,
  EmptyState,
  DropdownItem,
} from '@/components/ui';

export default function CollectionsPage() {
  const router = useRouter();
  const { collections, createCollection, deleteCollection, renameCollection } = useCollectionsStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDesc, setNewCollectionDesc] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => setActiveMenu(null);
    if (activeMenu) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMenu]);

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    createCollection(newCollectionName, newCollectionDesc || undefined);
    setNewCollectionName('');
    setNewCollectionDesc('');
    setShowCreateModal(false);
  };

  const handleDeleteCollection = (id: string) => {
    deleteCollection(id);
    setActiveMenu(null);
  };

  const handleStartRename = (collection: { id: string; name: string }) => {
    setEditingId(collection.id);
    setEditingName(collection.name);
    setActiveMenu(null);
  };

  const handleSaveRename = () => {
    if (editingId && editingName.trim()) {
      renameCollection(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleCollectionClick = (collectionId: string) => {
    if (editingId !== collectionId) {
      router.push(`/collections/${collectionId}`);
    }
  };

  // Loading state
  if (!isHydrated) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="animate-pulse">
          <div className="h-10 w-48 rounded mb-2" style={{ backgroundColor: 'var(--surface)' }} />
          <div className="h-5 w-64 rounded mb-8" style={{ backgroundColor: 'var(--surface)' }} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
      <PageHeader
        title="Collections"
        subtitle="Organize your favorite products into collections."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowCreateModal(true)}>
            New Collection
          </Button>
        }
      />

      <div className="px-8 pb-24 max-w-7xl mx-auto">
        {/* Empty State */}
        {collections.length === 0 && (
          <EmptyState
            icon={FolderOpen}
            title="No collections yet"
            description="Create a collection to start organizing your favorite products."
            action={{
              label: 'Create Collection',
              onClick: () => setShowCreateModal(true),
              icon: Plus,
            }}
          />
        )}

        {/* Collections Grid */}
        {collections.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {collections.map((collection) => (
              <Card
                key={collection.id}
                variant="interactive"
                onClick={() => handleCollectionClick(collection.id)}
                className="group"
              >
                {/* Cover Image Grid */}
                <div
                  className="aspect-square relative"
                  style={{ backgroundColor: 'var(--background-secondary)' }}
                >
                  {collection.coverImages.length > 0 ? (
                    <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                      {collection.coverImages.slice(0, 4).map((img, idx) => (
                        <div
                          key={idx}
                          className="w-full h-full bg-cover bg-center"
                          style={{ backgroundImage: `url(${img})` }}
                        />
                      ))}
                      {Array.from({ length: Math.max(0, 4 - collection.coverImages.length) }).map((_, idx) => (
                        <div
                          key={`empty-${idx}`}
                          className="w-full h-full"
                          style={{ backgroundColor: 'var(--border)' }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <FolderPlus size={32} style={{ color: 'var(--foreground-muted)', opacity: 0.5 }} />
                    </div>
                  )}

                  {/* Menu Button */}
                  <div className="absolute top-1.5 right-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenu(activeMenu === collection.id ? null : collection.id);
                      }}
                      className="w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'white' }}
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {/* Dropdown Menu */}
                    {activeMenu === collection.id && (
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
                          onClick={() => handleStartRename(collection)}
                          closeOnClick={false}
                        >
                          Rename
                        </DropdownItem>
                        <DropdownItem
                          icon={<Trash2 size={12} />}
                          variant="destructive"
                          onClick={() => handleDeleteCollection(collection.id)}
                          closeOnClick={false}
                        >
                          Delete
                        </DropdownItem>
                      </div>
                    )}
                  </div>
                </div>

                {/* Collection Info */}
                <div className="p-2.5">
                  {editingId === collection.id ? (
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
                    <h3 className="font-medium text-sm mb-0.5 truncate" style={{ color: 'var(--foreground)' }}>
                      {collection.name}
                    </h3>
                  )}
                  <div className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {collection.products.length} item{collection.products.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Collection Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Collection"
        size="sm"
      >
        <ModalContent className="space-y-4">
          <Input
            label="Name"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newCollectionName.trim()) {
                handleCreateCollection();
              }
            }}
            placeholder="e.g., Summer Favorites"
            autoFocus
          />
          <Textarea
            label="Description (optional)"
            value={newCollectionDesc}
            onChange={(e) => setNewCollectionDesc(e.target.value)}
            placeholder="What's this collection about?"
          />
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateCollection}
            disabled={!newCollectionName.trim()}
          >
            Create
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
