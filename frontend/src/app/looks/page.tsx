'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, LayoutGrid, Clock, Trash2, MoreHorizontal, X } from 'lucide-react';
import { useLooksStore, generateLookPath } from '@/stores/useLooksStore';

export default function LooksPage() {
  const router = useRouter();
  const { looks, createLook, deleteLook } = useLooksStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newLookName, setNewLookName] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const handleCreateLook = () => {
    if (!newLookName.trim()) {
      // Create with default name
      const newLook = createLook('Untitled Look');
      router.push(`/looks/${generateLookPath(newLook.name, newLook.id)}`);
      return;
    }

    const newLook = createLook(newLookName.trim());
    setNewLookName('');
    setIsCreating(false);
    router.push(`/looks/${generateLookPath(newLook.name, newLook.id)}`);
  };

  const handleDeleteLook = (id: string) => {
    deleteLook(id);
    setMenuOpen(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            My Looks
          </h1>
          <p style={{ color: 'var(--foreground-secondary)' }}>
            Create and manage your moodboard designs
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors"
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
          Create Look
        </button>
      </div>

      {/* Create Look Modal */}
      {isCreating && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={() => setIsCreating(false)}
        >
          <div
            className="w-full max-w-md p-6 rounded-lg mx-4"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                Create New Look
              </h3>
              <button
                onClick={() => setIsCreating(false)}
                style={{ color: 'var(--foreground-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <p className="mb-4 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              Give your new moodboard a name to get started.
            </p>

            <input
              type="text"
              value={newLookName}
              onChange={(e) => setNewLookName(e.target.value)}
              placeholder="e.g., Summer Patio Design"
              className="w-full p-3 rounded-lg border outline-none mb-6 focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
              style={{
                backgroundColor: 'var(--background)',
                borderColor: 'var(--border)',
                color: 'var(--foreground)',
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateLook();
              }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setIsCreating(false)}
                className="flex-1 py-2.5 rounded-lg font-medium"
                style={{
                  backgroundColor: 'var(--surface-light)',
                  color: 'var(--foreground)',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateLook}
                className="flex-1 py-2.5 rounded-lg font-medium"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Looks Grid */}
      {looks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* Create New Card */}
          <button
            onClick={() => setIsCreating(true)}
            className="aspect-[4/3] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-colors"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--foreground-muted)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.color = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.color = 'var(--foreground-muted)';
            }}
          >
            <Plus size={32} />
            <span className="font-medium">Create New Look</span>
          </button>

          {/* Existing Looks */}
          {looks.map((look) => (
            <Link
              key={look.id}
              href={`/looks/${generateLookPath(look.name, look.id)}`}
              className="rounded-lg border overflow-hidden transition-all hover:shadow-lg relative group block"
              style={{
                backgroundColor: 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            >
              {/* Thumbnail */}
              <div
                className="aspect-[4/3] flex items-center justify-center"
                style={{ backgroundColor: 'var(--surface-light)' }}
              >
                {look.thumbnail ? (
                  <img
                    src={look.thumbnail}
                    alt={look.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <LayoutGrid size={48} style={{ color: 'var(--foreground-muted)' }} />
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-semibold mb-1 truncate" style={{ color: 'var(--foreground)' }}>
                  {look.name}
                </h3>
                <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  <span>{look.items.length} items</span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {formatDate(look.updatedAt)}
                  </span>
                </div>
              </div>

              {/* Menu Button */}
              <div className="absolute top-2 right-2">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpen(menuOpen === look.id ? null : look.id);
                  }}
                  className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    color: 'white',
                  }}
                >
                  <MoreHorizontal size={16} />
                </button>

                {/* Dropdown Menu */}
                {menuOpen === look.id && (
                  <div
                    className="absolute top-10 right-0 w-40 rounded-lg border shadow-lg overflow-hidden z-10"
                    style={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteLook(look.id);
                      }}
                      className="w-full px-4 py-2.5 text-left flex items-center gap-2 transition-colors"
                      style={{ color: 'var(--error)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(168, 64, 50, 0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div
          className="flex flex-col items-center justify-center py-20 rounded-lg border-2 border-dashed"
          style={{ borderColor: 'var(--border)' }}
        >
          <LayoutGrid size={64} style={{ color: 'var(--foreground-muted)' }} className="mb-4" />
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
            No looks yet
          </h3>
          <p className="mb-6" style={{ color: 'var(--foreground-muted)' }}>
            Create your first moodboard to get started
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors"
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
            Create Your First Look
          </button>
        </div>
      )}

      {/* Click outside to close menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setMenuOpen(null)}
        />
      )}
    </div>
  );
}
