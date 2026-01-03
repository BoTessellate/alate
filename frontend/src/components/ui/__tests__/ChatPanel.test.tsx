import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatPanel, type Message } from '../ChatPanel';

// Mock scrollIntoView which is not available in jsdom
Element.prototype.scrollIntoView = jest.fn();

describe('ChatPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    title: 'Test Chat',
    messages: [] as Message[],
    onSendMessage: jest.fn(),
  };

  const mockMessages: Message[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Find me a blue sofa',
      timestamp: new Date('2024-01-15T10:00:00'),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'I found 3 blue sofas for you!',
      timestamp: new Date('2024-01-15T10:00:05'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      render(<ChatPanel {...defaultProps} data-testid="chat-panel" />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Chat')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<ChatPanel {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
      render(
        <ChatPanel
          {...defaultProps}
          subtitle="Describe what you're looking for"
        />
      );
      expect(screen.getByText("Describe what you're looking for")).toBeInTheDocument();
    });
  });

  describe('Welcome State', () => {
    it('shows welcome message when no messages', () => {
      render(
        <ChatPanel
          {...defaultProps}
          welcomeMessage="How can I help you today?"
        />
      );
      expect(screen.getByText('How can I help you today?')).toBeInTheDocument();
    });

    it('shows default welcome message when not provided', () => {
      render(<ChatPanel {...defaultProps} />);
      expect(screen.getByText('How can I help you find the perfect products?')).toBeInTheDocument();
    });

    it('renders suggested prompts when provided', () => {
      const prompts = ['Find blue sofas', 'Show mid-century modern'];
      render(<ChatPanel {...defaultProps} suggestedPrompts={prompts} />);

      expect(screen.getByText('Find blue sofas')).toBeInTheDocument();
      expect(screen.getByText('Show mid-century modern')).toBeInTheDocument();
    });

    it('clicking suggested prompt calls onSendMessage', () => {
      const handleSend = jest.fn();
      const prompts = ['Find blue sofas'];
      render(
        <ChatPanel
          {...defaultProps}
          suggestedPrompts={prompts}
          onSendMessage={handleSend}
        />
      );

      fireEvent.click(screen.getByText('Find blue sofas'));
      expect(handleSend).toHaveBeenCalledWith('Find blue sofas');
    });

    it('clicking suggested prompt calls onSuggestedPromptClick if provided', () => {
      const handleSend = jest.fn();
      const handlePromptClick = jest.fn();
      const prompts = ['Find blue sofas'];
      render(
        <ChatPanel
          {...defaultProps}
          suggestedPrompts={prompts}
          onSendMessage={handleSend}
          onSuggestedPromptClick={handlePromptClick}
        />
      );

      fireEvent.click(screen.getByText('Find blue sofas'));
      expect(handlePromptClick).toHaveBeenCalledWith('Find blue sofas');
      expect(handleSend).not.toHaveBeenCalled();
    });
  });

  describe('Messages Display', () => {
    it('renders all messages', () => {
      render(<ChatPanel {...defaultProps} messages={mockMessages} />);

      expect(screen.getByText('Find me a blue sofa')).toBeInTheDocument();
      expect(screen.getByText('I found 3 blue sofas for you!')).toBeInTheDocument();
    });

    it('does not show welcome message when there are messages', () => {
      render(
        <ChatPanel
          {...defaultProps}
          messages={mockMessages}
          welcomeMessage="Welcome!"
        />
      );
      expect(screen.queryByText('Welcome!')).not.toBeInTheDocument();
    });

    it('does not show suggested prompts when there are messages', () => {
      const prompts = ['Find blue sofas'];
      render(
        <ChatPanel
          {...defaultProps}
          messages={mockMessages}
          suggestedPrompts={prompts}
        />
      );
      // The prompt text appears in a message, but not as a prompt button
      const buttons = screen.getAllByRole('button');
      const promptButtons = buttons.filter(btn =>
        btn.textContent === 'Find blue sofas' &&
        btn.classList.contains('rounded-full') &&
        !btn.getAttribute('aria-label')
      );
      expect(promptButtons.length).toBe(0);
    });
  });

  describe('Loading State', () => {
    it('shows loading indicator when isLoading is true', () => {
      render(<ChatPanel {...defaultProps} messages={mockMessages} isLoading={true} />);
      const spinners = document.querySelectorAll('.animate-spin');
      expect(spinners.length).toBeGreaterThan(0);
    });

    it('shows bouncing dots when loading with messages', () => {
      render(<ChatPanel {...defaultProps} messages={mockMessages} isLoading={true} />);
      const bouncingDots = document.querySelectorAll('.animate-bounce');
      expect(bouncingDots.length).toBe(3);
    });
  });

  describe('Input Integration', () => {
    it('renders chat input', () => {
      render(<ChatPanel {...defaultProps} data-testid="chat-panel" />);
      expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    });

    it('uses custom inputPlaceholder', () => {
      render(
        <ChatPanel
          {...defaultProps}
          inputPlaceholder="Search for furniture..."
        />
      );
      expect(screen.getByPlaceholderText('Search for furniture...')).toBeInTheDocument();
    });

    it('uses default inputPlaceholder', () => {
      render(<ChatPanel {...defaultProps} />);
      expect(screen.getByPlaceholderText('Ask about products...')).toBeInTheDocument();
    });

    it('calls onSendMessage when message is submitted', () => {
      const handleSend = jest.fn();
      render(<ChatPanel {...defaultProps} onSendMessage={handleSend} />);

      const textarea = screen.getByTestId('chat-input-textarea');
      fireEvent.change(textarea, { target: { value: 'Find red chairs' } });
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

      expect(handleSend).toHaveBeenCalledWith('Find red chairs');
    });

    it('passes isLoading to ChatInput', () => {
      render(<ChatPanel {...defaultProps} isLoading={true} />);
      const textarea = screen.getByTestId('chat-input-textarea');
      expect(textarea).toBeDisabled();
    });
  });

  describe('Panel Features', () => {
    it('calls onClose when close button is clicked', () => {
      const handleClose = jest.fn();
      render(<ChatPanel {...defaultProps} onClose={handleClose} />);

      fireEvent.click(screen.getByLabelText('Close panel'));
      expect(handleClose).toHaveBeenCalled();
    });

    it('supports mode toggle from ExpandablePanel', () => {
      render(<ChatPanel {...defaultProps} />);

      // Initially in compact mode
      expect(screen.getByLabelText('Expand panel')).toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByLabelText('Expand panel'));
      expect(screen.getByLabelText('Collapse panel')).toBeInTheDocument();
    });

    it('calls onModeChange when mode is toggled', () => {
      const handleModeChange = jest.fn();
      render(<ChatPanel {...defaultProps} onModeChange={handleModeChange} />);

      fireEvent.click(screen.getByLabelText('Expand panel'));
      expect(handleModeChange).toHaveBeenCalledWith('expanded');
    });
  });

  describe('Accessibility', () => {
    it('has dialog role', () => {
      render(<ChatPanel {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('is modal', () => {
      render(<ChatPanel {...defaultProps} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('supports data-testid prop', () => {
      render(<ChatPanel {...defaultProps} data-testid="product-finder-chat" />);
      expect(screen.getByTestId('product-finder-chat')).toBeInTheDocument();
    });
  });
});
