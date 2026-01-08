'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Plus, X } from 'lucide-react';
import { useSidePanel, Modal, ModalContent, ModalFooter, TagList } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UnifiedChatInput, type ChatInputPayload } from '@/components/ui/UnifiedChatInput';
import { ProductResultCard, ProcessingIndicator, ImageCropAdjuster, type BoundingBox } from '@/components/chat';
import { useChatStore, type ChatMessage, type ChatProduct } from '@/stores/useChatStore';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import type { Product } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-tml.vercel.app';

// Wishlist collection ID
const WISHLIST_COLLECTION_ID = 'wishlist';

/**
 * UnifiedChatContent - Main unified chat interface
 *
 * Handles:
 * - Image uploads → Process and add to closet
 * - URL scrapes → Fetch, enrich, wishlist option
 * - Text search → AI search with inline results
 *
 * In bubble mode: Minimal UI (input only, status in header)
 * In panel mode: Full chat history with messages
 */
export default function UnifiedChatContent() {
  const router = useRouter();
  const { isPanelMode, close } = useSidePanel();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState<ChatProduct | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    product_name: '',
    brand: '',
    size: '',
    price: '',
    tags: [] as string[],
  });
  // Tag editing state
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [originalTags, setOriginalTags] = useState<string[]>([]);
  // Crop adjustment state
  const [showCropAdjust, setShowCropAdjust] = useState(false);
  const [adjustedBoundingBox, setAdjustedBoundingBox] = useState<BoundingBox | null>(null);
  const [isReCropping, setIsReCropping] = useState(false);
  // Save/sync status for visual feedback
  const [saveStatus, setSaveStatus] = useState<{
    state: 'idle' | 'saving' | 'searching' | 'syncing' | 'success' | 'error';
    message?: string;
  }>({ state: 'idle' });

  const {
    messages,
    processing,
    pendingImage,
    pendingImagePreview,
    addMessage,
    updateMessage,
    startProcessing,
    updateStage,
    updateProgress,
    finishProcessing,
    setProcessingError,
    setPendingImage,
    clearPendingImage,
    toggleProductWishlist,
    toggleProductCloset,
    updateProductInMessage,
  } = useChatStore();

  const {
    collections,
    addProductToCollection,
    createCollection,
    getCollectionById,
    updateProductInCollection,
  } = useCollectionsStore();

  // Auto-scroll to bottom in panel mode
  useEffect(() => {
    if (isPanelMode && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isPanelMode]);

  // Ensure wishlist collection exists
  const ensureWishlistCollection = useCallback(() => {
    const wishlist = getCollectionById(WISHLIST_COLLECTION_ID);
    if (!wishlist) {
      createCollection('Wishlist', 'Products you want to buy');
    }
  }, [getCollectionById, createCollection]);

  // Get default collection for uploads
  const getDefaultCollection = useCallback(() => {
    // Use first collection or create one
    if (collections.length > 0) {
      return collections[0].id;
    }
    const newCollection = createCollection('My Closet', 'My personal collection');
    return newCollection.id;
  }, [collections, createCollection]);

  // Convert File to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  // Process image upload with multi-product detection
  const processImageUpload = useCallback(async (file: File, description: string) => {
    try {
      // Add user message
      addMessage({
        type: 'user-image',
        content: description || 'Uploaded an image',
        imagePreviewUrl: pendingImagePreview || undefined,
      });

      clearPendingImage();
      startProcessing('uploading', 'Uploading image...');
      updateProgress(10);

      const base64 = await fileToBase64(file);
      updateProgress(20);

      const mimeType = file.type as 'image/jpeg' | 'image/png' | 'image/webp';

      // Step 1: Smart detect to find all products in the image
      updateStage('detecting', 'Detecting products...');
      const detectResponse = await fetch(`${API_BASE_URL}/api/image-processing?action=smart-detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: { base64, mimeType },
          context: 'fashion',
        }),
      });

      updateProgress(40);

      if (!detectResponse.ok) {
        const errorData = await detectResponse.json();
        throw new Error(errorData.error || 'Detection failed');
      }

      const detectData = await detectResponse.json();

      if (!detectData.success || detectData.detectedProducts.length === 0) {
        throw new Error('No products detected in image');
      }

      // Step 2: Process all detected products (crop and enrich each one)
      updateStage('enriching', `Processing ${detectData.detectedProducts.length} item${detectData.detectedProducts.length > 1 ? 's' : ''}...`);
      updateProgress(50);

      const selectedProducts = detectData.detectedProducts.map((p: any) => ({
        tempId: p.tempId,
        boundingBox: p.boundingBox,
        detected: p,
      }));

      const processResponse = await fetch(`${API_BASE_URL}/api/image-processing?action=process-multi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalBase64: base64,
          mimeType,
          selectedProducts,
          productType: 'fashion',
          originalImageUrl: detectData.originalImageUrl,
        }),
      });

      updateProgress(80);

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error || 'Processing failed');
      }

      const processData = await processResponse.json();

      if (!processData.success || processData.products.length === 0) {
        throw new Error('Failed to process products');
      }

      // Step 3: Add all products to collection
      const collectionId = getDefaultCollection();
      const collection = getCollectionById(collectionId);
      const collectionName = collection?.name || 'My Closet';

      const chatProducts: ChatProduct[] = processData.products.map((p: any) => ({
        id: p.id,
        product_name: p.product_name,
        brand: p.brand || 'My Upload',
        price: p.price || 0,
        currency: p.currency || 'USD',
        image_url: p.image_url,
        tags: p.tags || [],
        color_palette: p.color_palette || [],
        category: p.category || 'general',
        material: p.material,
        texture: p.texture,
        tone: p.tone,
        source: 'upload',
        original_image_url: p.original_image_url,
        uploaded_at: p.uploaded_at,
        isAddedToCloset: true,
      }));

      // Add each product to the collection
      for (const product of chatProducts) {
        addProductToCollection(collectionId, product as Product);
      }

      updateProgress(100);

      // Add assistant response with all products
      const productCount = chatProducts.length;
      addMessage({
        type: 'assistant-products',
        content: `Added ${productCount} item${productCount > 1 ? 's' : ''} to "${collectionName}"`,
        products: chatProducts,
        navigationHint: {
          text: 'View in Closet',
          route: `/closet`,
          collectionName,
        },
      });

      // Add follow-up prompt with action buttons
      addMessage({
        type: 'assistant-text',
        content: `What would you like to do next?`,
        followUpActions: [
          { label: 'Add details', action: 'add-details', primary: true },
          { label: 'Upload another', action: 'upload-another' },
          { label: 'View in closet', action: 'view-closet' },
        ],
        productId: chatProducts[0]?.id,
      });

      finishProcessing(`${productCount} item${productCount > 1 ? 's' : ''} added!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process image';
      setProcessingError(message);
      addMessage({
        type: 'assistant-status',
        content: message,
        statusType: 'error',
      });
    }
  }, [
    addMessage, pendingImagePreview, clearPendingImage, startProcessing,
    updateProgress, updateStage, fileToBase64, getDefaultCollection,
    addProductToCollection, finishProcessing, setProcessingError, getCollectionById,
  ]);

  // Process URL scrape
  const processUrlScrape = useCallback(async (url: string) => {
    try {
      addMessage({
        type: 'user-url',
        content: url,
      });

      startProcessing('scraping', 'Fetching product info...');
      updateProgress(20);

      // Step 1: Scrape the URL
      const scrapeResponse = await fetch(`${API_BASE_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      updateProgress(50);

      if (!scrapeResponse.ok) {
        throw new Error('Failed to fetch product information');
      }

      const scrapeData = await scrapeResponse.json();

      updateStage('enriching', 'Analyzing product...');
      updateProgress(70);

      // Step 2: Enrich with AI
      const enrichResponse = await fetch(`${API_BASE_URL}/api/ai?action=enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: {
            name: scrapeData.title,
            brand: scrapeData.brandName,
            price: parseFloat(scrapeData.price) || 0,
            currency: scrapeData.currency,
            image_url: scrapeData.imageUrl,
            source_url: url,
          },
        }),
      });

      updateProgress(90);

      let enrichedData = scrapeData;
      if (enrichResponse.ok) {
        const enrichResult = await enrichResponse.json();
        if (enrichResult.success) {
          enrichedData = { ...scrapeData, ...enrichResult.product };
        }
      }

      const product: ChatProduct = {
        id: `scrape-${Date.now()}`,
        product_name: enrichedData.title || enrichedData.product_name || 'Unknown Product',
        brand: enrichedData.brandName || enrichedData.brand || 'Unknown',
        price: parseFloat(enrichedData.price) || 0,
        currency: enrichedData.currency || 'USD',
        image_url: enrichedData.imageUrl || enrichedData.image_url || '',
        tags: enrichedData.tags || [],
        color_palette: enrichedData.color_palette || enrichedData.colors || [],
        category: enrichedData.category || 'general',
        material: enrichedData.material,
        texture: enrichedData.texture,
        tone: enrichedData.tone,
        source: 'scrape',
        isWishlisted: true, // Default to wishlisted
      };

      // Auto-add to wishlist collection since it's wishlisted by default
      ensureWishlistCollection();
      addProductToCollection(WISHLIST_COLLECTION_ID, product as Product);

      updateProgress(100);

      addMessage({
        type: 'assistant-products',
        content: 'Found this product',
        products: [product],
      });

      finishProcessing('Product found!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch product';
      setProcessingError(message);
      addMessage({
        type: 'assistant-status',
        content: message,
        statusType: 'error',
      });
    }
  }, [addMessage, startProcessing, updateProgress, updateStage, finishProcessing, setProcessingError, ensureWishlistCollection, addProductToCollection]);

  // Process natural language product details (Issue 2)
  const processProductDetails = useCallback(async (description: string, productId: string) => {
    try {
      addMessage({
        type: 'user-text',
        content: description,
      });

      startProcessing('enriching', 'Parsing details...');
      updateProgress(30);

      const response = await fetch(`${API_BASE_URL}/api/ai?action=parse-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          context: 'fashion',
        }),
      });

      updateProgress(80);

      if (!response.ok) {
        throw new Error('Failed to parse details');
      }

      const data = await response.json();
      updateProgress(100);

      if (data.success && data.parsed) {
        const parsed = data.parsed;

        // Handle multi-product response
        if (parsed.multiple && parsed.products?.length > 0) {
          const productSummaries = parsed.products.map((p: { product_type?: string; brand?: string; size?: string }) => {
            const parts = [];
            if (p.product_type) parts.push(p.product_type);
            if (p.brand) parts.push(p.brand);
            if (p.size) parts.push(`size ${p.size}`);
            return parts.join(' • ');
          });

          addMessage({
            type: 'assistant-text',
            content: `Got it! Updated ${parsed.products.length} items:\n${productSummaries.map((s: string) => `• ${s}`).join('\n')}`,
          });
          finishProcessing('Details updated!');
        } else {
          // Single product response
          const updates: string[] = [];

          if (parsed.brand) updates.push(`Brand: ${parsed.brand}`);
          if (parsed.size) updates.push(`Size: ${parsed.size}`);
          if (parsed.material) updates.push(`Material: ${parsed.material}`);
          if (parsed.estimated_price) updates.push(`Price: ${parsed.currency || '$'}${parsed.estimated_price}`);
          if (parsed.additional_tags?.length > 0) updates.push(`Tags: ${parsed.additional_tags.join(', ')}`);

          if (updates.length > 0) {
            addMessage({
              type: 'assistant-text',
              content: `Got it! Updated: ${updates.join(' • ')}`,
            });
            finishProcessing('Details updated!');
          } else {
            addMessage({
              type: 'assistant-text',
              content: "Hmm, I couldn't catch that. Try: \"Mango top, size S\" or \"M&S pants, size M\"",
            });
            finishProcessing('');
          }
        }
      } else {
        addMessage({
          type: 'assistant-text',
          content: "Couldn't parse that. Try: \"brand name, size\" — like \"Zara, size M\"",
        });
        finishProcessing('');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse details';
      setProcessingError(message);
      addMessage({
        type: 'assistant-status',
        content: message,
        statusType: 'error',
      });
    }
  }, [addMessage, startProcessing, updateProgress, finishProcessing, setProcessingError]);

  // Process text search
  const processTextSearch = useCallback(async (query: string) => {
    try {
      addMessage({
        type: 'user-text',
        content: query,
      });

      startProcessing('searching', 'Searching products...');
      updateProgress(30);

      const response = await fetch(
        `${API_BASE_URL}/api/search?q=${encodeURIComponent(query)}&limit=6`
      );

      updateProgress(80);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      updateProgress(100);

      const products: ChatProduct[] = (data.products || []).map((p: Product) => ({
        ...p,
        isAddedToCloset: false,
      }));

      if (products.length > 0) {
        addMessage({
          type: 'assistant-products',
          content: `Found ${products.length} products`,
          products,
          searchQuery: query,
        });

        // Add follow-up actions
        addMessage({
          type: 'assistant-text',
          content: 'Want to explore more?',
          followUpActions: [
            { label: 'Refine search', action: 'refine-search', primary: true },
            { label: 'Upload an image', action: 'upload-another' },
            { label: 'See all results', action: 'see-all-results' },
          ],
        });

        finishProcessing(`${products.length} products found`);
      } else {
        addMessage({
          type: 'assistant-text',
          content: 'No products found.',
          followUpActions: [
            { label: 'Try different search', action: 'refine-search', primary: true },
            { label: 'Upload an image', action: 'upload-another' },
          ],
        });

        finishProcessing('No results');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Search failed';
      setProcessingError(message);
      addMessage({
        type: 'assistant-status',
        content: message,
        statusType: 'error',
      });
    }
  }, [addMessage, startProcessing, updateProgress, finishProcessing, setProcessingError]);

  // Handle form submission
  const handleSubmit = useCallback(async (payload: ChatInputPayload) => {
    if (processing.isProcessing) return;

    // Check if we're awaiting product details input (Issue 2)
    const lastAwaitingMessage = [...messages].reverse().find(m => m.awaitingInput === 'product-details');

    switch (payload.type) {
      case 'image':
        if (payload.file) {
          await processImageUpload(payload.file, payload.content);
        }
        break;
      case 'url':
        await processUrlScrape(payload.content);
        break;
      case 'text':
        // If there's an awaiting product details message and user sends text, parse it as product details
        if (lastAwaitingMessage?.awaitingInput === 'product-details' && lastAwaitingMessage.productId) {
          await processProductDetails(payload.content, lastAwaitingMessage.productId);
        } else {
          await processTextSearch(payload.content);
        }
        break;
    }
  }, [processing.isProcessing, messages, processImageUpload, processUrlScrape, processTextSearch, processProductDetails]);

  // Handle image attachment
  const handleImageAttach = useCallback((file: File, previewUrl: string) => {
    setPendingImage(file, previewUrl);
  }, [setPendingImage]);

  // Handle quick action buttons (for images and URLs)
  const handleQuickAction = useCallback(async (action: string) => {
    if (processing.isProcessing) return;

    switch (action) {
      case 'extract':
        // Extract products from image (default image action)
        if (pendingImage) {
          await processImageUpload(pendingImage, 'Uploaded an image');
        }
        break;

      case 'search-similar':
        // Search for similar products based on the attached image
        if (pendingImage) {
          // Add user message with the image
          addMessage({
            type: 'user-image',
            content: 'Find similar products',
            imagePreviewUrl: pendingImagePreview || undefined,
          });

          const file = pendingImage;
          clearPendingImage();
          startProcessing('searching', 'Finding similar products...');
          updateProgress(20);

          try {
            const base64 = await fileToBase64(file);
            updateProgress(40);

            // Call visual search API
            const response = await fetch(`${API_BASE_URL}/api/search?action=visual`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                image: { base64, mimeType: file.type },
                limit: 6,
              }),
            });

            updateProgress(80);

            if (!response.ok) {
              throw new Error('Visual search failed');
            }

            const data = await response.json();
            updateProgress(100);

            const products: ChatProduct[] = (data.products || []).map((p: Product) => ({
              ...p,
              isAddedToCloset: false,
            }));

            if (products.length > 0) {
              addMessage({
                type: 'assistant-products',
                content: `Found ${products.length} similar products`,
                products,
                searchQuery: 'visual search',
              });
              finishProcessing(`${products.length} similar products found`);
            } else {
              addMessage({
                type: 'assistant-text',
                content: 'No similar products found. Try uploading a different image.',
              });
              finishProcessing('No results');
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Search failed';
            setProcessingError(message);
            addMessage({
              type: 'assistant-status',
              content: message,
              statusType: 'error',
            });
          }
        }
        break;

      case 'add-wishlist':
        // For URL - same as processUrlScrape but explicitly wishlisted
        // This is handled by processUrlScrape which already adds to wishlist
        break;

      default:
        break;
    }
  }, [
    processing.isProcessing, pendingImage, pendingImagePreview,
    processImageUpload, addMessage, clearPendingImage, startProcessing,
    updateProgress, fileToBase64, finishProcessing, setProcessingError,
  ]);

  // Handle wishlist toggle
  const handleWishlistToggle = useCallback((messageId: string, productId: string) => {
    toggleProductWishlist(messageId, productId);

    // Find the product in the message
    const message = messages.find(m => m.id === messageId);
    const product = message?.products?.find(p => p.id === productId);

    if (product) {
      ensureWishlistCollection();

      if (!product.isWishlisted) {
        // Add to wishlist
        addProductToCollection(WISHLIST_COLLECTION_ID, product as Product);
      }
      // Note: We don't remove from wishlist on uncheck to keep the UX simple
    }
  }, [toggleProductWishlist, messages, ensureWishlistCollection, addProductToCollection]);

  // Handle closet toggle (mutually exclusive with wishlist)
  // Closet = flat storage in enriched_products, NO collection
  // Product is already saved to DB during enrichment, just update UI state
  const handleClosetToggle = useCallback((messageId: string, productId: string) => {
    toggleProductCloset(messageId, productId);
    // No collection assignment - closet is just the enriched_products table
  }, [toggleProductCloset]);

  // Handle expand to discover
  const handleExpandToDiscover = useCallback((query: string) => {
    close();
    router.push(`/discover?q=${encodeURIComponent(query)}`);
  }, [close, router]);

  // Handle product edit
  const handleProductEdit = useCallback((messageId: string, product: ChatProduct) => {
    setEditingProduct(product);
    setEditingMessageId(messageId);
    const productTags = product.tags || [];
    setEditForm({
      product_name: product.product_name || '',
      brand: product.brand || '',
      size: product.size || '',
      price: product.price ? String(product.price) : '',
      tags: [...productTags],
    });
    setOriginalTags([...productTags]);
    // Reset tag editing state
    setNewTagInput('');
    setIsAddingTag(false);
    // Reset crop adjustment state
    setShowCropAdjust(false);
    setAdjustedBoundingBox(null);
  }, []);

  // Handle save edit
  const handleSaveEdit = useCallback(async () => {
    if (!editingProduct || !editingMessageId) return;

    // Use edited tags or keep original
    const finalTags = editForm.tags.length > 0 ? editForm.tags : editingProduct.tags || [];
    const nameChanged = editForm.product_name.trim() !== editingProduct.product_name;
    const brandChanged = editForm.brand.trim() !== editingProduct.brand;

    let updates: Partial<ChatProduct> = {
      product_name: editForm.product_name.trim() || editingProduct.product_name,
      brand: editForm.brand.trim() || editingProduct.brand,
      size: editForm.size.trim() || undefined,
      price: editForm.price ? parseFloat(editForm.price) : editingProduct.price,
      tags: finalTags,
    };

    // Submit tag feedback for AI learning if tags changed
    const tagsAdded = finalTags.filter(t => !originalTags.includes(t));
    const tagsRemoved = originalTags.filter(t => !finalTags.includes(t));
    if (tagsAdded.length > 0 || tagsRemoved.length > 0) {
      // Fire-and-forget feedback submission
      fetch(`${API_BASE_URL}/api/ai?action=feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ai_generated_tags: originalTags,
          user_final_tags: finalTags,
          tags_added: tagsAdded,
          tags_removed: tagsRemoved,
          brand: editingProduct.brand,
          category: editingProduct.category,
        }),
      }).catch(err => console.error('Tag feedback submission failed:', err));
    }

    // If bounding box was adjusted, call re-crop API
    if (adjustedBoundingBox && editingProduct.original_image_url) {
      setIsReCropping(true);
      setSaveStatus({ state: 'saving', message: 'Adjusting crop...' });
      try {
        const response = await fetch(`${API_BASE_URL}/api/image-processing?action=re-crop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            originalImageUrl: editingProduct.original_image_url,
            productId: editingProduct.id,
            originalBoundingBox: editingProduct.boundingBox,
            newBoundingBox: adjustedBoundingBox,
            productType: 'fashion',
          }),
        });

        if (response.ok) {
          const result = await response.json();
          // Update with new cropped image URL
          updates.image_url = result.newCroppedUrl;
          updates.boundingBox = adjustedBoundingBox;
        }
      } catch (error) {
        console.error('Re-crop failed:', error);
      } finally {
        setIsReCropping(false);
      }
    }

    // If name or brand changed significantly, call update-product API to search for better image and sync to DB
    if ((nameChanged || brandChanged) && editingProduct.source === 'upload') {
      setSaveStatus({ state: 'searching', message: 'Finding better image...' });
      try {
        const response = await fetch(`${API_BASE_URL}/api/image-processing?action=update-product`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: editingProduct.id,
            updates: {
              product_name: updates.product_name,
              brand: updates.brand,
              tags: updates.tags,
              category: editingProduct.category,
              price: updates.price,
            },
            previousName: editingProduct.product_name,
            currentImageUrl: editingProduct.image_url,
          }),
        });

        if (response.ok) {
          const result = await response.json();

          // Apply any enriched data from the API
          if (result.updates) {
            if (result.updates.image_url) {
              updates.image_url = result.updates.image_url;
            }
            if (result.updates.tags && !tagsAdded.length && !tagsRemoved.length) {
              updates.tags = result.updates.tags;
            }
            if (result.updates.material) {
              updates.material = result.updates.material;
            }
            if (result.updates.texture) {
              updates.texture = result.updates.texture;
            }
          }

          // Show feedback about what happened
          if (result.imageSearch?.found) {
            setSaveStatus({
              state: 'success',
              message: result.imageSearch.source === 'database'
                ? 'Found matching product image!'
                : 'Found product image online!',
            });
          } else if (result.syncedToDatabase) {
            setSaveStatus({ state: 'success', message: 'Saved to closet' });
          }
        }
      } catch (error) {
        console.error('Product update failed:', error);
        setSaveStatus({ state: 'error', message: 'Failed to save changes' });
      }
    } else {
      setSaveStatus({ state: 'syncing', message: 'Saving...' });
    }

    // Update product in chat message
    updateProductInMessage(editingMessageId, editingProduct.id, updates);

    // Also update in collection if it's an uploaded product
    if (editingProduct.source === 'upload' && collections.length > 0) {
      // Find which collection has this product
      for (const collection of collections) {
        if (collection.products.some((p) => p.id === editingProduct.id)) {
          updateProductInCollection(collection.id, editingProduct.id, updates);
          break;
        }
      }
    }

    // Show success briefly then close
    if (saveStatus.state !== 'success' && saveStatus.state !== 'error') {
      setSaveStatus({ state: 'success', message: 'Saved!' });
    }

    // Close modal after a brief delay to show feedback
    setTimeout(() => {
      setEditingProduct(null);
      setEditingMessageId(null);
      setShowCropAdjust(false);
      setAdjustedBoundingBox(null);
      setNewTagInput('');
      setIsAddingTag(false);
      setSaveStatus({ state: 'idle' });
    }, saveStatus.state === 'success' || saveStatus.state === 'error' ? 1500 : 500);
  }, [editingProduct, editingMessageId, editForm, adjustedBoundingBox, originalTags, updateProductInMessage, collections, updateProductInCollection, saveStatus.state]);

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditingProduct(null);
    setEditingMessageId(null);
    setShowCropAdjust(false);
    setAdjustedBoundingBox(null);
    setNewTagInput('');
    setIsAddingTag(false);
  }, []);

  // Handle add tag
  const handleAddTag = useCallback(() => {
    const tag = newTagInput.trim().toLowerCase();
    if (tag && !editForm.tags.includes(tag)) {
      setEditForm(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
    }
    setNewTagInput('');
    setIsAddingTag(false);
  }, [newTagInput, editForm.tags]);

  // Handle remove tag
  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove),
    }));
  }, []);

  // Handle follow-up action clicks from chat messages
  const handleFollowUpAction = useCallback((action: string, messageId: string) => {
    // Find the message to get context (e.g., productId)
    const message = messages.find(m => m.id === messageId);

    switch (action) {
      case 'add-details':
        // Focus the input and set a hint
        addMessage({
          type: 'assistant-text',
          content: 'Tell me the brand, size, or price — e.g. "Zara, size M, $80"',
          awaitingInput: 'product-details',
          productId: message?.productId,
        });
        break;

      case 'upload-another':
        // Trigger the file input
        const fileInput = document.querySelector('input[type="file"][accept*="image"]') as HTMLInputElement;
        fileInput?.click();
        break;

      case 'view-closet':
        close();
        router.push('/closet');
        break;

      case 'refine-search':
        // Just focus the input - user can type new search
        addMessage({
          type: 'assistant-text',
          content: 'What would you like to search for?',
        });
        break;

      case 'see-all-results':
        // Find the last search query
        const lastSearchMessage = [...messages].reverse().find(m => m.searchQuery);
        if (lastSearchMessage?.searchQuery) {
          close();
          router.push(`/discover?q=${encodeURIComponent(lastSearchMessage.searchQuery)}`);
        }
        break;

      default:
        break;
    }
  }, [messages, addMessage, close, router]);

  // Render message content
  const renderMessage = (message: ChatMessage) => {
    switch (message.type) {
      case 'user-text':
      case 'user-url':
        return (
          <div
            className="ml-auto max-w-[85%] px-3 py-2 rounded-2xl rounded-br-sm"
            style={{ backgroundColor: 'var(--primary-light)' }}
          >
            <p className="text-sm break-words" style={{ color: 'white' }}>
              {message.content}
            </p>
          </div>
        );

      case 'user-image':
        return (
          <div className="ml-auto max-w-[85%]">
            {message.imagePreviewUrl && (
              <img
                src={message.imagePreviewUrl}
                alt="Uploaded"
                className="w-32 h-32 object-cover rounded-lg mb-1"
              />
            )}
            {message.content && (
              <div
                className="px-3 py-2 rounded-2xl rounded-br-sm"
                style={{ backgroundColor: 'var(--primary-light)' }}
              >
                <p className="text-sm" style={{ color: 'white' }}>
                  {message.content}
                </p>
              </div>
            )}
          </div>
        );

      case 'assistant-products':
        return (
          <div className="space-y-2 max-w-full">
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              {message.content}
            </p>
            {message.products?.map((product) => (
              <ProductResultCard
                key={product.id}
                product={product}
                source={product.source as 'upload' | 'scrape' | 'search'}
                onWishlistToggle={(productId) => handleWishlistToggle(message.id, productId)}
                onClosetToggle={(productId) => handleClosetToggle(message.id, productId)}
                onEdit={product.source === 'upload' ? (p) => handleProductEdit(message.id, p) : undefined}
                compact
              />
            ))}
            {/* Navigation hint to view in closet (Issue 4) */}
            {message.navigationHint && (
              <button
                onClick={() => {
                  close();
                  router.push(message.navigationHint!.route);
                }}
                className="flex items-center gap-1 text-sm mt-2 transition-colors cursor-pointer"
                style={{ color: 'var(--primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--primary-dark)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--primary)';
                }}
              >
                {message.navigationHint.text}
                <ArrowRight size={14} />
              </button>
            )}
            {message.searchQuery && (
              <button
                onClick={() => handleExpandToDiscover(message.searchQuery!)}
                className="flex items-center gap-1 text-sm mt-2 transition-colors cursor-pointer"
                style={{ color: 'var(--primary)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--primary-dark)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--primary)';
                }}
              >
                See more results
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        );

      case 'assistant-text':
        return (
          <div className="space-y-2">
            <div
              className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm"
              style={{ backgroundColor: 'var(--surface-light)' }}
            >
              <p className="text-sm" style={{ color: 'var(--foreground)' }}>
                {message.content}
              </p>
            </div>
            {/* Follow-up action buttons */}
            {message.followUpActions && message.followUpActions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {message.followUpActions.map((action) => (
                  <button
                    key={action.action}
                    onClick={() => handleFollowUpAction(action.action, message.id)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
                    style={{
                      backgroundColor: action.primary ? 'var(--primary-light)' : 'var(--surface-light)',
                      color: action.primary ? 'white' : 'var(--foreground-secondary)',
                      border: '1px solid transparent',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = action.primary
                        ? 'var(--primary-dark)'
                        : 'var(--surface-elevated)';
                      e.currentTarget.style.color = action.primary ? 'white' : 'var(--foreground)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = action.primary
                        ? 'var(--primary-light)'
                        : 'var(--surface-light)';
                      e.currentTarget.style.color = action.primary ? 'white' : 'var(--foreground-secondary)';
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 'assistant-status':
        return (
          <div
            className="max-w-[85%] px-3 py-2 rounded-lg"
            style={{
              backgroundColor: message.statusType === 'error'
                ? 'rgba(239, 68, 68, 0.1)'
                : 'var(--surface-light)',
              color: message.statusType === 'error'
                ? 'var(--error)'
                : 'var(--foreground-secondary)',
            }}
          >
            <p className="text-sm">{message.content}</p>
          </div>
        );

      default:
        return null;
    }
  };

  // In bubble mode, only show input
  if (!isPanelMode) {
    return (
      <UnifiedChatInput
        onSubmit={handleSubmit}
        isLoading={processing.isProcessing}
        attachedImage={pendingImage}
        attachedImagePreview={pendingImagePreview}
        onImageAttach={handleImageAttach}
        onClearAttachment={() => clearPendingImage(true)}
        onQuickAction={handleQuickAction}
        autoFocus
      />
    );
  }

  // In panel mode, show full chat
  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !processing.isProcessing && (
          <div className="text-center py-8">
            <p
              className="text-sm"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Upload a photo, paste a product link, or search for something.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id}>{renderMessage(message)}</div>
        ))}

        {/* Processing indicator */}
        {processing.isProcessing && (
          <ProcessingIndicator
            stage={processing.stage}
            progress={processing.progress}
            statusText={processing.statusText}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <UnifiedChatInput
        onSubmit={handleSubmit}
        isLoading={processing.isProcessing}
        attachedImage={pendingImage}
        attachedImagePreview={pendingImagePreview}
        onImageAttach={handleImageAttach}
        onClearAttachment={() => clearPendingImage(true)}
        onQuickAction={handleQuickAction}
        autoFocus
      />

      {/* Edit Product Modal */}
      <Modal
        isOpen={!!editingProduct}
        onClose={handleCancelEdit}
        title="Edit Product"
        size={showCropAdjust ? 'full' : 'sm'}
      >
        <ModalContent>
          <div className="space-y-4">
            {/* Crop adjustment mode */}
            {showCropAdjust && editingProduct?.original_image_url ? (
              <ImageCropAdjuster
                originalImageUrl={editingProduct.original_image_url}
                boundingBox={adjustedBoundingBox || editingProduct.boundingBox || { x: 0, y: 0, width: 1, height: 1 }}
                onChange={setAdjustedBoundingBox}
                maxWidth={800}
                maxHeight={600}
              />
            ) : (
              <>
                {/* Product image preview with adjust button */}
                {editingProduct?.image_url && (
                  <div className="flex flex-col items-center gap-2">
                    <img
                      src={editingProduct.image_url}
                      alt={editingProduct.product_name}
                      className="w-24 h-24 object-cover rounded-lg"
                    />
                    {/* Show adjust crop button only if original image exists */}
                    {editingProduct?.original_image_url && (
                      <button
                        onClick={() => setShowCropAdjust(true)}
                        className="text-xs px-2 py-1 rounded-full transition-colors cursor-pointer"
                        style={{
                          backgroundColor: 'var(--surface-light)',
                          color: 'var(--foreground-secondary)',
                        }}
                      >
                        Adjust crop area
                      </button>
                    )}
                  </div>
                )}

                <Input
                  label="Product Name"
                  value={editForm.product_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, product_name: e.target.value }))}
                  placeholder="e.g., Navy Blazer"
                />

                <Input
                  label="Brand"
                  value={editForm.brand}
                  onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))}
                  placeholder="e.g., Zara"
                />

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Size"
                    value={editForm.size}
                    onChange={(e) => setEditForm((f) => ({ ...f, size: e.target.value }))}
                    placeholder="e.g., M, 38, US 8"
                  />

                  <Input
                    label="Price"
                    type="number"
                    value={editForm.price}
                    onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                    placeholder="e.g., 80"
                  />
                </div>

                {/* Tags Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--foreground)' }}
                    >
                      Tags
                    </span>
                    {!isAddingTag && (
                      <button
                        type="button"
                        onClick={() => setIsAddingTag(true)}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors cursor-pointer"
                        style={{ color: 'var(--primary)' }}
                      >
                        <Plus size={12} />
                        Add
                      </button>
                    )}
                  </div>

                  {/* Add Tag Input */}
                  {isAddingTag && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag();
                          } else if (e.key === 'Escape') {
                            setNewTagInput('');
                            setIsAddingTag(false);
                          }
                        }}
                        placeholder="Enter tag..."
                        autoFocus
                        className="flex-1 px-3 py-1.5 text-xs rounded-full outline-none"
                        style={{
                          backgroundColor: 'var(--surface)',
                          color: 'var(--foreground)',
                          border: '1px solid var(--primary)',
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        disabled={!newTagInput.trim()}
                        className="px-3 py-1.5 text-xs rounded-full transition-colors"
                        style={{
                          backgroundColor: newTagInput.trim() ? 'var(--primary)' : 'var(--surface)',
                          color: newTagInput.trim() ? 'white' : 'var(--foreground-muted)',
                          cursor: newTagInput.trim() ? 'pointer' : 'not-allowed',
                        }}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewTagInput('');
                          setIsAddingTag(false);
                        }}
                        className="px-2 py-1.5 text-xs rounded-full cursor-pointer"
                        style={{ color: 'var(--foreground-muted)' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  {/* Tags Display */}
                  {editForm.tags.length > 0 ? (
                    <TagList
                      tags={editForm.tags}
                      onRemove={handleRemoveTag}
                      size="md"
                    />
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                      No tags added yet
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </ModalContent>
        <ModalFooter>
          {showCropAdjust ? (
            <>
              <Button variant="ghost" onClick={() => setShowCropAdjust(false)}>
                Back
              </Button>
              <Button
                variant="primary"
                onClick={() => setShowCropAdjust(false)}
                disabled={!adjustedBoundingBox}
              >
                Apply Crop
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={handleCancelEdit} disabled={saveStatus.state !== 'idle' && saveStatus.state !== 'error'}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveEdit}
                disabled={isReCropping || (saveStatus.state !== 'idle' && saveStatus.state !== 'error')}
              >
                {saveStatus.state === 'saving' ? 'Adjusting crop...' :
                 saveStatus.state === 'searching' ? 'Finding image...' :
                 saveStatus.state === 'syncing' ? 'Saving...' :
                 saveStatus.state === 'success' ? saveStatus.message :
                 saveStatus.state === 'error' ? saveStatus.message :
                 isReCropping ? 'Saving...' :
                 adjustedBoundingBox ? 'Save & Re-crop' : 'Save'}
              </Button>
            </>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
}
