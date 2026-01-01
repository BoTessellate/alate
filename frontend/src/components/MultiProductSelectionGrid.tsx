'use client';

import { Check, Edit2 } from 'lucide-react';
import { useState } from 'react';
import type { DetectedProduct } from '@/stores/useUploadStore';

interface Props {
  products: DetectedProduct[];
  selectedIds: Set<string>;
  originalImageUrl: string;
  onToggle: (tempId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onUpdateName: (tempId: string, name: string) => void;
}

/**
 * Grid display of detected products with selection checkboxes
 */
export default function MultiProductSelectionGrid({
  products,
  selectedIds,
  originalImageUrl,
  onToggle,
  onSelectAll,
  onDeselectAll,
  onUpdateName,
}: Props) {
  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === products.length;

  return (
    <div className="space-y-3">
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
          {products.length} product{products.length !== 1 ? 's' : ''} detected
        </p>
        <div className="flex gap-2">
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{
              backgroundColor: 'var(--surface-light)',
              color: 'var(--foreground)',
            }}
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </button>
        </div>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 gap-2">
        {products.map((product) => (
          <DetectedProductCard
            key={product.tempId}
            product={product}
            isSelected={selectedIds.has(product.tempId)}
            originalImageUrl={originalImageUrl}
            onToggle={() => onToggle(product.tempId)}
            onUpdateName={(name) => onUpdateName(product.tempId, name)}
          />
        ))}
      </div>

      {/* Selection summary */}
      <p className="text-xs text-center" style={{ color: 'var(--foreground-muted)' }}>
        {selectedCount} of {products.length} selected
      </p>
    </div>
  );
}

interface CardProps {
  product: DetectedProduct;
  isSelected: boolean;
  originalImageUrl: string;
  onToggle: () => void;
  onUpdateName: (name: string) => void;
}

function DetectedProductCard({
  product,
  isSelected,
  originalImageUrl,
  onToggle,
  onUpdateName,
}: CardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(product.suggestedName);

  const handleSaveName = () => {
    if (editName.trim()) {
      onUpdateName(editName.trim());
    }
    setIsEditing(false);
  };

  // Calculate clip path for cropped preview
  const { x, y, width, height } = product.boundingBox;
  const clipStyle = {
    objectPosition: `${x * 100}% ${y * 100}%`,
    objectFit: 'cover' as const,
  };

  // Confidence badge color
  const confidenceColor =
    product.confidence >= 0.9
      ? 'var(--success)'
      : product.confidence >= 0.7
        ? 'var(--highlight)'
        : 'var(--foreground-muted)';

  return (
    <div
      className="relative rounded-lg border overflow-hidden cursor-pointer transition-all"
      style={{
        borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
        backgroundColor: isSelected ? 'rgba(76, 112, 49, 0.05)' : 'var(--surface)',
      }}
      onClick={onToggle}
    >
      {/* Cropped Image Preview */}
      <div
        className="relative w-full aspect-square overflow-hidden"
        style={{ backgroundColor: 'var(--background-secondary)' }}
      >
        <img
          src={originalImageUrl}
          alt={product.suggestedName}
          className="w-full h-full"
          style={{
            objectFit: 'none',
            objectPosition: `${-x * 100 + 50}% ${-y * 100 + 50}%`,
            transform: `scale(${1 / Math.max(width, height)})`,
          }}
        />

        {/* Selection checkbox */}
        <div
          className="absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
          style={{
            borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
            backgroundColor: isSelected ? 'var(--primary)' : 'white',
          }}
        >
          {isSelected && <Check size={12} className="text-white" />}
        </div>

        {/* Confidence badge */}
        <div
          className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs font-medium"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: confidenceColor }}
        >
          {Math.round(product.confidence * 100)}%
        </div>
      </div>

      {/* Product Info */}
      <div className="p-2" onClick={(e) => e.stopPropagation()}>
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName();
              if (e.key === 'Escape') {
                setEditName(product.suggestedName);
                setIsEditing(false);
              }
            }}
            className="w-full text-xs p-1 rounded border outline-none"
            style={{
              borderColor: 'var(--primary)',
              backgroundColor: 'var(--background)',
              color: 'var(--foreground)',
            }}
            autoFocus
          />
        ) : (
          <div className="flex items-start justify-between gap-1">
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-medium truncate"
                style={{ color: 'var(--foreground)' }}
              >
                {product.suggestedName}
              </p>
              <p
                className="text-xs truncate"
                style={{ color: 'var(--foreground-muted)' }}
              >
                {product.category}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="p-1 rounded hover:bg-black/5 transition-colors"
              title="Edit name"
            >
              <Edit2 size={12} style={{ color: 'var(--foreground-muted)' }} />
            </button>
          </div>
        )}

        {/* Color chips */}
        {product.colors.length > 0 && (
          <div className="flex gap-1 mt-1.5">
            {product.colors.slice(0, 3).map((color, i) => (
              <span
                key={i}
                className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'var(--surface-light)',
                  color: 'var(--foreground-secondary)',
                }}
              >
                {color}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
