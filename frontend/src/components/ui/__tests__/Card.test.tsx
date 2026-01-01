import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Card, CardHeader, CardContent, CardFooter } from '../Card';

describe('Card', () => {
  describe('Rendering', () => {
    it('renders children', () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(<Card className="custom-class">Content</Card>);
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('applies custom style', () => {
      const { container } = render(<Card style={{ maxWidth: '300px' }}>Content</Card>);
      expect(container.firstChild).toHaveStyle({ maxWidth: '300px' });
    });
  });

  describe('Variants', () => {
    it('renders default variant', () => {
      const { container } = render(<Card>Default</Card>);
      expect(container.firstChild).toHaveStyle({ backgroundColor: 'var(--surface)' });
    });

    it('renders interactive variant with cursor pointer', () => {
      const { container } = render(<Card variant="interactive">Interactive</Card>);
      expect(container.firstChild).toHaveStyle({ cursor: 'pointer' });
    });

    it('renders elevated variant', () => {
      const { container } = render(<Card variant="elevated">Elevated</Card>);
      expect(container.firstChild).toHaveStyle({ backgroundColor: 'var(--surface)' });
    });
  });

  describe('Padding', () => {
    it('applies no padding by default', () => {
      const { container } = render(<Card>No padding</Card>);
      expect(container.firstChild).not.toHaveClass('p-4');
      expect(container.firstChild).not.toHaveClass('p-3');
      expect(container.firstChild).not.toHaveClass('p-6');
    });

    it('applies small padding', () => {
      const { container } = render(<Card padding="sm">Small padding</Card>);
      expect(container.firstChild).toHaveClass('p-3');
    });

    it('applies medium padding', () => {
      const { container } = render(<Card padding="md">Medium padding</Card>);
      expect(container.firstChild).toHaveClass('p-4');
    });

    it('applies large padding', () => {
      const { container } = render(<Card padding="lg">Large padding</Card>);
      expect(container.firstChild).toHaveClass('p-6');
    });
  });

  describe('Hover Highlight', () => {
    it('applies hover highlight by default', () => {
      const { container } = render(<Card>With highlight</Card>);
      const card = container.firstChild as HTMLElement;

      // Initial state
      expect(card).toHaveStyle({ borderColor: 'var(--border)' });

      // Hover state - hoverHighlight is true by default
      fireEvent.mouseEnter(card);
      expect(card).toHaveStyle({ borderColor: 'var(--primary)' });

      // Mouse leave
      fireEvent.mouseLeave(card);
      expect(card).toHaveStyle({ borderColor: 'var(--border)' });
    });

    it('does not apply hover highlight when disabled', () => {
      const { container } = render(<Card hoverHighlight={false}>No highlight</Card>);
      const card = container.firstChild as HTMLElement;

      fireEvent.mouseEnter(card);
      expect(card).toHaveStyle({ borderColor: 'var(--border)' });
    });
  });

  describe('Click Handler', () => {
    it('calls onClick when clicked', () => {
      const handleClick = jest.fn();
      const { container } = render(<Card onClick={handleClick}>Clickable</Card>);

      fireEvent.click(container.firstChild as HTMLElement);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('adds button role when onClick is provided', () => {
      const { container } = render(<Card onClick={() => {}}>Clickable</Card>);
      expect(container.firstChild).toHaveAttribute('role', 'button');
    });

    it('supports keyboard navigation when onClick is provided', () => {
      const handleClick = jest.fn();
      const { container } = render(<Card onClick={handleClick}>Clickable</Card>);
      const card = container.firstChild as HTMLElement;

      fireEvent.keyDown(card, { key: 'Enter' });
      expect(handleClick).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(card, { key: ' ' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });
  });
});

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header content</CardHeader>);
    expect(screen.getByText('Header content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<CardHeader className="custom-header">Header</CardHeader>);
    expect(container.firstChild).toHaveClass('custom-header');
  });

  it('has border-b class', () => {
    const { container } = render(<CardHeader>Header</CardHeader>);
    expect(container.firstChild).toHaveClass('border-b');
  });
});

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Body content</CardContent>);
    expect(screen.getByText('Body content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<CardContent className="custom-content">Content</CardContent>);
    expect(container.firstChild).toHaveClass('custom-content');
  });

  it('has p-4 padding', () => {
    const { container } = render(<CardContent>Content</CardContent>);
    expect(container.firstChild).toHaveClass('p-4');
  });
});

describe('CardFooter', () => {
  it('renders children', () => {
    render(<CardFooter>Footer content</CardFooter>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<CardFooter className="custom-footer">Footer</CardFooter>);
    expect(container.firstChild).toHaveClass('custom-footer');
  });

  it('has border-t class', () => {
    const { container } = render(<CardFooter>Footer</CardFooter>);
    expect(container.firstChild).toHaveClass('border-t');
  });
});
