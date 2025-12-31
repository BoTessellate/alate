'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Type,
  X,
  Heart,
  Loader2,
  LayoutGrid,
  Grid3X3,
  Sparkles,
  Trash2,
  Copy,
  ArrowDown,
  Wand2,
  Download,
  ArrowLeft,
  Palette,
} from 'lucide-react';
import { useLooksStore, parseSlugId, generateMoodboardPath, CanvasItem } from '@/stores/useLooksStore';
import { usePriceFormatter } from '@/hooks/useCurrency';
import { getProductImage } from '@/utils/placeholder';
import CollectionInspiration from '@/components/CollectionInspiration';
import type { CollectionMetadata } from '@/types';
import Link from 'next/link';

interface Product {
  id: string;
  product_name: string;
  brand: string;
  image_url: string;
  price: number;
  currency?: string;
  tags?: string[];
}

const API_BASE_URL = 'https://backend-tml.vercel.app';

export default function MoodboardEditorPage() {
  const params = useParams();
  const router = useRouter();
  const moodboardSlug = params.collectionSlug as string;
  const canvasRef = useRef<HTMLDivElement>(null);

  // Parse the slug-id from URL
  const parsed = parseSlugId(moodboardSlug);
  const moodboardId = parsed?.id || moodboardSlug;

  // Get moodboard data from store
  const { getMoodboardById, updateMoodboard, updateMoodboardItems, setMoodboardBackground, setSaveStatus } = useLooksStore();
  const moodboard = getMoodboardById(moodboardId);

  const [moodboardName, setMoodboardName] = useState('');
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isHydrated, setIsHydrated] = useState(false);

  // Drag-to-select state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState({ x: 0, y: 0 });
  const [selectionEnd, setSelectionEnd] = useState({ x: 0, y: 0 });

  // Product suggestions state
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  // Currency formatting
  const { format: formatPrice } = usePriceFormatter();

  // Layout generator state
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const [applyingLayout, setApplyingLayout] = useState(false);

  // AI Composition state
  const [aiComposedImage, setAiComposedImage] = useState<string | null>(null);
  const [showAiPreview, setShowAiPreview] = useState(false);
  const [aiComposeError, setAiComposeError] = useState<string | null>(null);

  // Collection inspiration filter state
  const [isCollectionFilterActive, setIsCollectionFilterActive] = useState(false);

  // Background state
  const [showBackgroundMenu, setShowBackgroundMenu] = useState(false);
  const [backgroundIndex, setBackgroundIndex] = useState(0);

  // Available layout types
  const layoutTypes = [
    { type: 'ai', name: 'AI Compose', icon: Wand2, description: 'OpenAI visual moodboard', isAi: true },
    { type: 'grid', name: 'Grid', icon: Grid3X3, description: 'Clean, evenly spaced' },
    { type: 'hero', name: 'Hero', icon: Sparkles, description: 'Featured item in center' },
    { type: 'scattered', name: 'Scattered', icon: Layers, description: 'Organic, overlapping style' },
    { type: 'masonry', name: 'Masonry', icon: LayoutGrid, description: 'Pinterest-style columns' },
  ];

  // Canvas background options
  const backgroundOptions = [
    { name: 'Cream', value: 'var(--surface)', preview: '#f6f1e7' },
    { name: 'White', value: '#ffffff', preview: '#ffffff' },
    { name: 'Charcoal', value: 'var(--charcoal)', preview: '#222222' },
    { name: 'Sage', value: 'linear-gradient(135deg, #e8f0e4 0%, #d4e4cc 100%)', preview: '#d4e4cc' },
    { name: 'Warm Beige', value: 'linear-gradient(135deg, #f5ebe0 0%, #e3d5ca 100%)', preview: '#e3d5ca' },
    { name: 'Cool Gray', value: 'linear-gradient(135deg, #e9ecef 0%, #dee2e6 100%)', preview: '#dee2e6' },
    { name: 'Soft Pink', value: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)', preview: '#f8bbd9' },
    { name: 'Forest', value: 'linear-gradient(135deg, #2d4a3e 0%, #1a2f26 100%)', preview: '#2d4a3e' },
  ];

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Load moodboard data from store
  useEffect(() => {
    if (!isHydrated) return;

    if (moodboard) {
      setMoodboardName(moodboard.name);
      setItems(moodboard.items);
      setBackgroundIndex(moodboard.backgroundIndex || 0);
    } else if (!moodboard && isHydrated) {
      // Moodboard not found, redirect to looks page
      router.push('/looks');
    }
  }, [moodboard, router, isHydrated]);

  // Auto-save with debounce
  const autoSave = useCallback(() => {
    if (!moodboard) return;

    setSaveStatus('saving');

    // Update the store
    updateMoodboard(moodboard.id, { name: moodboardName });
    updateMoodboardItems(moodboard.id, items);
    setMoodboardBackground(moodboard.id, backgroundIndex);

    // Update URL if name changed
    const newPath = generateMoodboardPath(moodboardName, moodboard.id);
    const currentPath = moodboardSlug;
    if (newPath !== currentPath) {
      router.replace(`/looks/${newPath}`, { scroll: false });
    }

    setTimeout(() => {
      setSaveStatus('saved');
    }, 500);
  }, [moodboard, moodboardName, items, backgroundIndex, updateMoodboard, updateMoodboardItems, setMoodboardBackground, router, moodboardSlug, setSaveStatus]);

  // Debounced auto-save on changes
  useEffect(() => {
    if (!moodboard) return;

    const hasChanges = moodboardName !== moodboard.name ||
      JSON.stringify(items) !== JSON.stringify(moodboard.items) ||
      backgroundIndex !== moodboard.backgroundIndex;

    if (hasChanges) {
      setSaveStatus('unsaved');
      const timer = setTimeout(autoSave, 1000);
      return () => clearTimeout(timer);
    }
  }, [moodboardName, items, backgroundIndex, moodboard, autoSave, setSaveStatus]);

  // Fetch products on mount
  const fetchProducts = async (query: string = '') => {
    setLoadingProducts(true);
    try {
      const url = query
        ? `${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}&limit=50`
        : `${API_BASE_URL}/api/search?limit=50`;

      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Listen for search events from TopBar
  useEffect(() => {
    const handleSearchProducts = (e: CustomEvent<{ query: string }>) => {
      setActiveSearchQuery(e.detail.query);
      fetchProducts(e.detail.query);
    };

    window.addEventListener('searchProducts', handleSearchProducts as EventListener);
    return () => {
      window.removeEventListener('searchProducts', handleSearchProducts as EventListener);
    };
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Apply collection filters
  const handleApplyCollectionFilters = async (metadata: CollectionMetadata) => {
    setIsCollectionFilterActive(true);
    setLoadingProducts(true);

    try {
      const searchTerms: string[] = [];
      if (metadata.tags.length > 0) searchTerms.push(...metadata.tags.slice(0, 5));
      if (metadata.categories.length > 0) searchTerms.push(...metadata.categories.slice(0, 3));
      if (metadata.materials.length > 0) searchTerms.push(...metadata.materials.slice(0, 2));
      if (metadata.textures.length > 0) searchTerms.push(...metadata.textures.slice(0, 2));

      const searchPrompt = searchTerms.join(' ');

      const response = await fetch(`${API_BASE_URL}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: searchPrompt || 'all products', limit: 50 }),
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.products || []);
        setActiveSearchQuery(`Collection inspiration: ${searchTerms.slice(0, 3).join(', ')}...`);
      }
    } catch (error) {
      console.error('Failed to apply collection filters:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleClearCollectionFilters = () => {
    setIsCollectionFilterActive(false);
    setActiveSearchQuery('');
    fetchProducts();
  };

  const addProductToCanvas = (product: Product) => {
    const newItem: CanvasItem = {
      id: `item-${Date.now()}`,
      type: 'image',
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 200,
      height: 200,
      rotation: 0,
      zIndex: items.length,
      content: product.id,
      src: getProductImage(product.image_url, product.product_name),
      alt: product.product_name,
      productName: product.product_name,
      productBrand: product.brand,
      productPrice: product.price,
      productCurrency: product.currency,
    };

    setItems([...items, newItem]);
  };

  const toggleFavorite = (productId: string) => {
    setFavorites((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(productId)) {
        newFavorites.delete(productId);
      } else {
        newFavorites.add(productId);
      }
      return newFavorites;
    });
  };

  const addTextToCanvas = () => {
    const newItem: CanvasItem = {
      id: `item-${Date.now()}`,
      type: 'text',
      x: 150,
      y: 150,
      width: 200,
      height: 50,
      rotation: 0,
      zIndex: items.length,
      content: 'text',
      text: 'Double-click to edit',
      fontSize: 18,
      fontWeight: 'normal',
    };

    setItems([...items, newItem]);
  };

  const deleteSelectedItems = useCallback(() => {
    if (selectedItems.size > 0) {
      setItems(items.filter((item) => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
    }
  }, [selectedItems, items]);

  const duplicateSelectedItems = () => {
    if (selectedItems.size > 0) {
      const newItems: CanvasItem[] = [];
      let offset = 0;
      items.forEach((item) => {
        if (selectedItems.has(item.id)) {
          offset += 20;
          newItems.push({
            ...item,
            id: `item-${Date.now()}-${offset}`,
            x: item.x + offset,
            y: item.y + offset,
            zIndex: items.length + newItems.length,
          });
        }
      });
      setItems([...items, ...newItems]);
      setSelectedItems(new Set(newItems.map((i) => i.id)));
    }
  };

  const sendToBack = () => {
    if (selectedItems.size > 0) {
      const minZ = Math.min(...items.map((i) => i.zIndex));
      let zOffset = 0;
      setItems(
        items.map((item) => {
          if (selectedItems.has(item.id)) {
            zOffset++;
            return { ...item, zIndex: minZ - zOffset };
          }
          return item;
        })
      );
      setSelectedItems(new Set());
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
        deleteSelectedItems();
      }
      if (e.key === 'Escape') {
        setSelectedItems(new Set());
        setIsSelecting(false);
      }
      // Select all with Ctrl/Cmd + A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
        setSelectedItems(new Set(items.map((i) => i.id)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelectedItems, items]);

  const handleItemMouseDown = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();

    // If shift is held, add/remove from selection
    if (e.shiftKey) {
      setSelectedItems((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(itemId)) {
          newSet.delete(itemId);
        } else {
          newSet.add(itemId);
        }
        return newSet;
      });
    } else {
      // If clicking on an already selected item, keep the selection for dragging
      if (!selectedItems.has(itemId)) {
        setSelectedItems(new Set([itemId]));
      }
    }

    setDraggedItem(itemId);

    const item = items.find((i) => i.id === itemId);
    if (item && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setDragOffset({
        x: (e.clientX - rect.left) / zoom - item.x,
        y: (e.clientY - rect.top) / zoom - item.y,
      });
    }
  };

  // Handle canvas mousedown for drag-to-select
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only start selection if clicking on empty canvas area
    if (e.target === canvasRef.current) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      setIsSelecting(true);
      setSelectionStart({ x, y });
      setSelectionEnd({ x, y });

      // Clear selection unless shift is held
      if (!e.shiftKey) {
        setSelectedItems(new Set());
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    // Handle drag-to-select
    if (isSelecting) {
      setSelectionEnd({ x, y });

      // Calculate selection bounds
      const selectionBounds = {
        left: Math.min(selectionStart.x, x),
        right: Math.max(selectionStart.x, x),
        top: Math.min(selectionStart.y, y),
        bottom: Math.max(selectionStart.y, y),
      };

      // Find items that intersect with selection rectangle
      const newSelection = new Set<string>();
      items.forEach((item) => {
        const itemBounds = {
          left: item.x,
          right: item.x + item.width,
          top: item.y,
          bottom: item.y + item.height,
        };

        // Check if rectangles intersect
        const intersects =
          selectionBounds.left < itemBounds.right &&
          selectionBounds.right > itemBounds.left &&
          selectionBounds.top < itemBounds.bottom &&
          selectionBounds.bottom > itemBounds.top;

        if (intersects) {
          newSelection.add(item.id);
        }
      });

      setSelectedItems(newSelection);
      return;
    }

    // Handle item dragging (move all selected items together)
    if (draggedItem) {
      const deltaX = x - dragOffset.x - (items.find((i) => i.id === draggedItem)?.x || 0);
      const deltaY = y - dragOffset.y - (items.find((i) => i.id === draggedItem)?.y || 0);

      setItems(
        items.map((item) => {
          if (selectedItems.has(item.id)) {
            return { ...item, x: item.x + deltaX, y: item.y + deltaY };
          }
          return item;
        })
      );

      // Update drag offset to prevent accumulating delta
      const draggedItemData = items.find((i) => i.id === draggedItem);
      if (draggedItemData) {
        setDragOffset({
          x: x - draggedItemData.x - deltaX,
          y: y - draggedItemData.y - deltaY,
        });
      }
    }
  };

  const handleMouseUp = () => {
    setDraggedItem(null);
    setIsSelecting(false);
  };

  // Get selection rectangle dimensions for rendering
  const getSelectionRect = () => {
    if (!isSelecting) return null;
    return {
      left: Math.min(selectionStart.x, selectionEnd.x),
      top: Math.min(selectionStart.y, selectionEnd.y),
      width: Math.abs(selectionEnd.x - selectionStart.x),
      height: Math.abs(selectionEnd.y - selectionStart.y),
    };
  };

  const normalizeText = (text: string): string => {
    return text
      .replace(/^TEST_/i, '')
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // AI Compose function
  const handleAiCompose = async () => {
    if (items.length === 0) return;

    setApplyingLayout(true);
    setShowLayoutMenu(false);
    setAiComposeError(null);

    try {
      const productImages = items
        .filter((item) => item.type === 'image' && item.src)
        .map((item) => ({ url: item.src! }));

      if (productImages.length === 0) {
        setAiComposeError('No product images to compose');
        setApplyingLayout(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/ai?action=compose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImages,
          arrangement: 'organic',
          canvasSize: '1024x1024',
          moodboardId: moodboardId,
          style: {
            aesthetic: 'modern moodboard',
            mood: 'curated',
            lighting: 'natural',
          },
        }),
      });

      const data = await response.json();

      if (data.success && (data.moodboard?.imageUrl || data.moodboard?.imageBase64)) {
        const imageUrl = data.moodboard.imageUrl ||
          `data:image/png;base64,${data.moodboard.imageBase64}`;
        setAiComposedImage(imageUrl);
        setShowAiPreview(true);
      } else if (data._demo) {
        setAiComposeError('Demo mode active - AI composition requires API credits');
      } else {
        setAiComposeError(data.error || 'Failed to generate composition');
      }
    } catch (error) {
      console.error('AI compose error:', error);
      setAiComposeError('Failed to connect to AI service');
    } finally {
      setApplyingLayout(false);
    }
  };

  // Client-side layout algorithms
  const applyLayout = (layoutType: string) => {
    if (items.length === 0) return;

    if (layoutType === 'ai') {
      handleAiCompose();
      return;
    }

    setApplyingLayout(true);
    setShowLayoutMenu(false);

    const canvasWidth = 800;
    const canvasHeight = 600;
    const padding = 20;
    const count = items.length;

    let updatedItems: CanvasItem[] = [];

    switch (layoutType) {
      case 'grid': {
        const cols = count <= 2 ? count : count <= 4 ? 2 : count <= 6 ? 3 : 4;
        const rows = Math.ceil(count / cols);
        const cellWidth = (canvasWidth - padding * 2) / cols;
        const cellHeight = (canvasHeight - padding * 2) / rows;
        const itemSize = Math.min(cellWidth, cellHeight) - 20;

        updatedItems = items.map((item, index) => {
          const col = index % cols;
          const row = Math.floor(index / cols);
          const x = padding + col * cellWidth + (cellWidth - itemSize) / 2;
          const y = padding + row * cellHeight + (cellHeight - itemSize) / 2;

          return { ...item, x, y, width: itemSize, height: itemSize, rotation: 0, zIndex: index };
        });
        break;
      }

      case 'hero': {
        if (count === 1) {
          updatedItems = [{
            ...items[0],
            x: (canvasWidth - 300) / 2,
            y: (canvasHeight - 300) / 2,
            width: 300,
            height: 300,
            rotation: 0,
            zIndex: 0,
          }];
        } else {
          const heroSize = Math.min(350, canvasWidth * 0.45);
          const smallSize = Math.min(140, (canvasWidth - heroSize - padding * 3) / 2);

          updatedItems = [{
            ...items[0],
            x: (canvasWidth - heroSize) / 2,
            y: (canvasHeight - heroSize) / 2,
            width: heroSize,
            height: heroSize,
            rotation: 0,
            zIndex: count,
          }];

          const positions = [
            { x: padding, y: padding },
            { x: canvasWidth - smallSize - padding, y: padding },
            { x: padding, y: canvasHeight - smallSize - padding },
            { x: canvasWidth - smallSize - padding, y: canvasHeight - smallSize - padding },
            { x: padding, y: (canvasHeight - smallSize) / 2 },
            { x: canvasWidth - smallSize - padding, y: (canvasHeight - smallSize) / 2 },
          ];

          for (let i = 1; i < count; i++) {
            const pos = positions[(i - 1) % positions.length];
            updatedItems.push({
              ...items[i],
              x: pos.x,
              y: pos.y,
              width: smallSize,
              height: smallSize,
              rotation: 0,
              zIndex: i - 1,
            });
          }
        }
        break;
      }

      case 'scattered': {
        const baseSize = count <= 3 ? 200 : count <= 5 ? 170 : count <= 7 ? 150 : 130;
        const usableWidth = canvasWidth - baseSize - padding * 2;
        const usableHeight = canvasHeight - baseSize - padding * 2;

        const positions: { x: number; y: number; rotation: number; size: number }[] = [];

        for (let i = 0; i < count; i++) {
          const sizeVariation = 0.85 + Math.random() * 0.3;
          const size = baseSize * sizeVariation;
          const rotation = (Math.random() - 0.5) * 14;

          const goldenAngle = Math.PI * (3 - Math.sqrt(5));
          const angle = i * goldenAngle;
          const radius = 0.3 + (i / count) * 0.5;

          let x = padding + usableWidth / 2 + Math.cos(angle) * radius * usableWidth / 2;
          let y = padding + usableHeight / 2 + Math.sin(angle) * radius * usableHeight / 2;

          const jitterX = (Math.random() - 0.5) * 40;
          const jitterY = (Math.random() - 0.5) * 40;
          x = Math.max(padding, Math.min(canvasWidth - size - padding, x + jitterX));
          y = Math.max(padding, Math.min(canvasHeight - size - padding, y + jitterY));

          positions.push({ x, y, rotation, size });
        }

        updatedItems = items.map((item, index) => ({
          ...item,
          x: positions[index].x,
          y: positions[index].y,
          width: positions[index].size,
          height: positions[index].size,
          rotation: positions[index].rotation,
          zIndex: index,
        }));
        break;
      }

      case 'masonry': {
        const cols = count <= 2 ? 2 : count <= 4 ? 2 : 3;
        const gap = 12;
        const colWidth = (canvasWidth - padding * 2 - gap * (cols - 1)) / cols;
        const columnHeights = new Array(cols).fill(padding);

        const tempPositions: { x: number; y: number; width: number; height: number }[] = [];

        for (let i = 0; i < count; i++) {
          const shortestCol = columnHeights.indexOf(Math.min(...columnHeights));
          const heightRatio = 0.85 + Math.random() * 0.3;
          const itemHeight = colWidth * heightRatio;

          const x = padding + shortestCol * (colWidth + gap);
          const y = columnHeights[shortestCol];

          columnHeights[shortestCol] += itemHeight + gap;
          tempPositions.push({ x, y, width: colWidth, height: itemHeight });
        }

        const maxHeight = Math.max(...columnHeights);
        const availableHeight = canvasHeight - padding;
        const scale = maxHeight > availableHeight ? availableHeight / maxHeight : 1;

        if (scale < 1) {
          const scaledColWidth = colWidth * scale;
          const scaledGap = gap * scale;
          const totalScaledWidth = scaledColWidth * cols + scaledGap * (cols - 1);
          const offsetX = (canvasWidth - totalScaledWidth) / 2;

          updatedItems = items.map((item, index) => ({
            ...item,
            x: offsetX + (tempPositions[index].x - padding) * scale,
            y: tempPositions[index].y * scale,
            width: tempPositions[index].width * scale,
            height: tempPositions[index].height * scale,
            rotation: 0,
            zIndex: index,
          }));
        } else {
          const offsetY = (canvasHeight - maxHeight) / 2;
          updatedItems = items.map((item, index) => ({
            ...item,
            x: tempPositions[index].x,
            y: tempPositions[index].y + (offsetY > 0 ? offsetY : 0),
            width: tempPositions[index].width,
            height: tempPositions[index].height,
            rotation: 0,
            zIndex: index,
          }));
        }
        break;
      }

      default:
        updatedItems = items;
    }

    setItems(updatedItems);
    setApplyingLayout(false);
  };

  // Don't render until hydrated
  if (!isHydrated) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  // Moodboard not found
  if (!moodboard) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
            Moodboard not found
          </h1>
          <Link
            href="/looks"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg transition-colors"
            style={{ color: 'var(--primary)' }}
          >
            <ArrowLeft size={18} />
            Back to Layers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--background)' }}>
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Side - Canvas Area */}
        <div
          className="flex-1 relative min-w-0 flex items-center justify-center p-4"
          style={{ backgroundColor: 'var(--background-secondary)' }}
        >
          {/* Floating Tools */}
          <div
            className="absolute top-4 left-4 z-10 flex flex-col gap-1 p-2 rounded-full"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            <button
              onClick={addTextToCanvas}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer"
              style={{ color: 'var(--foreground-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                e.currentTarget.style.color = 'var(--foreground)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--foreground-secondary)';
              }}
              title="Add Text"
            >
              <Type size={18} />
            </button>

            {/* Layout Generator Button */}
            <div className="relative">
              <button
                onClick={() => setShowLayoutMenu(!showLayoutMenu)}
                disabled={items.length === 0 || applyingLayout}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-40 cursor-pointer"
                style={{
                  color: showLayoutMenu ? 'var(--primary)' : 'var(--foreground-secondary)',
                  backgroundColor: showLayoutMenu ? 'var(--surface-light)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (items.length > 0) {
                    e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showLayoutMenu) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--foreground-secondary)';
                  }
                }}
                title={items.length === 0 ? 'Add items first' : 'Auto Layout'}
              >
                {applyingLayout ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <LayoutGrid size={18} />
                )}
              </button>

              {/* Layout Menu Dropdown */}
              {showLayoutMenu && (
                <div
                  className="absolute left-full top-0 ml-2 w-48 rounded-lg border shadow-lg overflow-hidden"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                      Auto Layout
                    </p>
                  </div>
                  {layoutTypes.map((layout, idx) => {
                    const Icon = layout.icon;
                    const isAiOption = 'isAi' in layout && layout.isAi;
                    return (
                      <div key={layout.type}>
                        {isAiOption && idx > 0 && (
                          <div className="h-px mx-2" style={{ backgroundColor: 'var(--border)' }} />
                        )}
                        <button
                          onClick={() => applyLayout(layout.type)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer ${
                            isAiOption ? 'border-l-2' : ''
                          }`}
                          style={{
                            color: 'var(--foreground)',
                            backgroundColor: isAiOption ? 'rgba(147, 51, 234, 0.05)' : 'transparent',
                            borderLeftColor: isAiOption ? 'rgb(147, 51, 234)' : 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isAiOption
                              ? 'rgba(147, 51, 234, 0.1)'
                              : 'var(--surface-light)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = isAiOption
                              ? 'rgba(147, 51, 234, 0.05)'
                              : 'transparent';
                          }}
                        >
                          <Icon
                            size={16}
                            style={{ color: isAiOption ? 'rgb(147, 51, 234)' : 'var(--primary)' }}
                          />
                          <div>
                            <p className="text-sm font-medium">{layout.name}</p>
                            <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                              {layout.description}
                            </p>
                          </div>
                        </button>
                        {isAiOption && (
                          <div className="h-px mx-2" style={{ backgroundColor: 'var(--border)' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Background Picker Button */}
            <div className="relative">
              <button
                onClick={() => setShowBackgroundMenu(!showBackgroundMenu)}
                className="w-9 h-9 rounded-full flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  color: showBackgroundMenu ? 'var(--primary)' : 'var(--foreground-secondary)',
                  backgroundColor: showBackgroundMenu ? 'var(--surface-light)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseLeave={(e) => {
                  if (!showBackgroundMenu) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--foreground-secondary)';
                  }
                }}
                title="Canvas Background"
              >
                <Palette size={18} />
              </button>

              {/* Background Menu Dropdown */}
              {showBackgroundMenu && (
                <div
                  className="absolute left-full top-0 ml-2 w-44 rounded-lg border shadow-lg overflow-hidden"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--foreground-muted)' }}>
                      Canvas Background
                    </p>
                  </div>
                  <div className="p-2 grid grid-cols-4 gap-1.5">
                    {backgroundOptions.map((bg, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setBackgroundIndex(idx);
                          setShowBackgroundMenu(false);
                        }}
                        className="w-8 h-8 rounded-md border-2 transition-all cursor-pointer"
                        style={{
                          background: bg.preview,
                          borderColor: backgroundIndex === idx ? 'var(--primary)' : 'transparent',
                          boxShadow: backgroundIndex === idx ? '0 0 0 2px rgba(76, 112, 49, 0.2)' : 'none',
                        }}
                        title={bg.name}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="h-px my-1" style={{ backgroundColor: 'var(--border)' }} />

            <button
              onClick={() => setZoom(Math.min(zoom + 0.1, 2))}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ color: 'var(--foreground-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Zoom In"
            >
              <ZoomIn size={18} />
            </button>

            <span className="text-xs text-center" style={{ color: 'var(--foreground-muted)' }}>
              {Math.round(zoom * 100)}%
            </span>

            <button
              onClick={() => setZoom(Math.max(zoom - 0.1, 0.5))}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ color: 'var(--foreground-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Zoom Out"
            >
              <ZoomOut size={18} />
            </button>

            <button
              onClick={() => setZoom(1)}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ color: 'var(--foreground-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-light)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              title="Reset Zoom"
            >
              <RotateCcw size={18} />
            </button>
          </div>

          {/* Canvas */}
          <div
            ref={canvasRef}
            className="relative"
            style={{
              width: 'min(calc(100% - 32px), 800px)',
              height: 'min(calc(100% - 32px), 600px)',
              maxWidth: '800px',
              maxHeight: '600px',
              background: backgroundOptions[backgroundIndex]?.value || 'var(--surface)',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              cursor: isSelecting ? 'crosshair' : 'default',
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {items.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <Layers size={64} style={{ color: 'var(--foreground-muted)' }} className="mb-4" />
                <p className="text-lg font-medium mb-2" style={{ color: 'var(--foreground-secondary)' }}>
                  Start building your moodboard
                </p>
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  Click on products from the right panel to add them
                </p>
              </div>
            )}

            {items.map((item) => {
              const isSelected = selectedItems.has(item.id);
              return (
                <div
                  key={item.id}
                  className="absolute"
                  style={{
                    left: item.x,
                    top: item.y,
                    width: item.width,
                    height: isSelected && selectedItems.size === 1 ? item.height + 52 : item.height,
                    zIndex: isSelected ? 9999 : item.zIndex,
                  }}
                >
                  <div
                    className={`cursor-move transition-shadow duration-150 ${isSelected ? 'ring-2 ring-green-700/50' : ''}`}
                    style={{
                      width: item.width,
                      height: item.height,
                      transform: `rotate(${item.rotation}deg)`,
                    }}
                    onMouseDown={(e) => handleItemMouseDown(e, item.id)}
                  >
                    {item.type === 'image' && item.src && (
                      <img
                        src={item.src}
                        alt={item.alt || ''}
                        className="w-full h-full object-contain rounded-lg"
                        style={{ backgroundColor: 'var(--surface-light)' }}
                        draggable={false}
                      />
                    )}
                    {item.type === 'text' && (
                      <div
                        className="w-full h-full flex items-center justify-center p-2"
                        style={{
                          fontSize: item.fontSize,
                          fontWeight: item.fontWeight,
                          color: 'var(--foreground)',
                        }}
                      >
                        {item.text}
                      </div>
                    )}
                  </div>

                  {/* Show toolbar only when single item is selected */}
                  {isSelected && selectedItems.size === 1 && (
                    <div
                      className="flex items-center justify-center mt-2"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-lg"
                        style={{
                          backgroundColor: 'var(--surface)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <button
                          onClick={duplicateSelectedItems}
                          className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                          style={{ color: 'var(--foreground-secondary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                            e.currentTarget.style.color = 'var(--foreground)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--foreground-secondary)';
                          }}
                          title="Duplicate"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          onClick={sendToBack}
                          className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                          style={{ color: 'var(--foreground-secondary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                            e.currentTarget.style.color = 'var(--foreground)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--foreground-secondary)';
                          }}
                          title="Send to back"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <div className="w-px h-4 mx-0.5" style={{ backgroundColor: 'var(--border)' }} />
                        <button
                          onClick={deleteSelectedItems}
                          className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                          style={{ color: 'var(--foreground-secondary)' }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                            e.currentTarget.style.color = 'var(--error)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = 'var(--foreground-secondary)';
                          }}
                          title="Delete (Del)"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Selection Rectangle */}
            {isSelecting && (() => {
              const rect = getSelectionRect();
              if (!rect || (rect.width < 5 && rect.height < 5)) return null;
              return (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                    border: '1px dashed rgba(76, 112, 49, 0.8)',
                    backgroundColor: 'rgba(76, 112, 49, 0.1)',
                    zIndex: 10000,
                  }}
                />
              );
            })()}

            {/* Multi-selection floating toolbar */}
            {selectedItems.size > 1 && (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-2 rounded-lg shadow-lg z-[10001]"
                style={{
                  backgroundColor: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <span className="text-xs mr-2" style={{ color: 'var(--foreground-muted)' }}>
                  {selectedItems.size} selected
                </span>
                <button
                  onClick={duplicateSelectedItems}
                  className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                  style={{ color: 'var(--foreground-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--foreground-secondary)';
                  }}
                  title="Duplicate All"
                >
                  <Copy size={14} />
                </button>
                <button
                  onClick={sendToBack}
                  className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                  style={{ color: 'var(--foreground-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                    e.currentTarget.style.color = 'var(--foreground)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--foreground-secondary)';
                  }}
                  title="Send All to Back"
                >
                  <ArrowDown size={14} />
                </button>
                <div className="w-px h-4 mx-0.5" style={{ backgroundColor: 'var(--border)' }} />
                <button
                  onClick={deleteSelectedItems}
                  className="w-7 h-7 rounded flex items-center justify-center transition-colors"
                  style={{ color: 'var(--foreground-secondary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    e.currentTarget.style.color = 'var(--error)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--foreground-secondary)';
                  }}
                  title="Delete All (Del)"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side - Product Suggestions */}
        <div
          className="w-[400px] xl:w-[500px] 2xl:w-[600px] border-l flex flex-col shrink-0 min-h-0"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <CollectionInspiration
            onApplyFilters={handleApplyCollectionFilters}
            onClearFilters={handleClearCollectionFilters}
            isFilterActive={isCollectionFilterActive}
          />

          <div className="px-3 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                Add Products
              </h3>
              <div className="flex items-center gap-2">
                {loadingProducts ? (
                  <>
                    <div
                      className="w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: 'var(--warning, #f59e0b)' }}
                    />
                    <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      Loading...
                    </span>
                  </>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                    {products.length} products available
                  </span>
                )}
                {activeSearchQuery && (
                  <button
                    onClick={() => {
                      setActiveSearchQuery('');
                      setIsCollectionFilterActive(false);
                      fetchProducts('');
                    }}
                    className="text-xs hover:underline"
                    style={{ color: 'var(--primary)' }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            {activeSearchQuery && !loadingProducts && (
              <div className="flex items-center gap-2 mt-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: 'var(--primary)' }}
                />
                <span className="text-xs truncate" style={{ color: 'var(--foreground-secondary)' }}>
                  {isCollectionFilterActive
                    ? activeSearchQuery
                    : `Searching: "${activeSearchQuery}"`}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loadingProducts && (
              <div className="flex items-center justify-center py-12">
                <Loader2
                  size={24}
                  className="animate-spin"
                  style={{ color: 'var(--primary)' }}
                />
                <span className="ml-2 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                  Loading...
                </span>
              </div>
            )}

            {!loadingProducts && products.length === 0 && (
              <p className="text-sm text-center py-8" style={{ color: 'var(--foreground-muted)' }}>
                No products found
              </p>
            )}

            {!loadingProducts && products.length > 0 && (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="group rounded-lg border overflow-hidden cursor-pointer transition-all duration-200"
                    style={{
                      backgroundColor: 'var(--surface-light)',
                      borderColor: 'var(--border)',
                    }}
                    onClick={() => addProductToCanvas(product)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    <div
                      className="relative aspect-square"
                      style={{ backgroundColor: 'var(--background-secondary)' }}
                    >
                      <img
                        src={getProductImage(product.image_url, product.product_name)}
                        alt={product.product_name}
                        className="w-full h-full object-cover"
                      />

                      <div
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ backgroundColor: 'rgba(76, 112, 49, 0.8)' }}
                      >
                        <Plus size={24} style={{ color: 'white' }} />
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(product.id);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                        style={{
                          backgroundColor: favorites.has(product.id)
                            ? 'var(--error)'
                            : 'rgba(0,0,0,0.5)',
                        }}
                      >
                        <Heart
                          size={12}
                          fill={favorites.has(product.id) ? 'white' : 'none'}
                          style={{ color: 'white' }}
                        />
                      </button>
                    </div>

                    <div className="p-2">
                      <p
                        className="text-xs font-medium uppercase tracking-wide mb-0.5"
                        style={{ color: 'var(--primary)' }}
                      >
                        {normalizeText(product.brand)}
                      </p>
                      <h4
                        className="font-medium text-xs mb-1 line-clamp-2"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {normalizeText(product.product_name)}
                      </h4>
                      <p className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>
                        {formatPrice(product.price, product.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Compose Preview Modal */}
      {showAiPreview && aiComposedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
          onClick={() => setShowAiPreview(false)}
        >
          <div
            className="relative max-w-4xl w-full rounded-xl overflow-hidden"
            style={{ backgroundColor: 'var(--surface)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center gap-2">
                <Wand2 size={18} style={{ color: 'rgb(147, 51, 234)' }} />
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>
                  AI Composed Moodboard
                </span>
              </div>
              <button
                onClick={() => setShowAiPreview(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ color: 'var(--foreground-secondary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4">
              <img
                src={aiComposedImage}
                alt="AI Composed Moodboard"
                className="w-full rounded-lg"
                style={{ maxHeight: '70vh', objectFit: 'contain' }}
              />
            </div>

            <div
              className="flex items-center justify-end gap-3 px-4 py-3 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <a
                href={aiComposedImage}
                download={`moodboard-${moodboardId}-${Date.now()}.png`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                }}
              >
                <Download size={16} />
                Download
              </a>
              <button
                onClick={() => setShowAiPreview(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: 'var(--surface-light)',
                  color: 'var(--foreground)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Compose Error Toast */}
      {aiComposeError && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--error)',
          }}
        >
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>
            {aiComposeError}
          </span>
          <button
            onClick={() => setAiComposeError(null)}
            className="text-sm font-medium"
            style={{ color: 'var(--primary)' }}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
