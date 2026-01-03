'use client';

import { Check, Edit2, Maximize2, X, Crosshair } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import type { DetectedProduct } from '@/stores/useUploadStore';
import { IconButton, Modal, Button } from '@/components/ui';

interface Props {
  products: DetectedProduct[];
  selectedIds: Set<string>;
  originalImageUrl: string;
  onToggle: (tempId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onUpdateName: (tempId: string, name: string) => void;
  onManualSelect?: (boundingBox: { x: number; y: number; width: number; height: number }) => void;
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
  onManualSelect,
}: Props) {
  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === products.length;
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [showManualSelector, setShowManualSelector] = useState(false);

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

      {/* Product Grid - smaller boxes with 3 columns */}
      <div className="grid grid-cols-3 gap-2">
        {products.map((product) => (
          <DetectedProductCard
            key={product.tempId}
            product={product}
            isSelected={selectedIds.has(product.tempId)}
            originalImageUrl={originalImageUrl}
            onToggle={() => onToggle(product.tempId)}
            onUpdateName={(name) => onUpdateName(product.tempId, name)}
            onEnlarge={() => setEnlargedImage(originalImageUrl)}
          />
        ))}
      </div>

      {/* Manual Selection Button */}
      {onManualSelect && (
        <button
          onClick={() => setShowManualSelector(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed transition-colors hover:border-solid"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--foreground-muted)',
            backgroundColor: 'transparent',
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
          <Crosshair size={14} />
          <span className="text-xs">Select product manually</span>
        </button>
      )}

      {/* Selection summary */}
      <p className="text-xs text-center" style={{ color: 'var(--foreground-muted)' }}>
        {selectedCount} of {products.length} selected
      </p>

      {/* Enlarged Image Modal */}
      <Modal
        isOpen={!!enlargedImage}
        onClose={() => setEnlargedImage(null)}
        title="Product Image"
        size="lg"
      >
        <div className="p-4">
          {enlargedImage && (
            <img
              src={enlargedImage}
              alt="Enlarged product"
              className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </div>
      </Modal>

      {/* Manual Selection Modal */}
      {showManualSelector && onManualSelect && (
        <ManualProductSelector
          imageUrl={originalImageUrl}
          onSelect={(box) => {
            onManualSelect(box);
            setShowManualSelector(false);
          }}
          onClose={() => setShowManualSelector(false)}
        />
      )}
    </div>
  );
}

interface CardProps {
  product: DetectedProduct;
  isSelected: boolean;
  originalImageUrl: string;
  onToggle: () => void;
  onUpdateName: (name: string) => void;
  onEnlarge: () => void;
}

function DetectedProductCard({
  product,
  isSelected,
  originalImageUrl,
  onToggle,
  onUpdateName,
  onEnlarge,
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

  // Confidence badge color - high contrast with opaque background
  const getConfidenceStyles = () => {
    if (product.confidence >= 0.9) {
      return { bg: 'rgba(76, 112, 49, 0.95)', color: 'white' }; // Green
    } else if (product.confidence >= 0.7) {
      return { bg: 'rgba(153, 107, 38, 0.95)', color: 'white' }; // Gold
    }
    return { bg: 'rgba(102, 102, 102, 0.95)', color: 'white' }; // Gray
  };

  const confidenceStyles = getConfidenceStyles();

  return (
    <div
      className="relative rounded-lg border overflow-hidden cursor-pointer transition-all"
      style={{
        borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
        backgroundColor: isSelected ? 'rgba(76, 112, 49, 0.08)' : 'var(--surface)',
      }}
      onClick={onToggle}
    >
      {/* Cropped Image Preview - smaller aspect ratio */}
      <div
        className="relative w-full aspect-[4/3] overflow-hidden group"
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

        {/* Selection checkbox - opaque background */}
        <div
          className="absolute top-1.5 left-1.5 w-5 h-5 rounded flex items-center justify-center transition-colors shadow-sm"
          style={{
            backgroundColor: isSelected ? 'var(--primary)' : 'rgba(255, 255, 255, 0.95)',
            border: isSelected ? 'none' : '1.5px solid var(--border)',
          }}
        >
          {isSelected && <Check size={12} className="text-white" />}
        </div>

        {/* Confidence badge - opaque solid background */}
        <div
          className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold shadow-sm"
          style={{
            backgroundColor: confidenceStyles.bg,
            color: confidenceStyles.color,
          }}
        >
          {Math.round(product.confidence * 100)}%
        </div>

        {/* Enlarge button - appears on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEnlarge();
          }}
          className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
          }}
          title="Enlarge image"
        >
          <Maximize2 size={12} />
        </button>
      </div>

      {/* Product Info - compact */}
      <div className="p-1.5" onClick={(e) => e.stopPropagation()}>
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
            className="w-full text-[10px] p-1 rounded border outline-none"
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
                className="text-[10px] font-medium truncate leading-tight"
                style={{ color: 'var(--foreground)' }}
              >
                {product.suggestedName}
              </p>
              <p
                className="text-[9px] truncate"
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
              className="p-0.5 rounded hover:bg-black/5 transition-colors flex-shrink-0"
              title="Edit name"
            >
              <Edit2 size={10} style={{ color: 'var(--foreground-muted)' }} />
            </button>
          </div>
        )}

        {/* Color chips - smaller */}
        {product.colors.length > 0 && (
          <div className="flex gap-0.5 mt-1 flex-wrap">
            {product.colors.slice(0, 2).map((color, i) => (
              <span
                key={i}
                className="text-[8px] px-1 py-0.5 rounded-full"
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

/**
 * Manual product selection overlay - allows user to draw a box around a product
 */
interface ManualSelectorProps {
  imageUrl: string;
  onSelect: (boundingBox: { x: number; y: number; width: number; height: number }) => void;
  onClose: () => void;
}

function ManualProductSelector({ imageUrl, onSelect, onClose }: ManualSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const getRelativeCoords = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const coords = getRelativeCoords(e);
    setStartPoint(coords);
    setIsDrawing(true);
    setCurrentBox({ x: coords.x, y: coords.y, width: 0, height: 0 });
  }, [getRelativeCoords]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !startPoint) return;
    const coords = getRelativeCoords(e);

    const x = Math.min(startPoint.x, coords.x);
    const y = Math.min(startPoint.y, coords.y);
    const width = Math.abs(coords.x - startPoint.x);
    const height = Math.abs(coords.y - startPoint.y);

    setCurrentBox({ x, y, width, height });
  }, [isDrawing, startPoint, getRelativeCoords]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const handleConfirm = useCallback(() => {
    if (currentBox && currentBox.width > 0.02 && currentBox.height > 0.02) {
      onSelect(currentBox);
    }
  }, [currentBox, onSelect]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
    >
      <div
        className="relative max-w-2xl w-full rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              Select Product Area
            </h3>
            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
              Click and drag to draw a box around the product
            </p>
          </div>
          <IconButton icon={X} aria-label="Close" onClick={onClose} />
        </div>

        {/* Image with selection overlay */}
        <div
          ref={containerRef}
          className="relative cursor-crosshair select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={imageUrl}
            alt="Select product area"
            className="w-full h-auto max-h-[60vh] object-contain"
            draggable={false}
          />

          {/* Selection box overlay */}
          {currentBox && currentBox.width > 0 && currentBox.height > 0 && (
            <div
              className="absolute border-2 border-dashed pointer-events-none"
              style={{
                left: `${currentBox.x * 100}%`,
                top: `${currentBox.y * 100}%`,
                width: `${currentBox.width * 100}%`,
                height: `${currentBox.height * 100}%`,
                borderColor: 'var(--primary)',
                backgroundColor: 'rgba(76, 112, 49, 0.15)',
              }}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!currentBox || currentBox.width < 0.02 || currentBox.height < 0.02}
          >
            Confirm Selection
          </Button>
        </div>
      </div>
    </div>
  );
}
