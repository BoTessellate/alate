import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Modal, ModalContent, ModalFooter } from '../Modal';

describe('Modal', () => {
  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test Modal">
          <ModalContent>Content</ModalContent>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(
        <Modal isOpen={false} onClose={() => {}} title="Test Modal">
          <ModalContent>Content</ModalContent>
        </Modal>
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders title in header', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Modal Title">
          <ModalContent>Content</ModalContent>
        </Modal>
      );
      expect(screen.getByRole('heading', { name: 'Modal Title' })).toBeInTheDocument();
    });

    it('renders without title when empty string', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="">
          <ModalContent>Content</ModalContent>
        </Modal>
      );
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('applies custom className to modal', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Test" className="custom-modal-class">
          <ModalContent>Content</ModalContent>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toHaveClass('custom-modal-class');
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Small" size="sm">
          <ModalContent>Content</ModalContent>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toHaveClass('max-w-sm');
    });

    it('renders medium size by default', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Medium">
          <ModalContent>Content</ModalContent>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toHaveClass('max-w-md');
    });

    it('renders large size', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Large" size="lg">
          <ModalContent>Content</ModalContent>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toHaveClass('max-w-lg');
    });

    it('renders extra large size', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="XL" size="xl">
          <ModalContent>Content</ModalContent>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toHaveClass('max-w-xl');
    });
  });

  describe('Interaction', () => {
    it('calls onClose when backdrop is clicked', () => {
      const handleClose = jest.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test">
          <ModalContent>Content</ModalContent>
        </Modal>
      );

      // Click backdrop (the parent div containing the modal)
      const dialog = screen.getByRole('dialog');
      const backdrop = dialog.parentElement;
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(handleClose).toHaveBeenCalled();
    });

    it('does not call onClose when modal content is clicked', () => {
      const handleClose = jest.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test">
          <ModalContent>Content</ModalContent>
        </Modal>
      );

      fireEvent.click(screen.getByRole('dialog'));
      expect(handleClose).not.toHaveBeenCalled();
    });

    it('calls onClose when close button is clicked', () => {
      const handleClose = jest.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test">
          <ModalContent>Content</ModalContent>
        </Modal>
      );

      fireEvent.click(screen.getByLabelText('Close modal'));
      expect(handleClose).toHaveBeenCalled();
    });

    it('calls onClose when Escape key is pressed', () => {
      const handleClose = jest.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Test">
          <ModalContent>Content</ModalContent>
        </Modal>
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has aria-modal attribute', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Accessible">
          <ModalContent>Content</ModalContent>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(
        <Modal isOpen={true} onClose={() => {}} title="Modal Title">
          <ModalContent>Content</ModalContent>
        </Modal>
      );
      const dialog = screen.getByRole('dialog');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(screen.getByText('Modal Title')).toHaveAttribute('id', labelledBy);
    });
  });
});

describe('ModalContent', () => {
  it('renders children', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        <ModalContent>
          <p>Modal body content</p>
        </ModalContent>
      </Modal>
    );
    expect(screen.getByText('Modal body content')).toBeInTheDocument();
  });

  it('applies padding class', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        <ModalContent>Content</ModalContent>
      </Modal>
    );
    // ModalContent wraps content directly with p-4 class
    // The text content is inside ModalContent div which has p-4
    const contentText = screen.getByText('Content');
    // The parent is the ModalContent div with p-4 class
    expect(contentText.closest('.p-4')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        <ModalContent className="custom-content-class">Content</ModalContent>
      </Modal>
    );
    // ModalContent applies className directly: `p-4 ${className}`
    const contentText = screen.getByText('Content');
    expect(contentText.closest('.custom-content-class')).toBeInTheDocument();
  });
});

describe('ModalFooter', () => {
  it('renders children', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        <ModalContent>Content</ModalContent>
        <ModalFooter>
          <button>Cancel</button>
          <button>Save</button>
        </ModalFooter>
      </Modal>
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('applies flex layout with gap', () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        <ModalContent>Content</ModalContent>
        <ModalFooter>
          <button>Button</button>
        </ModalFooter>
      </Modal>
    );
    const footer = screen.getByRole('button', { name: 'Button' }).parentElement;
    expect(footer).toHaveClass('flex', 'gap-3');
  });
});
