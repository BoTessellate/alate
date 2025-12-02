import React, { useState, useEffect } from 'react';
import { Rows, Text, Alert, Box, Title } from '@canva/app-ui-kit';
import { selection } from '@canva/design';
import { BrandTagModal } from './components/BrandTagModal';
import { Sidebar } from './components/Sidebar';
import { ProductScraper } from './components/ProductScraper';
import { CollageMaker } from './components/CollageMaker';
import { ImageBrandData, BrandTag } from './types';
import {
  saveBrandData,
  loadBrandData,
  exportBrandData,
  canAddMoreTags,
  getTaggedImageCount,
  FREE_TIER_LIMIT
} from './utils/storage';

export const App = () => {
  const [brandDataList, setBrandDataList] = useState<ImageBrandData[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<any>(null);

  useEffect(() => {
    const data = loadBrandData();
    setBrandDataList(data);
  }, []);

  // Listen for selection changes on the canvas
  useEffect(() => {
    const onSelectionChange = async (event: any) => {
      if (event.count > 0) {
        const draft = await event.read();
        const firstSelected = draft.contents[0];

        // For scope: 'image', contents have a 'ref' property
        setCurrentSelection(firstSelected);
        setSelectedImageId(firstSelected.ref);

        // Auto-open tag modal when image is selected (matching Canva UX)
        const existingTag = brandDataList.find(data => data.imageId === firstSelected.ref);
        if (!existingTag && canAddMoreTags()) {
          setShowTagModal(true);
        }
      } else {
        setCurrentSelection(null);
        setSelectedImageId(null);
      }
    };

    const unsubscribe = selection.registerOnChange({
      scope: 'image',
      onChange: onSelectionChange,
    });

    return () => {
      unsubscribe();
    };
  }, [brandDataList]);

  const handleSaveTag = (brandTag: BrandTag) => {
    if (!selectedImageId) return;

    const existingIndex = brandDataList.findIndex(
      data => data.imageId === selectedImageId
    );

    let updatedList: ImageBrandData[];

    if (existingIndex >= 0) {
      updatedList = [...brandDataList];
      updatedList[existingIndex] = {
        ...updatedList[existingIndex],
        brandTag
      };
    } else {
      if (!canAddMoreTags()) {
        setShowUpgradeBanner(true);
        setShowTagModal(false);
        return;
      }

      const newData: ImageBrandData = {
        imageId: selectedImageId,
        brandTag,
        createdAt: Date.now()
      };
      updatedList = [...brandDataList, newData];
    }

    setBrandDataList(updatedList);
    saveBrandData(updatedList);
    setShowTagModal(false);
  };

  const handleExport = () => {
    const jsonData = exportBrandData();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moodboard-brands-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedData = selectedImageId
    ? brandDataList.find(data => data.imageId === selectedImageId)
    : undefined;

  const taggedCount = getTaggedImageCount();

  return (
    <div style={{ padding: '20px' }}>
      {showUpgradeBanner && (
        <Box paddingBottom="2u">
          <Alert tone="critical" onDismiss={() => setShowUpgradeBanner(false)}>
            <Text>
              You've reached the free limit of {FREE_TIER_LIMIT} tagged images.
              Upgrade to Premium for unlimited tags!
            </Text>
          </Alert>
        </Box>
      )}

      <ProductScraper />

      <Box paddingTop="3u">
        <CollageMaker />
      </Box>
    </div>
  );
};

 
