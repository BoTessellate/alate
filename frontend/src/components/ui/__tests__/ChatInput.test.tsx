import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatInput } from '../ChatInput';

describe('ChatInput', () => {
  describe('Rendering', () => {
    it('renders textarea and send button', () => {
      render(<ChatInput onSubmit={() => {}} data-testid="chat-input" />);
      expect(screen.getByTestId('chat-input-textarea')).toBeInTheDocument();
      expect(screen.getByLabelText('Send message')).toBeInTheDocument();
    });

    it('renders with custom placeholder', () => {
      render(
        <ChatInput
          onSubmit={() => {}}
          placeholder="Ask about products..."
          data-testid="chat-input"
        />
      );
      expect(screen.getByPlaceholderText('Ask about products...')).toBeInTheDocument();
    });

    it('renders with default placeholder', () => {
      render(<ChatInput onSubmit={() => {}} data-testid="chat-input" />);
      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    });
  });

  describe('Input Behavior', () => {
    it('updates textarea value on change', () => {
      render(<ChatInput onSubmit={() => {}} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea') as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: 'Hello world' } });
      expect(textarea.value).toBe('Hello world');
    });

    it('clears input after submission', () => {
      const handleSubmit = jest.fn();
      render(<ChatInput onSubmit={handleSubmit} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea') as HTMLTextAreaElement;

      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(screen.getByLabelText('Send message'));

      expect(textarea.value).toBe('');
    });
  });

  describe('Submit Behavior', () => {
    it('calls onSubmit with trimmed message when send button is clicked', () => {
      const handleSubmit = jest.fn();
      render(<ChatInput onSubmit={handleSubmit} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      fireEvent.change(textarea, { target: { value: '  Find blue sofas  ' } });
      fireEvent.click(screen.getByLabelText('Send message'));

      expect(handleSubmit).toHaveBeenCalledWith('Find blue sofas');
    });

    it('calls onSubmit when Enter is pressed', () => {
      const handleSubmit = jest.fn();
      render(<ChatInput onSubmit={handleSubmit} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      fireEvent.change(textarea, { target: { value: 'Test query' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(handleSubmit).toHaveBeenCalledWith('Test query');
    });

    it('does not submit when Shift+Enter is pressed (allows new line)', () => {
      const handleSubmit = jest.fn();
      render(<ChatInput onSubmit={handleSubmit} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      fireEvent.change(textarea, { target: { value: 'Test query' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('does not submit empty message', () => {
      const handleSubmit = jest.fn();
      render(<ChatInput onSubmit={handleSubmit} data-testid="chat-input" />);

      fireEvent.click(screen.getByLabelText('Send message'));
      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('does not submit whitespace-only message', () => {
      const handleSubmit = jest.fn();
      render(<ChatInput onSubmit={handleSubmit} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      fireEvent.change(textarea, { target: { value: '   ' } });
      fireEvent.click(screen.getByLabelText('Send message'));

      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('disables textarea when disabled prop is true', () => {
      render(<ChatInput onSubmit={() => {}} disabled={true} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');
      expect(textarea).toBeDisabled();
    });

    it('disables textarea when isLoading is true', () => {
      render(<ChatInput onSubmit={() => {}} isLoading={true} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');
      expect(textarea).toBeDisabled();
    });

    it('does not submit when disabled', () => {
      const handleSubmit = jest.fn();
      render(<ChatInput onSubmit={handleSubmit} disabled={true} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      // Force a value (simulating programmatic change)
      fireEvent.change(textarea, { target: { value: 'Test' } });
      fireEvent.click(screen.getByLabelText('Send message'));

      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when isLoading is true', () => {
      render(<ChatInput onSubmit={() => {}} isLoading={true} data-testid="chat-input" />);
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('shows send icon when not loading', () => {
      render(<ChatInput onSubmit={() => {}} isLoading={false} data-testid="chat-input" />);
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('Send Button State', () => {
    it('send button is disabled when input is empty', () => {
      render(<ChatInput onSubmit={() => {}} data-testid="chat-input" />);
      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton).toBeDisabled();
    });

    it('send button is enabled when input has content', () => {
      render(<ChatInput onSubmit={() => {}} data-testid="chat-input" />);
      const textarea = screen.getByTestId('chat-input-textarea');

      fireEvent.change(textarea, { target: { value: 'Hello' } });
      const sendButton = screen.getByLabelText('Send message');
      expect(sendButton).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('send button has aria-label', () => {
      render(<ChatInput onSubmit={() => {}} />);
      expect(screen.getByLabelText('Send message')).toBeInTheDocument();
    });

    it('supports data-testid prop', () => {
      render(<ChatInput onSubmit={() => {}} data-testid="test-input" />);
      expect(screen.getByTestId('test-input')).toBeInTheDocument();
      expect(screen.getByTestId('test-input-textarea')).toBeInTheDocument();
      expect(screen.getByTestId('test-input-send')).toBeInTheDocument();
    });
  });
});
