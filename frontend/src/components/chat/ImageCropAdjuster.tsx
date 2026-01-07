'use client';

import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { Move, Maximize2, ZoomIn, ZoomOut, Maximize, RotateCcw, AlertCircle } from 'lucide-react';

export interface BoundingBox {
  x: number;      // Top-left x (0-1)
  y: number;      // Top-left y (0-1)
  width: number;  // Width (0-1)
  height: number; // Height (0-1)
}

export interface ImageCropAdjusterProps {
  /** URL of the original (uncropped) image */
  originalImageUrl: string;
  /** Current bounding box (normalized 0-1 values) */
  boundingBox: BoundingBox;
  /** Callback when bounding box changes */
  onChange: (box: BoundingBox) => void;
  /** Maximum display width */
  maxWidth?: number;
  /** Maximum display height */
  maxHeight?: number;
}

type DragHandle = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w' | null;

// Minimum display width to ensure usability
const MIN_DISPLAY_WIDTH = 350;

/**
 * ImageCropAdjuster - Interactive bounding box editor for product detection correction
 *
 * Shows the original image with a draggable/resizable crop overlay.
 * User can adjust the crop area when AI detection was incorrect.
 *
 * Zoom behavior:
 * - The viewport (scroll container) stays a FIXED SIZE
 * - The image inside scales based on zoom level
 * - When zoomed in (>100%), image is larger than container, scroll to pan
 * - When zoomed out (<100%), image is smaller and centered in container
 */
