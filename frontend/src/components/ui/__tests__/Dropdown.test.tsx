import { render, screen, fireEvent } from '@testing-library/react';
import {
  Dropdown,
  DropdownMenu,
  DropdownItem,
  DropdownTrigger,
} from '../Dropdown';

describe('Dropdown', () => {
  describe('DropdownItem', () => {
    it('renders without crashing when used standalone (outside Dropdown)', () => {
      // This was the bug - DropdownItem would crash without Dropdown wrapper
      expect(() => {
        render(
          <DropdownItem onClick={() => {}}>
            Test Item
          </DropdownItem>
        );
      }).not.toThrow();
    });

    it('renders with correct text', () => {
      render(
        <DropdownItem onClick={() => {}}>
          Rename
        </DropdownItem>
      );
      expect(screen.getByText('Rename')).toBeInTheDocument();
    });

    it('calls onClick handler when clicked (standalone)', () => {
      const handleClick = jest.fn();
      render(
        <DropdownItem onClick={handleClick}>
          Click Me
        </DropdownItem>
      );

      fireEvent.click(screen.getByRole('menuitem'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when disabled', () => {
      const handleClick = jest.fn();
      render(
        <DropdownItem onClick={handleClick} disabled>
          Disabled Item
        </DropdownItem>
      );

      fireEvent.click(screen.getByRole('menuitem'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('renders icon when provided', () => {
      render(
        <DropdownItem
          onClick={() => {}}
          icon={<span data-testid="test-icon">Icon</span>}
        >
          With Icon
        </DropdownItem>
      );
      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });

    it('applies destructive styling when variant is destructive', () => {
      render(
        <DropdownItem onClick={() => {}} variant="destructive">
          Delete
        </DropdownItem>
      );
      const item = screen.getByRole('menuitem');
      expect(item).toHaveStyle({ color: 'var(--error)' });
    });
  });

  describe('Dropdown with context', () => {
    it('renders DropdownItem within Dropdown context', () => {
      render(
        <Dropdown open={true} onOpenChange={() => {}}>
          <DropdownTrigger>
            <button>Open</button>
          </DropdownTrigger>
          <DropdownMenu>
            <DropdownItem onClick={() => {}}>Option 1</DropdownItem>
            <DropdownItem onClick={() => {}}>Option 2</DropdownItem>
          </DropdownMenu>
        </Dropdown>
      );

      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('closes dropdown when item clicked with closeOnClick=true', () => {
      const handleOpenChange = jest.fn();
      render(
        <Dropdown open={true} onOpenChange={handleOpenChange}>
          <DropdownTrigger>
            <button>Open</button>
          </DropdownTrigger>
          <DropdownMenu>
            <DropdownItem onClick={() => {}} closeOnClick={true}>
              Close On Click
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      );

      fireEvent.click(screen.getByText('Close On Click'));
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it('does not close dropdown when closeOnClick=false', () => {
      const handleOpenChange = jest.fn();
      render(
        <Dropdown open={true} onOpenChange={handleOpenChange}>
          <DropdownTrigger>
            <button>Open</button>
          </DropdownTrigger>
          <DropdownMenu>
            <DropdownItem onClick={() => {}} closeOnClick={false}>
              Stay Open
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      );

      fireEvent.click(screen.getByText('Stay Open'));
      // Should not call close since closeOnClick is false
      expect(handleOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('DropdownMenu', () => {
    it('does not render when dropdown is closed', () => {
      render(
        <Dropdown open={false} onOpenChange={() => {}}>
          <DropdownTrigger>
            <button>Open</button>
          </DropdownTrigger>
          <DropdownMenu>
            <DropdownItem onClick={() => {}}>Hidden</DropdownItem>
          </DropdownMenu>
        </Dropdown>
      );

      expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    });

    it('renders when dropdown is open', () => {
      render(
        <Dropdown open={true} onOpenChange={() => {}}>
          <DropdownTrigger>
            <button>Open</button>
          </DropdownTrigger>
          <DropdownMenu>
            <DropdownItem onClick={() => {}}>Visible</DropdownItem>
          </DropdownMenu>
        </Dropdown>
      );

      expect(screen.getByText('Visible')).toBeInTheDocument();
    });
  });
});
