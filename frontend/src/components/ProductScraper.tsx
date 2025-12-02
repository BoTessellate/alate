import React, { useState } from 'react';
import {
  Button,
  FormField,
  TextInput,
  Rows,
  Text,
  Title,
  Box,
  CheckboxGroup,
} from '@canva/app-ui-kit';
import { addElementAtPoint } from '@canva/design';
import { upload } from '@canva/asset';
import { scrapeProductUrl } from '../utils/urlScraper';
import { getNextAvailableCell } from '../utils/gridManager';
import { queueCanvasOperation } from '../utils/canvasQueue';

export const ProductScraper: React.FC = () => {
  const [productUrl, setProductUrl] = useState('');
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [isAddingToCanvas, setIsAddingToCanvas] = useState(false);
  const [includeBrandName, setIncludeBrandName] = useState(true);
  const [includePrice, setIncludePrice] = useState(true);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Scraped data
  const [scrapedImageUrl, setScrapedImageUrl] = useState<string | null>(null);
  const [brandName, setBrandName] = useState('');
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('');

  const isValidUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  const handleScrapeUrl = async () => {
    if (!productUrl) return;

    // Validate URL
    if (!isValidUrl(productUrl)) {
      return;
    }

    setIsScrapingUrl(true);
    try {
      const scrapedData = await scrapeProductUrl(productUrl);
      if (scrapedData.brandName) setBrandName(scrapedData.brandName);
      if (scrapedData.title) setProductName(scrapedData.title);
      if (scrapedData.price) setPrice(scrapedData.price);
      if (scrapedData.currency) setCurrency(scrapedData.currency);
      if (scrapedData.imageUrl) setScrapedImageUrl(scrapedData.imageUrl);
    } catch (error) {
      // Error handling
    } finally {
      setIsScrapingUrl(false);
    }
  };

  const handleAddToCanvas = async () => {
    if (!scrapedImageUrl) return;

    // Disable button immediately to prevent rapid clicks
    setIsAddingToCanvas(true);

    try {
      // Upload the image from URL to Canva (this is not a canvas operation, safe outside queue)
      const image = await upload({
        type: 'image',
        mimeType: 'image/jpeg',
        url: scrapedImageUrl,
        thumbnailUrl: scrapedImageUrl,
        aiDisclosure: 'none',
      });

      // ⚠️ CRITICAL: Wait for Canva's internal library upload session to close
      // The upload() function creates an internal design editing session that must
      // fully close before any addElementAtPoint or openDesign calls can execute.
      // Without this delay, we get "Cannot use addElement() while Design Editing
      // transaction is active" errors.
      // See: https://www.canva.dev/docs/apps/api/latest/asset-upload/
      await new Promise(resolve => setTimeout(resolve, 250));

      // Get next available grid cell for positioning
      const gridCell = getNextAvailableCell(false);

      // Add image using grid-based positioning
      let imageId: string = '';
      await queueCanvasOperation(async () => {
        imageId = await addElementAtPoint({
          type: 'image',
          ref: image.ref,
          top: gridCell!.y,
          left: gridCell!.x,
          width: gridCell!.width,
          height: gridCell!.height,
          altText: {
            text: brandName || 'Product image',
            decorative: false,
          },
        });
      });

      // Import metadata and label positioning utilities
      const { saveProductMetadata } = await import('../utils/elementMetadata');
      const { createSmartLabels } = await import('../utils/labelPositioning');
      const { getCurrentPageContext, openDesign } = await import('@canva/design');

      // Save product metadata to localStorage (linked by image ID)
      saveProductMetadata({
        imageId: imageId,
        brandName: brandName || null,
        productName: productName || null,
        price: price || null,
        currency: currency || null,
        sourceUrl: scrapedImageUrl,
        addedAt: Date.now(),
      });

      // Get canvas dimensions for smart positioning
      const context = await getCurrentPageContext();
      const canvasWidth = context?.dimensions?.width || 800;
      const canvasHeight = context?.dimensions?.height || 600;

      // Get all existing elements for collision detection
      let allElements: any[] = [];
      await openDesign({ type: 'current_page' }, async (session) => {
        const page = session.page as any;
        allElements = page.elements?.toArray() || [];
      });

      // Create smart labels positioned to avoid overlaps
      // Only create labels if the user wants them
      if ((includeBrandName && brandName) || (includePrice && price && currency)) {
        await createSmartLabels(
          imageId,
          {
            left: gridCell!.x,
            top: gridCell!.y,
            width: gridCell!.width,
            height: gridCell!.height,
            right: gridCell!.x + gridCell!.width,
            bottom: gridCell!.y + gridCell!.height,
          },
          includeBrandName ? (brandName || null) : null,
          includePrice ? price : null,
          includePrice ? currency : null,
          allElements,
          canvasWidth,
          canvasHeight
        );
      }

      // Show success message with instructions only if everything succeeded
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 8000);
    } catch (error) {
      // Don't show success message when there's an error
    } finally{
      setIsAddingToCanvas(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && productUrl && !isScrapingUrl) {
      handleScrapeUrl();
    }
  };

  return (
    <Rows spacing="2u">
      <FormField
        label="Product URL"
        description="Paste any product URL to scrape details"
        value={productUrl}
        control={(props) => (
          <TextInput
            {...props}
            onChange={setProductUrl}
            onKeyDown={handleKeyDown}
            placeholder="https://example.com/product"
            disabled={isScrapingUrl}
          />
        )}
      />

      <Button
        variant="primary"
        onClick={handleScrapeUrl}
        disabled={!productUrl || isScrapingUrl}
        stretch
      >
        {isScrapingUrl ? 'Scraping...' : 'Scrape Product Details'}
      </Button>

      {isScrapingUrl && (
        <Text size="small" tone="tertiary">Fetching product details...</Text>
      )}

      {scrapedImageUrl && (
        <Box
          padding="1.5u"
          border="standard"
          borderRadius="standard"
          background='neutralLow'
        >
          <Rows spacing="1u">
            <Box>
              <Rows spacing="1u">
                <Box>
                  <Text size="small">Product Preview</Text>
                </Box>
                <img
                  src={scrapedImageUrl}
                  alt="Product preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '120px',
                    objectFit: 'contain',
                    borderRadius: '4px'
                  }}
                />
              </Rows>
            </Box>

            {brandName && (
              <Rows spacing="0.5u">
                <Text size="small" tone="tertiary">Brand</Text>
                <Text size="medium">{brandName}</Text>
              </Rows>
            )}

            {productName && (
              <Rows spacing="0.5u">
                <Text size="small" tone="tertiary">Product</Text>
                <Text size="small">{productName}</Text>
              </Rows>
            )}

            {price && (
              <Rows spacing="0.5u">
                <Text size="small" tone="tertiary">Price</Text>
                <Text size="small">
                  {currency ? `${currency} ${price}` : price}
                </Text>
              </Rows>
            )}

            <CheckboxGroup
              options={[
                {
                  label: 'Include brand name',
                  value: 'brand',
                },
                {
                  label: 'Include price tag',
                  value: 'price',
                },
              ]}
              value={[
                ...(includeBrandName ? ['brand'] : []),
                ...(includePrice ? ['price'] : []),
              ]}
              onChange={(value) => {
                setIncludeBrandName(value.includes('brand'));
                setIncludePrice(value.includes('price'));
              }}
            />

            <Button
              variant="primary"
              onClick={handleAddToCanvas}
              disabled={isAddingToCanvas}
              stretch
            >
              {isAddingToCanvas ? 'Adding to Canvas...' : 'Add to Canvas'}
            </Button>

            {showSuccessMessage && (
              <Box
                padding="1u"
                borderRadius="standard"
                background="neutralLow"
              >
                <Rows spacing="0.5u">
                  <Text size="small">✓ Product added successfully!</Text>
                  <Text size="xsmall" tone="tertiary">
                    To remove the background:
                  </Text>
                  <Text size="xsmall" tone="tertiary">
                    1. Select the image on canvas
                  </Text>
                  <Text size="xsmall" tone="tertiary">
                    2. Click "Edit Image" in toolbar
                  </Text>
                  <Text size="xsmall" tone="tertiary">
                    3. Choose "Background Remover"
                  </Text>
                </Rows>
              </Box>
            )}
          </Rows>
        </Box>
      )}
    </Rows>
  );
};
