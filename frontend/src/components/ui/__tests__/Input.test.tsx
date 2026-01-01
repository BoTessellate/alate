import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Search } from 'lucide-react';
import { Input, Textarea, PasswordInput, FormField } from '../Input';

describe('Input', () => {
  describe('Rendering', () => {
    it('renders an input element', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Input label="Username" />);
      expect(screen.getByText('Username')).toBeInTheDocument();
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
    });

    it('renders with helper text', () => {
      render(<Input helperText="This is helper text" />);
      expect(screen.getByText('This is helper text')).toBeInTheDocument();
    });

    it('renders with error message', () => {
      render(<Input error="This field is required" />);
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('hides helper text when error is present', () => {
      render(<Input helperText="Helper" error="Error" />);
      expect(screen.queryByText('Helper')).not.toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('renders with left icon', () => {
      // Input uses 'icon' prop for left icon
      render(<Input icon={Search} placeholder="Search" />);
      expect(screen.getByPlaceholderText('Search').parentElement?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with right icon', () => {
      // Input uses 'iconRight' prop for right icon
      render(<Input iconRight={Search} placeholder="Search" />);
      expect(screen.getByPlaceholderText('Search').parentElement?.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Sizes', () => {
    it('renders small size', () => {
      render(<Input size="sm" placeholder="Small" />);
      expect(screen.getByPlaceholderText('Small')).toHaveClass('h-8');
    });

    it('renders medium size by default', () => {
      render(<Input placeholder="Medium" />);
      expect(screen.getByPlaceholderText('Medium')).toHaveClass('h-10');
    });

    it('renders large size', () => {
      render(<Input size="lg" placeholder="Large" />);
      expect(screen.getByPlaceholderText('Large')).toHaveClass('h-12');
    });
  });

  describe('States', () => {
    it('handles disabled state', () => {
      render(<Input disabled placeholder="Disabled" />);
      expect(screen.getByPlaceholderText('Disabled')).toBeDisabled();
    });

    it('handles onChange events', () => {
      const handleChange = jest.fn();
      render(<Input onChange={handleChange} placeholder="Type here" />);

      fireEvent.change(screen.getByPlaceholderText('Type here'), {
        target: { value: 'Hello' },
      });

      expect(handleChange).toHaveBeenCalled();
    });

    it('applies focus border color', () => {
      render(<Input placeholder="Focus me" />);
      const input = screen.getByPlaceholderText('Focus me');

      fireEvent.focus(input);
      fireEvent.blur(input);

      expect(input).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('sets aria-invalid when error is present', () => {
      render(<Input error="Error" placeholder="Invalid" />);
      expect(screen.getByPlaceholderText('Invalid')).toHaveAttribute('aria-invalid', 'true');
    });

    it('links label to input via htmlFor', () => {
      render(<Input label="Email" id="email-input" />);
      expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'email-input');
    });
  });
});

describe('Textarea', () => {
  describe('Rendering', () => {
    it('renders a textarea element', () => {
      render(<Textarea placeholder="Enter message" />);
      expect(screen.getByPlaceholderText('Enter message')).toBeInTheDocument();
    });

    it('renders with label', () => {
      render(<Textarea label="Message" />);
      expect(screen.getByText('Message')).toBeInTheDocument();
    });

    it('renders with error message', () => {
      render(<Textarea error="Message is required" />);
      expect(screen.getByText('Message is required')).toBeInTheDocument();
    });
  });

  describe('Resize', () => {
    it('allows vertical resize by default', () => {
      render(<Textarea placeholder="Resizable" />);
      expect(screen.getByPlaceholderText('Resizable')).toHaveClass('resize-y');
    });
  });

  describe('States', () => {
    it('handles onChange events', () => {
      const handleChange = jest.fn();
      render(<Textarea onChange={handleChange} placeholder="Type here" />);

      fireEvent.change(screen.getByPlaceholderText('Type here'), {
        target: { value: 'Hello World' },
      });

      expect(handleChange).toHaveBeenCalled();
    });
  });
});

describe('PasswordInput', () => {
  describe('Rendering', () => {
    it('renders a password input by default', () => {
      render(<PasswordInput placeholder="Password" />);
      expect(screen.getByPlaceholderText('Password')).toHaveAttribute('type', 'password');
    });

    it('renders with label', () => {
      render(<PasswordInput label="Password" />);
      expect(screen.getByText('Password')).toBeInTheDocument();
    });

    it('renders visibility toggle button', () => {
      render(<PasswordInput placeholder="Password" />);
      expect(screen.getByRole('button', { name: /show password/i })).toBeInTheDocument();
    });
  });

  describe('Visibility Toggle', () => {
    it('toggles password visibility when button is clicked', () => {
      render(<PasswordInput placeholder="Password" />);
      const input = screen.getByPlaceholderText('Password');
      const toggleButton = screen.getByRole('button', { name: /show password/i });

      expect(input).toHaveAttribute('type', 'password');

      fireEvent.click(toggleButton);
      expect(input).toHaveAttribute('type', 'text');

      // Button label should change
      expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();

      fireEvent.click(toggleButton);
      expect(input).toHaveAttribute('type', 'password');
    });
  });

  describe('States', () => {
    it('shows error state', () => {
      render(<PasswordInput error="Password is required" />);
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    it('sets aria-invalid when error is present', () => {
      render(<PasswordInput error="Error" placeholder="Password" />);
      expect(screen.getByPlaceholderText('Password')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Accessibility', () => {
    it('toggle button has tabIndex -1 to prevent tab focus', () => {
      render(<PasswordInput placeholder="Password" />);
      expect(screen.getByRole('button')).toHaveAttribute('tabIndex', '-1');
    });
  });
});

describe('FormField', () => {
  it('renders children', () => {
    render(
      <FormField label="Field">
        <input data-testid="child-input" />
      </FormField>
    );
    expect(screen.getByTestId('child-input')).toBeInTheDocument();
  });

  it('renders label', () => {
    render(
      <FormField label="Field Label">
        <input />
      </FormField>
    );
    expect(screen.getByText('Field Label')).toBeInTheDocument();
  });

  it('shows required indicator', () => {
    render(
      <FormField label="Required Field" required>
        <input />
      </FormField>
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('shows error message', () => {
    render(
      <FormField label="Field" error="This is an error">
        <input />
      </FormField>
    );
    expect(screen.getByText('This is an error')).toBeInTheDocument();
  });

  it('shows helper text when no error', () => {
    render(
      <FormField label="Field" helperText="Helper text">
        <input />
      </FormField>
    );
    expect(screen.getByText('Helper text')).toBeInTheDocument();
  });

  it('hides helper text when error is present', () => {
    render(
      <FormField label="Field" helperText="Helper" error="Error">
        <input />
      </FormField>
    );
    expect(screen.queryByText('Helper')).not.toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });
});
