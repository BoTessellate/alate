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

type DragMode = 'none' | 'pan' | 'move-box' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | 'resize-n' | 'resize-s' | 'resize-e' | 'resize-w';

// Zoom limits
const MIN_ZOOM = 1;    // 1 = entire image fits in viewport
const MAX_ZOOM = 6;    // 6x zoom for detail work
const ZOOM_SENSITIVITY = 0.002;

/**
 * ImageCropAdjuster - Interactive bounding box editor for product detection correction
 *
 * Key behavior:
 * - At zoom=1, the ENTIRE image is visible (fits in viewport)
 * - Zoom in to see detail and make precise adjustments
 * - Drag to pan when zoomed in
 * - Drag handles to adjust crop area
 */
export const ImageCropAdjuster = memo(function ImageCropAdjuster({
  originalImageUrl,
  boundingBox,
  onChange,
  maxWidth = 600,
  maxHeight = 500,
}: ImageCropAdjusterProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Original image dimensions
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });

  // Viewport = the fixed container the user sees
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });

  // Base image size = size when zoom=1 (fits entirely in viewport)
  const [baseImageSize, setBaseImageSize] = useState({ width: 0, height: 0 });

  // Transform state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Drag state
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [boxStart, setBoxStart] = useState<BoundingBox>(boundingBox);

  const [initialBoundingBox] = useState<BoundingBox>(boundingBox);
  const [imageError, setImageError] = useState(false);

  // Touch zoom state
  const [lastPinchDistance, setLastPinchDistance] = useState(0);

  // Load image and calculate sizes
  useEffect(() => {
    const img = new Image();

    img.onload = () => {
      setImageError(false);
      const naturalWidth = img.width;
      const naturalHeight = img.height;
      setImageNaturalSize({ width: naturalWidth, height: naturalHeight });

      // Calculate viewport size (the fixed container)
      // Use the smaller of maxWidth/maxHeight to ensure we have a reasonable viewport
      const viewportW = Math.min(maxWidth, 600);
      const viewportH = Math.min(maxHeight, 500);
      setViewportSize({ width: viewportW, height: viewportH });

      // Calculate base image size - image scaled to FIT ENTIRELY within viewport at zoom=1
      const aspectRatio = naturalWidth / naturalHeight;
      let baseW: number;
      let baseH: number;

      if (aspectRatio > viewportW / viewportH) {
        // Image is wider than viewport - fit by width
        baseW = viewportW;
        baseH = viewportW / aspectRatio;
      } else {
        // Image is taller than viewport - fit by height
        baseH = viewportH;
        baseW = viewportH * aspectRatio;
      }

      setBaseImageSize({ width: baseW, height: baseH });
    };

    img.onerror = () => {
      setImageError(true);
    };

    img.src = originalImageUrl;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [originalImageUrl, maxWidth, maxHeight]);

  // Current image size (with zoom applied)
  const currentImageSize = {
    width: baseImageSize.width * zoom,
    height: baseImageSize.height * zoom,
  };

  // Handle wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (1 + delta)));

    // Zoom toward cursor position
    if (containerRef.current && newZoom !== zoom) {
      const rect = containerRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left - rect.width / 2;
      const cursorY = e.clientY - rect.top - rect.height / 2;

      // Adjust pan to keep point under cursor stationary
      const scale = newZoom / zoom;
      const newPanX = pan.x * scale + cursorX * (1 - scale) / zoom;
      const newPanY = pan.y * scale + cursorY * (1 - scale) / zoom;

      setPan({ x: newPanX, y: newPanY });
    }

    setZoom(newZoom);
  }, [zoom, pan]);

  // Handle pointer down for handles
  const handlePointerDown = useCallback((e: React.PointerEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();

    setDragMode(mode);
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart({ ...pan });
    setBoxStart({ ...boundingBox });

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan, boundingBox]);

  // Handle container pointer down (for panning)
  const handleContainerPointerDown = useCallback((e: React.PointerEvent) => {
    // Only start pan if clicking on the image/container itself, not on handles
    if ((e.target as HTMLElement).dataset.handle) return;

    e.preventDefault();
    setDragMode('pan');
    setDragStart({ x: e.clientX, y: e.clientY });
    setPanStart({ ...pan });

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [pan]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragMode === 'none') return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    if (dragMode === 'pan') {
      setPan({
        x: panStart.x + deltaX / zoom,
        y: panStart.y + deltaY / zoom,
      });
      return;
    }

    // Handle box manipulation - delta in normalized image coordinates
    const normalizedDeltaX = deltaX / currentImageSize.width;
    const normalizedDeltaY = deltaY / currentImageSize.height;

    let newBox = { ...boxStart };

    switch (dragMode) {
      case 'move-box':
        newBox.x = Math.max(0, Math.min(1 - boxStart.width, boxStart.x + normalizedDeltaX));
        newBox.y = Math.max(0, Math.min(1 - boxStart.height, boxStart.y + normalizedDeltaY));
        break;

      case 'resize-nw':
        newBox.x = Math.max(0, Math.min(boxStart.x + boxStart.width - 0.05, boxStart.x + normalizedDeltaX));
        newBox.y = Math.max(0, Math.min(boxStart.y + boxStart.height - 0.05, boxStart.y + normalizedDeltaY));
        newBox.width = boxStart.width - (newBox.x - boxStart.x);
        newBox.height = boxStart.height - (newBox.y - boxStart.y);
        break;

      case 'resize-ne':
        newBox.y = Math.max(0, Math.min(boxStart.y + boxStart.height - 0.05, boxStart.y + normalizedDeltaY));
        newBox.width = Math.max(0.05, Math.min(1 - boxStart.x, boxStart.width + normalizedDeltaX));
        newBox.height = boxStart.height - (newBox.y - boxStart.y);
        break;

      case 'resize-sw':
        newBox.x = Math.max(0, Math.min(boxStart.x + boxStart.width - 0.05, boxStart.x + normalizedDeltaX));
        newBox.width = boxStart.width - (newBox.x - boxStart.x);
        newBox.height = Math.max(0.05, Math.min(1 - boxStart.y, boxStart.height + normalizedDeltaY));
        break;

      case 'resize-se':
        newBox.width = Math.max(0.05, Math.min(1 - boxStart.x, boxStart.width + normalizedDeltaX));
        newBox.height = Math.max(0.05, Math.min(1 - boxStart.y, boxStart.height + normalizedDeltaY));
        break;

      case 'resize-n':
        newBox.y = Math.max(0, Math.min(boxStart.y + boxStart.height - 0.05, boxStart.y + normalizedDeltaY));
        newBox.height = boxStart.height - (newBox.y - boxStart.y);
        break;

      case 'resize-s':
        newBox.height = Math.max(0.05, Math.min(1 - boxStart.y, boxStart.height + normalizedDeltaY));
        break;

      case 'resize-e':
        newBox.width = Math.max(0.05, Math.min(1 - boxStart.x, boxStart.width + normalizedDeltaX));
        break;

      case 'resize-w':
        newBox.x = Math.max(0, Math.min(boxStart.x + boxStart.width - 0.05, boxStart.x + normalizedDeltaX));
        newBox.width = boxStart.width - (newBox.x - boxStart.x);
        break;
    }

    onChange(newBox);
  }, [dragMode, dragStart, panStart, boxStart, zoom, currentImageSize, onChange]);

  // Handle pointer up
  const handlePointerUp = useCallback(() => {
    setDragMode('none');
  }, []);

  // Handle touch events for pinch zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      setLastPinchDistance(Math.sqrt(dx * dx + dy * dy));
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && lastPinchDistance > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const scale = distance / lastPinchDistance;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * scale));

      setZoom(newZoom);
      setLastPinchDistance(distance);
    }
  }, [zoom, lastPinchDistance]);

  const handleTouchEnd = useCallback(() => {
    setLastPinchDistance(0);
  }, []);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(z => Math.min(z + 0.5, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(z => Math.max(z - 0.5, MIN_ZOOM));
  }, []);

  // Fit entire image in view
  const handleFitToView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Zoom to crop area
  const handleZoomToCrop = useCallback(() => {
    // Calculate zoom level to make crop area fill ~80% of viewport
    const cropAspect = boundingBox.width / boundingBox.height;
    const viewportAspect = viewportSize.width / viewportSize.height;

    let targetZoom: number;
    if (cropAspect > viewportAspect) {
      // Crop is wider - fit by width
      targetZoom = 0.8 / boundingBox.width;
    } else {
      // Crop is taller - fit by height
      targetZoom = 0.8 / boundingBox.height;
    }

    // Clamp zoom
    targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));

    // Center on crop area
    const cropCenterX = (boundingBox.x + boundingBox.width / 2 - 0.5) * baseImageSize.width * targetZoom;
    const cropCenterY = (boundingBox.y + boundingBox.height / 2 - 0.5) * baseImageSize.height * targetZoom;

    setZoom(targetZoom);
    setPan({ x: -cropCenterX / targetZoom, y: -cropCenterY / targetZoom });
  }, [boundingBox, viewportSize, baseImageSize]);

  // Select full image
  const handleSelectFullImage = useCallback(() => {
    onChange({ x: 0, y: 0, width: 1, height: 1 });
  }, [onChange]);

  // Reset to original detection
  const handleResetToOriginal = useCallback(() => {
    onChange(initialBoundingBox);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [onChange, initialBoundingBox]);

  // Error state
  if (imageError) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-lg"
        style={{
          width: maxWidth,
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
  if (baseImageSize.width === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg"
        style={{
          width: maxWidth,
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

  // Calculate crop box in current (zoomed) pixel coordinates
  const cropBox = {
    left: boundingBox.x * currentImageSize.width,
    top: boundingBox.y * currentImageSize.height,
    width: boundingBox.width * currentImageSize.width,
    height: boundingBox.height * currentImageSize.height,
  };

  const handleSize = 14;
  const isPanning = dragMode === 'pan';

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
            disabled={zoom <= MIN_ZOOM}
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
            disabled={zoom >= MAX_ZOOM}
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
            style={{ backgroundColor: zoom === 1 && pan.x === 0 && pan.y === 0 ? 'var(--primary-light, #e8f0e0)' : 'var(--surface-light)' }}
            title="Fit entire image in view"
          >
            <Maximize size={16} />
          </button>
          <button
            onClick={handleResetToOriginal}
            className="p-1.5 rounded transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--surface-light)' }}
            title="Reset to original detection"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
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
        <button
          onClick={handleZoomToCrop}
          className="text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer"
          style={{
            backgroundColor: 'var(--surface-light)',
            color: 'var(--foreground-secondary)',
          }}
        >
          Zoom to selection
        </button>
      </div>

      {/* Image viewport - FIXED SIZE container */}
      <div
        ref={containerRef}
        className="relative rounded-lg overflow-hidden select-none"
        style={{
          width: viewportSize.width,
          height: viewportSize.height,
          backgroundColor: '#1a1a1a',
          border: '1px solid var(--border)',
          cursor: isPanning ? 'grabbing' : (zoom > 1 ? 'grab' : 'default'),
        }}
        onWheel={handleWheel}
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Transformed image layer */}
        <div
          className="absolute"
          style={{
            width: currentImageSize.width,
            height: currentImageSize.height,
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translate(${pan.x * zoom}px, ${pan.y * zoom}px)`,
            transition: dragMode === 'none' ? 'transform 0.15s ease-out' : 'none',
          }}
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
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              clipPath: `polygon(
                0% 0%,
                0% 100%,
                ${boundingBox.x * 100}% 100%,
                ${boundingBox.x * 100}% ${boundingBox.y * 100}%,
                ${(boundingBox.x + boundingBox.width) * 100}% ${boundingBox.y * 100}%,
                ${(boundingBox.x + boundingBox.width) * 100}% ${(boundingBox.y + boundingBox.height) * 100}%,
                ${boundingBox.x * 100}% ${(boundingBox.y + boundingBox.height) * 100}%,
                ${boundingBox.x * 100}% 100%,
                100% 100%,
                100% 0%
              )`,
            }}
          />

          {/* Crop area outline */}
          <div
            className="absolute border-2 border-dashed pointer-events-none"
            style={{
              left: cropBox.left,
              top: cropBox.top,
              width: cropBox.width,
              height: cropBox.height,
              borderColor: 'var(--primary)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.5)',
            }}
          />

          {/* Move handle (center of crop area) */}
          <div
            data-handle="move"
            className="absolute flex items-center justify-center cursor-move"
            style={{
              left: cropBox.left,
              top: cropBox.top,
              width: cropBox.width,
              height: cropBox.height,
            }}
            onPointerDown={(e) => handlePointerDown(e, 'move-box')}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg pointer-events-none"
              style={{
                backgroundColor: 'var(--primary)',
                // Scale down the handle when zoomed out so it doesn't dominate small images
                transform: zoom < 1.5 ? `scale(${Math.max(0.6, 1/zoom * 0.8)})` : 'none',
              }}
            >
              <Move size={20} color="white" />
            </div>
          </div>

          {/* Corner resize handles */}
          {[
            { pos: 'nw', left: cropBox.left - handleSize / 2, top: cropBox.top - handleSize / 2 },
            { pos: 'ne', left: cropBox.left + cropBox.width - handleSize / 2, top: cropBox.top - handleSize / 2 },
            { pos: 'sw', left: cropBox.left - handleSize / 2, top: cropBox.top + cropBox.height - handleSize / 2 },
            { pos: 'se', left: cropBox.left + cropBox.width - handleSize / 2, top: cropBox.top + cropBox.height - handleSize / 2 },
          ].map(({ pos, left, top }) => (
            <div
              key={pos}
              data-handle="resize"
              className={`absolute rounded-full cursor-${pos}-resize shadow-md`}
              style={{
                left,
                top,
                width: handleSize,
                height: handleSize,
                backgroundColor: 'var(--primary)',
                border: '2px solid white',
              }}
              onPointerDown={(e) => handlePointerDown(e, `resize-${pos}` as DragMode)}
            />
          ))}

          {/* Edge resize handles */}
          {[
            { pos: 'n', left: cropBox.left + cropBox.width / 2 - handleSize / 2, top: cropBox.top - handleSize / 2 },
            { pos: 's', left: cropBox.left + cropBox.width / 2 - handleSize / 2, top: cropBox.top + cropBox.height - handleSize / 2 },
            { pos: 'e', left: cropBox.left + cropBox.width - handleSize / 2, top: cropBox.top + cropBox.height / 2 - handleSize / 2 },
            { pos: 'w', left: cropBox.left - handleSize / 2, top: cropBox.top + cropBox.height / 2 - handleSize / 2 },
          ].map(({ pos, left, top }) => (
            <div
              key={pos}
              data-handle="resize"
              className={`absolute cursor-${pos}-resize shadow-md`}
              style={{
                left,
                top,
                width: handleSize,
                height: handleSize,
                backgroundColor: 'var(--primary)',
                border: '2px solid white',
                borderRadius: '3px',
              }}
              onPointerDown={(e) => handlePointerDown(e, `resize-${pos}` as DragMode)}
            />
          ))}
        </div>

        {/* Zoom hint - show at default zoom */}
        {zoom === 1 && pan.x === 0 && pan.y === 0 && (
          <div
            className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs backdrop-blur-sm"
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'rgba(255,255,255,0.8)',
            }}
          >
            Scroll to zoom • Drag to pan
          </div>
        )}
      </div>

      {/* Crop info */}
      <div className="text-xs text-center" style={{ color: 'var(--foreground-muted)' }}>
        Selection: {Math.round(boundingBox.width * 100)}% x {Math.round(boundingBox.height * 100)}% of image
        {imageNaturalSize.width > 0 && (
          <span className="ml-2">
            ({Math.round(boundingBox.width * imageNaturalSize.width)} x {Math.round(boundingBox.height * imageNaturalSize.height)} px)
          </span>
        )}
      </div>
    </div>
  );
});

export default ImageCropAdjuster;
