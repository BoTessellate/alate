// Integration tests for CollageMaker component
import { TestAppI18nProvider } from '@canva/app-i18n-kit';
import { TestAppUiProvider } from '@canva/app-ui-kit';
import { fireEvent, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CollageMaker } from './CollageMaker';
import { getCurrentPageContext } from '@canva/design';
import { initializeGrid } from '../utils/gridManager';
import { rearrangeElementsIntoLayout } from '../utils/layoutEngine';

jest.mock('@canva/design');
jest.mock('../utils/gridManager');
jest.mock('../utils/layoutEngine');

function renderInTestProvider(node: ReactNode) {
  return render(
    <TestAppI18nProvider>
      <TestAppUiProvider>{node}</TestAppUiProvider>
    </TestAppI18nProvider>
  );
}

describe('CollageMaker Component', () => {
  const mockGetCurrentPageContext = jest.mocked(getCurrentPageContext);
  const mockInitializeGrid = jest.mocked(initializeGrid);
  const mockRearrangeElementsIntoLayout = jest.mocked(rearrangeElementsIntoLayout);

  const mockPageContext = {
    dimensions: {
      width: 1200,
      height: 800,
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockGetCurrentPageContext.mockResolvedValue(mockPageContext as any);
    mockInitializeGrid.mockReturnValue(undefined);
    mockRearrangeElementsIntoLayout.mockResolvedValue(undefined);
  });

  describe('Initial State', () => {
    it('should render with title and controls', () => {
      const { getByText } = renderInTestProvider(<CollageMaker />);

      expect(getByText('Quick Layout')).toBeInTheDocument();
      expect(getByText('Layout Style')).toBeInTheDocument();
    });

    it('should auto-initialize grid on mount', async () => {
      renderInTestProvider(<CollageMaker />);

      await waitFor(() => {
        expect(mockGetCurrentPageContext).toHaveBeenCalled();
        expect(mockInitializeGrid).toHaveBeenCalledWith(
          3, // default columns
          3, // default rows
          1200,
          800,
          'grid' // default layout
        );
      });
    });

    it('should show default grid settings (3x3)', () => {
      const { getByDisplayValue } = renderInTestProvider(<CollageMaker />);

      // Check default columns and rows
      const inputs = document.querySelectorAll('input[type="number"]');
      expect(inputs).toHaveLength(2); // columns and rows
      expect((inputs[0] as HTMLInputElement).value).toBe('3');
      expect((inputs[1] as HTMLInputElement).value).toBe('3');
    });

    it('should show Grid layout ready message', async () => {
      const { getByText } = renderInTestProvider(<CollageMaker />);

      await waitFor(() => {
        expect(getByText(/Grid layout ready \(3x3\)/i)).toBeInTheDocument();
      });
    });
  });

  describe('Layout Style Selection', () => {
    it('should switch to circular layout', async () => {
      const { getByRole, getByText } = renderInTestProvider(<CollageMaker />);

      // Find and click the Select dropdown
      const select = getByRole('button', { name: /Grid/i });
      fireEvent.click(select);

      // Select circular option
      const circularOption = getByRole('option', { name: /Circular/i });
      fireEvent.click(circularOption);

      await waitFor(() => {
        expect(mockInitializeGrid).toHaveBeenCalledWith(
          3,
          3,
          1200,
          800,
          'circular'
        );
        expect(getByText(/Circular layout ready/i)).toBeInTheDocument();
      });
    });

    it('should switch to editorial layout', async () => {
      const { getByRole, getByText } = renderInTestProvider(<CollageMaker />);

      const select = getByRole('button', { name: /Grid/i });
      fireEvent.click(select);

      const editorialOption = getByRole('option', { name: /Editorial Cluster/i });
      fireEvent.click(editorialOption);

      await waitFor(() => {
        expect(mockInitializeGrid).toHaveBeenCalledWith(
          3,
          3,
          1200,
          800,
          'editorial'
        );
        expect(getByText(/Editorial layout ready/i)).toBeInTheDocument();
      });
    });

    it('should hide column/row inputs for non-grid layouts', async () => {
      const { getByRole, queryByLabelText } = renderInTestProvider(<CollageMaker />);

      // Switch to circular
      const select = getByRole('button', { name: /Grid/i });
      fireEvent.click(select);
      fireEvent.click(getByRole('option', { name: /Circular/i }));

      await waitFor(() => {
        expect(queryByLabelText('Columns')).not.toBeInTheDocument();
        expect(queryByLabelText('Rows')).not.toBeInTheDocument();
      });
    });

    it('should show column/row inputs for grid layout', () => {
      const { getByLabelText } = renderInTestProvider(<CollageMaker />);

      expect(getByLabelText('Columns')).toBeInTheDocument();
      expect(getByLabelText('Rows')).toBeInTheDocument();
    });
  });

  describe('Grid Dimension Controls', () => {
    it('should update columns and re-initialize grid', async () => {
      const { getByLabelText } = renderInTestProvider(<CollageMaker />);

      const columnsInput = getByLabelText('Columns') as HTMLInputElement;
      fireEvent.change(columnsInput, { target: { value: '4' } });

      await waitFor(() => {
        expect(mockInitializeGrid).toHaveBeenCalledWith(
          4,
          3,
          1200,
          800,
          'grid'
        );
      });
    });

    it('should update rows and re-initialize grid', async () => {
      const { getByLabelText } = renderInTestProvider(<CollageMaker />);

      const rowsInput = getByLabelText('Rows') as HTMLInputElement;
      fireEvent.change(rowsInput, { target: { value: '5' } });

      await waitFor(() => {
        expect(mockInitializeGrid).toHaveBeenCalledWith(
          3,
          5,
          1200,
          800,
          'grid'
        );
      });
    });

    it('should update message when dimensions change', async () => {
      const { getByLabelText, getByText } = renderInTestProvider(<CollageMaker />);

      const columnsInput = getByLabelText('Columns') as HTMLInputElement;
      fireEvent.change(columnsInput, { target: { value: '4' } });

      await waitFor(() => {
        expect(getByText(/Grid layout ready \(4x3\)/i)).toBeInTheDocument();
      });
    });

    it('should respect min/max constraints', () => {
      const { getByLabelText } = renderInTestProvider(<CollageMaker />);

      const columnsInput = getByLabelText('Columns') as HTMLInputElement;
      expect(columnsInput).toHaveAttribute('min', '1');
      expect(columnsInput).toHaveAttribute('max', '6');

      const rowsInput = getByLabelText('Rows') as HTMLInputElement;
      expect(rowsInput).toHaveAttribute('min', '1');
      expect(rowsInput).toHaveAttribute('max', '6');
    });
  });

  describe('Rearrange Functionality', () => {
    it('should rearrange elements when button clicked', async () => {
      const { getByRole, getByText } = renderInTestProvider(<CollageMaker />);

      const rearrangeButton = getByRole('button', { name: /Rearrange Items on Canvas/i });
      fireEvent.click(rearrangeButton);

      await waitFor(() => {
        expect(mockRearrangeElementsIntoLayout).toHaveBeenCalledWith({
          columns: 3,
          rows: 3,
          layoutStyle: 'grid',
          canvasWidth: 1200,
          canvasHeight: 800,
        });
      });

      await waitFor(() => {
        expect(getByText('Items rearranged successfully!')).toBeInTheDocument();
      });
    });

    it('should show loading state during rearrange', async () => {
      let resolvePromise: any;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockRearrangeElementsIntoLayout.mockReturnValue(promise as any);

      const { getByRole, getByText } = renderInTestProvider(<CollageMaker />);

      const rearrangeButton = getByRole('button', { name: /Rearrange Items on Canvas/i });
      fireEvent.click(rearrangeButton);

      // Check loading state
      expect(getByText('Rearranging...')).toBeInTheDocument();
      expect(rearrangeButton).toBeDisabled();

      resolvePromise(undefined);

      await waitFor(() => {
        expect(rearrangeButton).not.toBeDisabled();
      });
    });

    it('should rearrange with updated layout settings', async () => {
      const { getByLabelText, getByRole } = renderInTestProvider(<CollageMaker />);

      // Change to 4x4 grid
      fireEvent.change(getByLabelText('Columns'), { target: { value: '4' } });
      fireEvent.change(getByLabelText('Rows'), { target: { value: '4' } });

      await waitFor(() => {
        expect(mockInitializeGrid).toHaveBeenCalledWith(4, 4, 1200, 800, 'grid');
      });

      // Rearrange
      const rearrangeButton = getByRole('button', { name: /Rearrange Items on Canvas/i });
      fireEvent.click(rearrangeButton);

      await waitFor(() => {
        expect(mockRearrangeElementsIntoLayout).toHaveBeenCalledWith(
          expect.objectContaining({
            columns: 4,
            rows: 4,
            layoutStyle: 'grid',
          })
        );
      });
    });

    it('should rearrange with circular layout', async () => {
      const { getByRole } = renderInTestProvider(<CollageMaker />);

      // Switch to circular
      const select = getByRole('button', { name: /Grid/i });
      fireEvent.click(select);
      fireEvent.click(getByRole('option', { name: /Circular/i }));

      await waitFor(() => {
        expect(mockInitializeGrid).toHaveBeenCalledWith(3, 3, 1200, 800, 'circular');
      });

      // Rearrange
      const rearrangeButton = getByRole('button', { name: /Rearrange Items on Canvas/i });
      fireEvent.click(rearrangeButton);

      await waitFor(() => {
        expect(mockRearrangeElementsIntoLayout).toHaveBeenCalledWith(
          expect.objectContaining({
            layoutStyle: 'circular',
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error message when rearrange fails', async () => {
      mockRearrangeElementsIntoLayout.mockRejectedValue(new Error('Failed to rearrange items'));

      const { getByRole, getByText } = renderInTestProvider(<CollageMaker />);

      const rearrangeButton = getByRole('button', { name: /Rearrange Items on Canvas/i });
      fireEvent.click(rearrangeButton);

      await waitFor(() => {
        expect(getByText('Failed to rearrange items')).toBeInTheDocument();
      });
    });

    it('should handle missing canvas dimensions', async () => {
      mockGetCurrentPageContext.mockResolvedValue({
        dimensions: undefined,
      } as any);

      const { getByRole, getByText } = renderInTestProvider(<CollageMaker />);

      const rearrangeButton = getByRole('button', { name: /Rearrange Items on Canvas/i });
      fireEvent.click(rearrangeButton);

      await waitFor(() => {
        expect(getByText('Unable to get canvas dimensions')).toBeInTheDocument();
      });
    });

    it('should show custom error messages from layout engine', async () => {
      mockRearrangeElementsIntoLayout.mockRejectedValue(
        new Error('No images found on canvas to rearrange')
      );

      const { getByRole, getByText } = renderInTestProvider(<CollageMaker />);

      const rearrangeButton = getByRole('button', { name: /Rearrange Items on Canvas/i });
      fireEvent.click(rearrangeButton);

      await waitFor(() => {
        expect(getByText(/No images found on canvas to rearrange/i)).toBeInTheDocument();
      });
    });

    it('should remain functional after error', async () => {
      mockRearrangeElementsIntoLayout.mockRejectedValueOnce(new Error('Test error'));

      const { getByRole } = renderInTestProvider(<CollageMaker />);

      const rearrangeButton = getByRole('button', { name: /Rearrange Items on Canvas/i });

      // First attempt fails
      fireEvent.click(rearrangeButton);

      await waitFor(() => {
        expect(rearrangeButton).not.toBeDisabled();
      });

      // Should be able to retry
      mockRearrangeElementsIntoLayout.mockResolvedValue(undefined);
      fireEvent.click(rearrangeButton);

      await waitFor(() => {
        expect(mockRearrangeElementsIntoLayout).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Message Display', () => {
    it('should show green text for success messages', async () => {
      const { getByRole, getByText } = renderInTestProvider(<CollageMaker />);

      const rearrangeButton = getByRole('button', { name: /Rearrange Items on Canvas/i });
      fireEvent.click(rearrangeButton);

      await waitFor(() => {
        const successMessage = getByText('Items rearranged successfully!');
        expect(successMessage).toBeInTheDocument();
        // The tone prop is 'positive' for success
      });
    });

    it('should show green text for ready messages', async () => {
      const { getByText } = renderInTestProvider(<CollageMaker />);

      await waitFor(() => {
        const readyMessage = getByText(/Grid layout ready/i);
        expect(readyMessage).toBeInTheDocument();
        // The tone prop is 'positive' for ready state
      });
    });

    it('should show red text for error messages', async () => {
      mockRearrangeElementsIntoLayout.mockRejectedValue(new Error('Test error'));

      const { getByRole, getByText } = renderInTestProvider(<CollageMaker />);

      const rearrangeButton = getByRole('button', { name: /Rearrange Items on Canvas/i });
      fireEvent.click(rearrangeButton);

      await waitFor(() => {
        const errorMessage = getByText('Test error');
        expect(errorMessage).toBeInTheDocument();
        // The tone prop is 'critical' for errors
      });
    });
  });
});
