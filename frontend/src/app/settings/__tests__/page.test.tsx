import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SettingsPage from '../page';

// Create a mutable store state for testing
let mockStoreState = {
  theme: 'system' as 'light' | 'dark' | 'system',
  emailNotifications: true,
  pushNotifications: false,
  agentModeEnabled: false,
  currencyDisplayMode: 'original' as 'original' | 'local',
  localCurrency: 'USD' as string,
  userName: null as string | null,
  isLoggedIn: false,
};

const mockSetTheme = jest.fn((theme) => {
  mockStoreState.theme = theme;
});
const mockSetEmailNotifications = jest.fn((enabled) => {
  mockStoreState.emailNotifications = enabled;
});
const mockSetPushNotifications = jest.fn((enabled) => {
  mockStoreState.pushNotifications = enabled;
});
const mockSetAgentMode = jest.fn((enabled) => {
  mockStoreState.agentModeEnabled = enabled;
});
const mockSetCurrencyDisplayMode = jest.fn();
const mockSetLocalCurrency = jest.fn();
const mockSetUserName = jest.fn();
const mockSetIsLoggedIn = jest.fn();

// Mock the Zustand store
jest.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: () => ({
    ...mockStoreState,
    setTheme: mockSetTheme,
    setEmailNotifications: mockSetEmailNotifications,
    setPushNotifications: mockSetPushNotifications,
    setAgentMode: mockSetAgentMode,
    setCurrencyDisplayMode: mockSetCurrencyDisplayMode,
    setLocalCurrency: mockSetLocalCurrency,
    setUserName: mockSetUserName,
    setIsLoggedIn: mockSetIsLoggedIn,
  }),
  Theme: {},
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Track if we're using fake timers
let usingFakeTimers = false;

