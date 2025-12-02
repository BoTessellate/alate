import React from 'react';
import {
  Button,
  Rows,
  Text,
  Title,
  Box,
  Badge,
} from '@canva/app-ui-kit';
import { addElementAtPoint } from '@canva/design';
import { ImageBrandData } from '../types';
import { getTaggedImageCount, FREE_TIER_LIMIT } from '../utils/storage';

interface SidebarProps {
  selectedImageData?: ImageBrandData;
  onEditTag: () => void;
  onExport: () => void;
  allBrandData: ImageBrandData[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedImageData,
  onEditTag,
  onExport,
  allBrandData
}) => {
  const taggedCount = getTaggedImageCount();
  const remainingFree = Math.max(0, FREE_TIER_LIMIT - taggedCount);

  const handleAddBrandNameToCanvas = async () => {
    if (!selectedImageData) return;

    await addElementAtPoint({
      type: 'text',
      children: [selectedImageData.brandTag.brandName],
      top: 0,
      left: 0,
    });
  };

  return (
    <Rows spacing="2u">
      <Box>
        <Title size="medium">Moodboard Tags</Title>
      </Box>

      <Box paddingTop="1u" paddingBottom="1u">
        <Rows spacing="0.5u">
          <Text size="small" tone="tertiary">
            Tagged images: {taggedCount} / {FREE_TIER_LIMIT} (Free)
          </Text>
          {remainingFree <= 3 && remainingFree > 0 && (
            <Badge tone="warn" text={`${remainingFree} tags remaining`} />
          )}
          {remainingFree === 0 && (
            <Badge tone="critical" text="Free limit reached" />
          )}
        </Rows>
      </Box>

      {selectedImageData ? (
        <Rows spacing="1.5u">
          <Box>
            <Title size="small">Selected Image</Title>
          </Box>

          <Rows spacing="0.5u">
            <Text size="small" tone="tertiary">Brand</Text>
            <Text size="medium">
              {selectedImageData.brandTag.brandName}
            </Text>
          </Rows>

          {selectedImageData.brandTag.productName && (
            <Rows spacing="0.5u">
              <Text size="small" tone="tertiary">Product</Text>
              <Text size="small">{selectedImageData.brandTag.productName}</Text>
            </Rows>
          )}

          {selectedImageData.brandTag.productUrl && (
            <Rows spacing="0.5u">
              <Text size="small" tone="tertiary">URL</Text>
              <Text size="xsmall" tone="tertiary">
                {selectedImageData.brandTag.productUrl.substring(0, 40)}...
              </Text>
            </Rows>
          )}

          {selectedImageData.brandTag.tags.length > 0 && (
            <Rows spacing="0.5u">
              <Text size="small" tone="tertiary">Tags</Text>
              <Box>
                {selectedImageData.brandTag.tags.map((tag, index) => (
                  <Badge key={index} text={tag} tone="info" />
                ))}
              </Box>
            </Rows>
          )}

          {selectedImageData.brandTag.price && (
            <Rows spacing="0.5u">
              <Text size="small" tone="tertiary">Price</Text>
              <Text size="small">
                {selectedImageData.brandTag.currency
                  ? `${selectedImageData.brandTag.currency} ${selectedImageData.brandTag.price}`
                  : selectedImageData.brandTag.price
                }
              </Text>
            </Rows>
          )}

          {selectedImageData.brandTag.notes && (
            <Rows spacing="0.5u">
              <Text size="small" tone="tertiary">Notes</Text>
              <Text size="small">{selectedImageData.brandTag.notes}</Text>
            </Rows>
          )}

          <Button
            variant="secondary"
            onClick={onEditTag}
            stretch
          >
            Edit Tag
          </Button>

          <Button
            variant="secondary"
            onClick={handleAddBrandNameToCanvas}
            stretch
          >
            Add Brand Name to Canvas
          </Button>
        </Rows>
      ) : (
        <Box paddingTop="2u">
          <Text size="small" tone="tertiary" alignment="center">
            Select a tagged image to view details
          </Text>
        </Box>
      )}

      <Box paddingTop="2u">
        <Button
          variant="primary"
          onClick={onExport}
          disabled={allBrandData.length === 0}
          stretch
        >
          Export Moodboard Data
        </Button>
      </Box>

      {allBrandData.length > 0 && (
        <Box paddingTop="1u">
          <Rows spacing="1u">
            <Title size="small">All Brands ({allBrandData.length})</Title>
            {allBrandData.map((data) => (
              <Box key={data.imageId}>
                <Text size="small">
                  {data.brandTag.brandName}
                </Text>
                {data.brandTag.productName && (
                  <Text size="xsmall" tone="tertiary">
                    {data.brandTag.productName}
                  </Text>
                )}
              </Box>
            ))}
          </Rows>
        </Box>
      )}
    </Rows>
  );
};
