/**
 * Smart Label Generation
 * Uses vision AI to place labels optimally on layouts
 */

import { createVisionClient, VisionRequest } from './visionClient';
import { LayoutOutput } from '../layoutGenerator/types';

export async function generateSmartLabels(
  layout: LayoutOutput,
  anthropicApiKey: string
): Promise<LayoutOutput> {
  const visionClient = createVisionClient(anthropicApiKey);

  // Extract image positions
  const imagePositions = layout.elements
    .filter(el => el.type === 'image')
    .map(el => ({
      x: el.position.x,
      y: el.position.y,
      width: el.size!.width,
      height: el.size!.height,
      product_name: el.text || 'Product'
    }));

  const visionRequest: VisionRequest = {
    canvas_size: layout.canvas_size,
    image_positions: imagePositions,
    label_style: {
      font_size: 18,
      color: '#2C2416',
      placement_preference: 'auto'
    }
  };

  const result = await visionClient.getSmartLabelPlacements(visionRequest);

  // Update label positions in layout
  const updatedElements = layout.elements.map(el => {
    if (el.type === 'label') {
      const smartPlacement = result.label_placements.find(
        p => p.product_name === el.text
      );
      if (smartPlacement) {
        return { ...el, position: smartPlacement.position };
      }
    }
    return el;
  });

  return { ...layout, elements: updatedElements };
}
