import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UnifiedChatInput } from '../UnifiedChatInput';

describe('UnifiedChatInput', () => {
  describe('Rendering', () => {
    it('renders textarea and action buttons', () => {
      render(<UnifiedChatInput onSubmit={() => {}} data-testid="chat-input" />);
      expect(screen.getByTestId('chat-input-textarea')).toBeInTheDocument();
      expect(screen.getByLabelText('Attach image')).toBeInTheDocument();
      expect(screen.getByLabelText('Send')).toBeInTheDocument();
    });

    it('renders with custom placeholder', () => {
      render(
        <UnifiedChatInput
          onSubmit={() => {}}
          placeholder="Search products..."
          data-testid="chat-input"
        />
      );
      expect(screen.getByPlaceholderText('Search products...')).toBeInTheDocument();
    });

    it('renders with default placeholder', () => {
      render(<UnifiedChatInput onSubmit={() => {}} data-testid="chat-input" />);
      expect(screen.getByPlaceholderText('Ask anything...')).toBeInTheDocument();
    });
  });

  describe('Layout and Alignment', () => {
    it('input row uses items-center for vertical alignment', () => {
      const { container } = render(<UnifiedChatInput onSubmit={() => {}} data-testid="chat-input" />);

      // Find the input row container (has flex and items-center)
      const inputRow = container.querySelector('.flex.items-center');
      expect(inputRow).toBeInTheDocument();

      // Ensure it does NOT use items-end (which causes misalignment)
      const itemsEndElement = container.querySelector('.items-end');
      // The only items-end should be absent from the input row
      expect(inputRow?.classList.contains('items-end')).toBe(false);
    });

    it('camera button has centered content styling', () => {
      render(<UnifiedChatInput onSubmit={() => {}} data-testid="chat-input" />);
      const cameraButton = screen.getByLabelText('Attach image');

      // Button should have flex centering classes
      expect(cameraButton.className).toContain('flex');
      expect(cameraButton.className).toContain('items-center');
      expect(cameraButton.className).toContain('justify-center');
    });

    it('send button has centered content styling', () => {
      render(<UnifiedChatInput onSubmit={() => {}} data-testid="chat-input" />);
      const sendButton = screen.getByLabelText('Send');

      // Button should have flex centering classes
      expect(sendButton.className).toContain('flex');
      expect(sendButton.className).toContain('items-center');
      expect(sendButton.className).toContain('justify-center');
    });
  });

  describe('Input Behavior', () => {
    it('updates textarea value on change', () => {
      render(<UnifiedChatInput onSubmit={() => {}} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea') as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: 'Hello world' } });
      expect(textarea.value).toBe('Hello world');
    });

    it('clears input after submission', () => {
      const handleSubmit = jest.fn();
      render(<UnifiedChatInput onSubmit={handleSubmit} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea') as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(screen.getByLabelText('Send'));

      expect(textarea.value).toBe('');
    });
  });

  describe('Submit Behavior', () => {
    it('calls onSubmit with payload when send button is clicked', () => {
      const handleSubmit = jest.fn();
      render(<UnifiedChatInput onSubmit={handleSubmit} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      fireEvent.change(textarea, { target: { value: 'Find blue sofas' } });
      fireEvent.click(screen.getByLabelText('Send'));

      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'text',
          content: 'Find blue sofas',
        })
      );
    });

    it('calls onSubmit when Enter is pressed', () => {
      const handleSubmit = jest.fn();
      render(<UnifiedChatInput onSubmit={handleSubmit} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      fireEvent.change(textarea, { target: { value: 'Test query' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(handleSubmit).toHaveBeenCalled();
    });

    it('does not submit when Shift+Enter is pressed (allows new line)', () => {
      const handleSubmit = jest.fn();
      render(<UnifiedChatInput onSubmit={handleSubmit} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      fireEvent.change(textarea, { target: { value: 'Test query' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('does not submit empty message', () => {
      const handleSubmit = jest.fn();
      render(<UnifiedChatInput onSubmit={handleSubmit} data-testid="chat-input" />);

      fireEvent.click(screen.getByLabelText('Send'));
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('does not submit whitespace-only message', () => {
      const handleSubmit = jest.fn();
      render(<UnifiedChatInput onSubmit={handleSubmit} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.click(screen.getByLabelText('Send'));

      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  describe('URL Detection', () => {
    it('detects URL in input and marks type as url', () => {
      const handleSubmit = jest.fn();
      render(<UnifiedChatInput onSubmit={handleSubmit} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      fireEvent.change(textarea, { target: { value: 'https://example.com/product' } });
      fireEvent.click(screen.getByLabelText('Send'));

      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'url',
        })
      );
    });
  });

  describe('Disabled State', () => {
    it('disables textarea when disabled prop is true', () => {
      render(<UnifiedChatInput onSubmit={() => {}} disabled={true} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');
      expect(textarea).toBeDisabled();
    });

    it('disables textarea when isLoading is true', () => {
      render(<UnifiedChatInput onSubmit={() => {}} isLoading={true} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');
      expect(textarea).toBeDisabled();
    });

    it('does not submit when disabled', () => {
      const handleSubmit = jest.fn();
      render(<UnifiedChatInput onSubmit={handleSubmit} disabled={true} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.click(screen.getByLabelText('Send'));

      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<UnifiedChatInput onSubmit={() => {}} isLoading={true} data-testid="chat-input" />);
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('shows send icon when not loading', () => {
      render(<UnifiedChatInput onSubmit={() => {}} isLoading={false} data-testid="chat-input" />);
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('Send Button State', () => {
    it('send button is disabled when input is empty', () => {
      render(<UnifiedChatInput onSubmit={() => {}} data-testid="chat-input" />);
      const sendButton = screen.getByLabelText('Send');
      expect(sendButton).toBeDisabled();
    });

    it('send button is enabled when input has content', () => {
      render(<UnifiedChatInput onSubmit={() => {}} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      const sendButton = screen.getByLabelText('Send');
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('Image Attachment', () => {
    it('shows image preview when image is attached', () => {
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const mockPreviewUrl = 'blob:http://localhost/test-image';

      render(
        <UnifiedChatInput
          onSubmit={() => {}}
          attachedImage={mockFile}
          attachedImagePreview={mockPreviewUrl}
          data-testid="chat-input"
        />
      );

      const preview = screen.getByAltText('Attached');
      expect(preview).toBeInTheDocument();
    });

    it('shows remove button when image is attached', () => {
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const mockPreviewUrl = 'blob:http://localhost/test-image';

      render(
        <UnifiedChatInput
          onSubmit={() => {}}
          attachedImage={mockFile}
          attachedImagePreview={mockPreviewUrl}
          onClearAttachment={() => {}}
          data-testid="chat-input"
        />
      );

      const removeButton = screen.getByLabelText('Remove image');
      expect(removeButton).toBeInTheDocument();
    });

    it('changes placeholder when image is attached', () => {
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const mockPreviewUrl = 'blob:http://localhost/test-image';

      render(
        <UnifiedChatInput
          onSubmit={() => {}}
          attachedImage={mockFile}
          attachedImagePreview={mockPreviewUrl}
          data-testid="chat-input"
        />
      );

      expect(screen.getByPlaceholderText('Add a description...')).toBeInTheDocument();
    });

    it('enables send button when image is attached even without text', () => {
      const mockFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const mockPreviewUrl = 'blob:http://localhost/test-image';

      render(
        <UnifiedChatInput
          onSubmit={() => {}}
          attachedImage={mockFile}
          attachedImagePreview={mockPreviewUrl}
          data-testid="chat-input"
        />
      );

      const sendButton = screen.getByLabelText('Send');
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('camera button has aria-label', () => {
      render(<UnifiedChatInput onSubmit={() => {}} />);
      expect(screen.getByLabelText('Attach image')).toBeInTheDocument();
    });

    it('send button has aria-label', () => {
      render(<UnifiedChatInput onSubmit={() => {}} />);
      expect(screen.getByLabelText('Send')).toBeInTheDocument();
    });

    it('supports data-testid prop', () => {
      render(<UnifiedChatInput onSubmit={() => {}} data-testid="test-input" />);
      expect(screen.getByTestId('test-input')).toBeInTheDocument();
      expect(screen.getByTestId('test-input-textarea')).toBeInTheDocument();
      expect(screen.getByTestId('test-input-send')).toBeInTheDocument();
    });
  });
});