export const ImageCropAdjuster = memo(function ImageCropAdjuster({
  originalImageUrl,
  boundingBox,
  onChange,
  maxWidth = 600,
  maxHeight = 500,
}: ImageCropAdjusterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [activeHandle, setActiveHandle] = useState<DragHandle>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [boxStart, setBoxStart] = useState<BoundingBox>(boundingBox);
  const [zoom, setZoom] = useState(1);
  const [initialBoundingBox] = useState<BoundingBox>(boundingBox);
  const [imageError, setImageError] = useState(false);

  // Load image and calculate display size
  useEffect(() => {
    const img = new Image();

    img.onload = () => {
      setImageError(false);
      setImageSize({ width: img.width, height: img.height });

      // Calculate display size maintaining aspect ratio
      const aspectRatio = img.width / img.height;
      let displayWidth = Math.min(img.width, maxWidth);
      let displayHeight = displayWidth / aspectRatio;

      if (displayHeight > maxHeight) {
        displayHeight = maxHeight;
        displayWidth = displayHeight * aspectRatio;
      }

      // Enforce minimum width for portrait images
      if (displayWidth < MIN_DISPLAY_WIDTH) {
        displayWidth = MIN_DISPLAY_WIDTH;
        displayHeight = displayWidth / aspectRatio;
      }

      setDisplaySize({ width: displayWidth, height: displayHeight });
    };

    img.onerror = () => {
      setImageError(true);
    };

    img.src = originalImageUrl;

    // Cleanup to prevent memory leaks
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [originalImageUrl, maxWidth, maxHeight]);

  // Calculate zoomed display size
  const zoomedSize = {
    width: displaySize.width * zoom,
    height: displaySize.height * zoom,
  };

  // Convert normalized box to pixel values
  const boxToPixels = useCallback((box: BoundingBox) => {
    return {
      left: box.x * zoomedSize.width,
      top: box.y * zoomedSize.height,
      width: box.width * zoomedSize.width,
      height: box.height * zoomedSize.height,
    };
  }, [zoomedSize]);

  // Handle mouse/touch start
  const handlePointerDown = useCallback((
    e: React.PointerEvent,
    handle: DragHandle
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setActiveHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setBoxStart({ ...boundingBox });

    // Capture pointer for smooth dragging
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [boundingBox]);

  // Handle mouse/touch move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!activeHandle || zoomedSize.width === 0) return;

    const deltaX = (e.clientX - dragStart.x) / zoomedSize.width;
    const deltaY = (e.clientY - dragStart.y) / zoomedSize.height;

    let newBox = { ...boxStart };

    switch (activeHandle) {
      case 'move':
        newBox.x = Math.max(0, Math.min(1 - boxStart.width, boxStart.x + deltaX));
        newBox.y = Math.max(0, Math.min(1 - boxStart.height, boxStart.y + deltaY));
        break;

      case 'nw':
        newBox.x = Math.max(0, Math.min(boxStart.x + boxStart.width - 0.05, boxStart.x + deltaX));
        newBox.y = Math.max(0, Math.min(boxStart.y + boxStart.height - 0.05, boxStart.y + deltaY));
        newBox.width = boxStart.width - (newBox.x - boxStart.x);
        newBox.height = boxStart.height - (newBox.y - boxStart.y);
        break;

      case 'ne':
        newBox.y = Math.max(0, Math.min(boxStart.y + boxStart.height - 0.05, boxStart.y + deltaY));
        newBox.width = Math.max(0.05, Math.min(1 - boxStart.x, boxStart.width + deltaX));
        newBox.height = boxStart.height - (newBox.y - boxStart.y);
        break;

      case 'sw':
        newBox.x = Math.max(0, Math.min(boxStart.x + boxStart.width - 0.05, boxStart.x + deltaX));
        newBox.width = boxStart.width - (newBox.x - boxStart.x);
        newBox.height = Math.max(0.05, Math.min(1 - boxStart.y, boxStart.height + deltaY));
        break;

      case 'se':
        newBox.width = Math.max(0.05, Math.min(1 - boxStart.x, boxStart.width + deltaX));
        newBox.height = Math.max(0.05, Math.min(1 - boxStart.y, boxStart.height + deltaY));
        break;

      case 'n':
        newBox.y = Math.max(0, Math.min(boxStart.y + boxStart.height - 0.05, boxStart.y + deltaY));
        newBox.height = boxStart.height - (newBox.y - boxStart.y);
        break;

      case 's':
        newBox.height = Math.max(0.05, Math.min(1 - boxStart.y, boxStart.height + deltaY));
        break;

      case 'e':
        newBox.width = Math.max(0.05, Math.min(1 - boxStart.x, boxStart.width + deltaX));
        break;

      case 'w':
        newBox.x = Math.max(0, Math.min(boxStart.x + boxStart.width - 0.05, boxStart.x + deltaX));
        newBox.width = boxStart.width - (newBox.x - boxStart.x);
        break;
    }

    onChange(newBox);
  }, [activeHandle, dragStart, boxStart, zoomedSize, onChange]);

  // Handle mouse/touch end
  const handlePointerUp = useCallback(() => {
    setActiveHandle(null);
  }, []);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z - 0.25, 0.5));
  }, []);

  const handleFitToView = useCallback(() => {
    setZoom(1);
  }, []);

  // Select full image
  const handleSelectFullImage = useCallback(() => {
    onChange({ x: 0, y: 0, width: 1, height: 1 });
  }, [onChange]);

  // Reset to original detection
  const handleResetToOriginal = useCallback(() => {
    onChange(initialBoundingBox);
  }, [onChange, initialBoundingBox]);

  // Scroll to center on crop area when zoom changes
  useEffect(() => {
    if (scrollContainerRef.current && zoom > 1) {
      const container = scrollContainerRef.current;
      const centerX = (boundingBox.x + boundingBox.width / 2) * zoomedSize.width;
      const centerY = (boundingBox.y + boundingBox.height / 2) * zoomedSize.height;

      container.scrollLeft = centerX - container.clientWidth / 2;
      container.scrollTop = centerY - container.clientHeight / 2;
    }
  }, [zoom, boundingBox, zoomedSize]);

  // Error state
  if (imageError) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg"
        style={{
          width: Math.max(maxWidth, MIN_DISPLAY_WIDTH),
          height: 300,
          backgroundColor: 'var(--surface-light)',
        }}
      >
        <AlertCircle size={32} style={{ color: 'var(--error, #ef4444)' }} />
        <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Failed to load image. Please try again.
        </span>
      </div>
    );
  }

  // Loading state
  if (displaySize.width === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg"
        style={{
          width: Math.max(maxWidth, MIN_DISPLAY_WIDTH),
          height: 300,
          backgroundColor: 'var(--surface-light)',
        }}
      >
        <span className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
          Loading image...
        </span>
      </div>
    );
  }

  const pixelBox = boxToPixels(boundingBox);
  const handleSize = 14;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Instructions */}
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--foreground-muted)' }}>
          <Move size={12} />
          <span>Drag to move</span>
          <Maximize2 size={12} className="ml-1" />
          <span>Drag corners to resize</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="p-1.5 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--surface-light)' }}
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs px-2 min-w-[3rem] text-center" style={{ color: 'var(--foreground-secondary)' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            className="p-1.5 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--surface-light)' }}
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-px h-4 mx-1" style={{ backgroundColor: 'var(--border)' }} />
          <button
            onClick={handleFitToView}
            className="p-1.5 rounded transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--surface-light)' }}
            title="Fit to view"
          >
            <Maximize size={16} />
          </button>
          <button
            onClick={handleResetToOriginal}
            className="p-1.5 rounded transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--surface-light)' }}
            title="Reset to original"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <button
          onClick={handleSelectFullImage}
          className="text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer"
          style={{
            backgroundColor: 'var(--surface-light)',
            color: 'var(--foreground-secondary)',
          }}
        >
          Select full image
        </button>
      </div>

      {/* Scrollable image container - FIXED SIZE viewport */}
      <div
        ref={scrollContainerRef}
        className="rounded-lg overflow-auto"
        style={{
          // FIXED viewport size - does NOT grow with zoom
          width: Math.max(displaySize.width, MIN_DISPLAY_WIDTH),
          height: displaySize.height,
          maxWidth: maxWidth,
          maxHeight: maxHeight,
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Image container with zoom - this scales and can exceed viewport */}
        <div
          ref={containerRef}
          className="relative"
          style={{
            // Image scales based on zoom
            width: zoomedSize.width,
            height: zoomedSize.height,
            minWidth: MIN_DISPLAY_WIDTH,
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Original image */}
          <img
            src={originalImageUrl}
            alt="Original"
            className="w-full h-full object-contain"
            draggable={false}
            style={{ pointerEvents: 'none' }}
          />

          {/* Darkened overlay outside crop area */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                linear-gradient(to right, rgba(0,0,0,0.5) ${pixelBox.left}px, transparent ${pixelBox.left}px),
                linear-gradient(to left, rgba(0,0,0,0.5) ${zoomedSize.width - pixelBox.left - pixelBox.width}px, transparent ${zoomedSize.width - pixelBox.left - pixelBox.width}px),
                linear-gradient(to bottom, rgba(0,0,0,0.5) ${pixelBox.top}px, transparent ${pixelBox.top}px),
                linear-gradient(to top, rgba(0,0,0,0.5) ${zoomedSize.height - pixelBox.top - pixelBox.height}px, transparent ${zoomedSize.height - pixelBox.top - pixelBox.height}px)
              `,
            }}
          />

          {/* Crop area outline */}
          <div
            className="absolute border-2 border-dashed"
            style={{
              left: pixelBox.left,
              top: pixelBox.top,
              width: pixelBox.width,
              height: pixelBox.height,
              borderColor: 'var(--primary)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.5)',
            }}
          />

          {/* Move handle (center) */}
          <div
            className="absolute flex items-center justify-center cursor-move"
            style={{
              left: pixelBox.left,
              top: pixelBox.top,
              width: pixelBox.width,
              height: pixelBox.height,
            }}
            onPointerDown={(e) => handlePointerDown(e, 'move')}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg"
              style={{
                backgroundColor: 'var(--primary)',
              }}
            >
              <Move size={20} color="white" />
            </div>
          </div>

          {/* Corner resize handles */}
          {/* NW */}
          <div
            className="absolute rounded-full cursor-nw-resize shadow-md"
            style={{
              left: pixelBox.left - handleSize / 2,
              top: pixelBox.top - handleSize / 2,
              width: handleSize,
              height: handleSize,
              backgroundColor: 'var(--primary)',
              border: '2px solid white',
            }}
            onPointerDown={(e) => handlePointerDown(e, 'nw')}
          />
          {/* NE */}
          <div
            className="absolute rounded-full cursor-ne-resize shadow-md"
            style={{
              left: pixelBox.left + pixelBox.width - handleSize / 2,
              top: pixelBox.top - handleSize / 2,
              width: handleSize,
              height: handleSize,
              backgroundColor: 'var(--primary)',
              border: '2px solid white',
            }}
            onPointerDown={(e) => handlePointerDown(e, 'ne')}
          />
          {/* SW */}
          <div
            className="absolute rounded-full cursor-sw-resize shadow-md"
            style={{
              left: pixelBox.left - handleSize / 2,
              top: pixelBox.top + pixelBox.height - handleSize / 2,
              width: handleSize,
              height: handleSize,
              backgroundColor: 'var(--primary)',
              border: '2px solid white',
            }}
            onPointerDown={(e) => handlePointerDown(e, 'sw')}
          />
          {/* SE */}
          <div
            className="absolute rounded-full cursor-se-resize shadow-md"
            style={{
              left: pixelBox.left + pixelBox.width - handleSize / 2,
              top: pixelBox.top + pixelBox.height - handleSize / 2,
              width: handleSize,
              height: handleSize,
              backgroundColor: 'var(--primary)',
              border: '2px solid white',
            }}
            onPointerDown={(e) => handlePointerDown(e, 'se')}
          />

          {/* Edge resize handles */}
          {/* N */}
          <div
            className="absolute cursor-n-resize shadow-md"
            style={{
              left: pixelBox.left + pixelBox.width / 2 - handleSize / 2,
              top: pixelBox.top - handleSize / 2,
              width: handleSize,
              height: handleSize,
              backgroundColor: 'var(--primary)',
              border: '2px solid white',
              borderRadius: '3px',
            }}
            onPointerDown={(e) => handlePointerDown(e, 'n')}
          />
          {/* S */}
          <div
            className="absolute cursor-s-resize shadow-md"
            style={{
              left: pixelBox.left + pixelBox.width / 2 - handleSize / 2,
              top: pixelBox.top + pixelBox.height - handleSize / 2,
              width: handleSize,
              height: handleSize,
              backgroundColor: 'var(--primary)',
              border: '2px solid white',
              borderRadius: '3px',
            }}
            onPointerDown={(e) => handlePointerDown(e, 's')}
          />
          {/* E */}
          <div
            className="absolute cursor-e-resize shadow-md"
            style={{
              left: pixelBox.left + pixelBox.width - handleSize / 2,
              top: pixelBox.top + pixelBox.height / 2 - handleSize / 2,
              width: handleSize,
              height: handleSize,
              backgroundColor: 'var(--primary)',
              border: '2px solid white',
              borderRadius: '3px',
            }}
            onPointerDown={(e) => handlePointerDown(e, 'e')}
          />
          {/* W */}
          <div
            className="absolute cursor-w-resize shadow-md"
            style={{
              left: pixelBox.left - handleSize / 2,
              top: pixelBox.top + pixelBox.height / 2 - handleSize / 2,
              width: handleSize,
              height: handleSize,
              backgroundColor: 'var(--primary)',
              border: '2px solid white',
              borderRadius: '3px',
            }}
            onPointerDown={(e) => handlePointerDown(e, 'w')}
          />
        </div>
      </div>

      {/* Crop info */}
      <div className="text-xs text-center" style={{ color: 'var(--foreground-muted)' }}>
        Selection: {Math.round(boundingBox.width * 100)}% x {Math.round(boundingBox.height * 100)}% of image
      </div>
    </div>
  );
});

export default ImageCropAdjuster;
