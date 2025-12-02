import React, { useState, useEffect } from 'react';
import {
  Rows,
  Text,
  Title,
  Box,
  FormField,
  NumberInput,
  Select,
  Button,
} from '@canva/app-ui-kit';
import { getCurrentPageContext } from '@canva/design';
import { initializeGrid, type LayoutStyle } from '../utils/gridManager';
import { rearrangeElementsIntoLayout } from '../utils/layoutEngine';

export const CollageMaker: React.FC = () => {
  const [columns, setColumns] = useState(2);
  const [rows, setRows] = useState(2);
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>('grid');
  const [message, setMessage] = useState<string>('');
  const [isRearranging, setIsRearranging] = useState(false);

  // Auto-initialize grid when layout settings change
  useEffect(() => {
    const initGrid = async () => {
      try {
        const context = await getCurrentPageContext();
        if (!context || !context.dimensions) {
          return;
        }

        const canvasWidth = context.dimensions.width;
        const canvasHeight = context.dimensions.height;

        initializeGrid(columns, rows, canvasWidth, canvasHeight, layoutStyle);

        const styleName = layoutStyle.charAt(0).toUpperCase() + layoutStyle.slice(1);
        const layoutInfo = layoutStyle === 'grid'
          ? `(${columns}x${rows})`
          : '';
        setMessage(`${styleName} layout ready ${layoutInfo}`);
      } catch (error) {
        // Error handling
      }
    };

    initGrid();
  }, [layoutStyle, columns, rows]);

  const handleRearrange = async () => {
    setIsRearranging(true);
    setMessage('');
    try {
      const context = await getCurrentPageContext();
      if (!context || !context.dimensions) {
        setMessage('Unable to get canvas dimensions');
        return;
      }

      await rearrangeElementsIntoLayout({
        columns,
        rows,
        layoutStyle,
        canvasWidth: context.dimensions.width,
        canvasHeight: context.dimensions.height,
      });

      setMessage('Items rearranged successfully!');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to rearrange items');
    } finally {
      setIsRearranging(false);
    }
  };

  return (
    <Rows spacing="1u">
      <Box>
        <Title size="small">Quick Layout</Title>
      </Box>

      <FormField
        label="Layout Style"
        value={layoutStyle}
        control={(props) => (
          <Select
            {...props}
            onChange={setLayoutStyle}
            options={[
              { label: 'Grid', value: 'grid' },
              { label: 'Circular', value: 'circular' },
              { label: 'Editorial Cluster', value: 'editorial' },
            ]}
          />
        )}
      />

      {layoutStyle === 'grid' && (
        <Rows spacing="1u">
          <FormField
            label="Columns"
            value={columns}
            control={(props) => (
              <NumberInput
                {...props}
                min={1}
                max={6}
                onChange={(valueAsNumber) => {
                  if (valueAsNumber !== undefined) setColumns(valueAsNumber);
                }}
              />
            )}
          />
          <FormField
            label="Rows"
            value={rows}
            control={(props) => (
              <NumberInput
                {...props}
                min={1}
                max={6}
                onChange={(valueAsNumber) => {
                  if (valueAsNumber !== undefined) setRows(valueAsNumber);
                }}
              />
            )}
          />
        </Rows>
      )}

      <Button
        variant="secondary"
        onClick={handleRearrange}
        disabled={isRearranging}
        stretch
      >
        {isRearranging ? 'Rearranging...' : 'Rearrange Items on Canvas'}
      </Button>

      {message && (
        <Box paddingTop="0.5u">
          <Text size="small" tone={(message.includes('success') || message.includes('ready')) ? 'tertiary' : 'tertiary'}>
            {message}
          </Text>
        </Box>
      )}
    </Rows>
  );
}
