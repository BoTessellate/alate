import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ChatMessage } from '../ChatMessage';

describe('ChatMessage', () => {
  describe('User Messages', () => {
    it('renders user message with correct content', () => {
      render(
        <ChatMessage
          role="user"
          content="Find me a blue sofa"
          data-testid="user-message"
        />
      );
      expect(screen.getByText('Find me a blue sofa')).toBeInTheDocument();
    });

    it('renders user message with right alignment', () => {
      render(
        <ChatMessage
          role="user"
          content="Test message"
          data-testid="user-message"
        />
      );
      const container = screen.getByTestId('user-message');
      expect(container).toHaveClass('flex-row-reverse');
    });

    it('renders user avatar with User icon styling', () => {
      render(
        <ChatMessage
          role="user"
          content="Test message"
        />
      );
      // User messages have a user icon in a circle
      const avatars = document.querySelectorAll('.rounded-full');
      expect(avatars.length).toBeGreaterThan(0);
    });
  });

  describe('Assistant Messages', () => {
    it('renders assistant message with correct content', () => {
      render(
        <ChatMessage
          role="assistant"
          content="I found 3 sofas matching your criteria"
          data-testid="assistant-message"
        />
      );
      expect(screen.getByText('I found 3 sofas matching your criteria')).toBeInTheDocument();
    });

    it('renders assistant message with left alignment', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Test response"
          data-testid="assistant-message"
        />
      );
      const container = screen.getByTestId('assistant-message');
      expect(container).toHaveClass('flex-row');
      expect(container).not.toHaveClass('flex-row-reverse');
    });

    it('shows streaming indicator when isStreaming is true', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Generating..."
          isStreaming={true}
        />
      );
      // Streaming indicator is a Loader2 with animate-spin class
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('does not show streaming indicator when isStreaming is false', () => {
      render(
        <ChatMessage
          role="assistant"
          content="Complete message"
          isStreaming={false}
        />
      );
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).not.toBeInTheDocument();
    });
  });

  describe('System Messages', () => {
    it('renders system message with centered styling', () => {
      render(
        <ChatMessage
          role="system"
          content="Chat started"
          data-testid="system-message"
        />
      );
      const container = screen.getByTestId('system-message');
      expect(container).toHaveClass('justify-center');
    });

    it('renders system message content in a pill shape', () => {
      render(
        <ChatMessage
          role="system"
          content="System notification"
        />
      );
      expect(screen.getByText('System notification')).toBeInTheDocument();
    });
  });

  describe('Timestamp', () => {
    it('renders timestamp when provided', () => {
      const testDate = new Date('2024-01-15T10:30:00');
      render(
        <ChatMessage
          role="user"
          content="Test message"
          timestamp={testDate}
        />
      );
      // Time should be formatted like "10:30 AM"
      expect(screen.getByText(/10:30 AM/)).toBeInTheDocument();
    });

    it('does not render timestamp when not provided', () => {
      render(
        <ChatMessage
          role="user"
          content="Test message"
        />
      );
      // No timestamp elements should be present
      const timeElements = document.querySelectorAll('.text-xs.mt-1');
      expect(timeElements.length).toBe(0);
    });
  });

  describe('Props', () => {
    it('supports data-testid prop', () => {
      render(
        <ChatMessage
          role="user"
          content="Test"
          data-testid="custom-message"
        />
      );
      expect(screen.getByTestId('custom-message')).toBeInTheDocument();
    });

    it('accepts ReactNode as content', () => {
      render(
        <ChatMessage
          role="assistant"
          content={<strong>Bold content</strong>}
        />
      );
      expect(screen.getByText('Bold content')).toBeInTheDocument();
    });
  });
});
