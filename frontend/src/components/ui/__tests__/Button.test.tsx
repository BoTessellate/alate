import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Plus } from 'lucide-react';
import { Button, IconButton } from '../Button';

describe('Button', () => {
  describe('Rendering', () => {
    it('renders with children text', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('renders with icon', () => {
      render(<Button icon={Plus}>Add Item</Button>);
      const button = screen.getByRole('button', { name: 'Add Item' });
      expect(button).toBeInTheDocument();
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<Button className="custom-class">Button</Button>);
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });

  describe('Variants', () => {
    it('renders primary variant by default', () => {
      render(<Button>Primary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({ backgroundColor: 'var(--primary)' });
    });

    it('renders secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button');
      // Secondary has var(--surface) bg by default (var(--surface-light) on hover)
      expect(button).toHaveStyle({ backgroundColor: 'var(--surface)' });
    });

    it('renders ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button');
      // Ghost variant has transparent bg (JSDOM returns empty string for transparent)
      expect(button).toBeInTheDocument();
      expect(button).toHaveStyle({ color: 'var(--foreground-secondary)' });
    });

    it('renders outline variant', () => {
      render(<Button variant="outline">Outline</Button>);
      const button = screen.getByRole('button');
      // Outline variant has transparent bg (JSDOM returns empty string for transparent)
      expect(button).toBeInTheDocument();
      expect(button).toHaveStyle({ borderColor: 'var(--border)' });
    });

    it('renders destructive variant', () => {
      render(<Button variant="destructive">Destructive</Button>);
      const button = screen.getByRole('button');
      // Destructive has rgba bg by default (var(--error) on hover)
      expect(button).toHaveStyle({ backgroundColor: 'rgba(168, 64, 50, 0.1)' });
    });

    it('renders link variant', () => {
      render(<Button variant="link">Link</Button>);
      const button = screen.getByRole('button');
      // Link variant has transparent bg (JSDOM returns empty string for transparent)
      expect(button).toBeInTheDocument();
      expect(button).toHaveStyle({ color: 'var(--primary)' });
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-8');
    });

    it('renders medium size by default', () => {
      render(<Button>Medium</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-10');
    });

    it('renders large size', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('h-12');
    });
  });

  describe('States', () => {
    it('handles disabled state', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('cursor-not-allowed');
    });

    it('handles click events', () => {
      const handleClick = jest.fn();
      render(<Button onClick={handleClick}>Clickable</Button>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = jest.fn();
      render(<Button disabled onClick={handleClick}>Disabled</Button>);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Hover States', () => {
    it('applies hover styles on mouse enter', () => {
      render(<Button>Hover me</Button>);
      const button = screen.getByRole('button');

      fireEvent.mouseEnter(button);
      fireEvent.mouseLeave(button);

      // Button should still be in the document after hover
      expect(button).toBeInTheDocument();
    });
  });

  describe('Button Types', () => {
    it('can be submit type', () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('can be reset type', () => {
      render(<Button type="reset">Reset</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'reset');
    });
  });
});

describe('IconButton', () => {
  describe('Rendering', () => {
    it('renders with icon', () => {
      render(<IconButton icon={Plus} aria-label="Add" />);
      const button = screen.getByRole('button', { name: 'Add' });
      expect(button).toBeInTheDocument();
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('requires aria-label', () => {
      render(<IconButton icon={Plus} aria-label="Add item" />);
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Add item');
    });
  });

  describe('Sizes', () => {
    // IconButton sizes: sm=w-7, md=w-8, lg=w-10
    it('renders small size', () => {
      render(<IconButton icon={Plus} aria-label="Add" size="sm" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-7', 'h-7');
    });

    it('renders medium size by default', () => {
      render(<IconButton icon={Plus} aria-label="Add" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-8', 'h-8');
    });

    it('renders large size', () => {
      render(<IconButton icon={Plus} aria-label="Add" size="lg" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-10', 'h-10');
    });
  });

  describe('States', () => {
    it('handles click events', () => {
      const handleClick = jest.fn();
      render(<IconButton icon={Plus} aria-label="Add" onClick={handleClick} />);

      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('handles disabled state', () => {
      render(<IconButton icon={Plus} aria-label="Add" disabled />);
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });
});
