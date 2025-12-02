import React, { useState } from 'react';
import {
  Button,
  FormField,
  TextInput,
  Rows,
  Text,
  Title,
  Box,
} from '@canva/app-ui-kit';
import { addElementAtPoint } from '@canva/design';
import { upload } from '@canva/asset';
import { BrandTag } from '../types';
import { scrapeProductUrl } from '../utils/urlScraper';

interface BrandTagModalProps {
  onSave: (brandTag: BrandTag) => void;
  onCancel: () => void;
  existingTag?: BrandTag;
}

export const BrandTagModal: React.FC<BrandTagModalProps> = ({
  onSave,
  onCancel,
  existingTag
}) => {
  const [brandName, setBrandName] = useState(existingTag?.brandName || '');
  const [productUrl, setProductUrl] = useState(existingTag?.productUrl || '');
  const [tags, setTags] = useState(existingTag?.tags.join(', ') || '');
  const [productName, setProductName] = useState(existingTag?.productName || '');
  const [price, setPrice] = useState(existingTag?.price || '');
  const [currency, setCurrency] = useState(existingTag?.currency || '');
  const [notes, setNotes] = useState(existingTag?.notes || '');
  const [isScrapingUrl, setIsScrapingUrl] = useState(false);
  const [scrapedImageUrl, setScrapedImageUrl] = useState<string | null>(null);
  const [isAddingToCanvas, setIsAddingToCanvas] = useState(false);

  const handleUrlBlur = async () => {
    if (productUrl) {
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
    }
  };

  const handleAddToCanvas = async () => {
    if (!scrapedImageUrl) return;

    setIsAddingToCanvas(true);
    try {
      // Upload the image from URL to Canva
      const image = await upload({
        type: 'image',
        mimeType: 'image/jpeg',
        url: scrapedImageUrl,
        thumbnailUrl: scrapedImageUrl,
        aiDisclosure: 'none',
      });

      // Add the image to canvas using addElementAtPoint with proper box properties
      await addElementAtPoint({
        type: 'image',
        ref: image.ref,
        top: 0,
        left: 0,
        width: 400,
        height: "auto",
        altText: {
          text: brandName || 'Product image',
          decorative: false,
        },
      });

      // Optionally add brand name as text below the image
      if (brandName) {
        await addElementAtPoint({
          type: 'text',
          children: [brandName],
          top: 420,
          left: 0,
          fontSize: 24,
          fontWeight: 'bold',
        });
      }

      // Add price tag if available
      if (price && currency) {
        const priceText = `${currency} ${price}`;
        await addElementAtPoint({
          type: 'text',
          children: [priceText],
          top: 450,
          left: 0,
          fontSize: 20,
        });
      }
    } catch (error) {
      // Error handling
    } finally {
      setIsAddingToCanvas(false);
    }
  };

  const handleSave = () => {
    const brandTag: BrandTag = {
      id: existingTag?.id || `brand-${Date.now()}`,
      brandName,
      productUrl,
      tags: tags.split(',').map(t => t.trim()).filter(t => t),
      productName,
      price,
      currency,
      notes
    };
    onSave(brandTag);
  };

  const isValid = brandName.trim() !== '';

  return (
    <Rows spacing="2u">
      <Box paddingBottom="1u">
        <Title size="small">Tag Brand</Title>
      </Box>

      <FormField
        label="Product URL"
        description="Paste a product URL to auto-fill details"
        value={productUrl}
        control={(props) => (
          <TextInput
            {...props}
            onBlur={handleUrlBlur}
            onChange={setProductUrl}
            placeholder="https://example.com/product"
            disabled={isScrapingUrl}
          />
        )}
      />

      {isScrapingUrl && (
        <Text size="small" tone="tertiary">Fetching product details...</Text>
      )}

      {scrapedImageUrl && (
        <Box
          padding="2u"
          border="standard"
          borderRadius="standard"
          background="neutralLow"
        >
          <Rows spacing="1u">
            <Text size="small">Product Preview</Text>
            <img
              src={scrapedImageUrl}
              alt="Product preview"
              style={{
                maxWidth: '100%',
                maxHeight: '200px',
                objectFit: 'contain',
                borderRadius: '4px'
              }}
            />
            <Button
              variant="primary"
              onClick={handleAddToCanvas}
              disabled={isAddingToCanvas}
              stretch
            >
              {isAddingToCanvas ? 'Adding to Canvas...' : 'Add Product to Canvas'}
            </Button>
          </Rows>
        </Box>
      )}

      <FormField
        label="Brand Name *"
        value={brandName}
        control={(props) => (
          <TextInput
            {...props}
            onChange={setBrandName}
            placeholder="e.g., Nike, IKEA"
          />
        )}
      />

      <FormField
        label="Product Name"
        value={productName}
        control={(props) => (
          <TextInput
            {...props}
            onChange={setProductName}
            placeholder="e.g., Air Max 90"
          />
        )}
      />

      <FormField
        label="Tags"
        description="Comma-separated (e.g., furniture, modern, outdoor)"
        value={tags}
        control={(props) => (
          <TextInput
            {...props}
            onChange={setTags}
            placeholder="furniture, modern, outdoor"
          />
        )}
      />

      <FormField
        label="Price"
        value={price}
        control={(props) => (
          <TextInput
            {...props}
            onChange={setPrice}
            placeholder="99.99"
          />
        )}
      />

      <FormField
        label="Currency"
        description="e.g., USD, INR, GBP, EUR"
        value={currency}
        control={(props) => (
          <TextInput
            {...props}
            onChange={setCurrency}
            placeholder="USD"
          />
        )}
      />

      <FormField
        label="Notes"
        value={notes}
        control={(props) => (
          <TextInput
            {...props}
            onChange={setNotes}
            placeholder="Additional notes..."
          />
        )}
      />

      <Rows spacing="1u">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={!isValid}
          stretch
        >
          Save Brand Tag
        </Button>
        <Button
          variant="secondary"
          onClick={onCancel}
          stretch
        >
          Cancel
        </Button>
      </Rows>
    </Rows>
  );
};