describe('SettingsPage', () => {
  beforeEach(() => {
    // Reset store state
    mockStoreState = {
      theme: 'system',
      emailNotifications: true,
      pushNotifications: false,
      agentModeEnabled: false,
      currencyDisplayMode: 'original',
      localCurrency: 'USD',
      userName: null,
      isLoggedIn: false,
    };
    jest.clearAllMocks();
    usingFakeTimers = false;
  });

  afterEach(() => {
    // Only run timers if we're using fake timers
    if (usingFakeTimers) {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    }
    cleanup();
  });

  // Helper to enable fake timers for tests that need them
  const enableFakeTimers = () => {
    jest.useFakeTimers();
    usingFakeTimers = true;
  };

  describe('Rendering', () => {
    it('renders the settings page with all sections', () => {
      render(<SettingsPage />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Account')).toBeInTheDocument();
      expect(screen.getByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('Appearance')).toBeInTheDocument();
      expect(screen.getByText('Data & Privacy')).toBeInTheDocument();
    });

    it('displays user email', () => {
      render(<SettingsPage />);

      expect(screen.getByText('user@example.com')).toBeInTheDocument();
    });

    it('renders all theme options including system', () => {
      render(<SettingsPage />);

      expect(screen.getByTestId('theme-light')).toBeInTheDocument();
      expect(screen.getByTestId('theme-dark')).toBeInTheDocument();
      expect(screen.getByTestId('theme-system')).toBeInTheDocument();
    });
  });

  describe('Theme Selection', () => {
    it('defaults to system theme', () => {
      render(<SettingsPage />);

      const systemButton = screen.getByTestId('theme-system');
      expect(systemButton).toHaveStyle({ borderColor: 'var(--primary)' });
    });

    it('changes theme when clicking a theme option', async () => {
      render(<SettingsPage />);

      const darkButton = screen.getByTestId('theme-dark');
      fireEvent.click(darkButton);

      expect(mockSetTheme).toHaveBeenCalledWith('dark');

      await waitFor(() => {
        expect(screen.getByTestId('save-status')).toBeInTheDocument();
      });
    });
  });

  describe('Notification Toggles', () => {
    it('toggles email notifications', async () => {
      render(<SettingsPage />);

      const toggle = screen.getByTestId('email-notifications-toggle');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(toggle);

      expect(mockSetEmailNotifications).toHaveBeenCalledWith(false);
    });

    it('toggles push notifications', async () => {
      render(<SettingsPage />);

      const toggle = screen.getByTestId('push-notifications-toggle');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(toggle);

      expect(mockSetPushNotifications).toHaveBeenCalledWith(true);
    });
  });

  describe('Email Change Modal', () => {
    it('opens email change modal when clicking Change button', () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-email-btn'));

      expect(screen.getByTestId('email-modal')).toBeInTheDocument();
      expect(screen.getByText('Change Email')).toBeInTheDocument();
    });

    it('closes modal when clicking Cancel', () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-email-btn'));
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByTestId('email-modal')).not.toBeInTheDocument();
    });

    it('shows error when email is empty', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-email-btn'));
      fireEvent.click(screen.getByTestId('save-email-btn'));

      await waitFor(() => {
        expect(screen.getByText('Please enter a new email address')).toBeInTheDocument();
      });
    });

    it('shows error for invalid email', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-email-btn'));

      const emailInput = screen.getByTestId('new-email-input');
      await userEvent.type(emailInput, 'invalid-email');

      fireEvent.click(screen.getByTestId('save-email-btn'));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
      });
    });

    it('shows error when password is not provided', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-email-btn'));

      const emailInput = screen.getByTestId('new-email-input');
      await userEvent.type(emailInput, 'new@example.com');

      fireEvent.click(screen.getByTestId('save-email-btn'));

      await waitFor(() => {
        expect(screen.getByText('Please enter your current password to confirm')).toBeInTheDocument();
      });
    });

    it('successfully changes email with valid inputs', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-email-btn'));

      await userEvent.type(screen.getByTestId('new-email-input'), 'new@example.com');
      await userEvent.type(screen.getByTestId('email-password-input'), 'password123');

      fireEvent.click(screen.getByTestId('save-email-btn'));

      await waitFor(() => {
        expect(screen.getByText(/Email updated successfully/)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Password Change Modal', () => {
    it('opens password change modal when clicking Update button', () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-password-btn'));

      expect(screen.getByTestId('password-modal')).toBeInTheDocument();
      // Modal title
      expect(screen.getByRole('heading', { name: 'Update Password' })).toBeInTheDocument();
    });

    it('shows error when current password is empty', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-password-btn'));
      fireEvent.click(screen.getByTestId('save-password-btn'));

      await waitFor(() => {
        expect(screen.getByText('Please enter your current password')).toBeInTheDocument();
      });
    });

    it('shows error when new password is too short', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-password-btn'));

      await userEvent.type(screen.getByTestId('current-password-input'), 'oldpass');
      await userEvent.type(screen.getByTestId('new-password-input'), 'short');

      fireEvent.click(screen.getByTestId('save-password-btn'));

      await waitFor(() => {
        expect(screen.getByText('New password must be at least 8 characters')).toBeInTheDocument();
      });
    });

    it('shows error when passwords do not match', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-password-btn'));

      fireEvent.change(screen.getByTestId('current-password-input'), { target: { value: 'oldpassword' } });
      fireEvent.change(screen.getByTestId('new-password-input'), { target: { value: 'newpassword123' } });
      fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'differentpassword' } });

      fireEvent.click(screen.getByTestId('save-password-btn'));

      await waitFor(() => {
        expect(screen.getByText('New passwords do not match')).toBeInTheDocument();
      });
    });

    it('successfully changes password with valid inputs', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-password-btn'));

      fireEvent.change(screen.getByTestId('current-password-input'), { target: { value: 'oldpassword' } });
      fireEvent.change(screen.getByTestId('new-password-input'), { target: { value: 'newpassword123' } });
      fireEvent.change(screen.getByTestId('confirm-password-input'), { target: { value: 'newpassword123' } });

      fireEvent.click(screen.getByTestId('save-password-btn'));

      await waitFor(() => {
        expect(screen.getByText('Password updated successfully!')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Delete Account Modal', () => {
    it('opens delete account modal', () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('delete-account-btn'));

      expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
      // Modal title
      expect(screen.getByRole('heading', { name: 'Delete Account' })).toBeInTheDocument();
    });

    it('delete button is disabled until DELETE is typed', () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('delete-account-btn'));

      const deleteBtn = screen.getByTestId('confirm-delete-btn');
      expect(deleteBtn).toHaveStyle({ cursor: 'not-allowed' });
    });

    it('enables delete button when DELETE is typed', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('delete-account-btn'));

      await userEvent.type(screen.getByTestId('delete-confirm-input'), 'DELETE');

      const deleteBtn = screen.getByTestId('confirm-delete-btn');
      expect(deleteBtn).toHaveStyle({ cursor: 'pointer' });
    });

    it('auto-capitalizes delete confirmation input', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('delete-account-btn'));

      const input = screen.getByTestId('delete-confirm-input');
      await userEvent.type(input, 'delete');

      expect(input).toHaveValue('DELETE');
    });
  });

  describe('Export Data', () => {
    it('shows exporting state when clicked', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('export-data-btn'));

      expect(screen.getByText('Exporting...')).toBeInTheDocument();
    });

    it('creates and downloads export file', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('export-data-btn'));

      await waitFor(() => {
        expect(URL.createObjectURL).toHaveBeenCalled();
      }, { timeout: 3000 });
    });
  });

  describe('Sign Out', () => {
    it('shows signing out state when clicked', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('sign-out-btn'));

      expect(screen.getByText('Signing out...')).toBeInTheDocument();
    });
  });

  describe('Save Status Indicator', () => {
    it('shows saving status when preference is changed', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('email-notifications-toggle'));

      // Saving status appears immediately
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('shows saved status after saving completes', async () => {
      enableFakeTimers();
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('email-notifications-toggle'));

      // Advance timer to complete the 500ms save operation
      await act(async () => {
        jest.advanceTimersByTime(600);
      });

      expect(screen.getByText('Saved')).toBeInTheDocument();
    });
  });

  describe('Modal Closing', () => {
    it('closes modal when clicking outside', () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-email-btn'));
      expect(screen.getByTestId('email-modal')).toBeInTheDocument();

      // Click the backdrop (the fixed overlay div that contains the modal)
      // The backdrop is the parent element with the onClick={closeModal}
      const backdrop = screen.getByTestId('email-modal').parentElement;
      if (backdrop) {
        // Direct click on backdrop should close the modal
        fireEvent.click(backdrop);
      }

      expect(screen.queryByTestId('email-modal')).not.toBeInTheDocument();
    });

    it('closes modal when clicking X button', () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-password-btn'));
      expect(screen.getByTestId('password-modal')).toBeInTheDocument();

      // The X button is the first button inside the modal header
      const modal = screen.getByTestId('password-modal');
      const closeButton = modal.querySelector('button');
      if (closeButton) {
        fireEvent.click(closeButton);
      }

      expect(screen.queryByTestId('password-modal')).not.toBeInTheDocument();
    });

    it('resets form fields when modal closes', async () => {
      jest.useRealTimers();
      const user = userEvent.setup();
      render(<SettingsPage />);

      await user.click(screen.getByTestId('change-email-btn'));
      await user.type(screen.getByTestId('new-email-input'), 'test@example.com');

      await user.click(screen.getByText('Cancel'));

      // Reopen modal
      await user.click(screen.getByTestId('change-email-btn'));

      expect(screen.getByTestId('new-email-input')).toHaveValue('');
    });
  });

  describe('Password Visibility Toggle', () => {
    it('toggles password visibility', async () => {
      render(<SettingsPage />);

      fireEvent.click(screen.getByTestId('change-password-btn'));

      // Check initial state
      expect(screen.getByTestId('current-password-input')).toHaveAttribute('type', 'password');

      // The eye button is inside the parent wrapper of the password input
      const passwordInput = screen.getByTestId('current-password-input');
      const inputWrapper = passwordInput.parentElement;
      const eyeButton = inputWrapper?.querySelector('button');

      expect(eyeButton).toBeTruthy();

      // Click the eye button to toggle visibility
      fireEvent.click(eyeButton!);

      // Re-query the input element after state change and verify
      await waitFor(() => {
        expect(screen.getByTestId('current-password-input')).toHaveAttribute('type', 'text');
      });
    });
  });
});
