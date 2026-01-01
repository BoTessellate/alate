import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { FolderOpen, Plus } from 'lucide-react';
import { EmptyState, InlineEmptyState } from '../EmptyState';

describe('EmptyState', () => {
  describe('Rendering', () => {
    it('renders title', () => {
      render(<EmptyState title="No items found" />);
      expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    it('renders description', () => {
      render(
        <EmptyState
          title="No items"
          description="Create your first item to get started"
        />
      );
      expect(screen.getByText('Create your first item to get started')).toBeInTheDocument();
    });

    it('renders icon', () => {
      render(<EmptyState title="No items" icon={FolderOpen} />);
      expect(document.querySelector('svg')).toBeInTheDocument();
    });

    it('renders without icon', () => {
      render(<EmptyState title="No items" />);
      // The container should still render without icon
      expect(screen.getByText('No items')).toBeInTheDocument();
    });

    it('renders children', () => {
      render(
        <EmptyState title="No items">
          <p>Custom content</p>
        </EmptyState>
      );
      expect(screen.getByText('Custom content')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('renders primary action button', () => {
      const handleClick = jest.fn();
      render(
        <EmptyState
          title="No items"
          action={{
            label: 'Create Item',
            onClick: handleClick,
          }}
        />
      );

      const button = screen.getByRole('button', { name: 'Create Item' });
      expect(button).toBeInTheDocument();

      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalled();
    });

    it('renders action button with icon', () => {
      render(
        <EmptyState
          title="No items"
          action={{
            label: 'Add New',
            onClick: () => {},
            icon: Plus,
          }}
        />
      );

      const button = screen.getByRole('button', { name: 'Add New' });
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('renders secondary action', () => {
      const handleSecondary = jest.fn();
      render(
        <EmptyState
          title="No items"
          action={{
            label: 'Primary',
            onClick: () => {},
          }}
          secondaryAction={{
            label: 'Learn More',
            onClick: handleSecondary,
          }}
        />
      );

      const secondaryButton = screen.getByRole('button', { name: 'Learn More' });
      expect(secondaryButton).toBeInTheDocument();

      fireEvent.click(secondaryButton);
      expect(handleSecondary).toHaveBeenCalled();
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      render(<EmptyState title="Small" size="sm" />);
      const container = screen.getByText('Small').parentElement;
      expect(container).toHaveClass('py-8');
    });

    it('renders medium size by default', () => {
      render(<EmptyState title="Medium" />);
      const container = screen.getByText('Medium').parentElement;
      expect(container).toHaveClass('py-12');
    });

    it('renders large size', () => {
      render(<EmptyState title="Large" size="lg" />);
      const container = screen.getByText('Large').parentElement;
      expect(container).toHaveClass('py-20');
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      render(<EmptyState title="Custom" className="custom-class" />);
      expect(screen.getByText('Custom').parentElement).toHaveClass('custom-class');
    });

    it('centers text', () => {
      render(<EmptyState title="Centered" />);
      expect(screen.getByText('Centered').parentElement).toHaveClass('text-center');
    });
  });
});

describe('InlineEmptyState', () => {
  describe('Rendering', () => {
    it('renders message', () => {
      render(<InlineEmptyState message="No results" />);
      expect(screen.getByText('No results')).toBeInTheDocument();
    });

    it('renders icon', () => {
      render(<InlineEmptyState message="No results" icon={FolderOpen} />);
      expect(document.querySelector('svg')).toBeInTheDocument();
    });

    it('renders without icon', () => {
      render(<InlineEmptyState message="No results" />);
      expect(screen.getByText('No results')).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('renders action button', () => {
      const handleClick = jest.fn();
      render(
        <InlineEmptyState
          message="No results"
          action={{
            label: 'Create One',
            onClick: handleClick,
          }}
        />
      );

      const button = screen.getByRole('button', { name: 'Create One' });
      expect(button).toBeInTheDocument();

      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      render(<InlineEmptyState message="Custom" className="inline-custom" />);
      expect(screen.getByText('Custom').parentElement).toHaveClass('inline-custom');
    });

    it('uses flex layout', () => {
      render(<InlineEmptyState message="Flex" />);
      expect(screen.getByText('Flex').parentElement).toHaveClass('flex', 'items-center');
    });
  });
});
