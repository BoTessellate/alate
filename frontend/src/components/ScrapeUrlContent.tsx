'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Link, Loader2, Check, AlertCircle, ExternalLink, Package, Tag, Layers, X, Plus } from 'lucide-react';
import { Button, Input, useSidePanel } from '@/components/ui';
import { useCollectionsStore } from '@/stores/useCollectionsStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-tml.vercel.app';

interface ScrapedProduct {
  title: string;
  brandName: string;
  price: string;
  currency: string;
  imageUrl: string;
}

interface EnrichedProduct extends ScrapedProduct {
  tags?: string[];
  color_palette?: string[];
  color_hex_codes?: string[];  // Actual hex values from pixel extraction
  warmth?: 'warm' | 'cool' | 'neutral';  // Color palette warmth
  material?: string;
  texture?: string;
  tone?: string;
  category?: string;
  vibe_layer?: string;
  pairs_with?: string[];
}

type ScrapeStatus = 'idle' | 'scraping' | 'enriching' | 'saving' | 'success' | 'error';

/**
 * URL Scrape form content - used inside SidePanel
 * Allows users to import products by pasting a URL
 * Shows compact view in bubble mode, full details in panel mode
 */
export default function ScrapeUrlContent() {
  const { close, isPanelMode } = useSidePanel();
  const { collections } = useCollectionsStore();

  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ScrapeStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [scrapedProduct, setScrapedProduct] = useState<EnrichedProduct | null>(null);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);

  // Track original AI tags for feedback learning
  const [originalAiTags, setOriginalAiTags] = useState<string[]>([]);
  const [productId, setProductId] = useState<string | null>(null);

  const handleScrape = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      setError('Please enter a valid URL');
      return;
    }

    setStatus('scraping');
    setError(null);
    setScrapedProduct(null);

    try {
      const response = await fetch(`${API_URL}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to scrape URL');
      }

      if (!data.title && !data.imageUrl) {
        throw new Error('Could not extract product information from this URL');
      }

      setScrapedProduct({
        title: data.title || 'Unknown Product',
        brandName: data.brandName || '',
        price: data.price || '',
        currency: data.currency || 'USD',
        imageUrl: data.imageUrl || '',
      });
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scrape URL');
      setStatus('error');
    }
  }, [url]);

  const handleSave = useCallback(async () => {
    if (!scrapedProduct) return;

    setStatus('enriching');
    setError(null);

    try {
      // Call the AI enrichment API with correct payload format
      // Backend expects: { product: { name, description, brand, price, currency, image_url, source_url } }
      const response = await fetch(`${API_URL}/api/ai?action=enrich`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: {
            name: scrapedProduct.title,
            brand: scrapedProduct.brandName,
            price: parseFloat(scrapedProduct.price) || 0,
            currency: scrapedProduct.currency,
            image_url: scrapedProduct.imageUrl,
            source_url: url,
          },
          collection_ids: selectedCollections,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enrich product');
      }

      // Update scraped product with enriched data
      if (data.product) {
        // Store original AI tags for feedback learning
        const aiTags = data.product.tags || [];
        setOriginalAiTags(aiTags);
        setProductId(data.product.id || null);

        // Extract warmth from debug info or use 'neutral' as default
        const warmth = data._debug?.extractedWarmth || 'neutral';

        setScrapedProduct((prev) => ({
          ...prev!,
          tags: aiTags,
          color_palette: data.product.color_palette || [],
          color_hex_codes: data.color_hex_codes || [],  // Pixel-extracted hex codes
          warmth: warmth as 'warm' | 'cool' | 'neutral',
          material: data.product.material,
          texture: data.product.texture,
          tone: data.product.tone,
          category: data.product.category,
          vibe_layer: data.product.vibe_layer,
          pairs_with: data.product.pairs_with || [],
          // Update brand from AI if more specific
          brandName: data.product.brand || prev!.brandName,
        }));
      }

      setStatus('success');

      // Keep panel open in panel mode to show enriched details, close in bubble mode
      if (!isPanelMode) {
        setTimeout(() => {
          close();
        }, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
      setStatus('error');
    }
  }, [scrapedProduct, url, selectedCollections, close, isPanelMode]);

  const toggleCollection = (id: string) => {
    setSelectedCollections((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  // Tag editing functions
  const handleAddTag = useCallback(() => {
    const trimmedTag = newTag.trim().toLowerCase();
    if (!trimmedTag || !scrapedProduct) return;

    // Don't add duplicate tags
    if (scrapedProduct.tags?.includes(trimmedTag)) {
      setNewTag('');
      setIsAddingTag(false);
      return;
    }

    setScrapedProduct((prev) => ({
      ...prev!,
      tags: [...(prev!.tags || []), trimmedTag],
    }));
    setNewTag('');
    setIsAddingTag(false);

    // TODO: Save tag edit to feedback database for AI learning
  }, [newTag, scrapedProduct]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    if (!scrapedProduct) return;

    setScrapedProduct((prev) => ({
      ...prev!,
      tags: (prev!.tags || []).filter((tag) => tag !== tagToRemove),
    }));
  }, [scrapedProduct]);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Escape') {
      setNewTag('');
      setIsAddingTag(false);
    }
  };

  // Submit tag feedback to help AI learn from user corrections
  const submitTagFeedback = useCallback(async () => {
    if (!scrapedProduct || originalAiTags.length === 0) return;

    const currentTags = scrapedProduct.tags || [];

    // Check if tags were actually changed
    const tagsChanged =
      currentTags.length !== originalAiTags.length ||
      !currentTags.every((t) => originalAiTags.includes(t));

    if (!tagsChanged) return;

    try {
      await fetch(`${API_URL}/api/ai?action=feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: {
            product_id: productId,
            brand: scrapedProduct.brandName,
            category: scrapedProduct.category,
            ai_generated_tags: originalAiTags,
            user_final_tags: currentTags,
            source_url: url,
          },
        }),
      });
      // Silent - don't show errors to user for feedback
    } catch {
      // Ignore feedback errors
    }
  }, [scrapedProduct, originalAiTags, productId, url]);

  const getStatusMessage = () => {
    switch (status) {
      case 'scraping':
        return 'Extracting product info...';
      case 'enriching':
        return 'Enriching with AI...';
      case 'saving':
        return 'Saving to database...';
      case 'success':
        return 'Product added successfully!';
      default:
        return null;
    }
  };

  const isLoading = status === 'scraping' || status === 'enriching' || status === 'saving';

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* URL Input */}
        <div className="space-y-2">
          <label
            className="text-sm font-medium"
            style={{ color: 'var(--foreground)' }}
          >
            Product URL
          </label>
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/product..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              variant="secondary"
              onClick={handleScrape}
              disabled={isLoading || !url.trim()}
              loading={status === 'scraping'}
            >
              {status === 'scraping' ? 'Scraping...' : 'Fetch'}
            </Button>
          </div>
          <p className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
            Paste a product URL from any e-commerce website
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div
            className="p-3 rounded-lg flex items-center gap-2"
            style={{ backgroundColor: 'rgba(168, 64, 50, 0.1)' }}
          >
            <AlertCircle size={18} style={{ color: 'var(--error)' }} />
            <span className="text-sm" style={{ color: 'var(--error)' }}>
              {error}
            </span>
          </div>
        )}

        {/* Status Message */}
        {getStatusMessage() && !error && (
          <div
            className="p-3 rounded-lg flex items-center gap-2"
            style={{
              backgroundColor:
                status === 'success'
                  ? 'rgba(76, 112, 49, 0.1)'
                  : 'rgba(196, 163, 90, 0.1)',
            }}
          >
            {status === 'success' ? (
              <Check size={18} style={{ color: 'var(--success)' }} />
            ) : (
              <Loader2
                size={18}
                className="animate-spin"
                style={{ color: 'var(--highlight)' }}
              />
            )}
            <span
              className="text-sm"
              style={{
                color: status === 'success' ? 'var(--success)' : 'var(--highlight)',
              }}
            >
              {getStatusMessage()}
            </span>
          </div>
        )}

        {/* Scraped Product Preview - Before Enrichment (Compact, no image) */}
        {scrapedProduct && status !== 'success' && (
          <div className="space-y-4">
            <h3
              className="text-sm font-medium"
              style={{ color: 'var(--foreground)' }}
            >
              Product Found
            </h3>

            <div
              className="rounded-lg border p-4 space-y-3"
              style={{
                backgroundColor: 'var(--surface-light)',
                borderColor: 'var(--border)',
              }}
            >
              {/* Product Info - Compact display without image */}
              <h4
                className="font-medium"
                style={{ color: 'var(--foreground)' }}
              >
                {scrapedProduct.title.split('|')[0].trim()}
              </h4>

              {scrapedProduct.brandName && (
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  Brand: {scrapedProduct.brandName}
                </p>
              )}

              {scrapedProduct.price && (
                <p
                  className="text-lg font-semibold"
                  style={{ color: 'var(--primary)' }}
                >
                  {scrapedProduct.currency === 'INR' ? '₹' :
                   scrapedProduct.currency === 'EUR' ? '€' :
                   scrapedProduct.currency === 'GBP' ? '£' : '$'}
                  {scrapedProduct.price}
                </p>
              )}

              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs hover:underline"
                style={{ color: 'var(--foreground-muted)' }}
              >
                <ExternalLink size={12} />
                View original
              </a>
            </div>

            {/* Collection Selection */}
            {collections.length > 0 && (
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  style={{ color: 'var(--foreground)' }}
                >
                  Add to Collections (optional)
                </label>
                <div className="flex flex-wrap gap-2">
                  {collections.map((collection) => (
                    <button
                      key={collection.id}
                      onClick={() => toggleCollection(collection.id)}
                      className="px-3 py-1.5 rounded-full text-sm transition-colors"
                      style={{
                        backgroundColor: selectedCollections.includes(collection.id)
                          ? 'var(--primary)'
                          : 'var(--surface)',
                        color: selectedCollections.includes(collection.id)
                          ? 'white'
                          : 'var(--foreground)',
                        border: `1px solid ${
                          selectedCollections.includes(collection.id)
                            ? 'var(--primary)'
                            : 'var(--border)'
                        }`,
                      }}
                    >
                      {collection.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Success State - Different views based on panel mode */}
        {scrapedProduct && status === 'success' && (
          <>
            {/* Bubble mode: Compact success message */}
            {!isPanelMode && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                  style={{ backgroundColor: 'rgba(76, 112, 49, 0.1)' }}
                >
                  <Check size={24} style={{ color: 'var(--success)' }} />
                </div>
                <p className="font-medium mb-1" style={{ color: 'var(--foreground)' }}>
                  Processing Complete
                </p>
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  Product has been added
                </p>
              </div>
            )}

            {/* Panel mode: Full enriched product details (no image) */}
            {isPanelMode && (
              <div className="space-y-4">
                <div
                  className="p-3 rounded-lg flex items-center gap-2"
                  style={{ backgroundColor: 'rgba(76, 112, 49, 0.1)' }}
                >
                  <Check size={18} style={{ color: 'var(--success)' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--success)' }}>
                    Product enriched & saved!
                  </span>
                </div>

                <div
                  className="rounded-lg border p-4 space-y-4"
                  style={{
                    backgroundColor: 'var(--surface-light)',
                    borderColor: 'var(--border)',
                  }}
                >
                  {/* Product Header */}
                  <div>
                    <h4
                      className="font-medium text-lg mb-1"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {scrapedProduct.title.split('|')[0].trim()}
                    </h4>
                    {scrapedProduct.brandName && (
                      <p
                        className="text-base font-medium"
                        style={{ color: 'var(--primary)' }}
                      >
                        {scrapedProduct.brandName}
                      </p>
                    )}
                    {scrapedProduct.price && (
                      <p
                        className="text-lg font-semibold mt-2"
                        style={{ color: 'var(--foreground)' }}
                      >
                        {scrapedProduct.currency === 'INR' ? '₹' :
                         scrapedProduct.currency === 'EUR' ? '€' :
                         scrapedProduct.currency === 'GBP' ? '£' : '$'}
                        {scrapedProduct.price}
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid var(--border)' }} />

                  {/* AI-Generated Tags - Editable */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Tag size={14} style={{ color: 'var(--primary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          Style Tags ({scrapedProduct.tags?.length || 0})
                        </span>
                      </div>
                      {!isAddingTag && (
                        <button
                          onClick={() => setIsAddingTag(true)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors"
                          style={{
                            color: 'var(--primary)',
                            backgroundColor: 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(196, 163, 90, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
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
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyDown={handleTagKeyDown}
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
                          onClick={handleAddTag}
                          disabled={!newTag.trim()}
                          className="px-3 py-1.5 text-xs rounded-full transition-colors"
                          style={{
                            backgroundColor: newTag.trim() ? 'var(--primary)' : 'var(--surface)',
                            color: newTag.trim() ? 'white' : 'var(--foreground-muted)',
                            cursor: newTag.trim() ? 'pointer' : 'not-allowed',
                          }}
                        >
                          Add
                        </button>
                        <button
                          onClick={() => {
                            setNewTag('');
                            setIsAddingTag(false);
                          }}
                          className="px-2 py-1.5 text-xs rounded-full"
                          style={{ color: 'var(--foreground-muted)' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    {/* Tags List with Delete */}
                    <div className="flex flex-wrap gap-2">
                      {(scrapedProduct.tags || []).map((tag, i) => (
                        <span
                          key={i}
                          className="group px-2.5 py-1 rounded-full text-xs flex items-center gap-1.5 transition-colors"
                          style={{
                            backgroundColor: 'var(--surface)',
                            color: 'var(--foreground)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="opacity-50 hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--foreground-muted)' }}
                            title="Remove tag"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                      {(!scrapedProduct.tags || scrapedProduct.tags.length === 0) && !isAddingTag && (
                        <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                          No tags yet. Click "Add" to create one.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Color Palette with Hex Swatches */}
                  {scrapedProduct.color_palette && scrapedProduct.color_palette.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          Color Palette
                        </span>
                        {/* Warmth Indicator */}
                        {scrapedProduct.warmth && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor:
                                scrapedProduct.warmth === 'warm'
                                  ? 'rgba(255, 140, 0, 0.15)'
                                  : scrapedProduct.warmth === 'cool'
                                  ? 'rgba(100, 149, 237, 0.15)'
                                  : 'rgba(128, 128, 128, 0.15)',
                              color:
                                scrapedProduct.warmth === 'warm'
                                  ? '#FF8C00'
                                  : scrapedProduct.warmth === 'cool'
                                  ? '#6495ED'
                                  : 'var(--foreground-muted)',
                            }}
                          >
                            {scrapedProduct.warmth}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {scrapedProduct.color_palette.map((colorName, i) => {
                          // Get corresponding hex code if available
                          const hexCode = scrapedProduct.color_hex_codes?.[i];
                          return (
                            <div
                              key={i}
                              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs"
                              style={{
                                backgroundColor: 'rgba(196, 163, 90, 0.1)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {/* Color Swatch */}
                              {hexCode && (
                                <div
                                  className="w-4 h-4 rounded-full border"
                                  style={{
                                    backgroundColor: hexCode,
                                    borderColor: 'rgba(0,0,0,0.1)',
                                  }}
                                  title={hexCode}
                                />
                              )}
                              <span style={{ color: 'var(--foreground)' }}>{colorName}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Pairs With - Complementary categories */}
                  {scrapedProduct.pairs_with && scrapedProduct.pairs_with.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Layers size={14} style={{ color: 'var(--primary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                          Pairs With
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {scrapedProduct.pairs_with.map((item, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-full text-xs"
                            style={{
                              backgroundColor: 'var(--surface)',
                              color: 'var(--foreground)',
                              border: '1px dashed var(--border)',
                            }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Product Attributes */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {scrapedProduct.category && (
                      <div
                        className="p-2 rounded"
                        style={{ backgroundColor: 'var(--surface)' }}
                      >
                        <span className="text-xs block" style={{ color: 'var(--foreground-muted)' }}>
                          Category
                        </span>
                        <span style={{ color: 'var(--foreground)' }}>{scrapedProduct.category}</span>
                      </div>
                    )}
                    {scrapedProduct.material && (
                      <div
                        className="p-2 rounded"
                        style={{ backgroundColor: 'var(--surface)' }}
                      >
                        <span className="text-xs block" style={{ color: 'var(--foreground-muted)' }}>
                          Material
                        </span>
                        <span style={{ color: 'var(--foreground)' }}>{scrapedProduct.material}</span>
                      </div>
                    )}
                    {scrapedProduct.texture && (
                      <div
                        className="p-2 rounded"
                        style={{ backgroundColor: 'var(--surface)' }}
                      >
                        <span className="text-xs block" style={{ color: 'var(--foreground-muted)' }}>
                          Texture
                        </span>
                        <span style={{ color: 'var(--foreground)' }}>{scrapedProduct.texture}</span>
                      </div>
                    )}
                    {scrapedProduct.tone && (
                      <div
                        className="p-2 rounded"
                        style={{ backgroundColor: 'var(--surface)' }}
                      >
                        <span className="text-xs block" style={{ color: 'var(--foreground-muted)' }}>
                          Tone
                        </span>
                        <span style={{ color: 'var(--foreground)' }}>{scrapedProduct.tone}</span>
                      </div>
                    )}
                  </div>

                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs hover:underline"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    <ExternalLink size={12} />
                    View original product
                  </a>
                </div>

                {/* Action buttons in panel mode */}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={() => {
                      submitTagFeedback();
                      close();
                    }}
                    className="flex-1"
                  >
                    Close
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      submitTagFeedback();
                      setUrl('');
                      setScrapedProduct(null);
                      setStatus('idle');
                      setError(null);
                      setOriginalAiTags([]);
                      setProductId(null);
                    }}
                    className="flex-1"
                  >
                    Add Another
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!scrapedProduct && status === 'idle' && !error && (
          <div
            className="flex flex-col items-center justify-center py-12 text-center"
            style={{ color: 'var(--foreground-muted)' }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: 'var(--surface-light)' }}
            >
              <Package size={32} style={{ color: 'var(--foreground-muted)' }} />
            </div>
            <p className="text-sm mb-1">Paste a product URL above</p>
            <p className="text-xs">
              Works with most e-commerce sites like Amazon, Shopify stores, etc.
            </p>
          </div>
        )}
      </div>

      {/* Footer with Save Button */}
      {scrapedProduct && status !== 'success' && (
        <div
          className="p-4 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={isLoading}
            loading={status === 'enriching' || status === 'saving'}
            className="w-full"
          >
            {isLoading ? 'Saving...' : 'Add Product'}
          </Button>
        </div>
      )}
    </div>
  );
}
