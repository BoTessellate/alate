'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Image,
  Type,
  X,
  Heart,
  Loader2,
  LayoutGrid,
  Grid3X3,
  Sparkles,
  ChevronDown,
  Trash2,
  Copy,
  ArrowDown,
  Wand2,
  Download,
} from 'lucide-react';
import { useLooksStore, parseSlugId, generateLookPath, CanvasItem } from '@/stores/useLooksStore';
import { usePriceFormatter } from '@/hooks/useCurrency';
import { getProductImage } from '@/utils/placeholder';
import CollectionInspiration from '@/components/CollectionInspiration';
import type { CollectionMetadata } from '@/types';

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

export default function LookEditorPage() {
  const params = useParams();
  const router = useRouter();
  const slugId = params.id as string;
  const canvasRef = useRef<HTMLDivElement>(null);

  // Parse the slug-id from URL
  const parsed = parseSlugId(slugId);
  const lookId = parsed?.id || slugId;

  // Get look data from store
  const { getLookById, updateLook, updateLookItems, createLook, setSaveStatus } = useLooksStore();
  const look = getLookById(lookId);

  const [lookName, setLookName] = useState('');
  const [items, setItems] = useState<CanvasItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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

  // Available layout types
  const layoutTypes = [
    { type: 'ai', name: 'AI Compose', icon: Wand2, description: 'OpenAI visual moodboard', isAi: true },
    { type: 'grid', name: 'Grid', icon: Grid3X3, description: 'Clean, evenly spaced' },
    { type: 'hero', name: 'Hero', icon: Sparkles, description: 'Featured item in center' },
    { type: 'scattered', name: 'Scattered', icon: Layers, description: 'Organic, overlapping style' },
    { type: 'masonry', name: 'Masonry', icon: LayoutGrid, description: 'Pinterest-style columns' },
  ];

  // Load look data from store
  useEffect(() => {
    if (look) {
      setLookName(look.name);
      setItems(look.items);
    } else if (slugId === 'new') {
      // Create a new look
      const newLook = createLook('Untitled Look');
      router.replace(`/looks/${generateLookPath(newLook.name, newLook.id)}`);
    } else {
      // Look not found, redirect to looks page
      router.push('/looks');
    }
  }, [look, slugId, createLook, router]);

  // Auto-save with debounce
  const autoSave = useCallback(() => {
    if (!look) return;

    setSaveStatus('saving');

    // Update the store
    updateLook(look.id, { name: lookName });
    updateLookItems(look.id, items);

    // Update URL if name changed
    const newPath = generateLookPath(lookName, look.id);
    const currentPath = slugId;
    if (newPath !== currentPath) {
      router.replace(`/looks/${newPath}`, { scroll: false });
    }

    setTimeout(() => {
      setSaveStatus('saved');
    }, 500);
  }, [look, lookName, items, updateLook, updateLookItems, router, slugId]);

  // Debounced auto-save on changes
  useEffect(() => {
    if (!look) return;

    const hasChanges = lookName !== look.name || JSON.stringify(items) !== JSON.stringify(look.items);

    if (hasChanges) {
      setSaveStatus('unsaved');
      const timer = setTimeout(autoSave, 1000);
      return () => clearTimeout(timer);
    }
  }, [lookName, items, look, autoSave]);

  // Fetch products on mount
  const fetchProducts = async (query: string = '') => {
    setLoadingProducts(true);
    try {
      // Use GET without query param to fetch all products, or with q param to search
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

  // Apply collection filters - search using aggregated metadata
  const handleApplyCollectionFilters = async (metadata: CollectionMetadata) => {
    setIsCollectionFilterActive(true);
    setLoadingProducts(true);

    try {
      // Build a search query from the collection metadata
      const searchTerms: string[] = [];

      // Add tags (most important)
      if (metadata.tags.length > 0) {
        searchTerms.push(...metadata.tags.slice(0, 5));
      }

      // Add categories
      if (metadata.categories.length > 0) {
        searchTerms.push(...metadata.categories.slice(0, 3));
      }

      // Add materials
      if (metadata.materials.length > 0) {
        searchTerms.push(...metadata.materials.slice(0, 2));
      }

      // Add textures
      if (metadata.textures.length > 0) {
        searchTerms.push(...metadata.textures.slice(0, 2));
      }

      // Create a combined search prompt
      const searchPrompt = searchTerms.join(' ');

      // Use POST endpoint for semantic search
      const response = await fetch(`${API_BASE_URL}/api/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: searchPrompt || 'all products',
          limit: 50,
        }),
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

  // Clear collection filters
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

  const deleteSelectedItem = useCallback(() => {
    if (selectedItem) {
      setItems(items.filter((item) => item.id !== selectedItem));
      setSelectedItem(null);
    }
  }, [selectedItem, items]);

  const duplicateSelectedItem = () => {
    if (selectedItem) {
      const item = items.find((i) => i.id === selectedItem);
      if (item) {
        const newItem: CanvasItem = {
          ...item,
          id: `item-${Date.now()}`,
          x: item.x + 20,
          y: item.y + 20,
          zIndex: items.length,
        };
        setItems([...items, newItem]);
        setSelectedItem(newItem.id);
      }
    }
  };

  const sendToBack = () => {
    if (selectedItem) {
      const minZ = Math.min(...items.map((i) => i.zIndex));
      setItems(
        items.map((item) =>
          item.id === selectedItem ? { ...item, zIndex: minZ - 1 } : item
        )
      );
      // Deselect so the z-index change is visible immediately
      setSelectedItem(null);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't delete if user is typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return;
        }
        e.preventDefault();
        deleteSelectedItem();
      }
      if (e.key === 'Escape') {
        setSelectedItem(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteSelectedItem]);

  const handleMouseDown = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    setSelectedItem(itemId);
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

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedItem && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom - dragOffset.x;
      const y = (e.clientY - rect.top) / zoom - dragOffset.y;

      setItems(
        items.map((item) =>
          item.id === draggedItem ? { ...item, x, y } : item
        )
      );
    }
  };

  const handleMouseUp = () => {
    setDraggedItem(null);
  };

  const normalizeText = (text: string): string => {
    return text
      .replace(/^TEST_/i, '')
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // AI Compose function - calls OpenAI to generate visual moodboard
  const handleAiCompose = async () => {
    if (items.length === 0) return;

    setApplyingLayout(true);
    setShowLayoutMenu(false);
    setAiComposeError(null);

    try {
      // Get image URLs from items
      const productImages = items
        .filter((item) => item.type === 'image' && item.src)
        .map((item) => ({ url: item.src! }));

      if (productImages.length === 0) {
        setAiComposeError('No product images to compose');
        setApplyingLayout(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/image-ai?action=compose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productImages,
          arrangement: 'organic',
          canvasSize: '1024x1024',
          lookId: lookId,
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

    // Handle AI compose separately
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
        // Clean grid layout
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

          return {
            ...item,
            x,
            y,
            width: itemSize,
            height: itemSize,
            rotation: 0,
            zIndex: index,
          };
        });
        break;
      }

      case 'hero': {
        // Hero layout - first item large in center, others smaller around
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

          // Hero item centered
          updatedItems = [{
            ...items[0],
            x: (canvasWidth - heroSize) / 2,
            y: (canvasHeight - heroSize) / 2,
            width: heroSize,
            height: heroSize,
            rotation: 0,
            zIndex: count,
          }];

          // Position other items around the hero
          const positions = [
            { x: padding, y: padding }, // top-left
            { x: canvasWidth - smallSize - padding, y: padding }, // top-right
            { x: padding, y: canvasHeight - smallSize - padding }, // bottom-left
            { x: canvasWidth - smallSize - padding, y: canvasHeight - smallSize - padding }, // bottom-right
            { x: padding, y: (canvasHeight - smallSize) / 2 }, // middle-left
            { x: canvasWidth - smallSize - padding, y: (canvasHeight - smallSize) / 2 }, // middle-right
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
        // Organic scattered layout with slight overlaps and rotations
        // Size based on count - smaller items when more products
        const baseSize = count <= 3 ? 200 : count <= 5 ? 170 : count <= 7 ? 150 : 130;
        const positions: { x: number; y: number; rotation: number; size: number }[] = [];

        // Calculate usable area (accounting for item size)
        const usableWidth = canvasWidth - baseSize - padding * 2;
        const usableHeight = canvasHeight - baseSize - padding * 2;

        // Generate positions using a spiral-like distribution for better space usage
        for (let i = 0; i < count; i++) {
          const sizeVariation = 0.85 + Math.random() * 0.3; // 85% to 115%
          const size = baseSize * sizeVariation;
          const rotation = (Math.random() - 0.5) * 14; // -7 to +7 degrees

          // Use golden angle distribution for organic but space-efficient placement
          const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ~137.5 degrees
          const angle = i * goldenAngle;
          const radius = 0.3 + (i / count) * 0.5; // Expand outward

          // Convert polar to cartesian, centered on canvas
          let x = padding + usableWidth / 2 + Math.cos(angle) * radius * usableWidth / 2;
          let y = padding + usableHeight / 2 + Math.sin(angle) * radius * usableHeight / 2;

          // Add small jitter for organic feel
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
        // Pinterest-style masonry columns
        const cols = count <= 2 ? 2 : count <= 4 ? 2 : 3;
        const gap = 12;
        const colWidth = (canvasWidth - padding * 2 - gap * (cols - 1)) / cols;
        const columnHeights = new Array(cols).fill(padding);

        // First pass: calculate positions with varied heights
        const tempPositions: { x: number; y: number; width: number; height: number }[] = [];

        for (let i = 0; i < count; i++) {
          const shortestCol = columnHeights.indexOf(Math.min(...columnHeights));
          const heightRatio = 0.85 + Math.random() * 0.3; // 85% to 115%
          const itemHeight = colWidth * heightRatio;

          const x = padding + shortestCol * (colWidth + gap);
          const y = columnHeights[shortestCol];

          columnHeights[shortestCol] += itemHeight + gap;
          tempPositions.push({ x, y, width: colWidth, height: itemHeight });
        }

        // Check if content overflows and scale down if needed
        const maxHeight = Math.max(...columnHeights);
        const availableHeight = canvasHeight - padding;
        const scale = maxHeight > availableHeight ? availableHeight / maxHeight : 1;

        if (scale < 1) {
          // Scale everything down to fit
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
          // No scaling needed, center vertically if extra space
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

  // Don't render until look is loaded
  if (!look) {
    return (
      <div className="h-full flex items-center justify-center" style={{ backgroundColor: 'var(--background)' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
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
              backgroundColor: 'var(--surface)',
              borderRadius: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
            }}
            onClick={() => setSelectedItem(null)}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {items.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Layers size={64} style={{ color: 'var(--foreground-muted)' }} className="mb-4" />
                <p className="text-lg font-medium mb-2" style={{ color: 'var(--foreground-secondary)' }}>
                  Start building your look
                </p>
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  Click on products from the right panel to add them
                </p>
              </div>
            )}

            {items.map((item) => (
              <div
                key={item.id}
                className="absolute"
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  height: selectedItem === item.id ? item.height + 52 : item.height,
                  zIndex: selectedItem === item.id ? 9999 : item.zIndex,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* The actual item */}
                <div
                  className={`cursor-move transition-shadow duration-150 ${selectedItem === item.id ? 'ring-2 ring-green-700/50' : ''}`}
                  style={{
                    width: item.width,
                    height: item.height,
                    transform: `rotate(${item.rotation}deg)`,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, item.id)}
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

                {/* Floating toolbar on selection */}
                {selectedItem === item.id && (
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
                        onClick={duplicateSelectedItem}
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
                        onClick={deleteSelectedItem}
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
            ))}
          </div>
        </div>

        {/* Right Side - Product Suggestions (Discover Content) */}
        <div
          className="w-[400px] xl:w-[500px] 2xl:w-[600px] border-l flex flex-col shrink-0 min-h-0"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Collection Inspiration Panel - Moved to top for visibility */}
          <CollectionInspiration
            onApplyFilters={handleApplyCollectionFilters}
            onClearFilters={handleClearCollectionFilters}
            isFilterActive={isCollectionFilterActive}
          />

          {/* Header with Search Status - Title and count on same line */}
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
            {/* Search/Filter Status Message (only when filtering) */}
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

          {/* Products Grid */}
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
                      {/* Product Image */}
                      <div
                        className="relative aspect-square"
                        style={{ backgroundColor: 'var(--background-secondary)' }}
                      >
                        <img
                          src={getProductImage(product.image_url, product.product_name)}
                          alt={product.product_name}
                          className="w-full h-full object-cover"
                        />

                        {/* Add indicator on hover */}
                        <div
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ backgroundColor: 'rgba(76, 112, 49, 0.8)' }}
                        >
                          <Plus size={24} style={{ color: 'white' }} />
                        </div>

                        {/* Favorite Button */}
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

                      {/* Product Info */}
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
            {/* Header */}
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

            {/* Image */}
            <div className="p-4">
              <img
                src={aiComposedImage}
                alt="AI Composed Moodboard"
                className="w-full rounded-lg"
                style={{ maxHeight: '70vh', objectFit: 'contain' }}
              />
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end gap-3 px-4 py-3 border-t"
              style={{ borderColor: 'var(--border)' }}
            >
              <a
                href={aiComposedImage}
                download={`moodboard-${lookId}-${Date.now()}.png`}
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
