import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ExpandablePanel } from '../ExpandablePanel';

describe('ExpandablePanel', () => {
  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(
        <ExpandablePanel isOpen={true} onClose={() => {}} title="Test Panel">
          <div>Content</div>
        </ExpandablePanel>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Panel')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(
        <ExpandablePanel isOpen={false} onClose={() => {}} title="Test Panel">
          <div>Content</div>
        </ExpandablePanel>
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders title in header', () => {
      render(
        <ExpandablePanel isOpen={true} onClose={() => {}} title="Panel Title">
          <div>Content</div>
        </ExpandablePanel>
      );
      expect(screen.getByRole('heading', { name: 'Panel Title' })).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
      render(
        <ExpandablePanel
          isOpen={true}
          onClose={() => {}}
          title="Title"
          subtitle="Subtitle text"
        >
          <div>Content</div>
        </ExpandablePanel>
      );
      expect(screen.getByText('Subtitle text')).toBeInTheDocument();
    });

    it('applies custom className to panel', () => {
      render(
        <ExpandablePanel
          isOpen={true}
          onClose={() => {}}
          title="Test"
          className="custom-panel-class"
        >
          <div>Content</div>
        </ExpandablePanel>
      );
      expect(screen.getByRole('dialog')).toHaveClass('custom-panel-class');
    });

    it('renders header actions when provided', () => {
      render(
        <ExpandablePanel
          isOpen={true}
          onClose={() => {}}
          title="Test"
          headerActions={<button>Action</button>}
        >
          <div>Content</div>
        </ExpandablePanel>
      );
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });
  });

  describe('Mode Toggle', () => {
    it('starts in compact mode by default', () => {
      render(
        <ExpandablePanel isOpen={true} onClose={() => {}} title="Test">
          <div>Content</div>
        </ExpandablePanel>
      );
      // Compact mode should have expand button (ChevronLeft)
      expect(screen.getByLabelText('Expand panel')).toBeInTheDocument();
    });

    it('starts in expanded mode when initialMode is expanded', () => {
      render(
        <ExpandablePanel
          isOpen={true}
          onClose={() => {}}
          title="Test"
          initialMode="expanded"
        >
          <div>Content</div>
        </ExpandablePanel>
      );
      // Expanded mode should have collapse button (ChevronRight)
      expect(screen.getByLabelText('Collapse panel')).toBeInTheDocument();
    });

    it('toggles between compact and expanded modes', () => {
      render(
        <ExpandablePanel isOpen={true} onClose={() => {}} title="Test">
          <div>Content</div>
        </ExpandablePanel>
      );

      // Initially in compact mode
      const expandButton = screen.getByLabelText('Expand panel');
      expect(expandButton).toBeInTheDocument();

      // Click to expand
      fireEvent.click(expandButton);

      // Now should be in expanded mode
      expect(screen.getByLabelText('Collapse panel')).toBeInTheDocument();
    });

    it('calls onModeChange when mode is toggled', () => {
      const handleModeChange = jest.fn();
      render(
        <ExpandablePanel
          isOpen={true}
          onClose={() => {}}
          title="Test"
          onModeChange={handleModeChange}
        >
          <div>Content</div>
        </ExpandablePanel>
      );

      fireEvent.click(screen.getByLabelText('Expand panel'));
      expect(handleModeChange).toHaveBeenCalledWith('expanded');

      fireEvent.click(screen.getByLabelText('Collapse panel'));
      expect(handleModeChange).toHaveBeenCalledWith('compact');
    });

    it('resets to initialMode when closed and reopened', () => {
      const { rerender } = render(
        <ExpandablePanel isOpen={true} onClose={() => {}} title="Test">
          <div>Content</div>
        </ExpandablePanel>
      );

      // Expand the panel
      fireEvent.click(screen.getByLabelText('Expand panel'));
      expect(screen.getByLabelText('Collapse panel')).toBeInTheDocument();

      // Close the panel
      rerender(
        <ExpandablePanel isOpen={false} onClose={() => {}} title="Test">
          <div>Content</div>
        </ExpandablePanel>
      );

      // Reopen - should be back to compact
      rerender(
        <ExpandablePanel isOpen={true} onClose={() => {}} title="Test">
          <div>Content</div>
        </ExpandablePanel>
      );

      expect(screen.getByLabelText('Expand panel')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('calls onClose when backdrop is clicked', () => {
      const handleClose = jest.fn();
      render(
        <ExpandablePanel isOpen={true} onClose={handleClose} title="Test" data-testid="test-panel">
          <div>Content</div>
        </ExpandablePanel>
      );

      const backdrop = screen.getByTestId('test-panel-backdrop');
      fireEvent.click(backdrop);

      expect(handleClose).toHaveBeenCalled();
    });

    it('does not call onClose when panel content is clicked', () => {
      const handleClose = jest.fn();
      render(
        <ExpandablePanel isOpen={true} onClose={handleClose} title="Test">
          <div>Content</div>
        </ExpandablePanel>
      );

      fireEvent.click(screen.getByRole('dialog'));
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
      const handleClose = jest.fn();
      render(
        <ExpandablePanel isOpen={true} onClose={handleClose} title="Test">
          <div>Content</div>
        </ExpandablePanel>
      );

      fireEvent.click(screen.getByLabelText('Close panel'));
      expect(handleClose).toHaveBeenCalled();
    });

    it('calls onClose when Escape key is pressed', () => {
      const handleClose = jest.fn();
      render(
        <ExpandablePanel isOpen={true} onClose={handleClose} title="Test">
          <div>Content</div>
        </ExpandablePanel>
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });

    it('does not close on Escape when closeOnEscape is false', () => {
      const handleClose = jest.fn();
      render(
        <ExpandablePanel
          isOpen={true}
          onClose={handleClose}
          title="Test"
          closeOnEscape={false}
        >
          <div>Content</div>
        </ExpandablePanel>
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('does not close on backdrop click when closeOnBackdropClick is false', () => {
      const handleClose = jest.fn();
      render(
        <ExpandablePanel
          isOpen={true}
          onClose={handleClose}
          title="Test"
          closeOnBackdropClick={false}
          data-testid="test-panel"
        >
          <div>Content</div>
        </ExpandablePanel>
      );

      const backdrop = screen.getByTestId('test-panel-backdrop');
      fireEvent.click(backdrop);

      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has aria-modal attribute', () => {
      render(
        <ExpandablePanel isOpen={true} onClose={() => {}} title="Accessible">
          <div>Content</div>
        </ExpandablePanel>
      );
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(
        <ExpandablePanel isOpen={true} onClose={() => {}} title="Panel Title">
          <div>Content</div>
        </ExpandablePanel>
      );
      const dialog = screen.getByRole('dialog');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(screen.getByText('Panel Title')).toHaveAttribute('id', labelledBy);
    });

    it('supports data-testid prop', () => {
      render(
        <ExpandablePanel
          isOpen={true}
          onClose={() => {}}
          title="Test"
          data-testid="test-panel"
        >
          <div>Content</div>
        </ExpandablePanel>
      );
      expect(screen.getByTestId('test-panel')).toBeInTheDocument();
      expect(screen.getByTestId('test-panel-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('test-panel-close')).toBeInTheDocument();
      expect(screen.getByTestId('test-panel-backdrop')).toBeInTheDocument();
    });
  });
});
