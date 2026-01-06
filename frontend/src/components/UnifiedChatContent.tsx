'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { useSidePanel } from '@/components/ui';
import { UnifiedChatInput, type ChatInputPayload } from '@/components/ui/UnifiedChatInput';
import { ProductResultCard, ProcessingIndicator } from '@/components/chat';
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
  } = useChatStore();

  const {
    collections,
    addProductToCollection,
    createCollection,
    getCollectionById,
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

  // Process image upload
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

      const response = await fetch(`${API_BASE_URL}/api/image-processing?action=upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: { base64, mimeType, fileName: file.name },
          productType: 'fashion',
        }),
      });

      updateProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      updateStage('enriching', 'Analyzing product...');
      updateProgress(85);

      const data = await response.json();

      if (!data.success) {
        throw new Error('Processing failed');
      }

      const product: ChatProduct = {
        id: data.product.id,
        product_name: data.product.product_name,
        brand: data.product.brand || 'My Upload',
        price: data.product.price || 0,
        currency: data.product.currency || 'USD',
        image_url: data.product.image_url,
        tags: data.product.tags || [],
        color_palette: data.product.color_palette || [],
        category: data.product.category || 'general',
        material: data.product.material,
        texture: data.product.texture,
        tone: data.product.tone,
        source: 'upload',
        original_image_url: data.product.original_image_url,
        uploaded_at: data.product.uploaded_at,
        isAddedToCloset: true,
      };

      // Add to default collection
      const collectionId = getDefaultCollection();
      const collection = getCollectionById(collectionId);
      const collectionName = collection?.name || 'My Closet';
      addProductToCollection(collectionId, product as Product);

      updateProgress(100);

      // Add assistant response with product and navigation hint (Issues 3 & 4)
      addMessage({
        type: 'assistant-products',
        content: `Added to "${collectionName}"`,
        products: [product],
        navigationHint: {
          text: 'View in Closet',
          route: `/closet`,
          collectionName,
        },
      });

      // Issue 2: Add follow-up prompt for additional details
      addMessage({
        type: 'assistant-text',
        content: `Want to add more details? Just type naturally, like "It's a Zara, size M, paid $80"`,
        awaitingInput: 'product-details',
        productId: product.id,
      });

      finishProcessing('Product added to library!');
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
    addProductToCollection, finishProcessing, setProcessingError,
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
        } else {
          addMessage({
            type: 'assistant-text',
            content: "I couldn't extract any details from that. Try being more specific, like \"Zara blazer, size M, wool\"",
          });
        }

        finishProcessing('Details updated!');
      } else {
        addMessage({
          type: 'assistant-text',
          content: "I couldn't understand that. Try something like \"Nike, size 10, leather, $120\"",
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

        finishProcessing(`${products.length} products found`);
      } else {
        addMessage({
          type: 'assistant-text',
          content: 'No products found. Try a different search term.',
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
                className="flex items-center gap-1 text-sm mt-2 transition-colors"
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
                className="flex items-center gap-1 text-sm mt-2 transition-colors"
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
          <div
            className="max-w-[85%] px-3 py-2 rounded-2xl rounded-bl-sm"
            style={{ backgroundColor: 'var(--surface-light)' }}
          >
            <p className="text-sm" style={{ color: 'var(--foreground)' }}>
              {message.content}
            </p>
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
        onClearAttachment={clearPendingImage}
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
        onClearAttachment={clearPendingImage}
        autoFocus
      />
    </div>
  );
}
