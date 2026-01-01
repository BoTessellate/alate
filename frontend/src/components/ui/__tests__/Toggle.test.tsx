import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Toggle } from '../Toggle';

describe('Toggle', () => {
  describe('Rendering', () => {
    it('renders as a switch', () => {
      render(<Toggle checked={false} onChange={() => {}} />);
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });

    it('applies custom data-testid', () => {
      render(<Toggle checked={false} onChange={() => {}} data-testid="my-toggle" />);
      expect(screen.getByTestId('my-toggle')).toBeInTheDocument();
    });
  });

  describe('Checked State', () => {
    it('shows unchecked state with aria-checked false', () => {
      render(<Toggle checked={false} onChange={() => {}} />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    });

    it('shows checked state with aria-checked true', () => {
      render(<Toggle checked={true} onChange={() => {}} />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    });

    it('applies primary background color when checked', () => {
      render(<Toggle checked={true} onChange={() => {}} />);
      expect(screen.getByRole('switch')).toHaveStyle({ backgroundColor: 'var(--primary)' });
    });

    it('applies surface-light background when unchecked', () => {
      render(<Toggle checked={false} onChange={() => {}} />);
      expect(screen.getByRole('switch')).toHaveStyle({ backgroundColor: 'var(--surface-light)' });
    });
  });

  describe('Interaction', () => {
    it('calls onChange with inverted value when clicked', () => {
      const handleChange = jest.fn();
      render(<Toggle checked={false} onChange={handleChange} />);

      fireEvent.click(screen.getByRole('switch'));
      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it('calls onChange with false when checked toggle is clicked', () => {
      const handleChange = jest.fn();
      render(<Toggle checked={true} onChange={handleChange} />);

      fireEvent.click(screen.getByRole('switch'));
      expect(handleChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Disabled State', () => {
    it('does not call onChange when disabled', () => {
      const handleChange = jest.fn();
      render(<Toggle checked={false} onChange={handleChange} disabled />);

      fireEvent.click(screen.getByRole('switch'));
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('applies disabled styling', () => {
      render(<Toggle checked={false} onChange={() => {}} disabled />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveClass('opacity-50', 'cursor-not-allowed');
    });

    it('applies cursor-pointer when not disabled', () => {
      render(<Toggle checked={false} onChange={() => {}} />);
      expect(screen.getByRole('switch')).toHaveClass('cursor-pointer');
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      render(<Toggle checked={false} onChange={() => {}} size="sm" />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveClass('w-9', 'h-5');
    });

    it('renders medium size by default', () => {
      render(<Toggle checked={false} onChange={() => {}} />);
      const toggle = screen.getByRole('switch');
      expect(toggle).toHaveClass('w-11', 'h-6');
    });
  });

  describe('Thumb Position', () => {
    it('positions thumb on left when unchecked', () => {
      render(<Toggle checked={false} onChange={() => {}} />);
      const thumb = screen.getByRole('switch').querySelector('div');
      expect(thumb).toHaveStyle({ left: '4px' });
    });

    it('positions thumb on right when checked', () => {
      render(<Toggle checked={true} onChange={() => {}} />);
      const thumb = screen.getByRole('switch').querySelector('div');
      expect(thumb).toHaveStyle({ left: '20px' });
    });
  });

  describe('Accessibility', () => {
    it('has correct button type', () => {
      render(<Toggle checked={false} onChange={() => {}} />);
      expect(screen.getByRole('switch')).toHaveAttribute('type', 'button');
    });
  });
});
