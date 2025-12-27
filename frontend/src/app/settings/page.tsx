'use client';

import { useState } from 'react';
import {
  User,
  Bell,
  Palette,
  Shield,
  Trash2,
  Moon,
  Sun,
  Monitor,
  Check,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Download,
  LogOut,
  X,
  Eye,
  EyeOff,
  DollarSign,
} from 'lucide-react';
import { useSettingsStore, Theme, CurrencyDisplayMode, LocalCurrency } from '@/stores/useSettingsStore';
import { DISPLAY_CURRENCIES, getCurrencySymbol } from '@/utils/currency';

type ModalType = 'email' | 'password' | 'delete' | null;

export default function SettingsPage() {
  // Get persisted settings from Zustand store
  const {
    theme,
    emailNotifications,
    pushNotifications,
    currencyDisplayMode,
    localCurrency,
    setTheme,
    setEmailNotifications,
    setPushNotifications,
    setCurrencyDisplayMode,
    setLocalCurrency,
  } = useSettingsStore();
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Form states
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock user data - replace with actual auth
  const [user, setUser] = useState({
    email: 'user@example.com',
    name: 'Demo User',
    createdAt: '2024-01-15',
    lastPasswordChange: null as string | null,
  });

  const updateTheme = async (newTheme: Theme) => {
    setSaveStatus('saving');
    setTheme(newTheme);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const updateEmailNotifications = async (value: boolean) => {
    setSaveStatus('saving');
    setEmailNotifications(value);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const updatePushNotifications = async (value: boolean) => {
    setSaveStatus('saving');
    setPushNotifications(value);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const updateCurrencyDisplayMode = async (mode: CurrencyDisplayMode) => {
    setSaveStatus('saving');
    setCurrencyDisplayMode(mode);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const updateLocalCurrency = async (currency: LocalCurrency) => {
    setSaveStatus('saving');
    setLocalCurrency(currency);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const exportData = {
        user: {
          email: user.email,
          createdAt: user.createdAt,
        },
        preferences: {
          theme,
          emailNotifications,
          pushNotifications,
          currencyDisplayMode,
          localCurrency,
        },
        looks: [],
        collections: [],
        exportedAt: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mood-layer-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out failed:', error);
      setIsSigningOut(false);
    }
  };

  const handleEmailChange = async () => {
    setFormError('');
    setFormSuccess('');

    if (!newEmail.trim()) {
      setFormError('Please enter a new email address');
      return;
    }
    if (!newEmail.includes('@')) {
      setFormError('Please enter a valid email address');
      return;
    }
    if (!emailPassword) {
      setFormError('Please enter your current password to confirm');
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Simulate success
      setUser((prev) => ({ ...prev, email: newEmail }));
      setFormSuccess('Email updated successfully! Please check your new email for verification.');
      setNewEmail('');
      setEmailPassword('');

      setTimeout(() => {
        setActiveModal(null);
        setFormSuccess('');
      }, 2000);
    } catch (error) {
      setFormError('Failed to update email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordChange = async () => {
    setFormError('');
    setFormSuccess('');

    if (!currentPassword) {
      setFormError('Please enter your current password');
      return;
    }
    if (!newPassword) {
      setFormError('Please enter a new password');
      return;
    }
    if (newPassword.length < 8) {
      setFormError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError('New passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setUser((prev) => ({ ...prev, lastPasswordChange: new Date().toISOString() }));
      setFormSuccess('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        setActiveModal(null);
        setFormSuccess('');
      }, 2000);
    } catch (error) {
      setFormError('Failed to update password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setIsDeleting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      window.location.href = '/';
    } catch (error) {
      console.error('Delete failed:', error);
      setIsDeleting(false);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setFormError('');
    setFormSuccess('');
    setDeleteConfirmText('');
    setNewEmail('');
    setEmailPassword('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const ToggleSwitch = ({
    enabled,
    onChange,
    testId,
  }: {
    enabled: boolean;
    onChange: (value: boolean) => void;
    testId?: string;
  }) => (
    <button
      data-testid={testId}
      onClick={() => onChange(!enabled)}
      className="relative w-11 h-6 rounded-full transition-colors"
      style={{
        backgroundColor: enabled ? 'var(--primary)' : 'var(--surface-light)',
      }}
      aria-pressed={enabled}
    >
      <div
        className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-200"
        style={{
          left: enabled ? '24px' : '4px',
        }}
      />
    </button>
  );

  const PasswordInput = ({
    value,
    onChange,
    placeholder,
    testId,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    testId?: string;
  }) => (
    <div className="relative focus-within:ring-1 focus-within:ring-[var(--primary)] rounded-lg">
      <input
        data-testid={testId}
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-3 pr-10 rounded-lg border outline-none focus:border-[var(--primary)]"
        style={{
          backgroundColor: 'var(--background)',
          borderColor: 'var(--border)',
          color: 'var(--foreground)',
        }}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-3 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--foreground-muted)' }}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--foreground)' }}>
          Settings
        </h1>
        <p style={{ color: 'var(--foreground-secondary)' }}>
          Manage your account and preferences.
        </p>
      </div>

      {/* Save Status */}
      {saveStatus !== 'idle' && (
        <div
          data-testid="save-status"
          className="fixed top-20 right-8 px-4 py-2 rounded-lg flex items-center gap-2 z-50"
          style={{
            backgroundColor: saveStatus === 'saved' ? 'var(--success)' : 'var(--surface)',
            color: 'white',
          }}
        >
          {saveStatus === 'saving' ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Saving...</span>
            </>
          ) : (
            <>
              <Check size={16} />
              <span className="text-sm">Saved</span>
            </>
          )}
        </div>
      )}

      <div className="space-y-6">
        {/* Account Section */}
        <section
          className="rounded-lg border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div
            className="p-4 border-b flex items-center gap-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}
            >
              <User size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                Account
              </h2>
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                Manage your profile information
              </p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                  Email
                </p>
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  {user.email}
                </p>
              </div>
              <button
                data-testid="change-email-btn"
                onClick={() => setActiveModal('email')}
                className="px-3 py-1.5 rounded-md text-sm transition-colors"
                style={{
                  backgroundColor: 'var(--surface-light)',
                  color: 'var(--foreground)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                }}
              >
                Change
              </button>
            </div>

            <div
              className="border-t pt-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                    Password
                  </p>
                  <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    Last changed: {formatDate(user.lastPasswordChange)}
                  </p>
                </div>
                <button
                  data-testid="change-password-btn"
                  onClick={() => setActiveModal('password')}
                  className="px-3 py-1.5 rounded-md text-sm transition-colors"
                  style={{
                    backgroundColor: 'var(--surface-light)',
                    color: 'var(--foreground)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--surface-light)';
                  }}
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section
          className="rounded-lg border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div
            className="p-4 border-b flex items-center gap-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}
            >
              <Bell size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                Notifications
              </h2>
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                Control how you receive updates
              </p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                  Email notifications
                </p>
                <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                  Receive updates about your looks and collections
                </p>
              </div>
              <ToggleSwitch
                testId="email-notifications-toggle"
                enabled={emailNotifications}
                onChange={updateEmailNotifications}
              />
            </div>

            <div
              className="border-t pt-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                    Push notifications
                  </p>
                  <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    Get browser notifications for activity
                  </p>
                </div>
                <ToggleSwitch
                  testId="push-notifications-toggle"
                  enabled={pushNotifications}
                  onChange={updatePushNotifications}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Currency Section */}
        <section
          className="rounded-lg border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div
            className="p-4 border-b flex items-center gap-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}
            >
              <DollarSign size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                Currency
              </h2>
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                Set your currency display preferences
              </p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Display Mode */}
            <div>
              <p className="font-medium mb-3" style={{ color: 'var(--foreground)' }}>
                Price Display
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'original' as CurrencyDisplayMode, label: 'Original Currency', description: 'Show prices in their original currency' },
                  { value: 'local' as CurrencyDisplayMode, label: 'Convert to Local', description: 'Convert prices to your preferred currency' },
                ].map((option) => {
                  const isSelected = currencyDisplayMode === option.value;
                  return (
                    <button
                      key={option.value}
                      data-testid={`currency-mode-${option.value}`}
                      onClick={() => updateCurrencyDisplayMode(option.value)}
                      className="p-4 rounded-lg border-2 text-left transition-all"
                      style={{
                        backgroundColor: isSelected ? 'rgba(76, 112, 49, 0.1)' : 'var(--surface-light)',
                        borderColor: isSelected ? 'var(--primary)' : 'transparent',
                        color: 'var(--foreground)',
                      }}
                    >
                      <span className="block font-medium text-sm">{option.label}</span>
                      <span className="block text-xs mt-1" style={{ color: 'var(--foreground-muted)' }}>
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Local Currency Selection */}
            {currencyDisplayMode === 'local' && (
              <div
                className="border-t pt-4"
                style={{ borderColor: 'var(--border)' }}
              >
                <p className="font-medium mb-3" style={{ color: 'var(--foreground)' }}>
                  Your Currency
                </p>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {DISPLAY_CURRENCIES.map((currency) => {
                    const isSelected = localCurrency === currency;
                    return (
                      <button
                        key={currency}
                        data-testid={`currency-${currency}`}
                        onClick={() => updateLocalCurrency(currency as LocalCurrency)}
                        className="p-3 rounded-lg border-2 flex flex-col items-center justify-center gap-1 transition-all"
                        style={{
                          backgroundColor: isSelected ? 'rgba(76, 112, 49, 0.1)' : 'var(--surface-light)',
                          borderColor: isSelected ? 'var(--primary)' : 'transparent',
                          color: 'var(--foreground)',
                        }}
                      >
                        <span className="text-lg">{getCurrencySymbol(currency)}</span>
                        <span className="text-xs font-medium">{currency}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs mt-3" style={{ color: 'var(--foreground-muted)' }}>
                  Converted prices are approximate and use daily ECB exchange rates.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Appearance Section */}
        <section
          className="rounded-lg border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div
            className="p-4 border-b flex items-center gap-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}
            >
              <Palette size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                Appearance
              </h2>
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                Customize how Mood Layer looks
              </p>
            </div>
          </div>

          <div className="p-4">
            <p className="font-medium mb-3" style={{ color: 'var(--foreground)' }}>
              Theme
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'light' as Theme, label: 'Light', icon: Sun },
                { value: 'dark' as Theme, label: 'Dark', icon: Moon },
                { value: 'system' as Theme, label: 'System', icon: Monitor },
              ].map((themeOption) => {
                const Icon = themeOption.icon;
                const isSelected = theme === themeOption.value;
                return (
                  <button
                    key={themeOption.value}
                    data-testid={`theme-${themeOption.value}`}
                    onClick={() => updateTheme(themeOption.value)}
                    className="p-4 rounded-lg border-2 flex flex-col items-center justify-center gap-2 transition-all"
                    style={{
                      backgroundColor: isSelected ? 'rgba(76, 112, 49, 0.1)' : 'var(--surface-light)',
                      borderColor: isSelected ? 'var(--primary)' : 'transparent',
                      color: 'var(--foreground)',
                    }}
                  >
                    <Icon size={24} />
                    <span className="text-sm font-medium">{themeOption.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Data & Privacy Section */}
        <section
          className="rounded-lg border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <div
            className="p-4 border-b flex items-center gap-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}
            >
              <Shield size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
                Data & Privacy
              </h2>
              <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                Manage your data and account
              </p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Export Data */}
            <button
              data-testid="export-data-btn"
              onClick={handleExportData}
              disabled={isExporting}
              className="w-full flex items-center justify-between p-3 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--surface-light)' }}
              onMouseEnter={(e) => {
                if (!isExporting) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-light)';
              }}
            >
              <div className="flex items-center gap-3">
                {isExporting ? (
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--foreground-secondary)' }} />
                ) : (
                  <Download size={20} style={{ color: 'var(--foreground-secondary)' }} />
                )}
                <div className="text-left">
                  <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                    {isExporting ? 'Exporting...' : 'Export your data'}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    Download all your looks, collections, and preferences
                  </p>
                </div>
              </div>
              <ChevronRight size={20} style={{ color: 'var(--foreground-muted)' }} />
            </button>

            {/* Sign Out */}
            <button
              data-testid="sign-out-btn"
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full flex items-center justify-between p-3 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--surface-light)' }}
              onMouseEnter={(e) => {
                if (!isSigningOut) e.currentTarget.style.backgroundColor = 'var(--surface-elevated)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--surface-light)';
              }}
            >
              <div className="flex items-center gap-3">
                {isSigningOut ? (
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--foreground-secondary)' }} />
                ) : (
                  <LogOut size={20} style={{ color: 'var(--foreground-secondary)' }} />
                )}
                <div className="text-left">
                  <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                    {isSigningOut ? 'Signing out...' : 'Sign out'}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                    Sign out of your account on this device
                  </p>
                </div>
              </div>
              <ChevronRight size={20} style={{ color: 'var(--foreground-muted)' }} />
            </button>

            {/* Delete Account */}
            <div
              className="border-t pt-4"
              style={{ borderColor: 'var(--border)' }}
            >
              <button
                data-testid="delete-account-btn"
                onClick={() => setActiveModal('delete')}
                className="w-full flex items-center justify-between p-3 rounded-lg transition-colors"
                style={{ backgroundColor: 'rgba(168, 64, 50, 0.15)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(168, 64, 50, 0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(168, 64, 50, 0.15)';
                }}
              >
                <div className="flex items-center gap-3">
                  <Trash2 size={20} style={{ color: 'var(--error)' }} />
                  <div className="text-left">
                    <p className="font-medium" style={{ color: 'var(--error)' }}>
                      Delete account
                    </p>
                    <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                      Permanently delete your account and all data
                    </p>
                  </div>
                </div>
                <ChevronRight size={20} style={{ color: 'var(--error)' }} />
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Email Change Modal */}
      {activeModal === 'email' && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={closeModal}
        >
          <div
            data-testid="email-modal"
            className="w-full max-w-md p-6 rounded-lg mx-4"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                Change Email
              </h3>
              <button onClick={closeModal} style={{ color: 'var(--foreground-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <p className="mb-4 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              Enter your new email address. We'll send a verification link to confirm.
            </p>

            {formError && (
              <div
                className="mb-4 p-3 rounded-lg text-sm"
                style={{ backgroundColor: 'rgba(168, 64, 50, 0.2)', color: 'var(--error)' }}
              >
                {formError}
              </div>
            )}

            {formSuccess && (
              <div
                className="mb-4 p-3 rounded-lg text-sm"
                style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)', color: 'var(--success)' }}
              >
                {formSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  New Email
                </label>
                <input
                  data-testid="new-email-input"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full p-3 rounded-lg border outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                  style={{
                    backgroundColor: 'var(--background)',
                    borderColor: 'var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  Current Password
                </label>
                <PasswordInput
                  testId="email-password-input"
                  value={emailPassword}
                  onChange={setEmailPassword}
                  placeholder="Enter your password to confirm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-lg font-medium"
                style={{
                  backgroundColor: 'var(--surface-light)',
                  color: 'var(--foreground)',
                }}
              >
                Cancel
              </button>
              <button
                data-testid="save-email-btn"
                onClick={handleEmailChange}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {activeModal === 'password' && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={closeModal}
        >
          <div
            data-testid="password-modal"
            className="w-full max-w-md p-6 rounded-lg mx-4"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                Update Password
              </h3>
              <button onClick={closeModal} style={{ color: 'var(--foreground-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div
                className="mb-4 p-3 rounded-lg text-sm"
                style={{ backgroundColor: 'rgba(168, 64, 50, 0.2)', color: 'var(--error)' }}
              >
                {formError}
              </div>
            )}

            {formSuccess && (
              <div
                className="mb-4 p-3 rounded-lg text-sm"
                style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)', color: 'var(--success)' }}
              >
                {formSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  Current Password
                </label>
                <PasswordInput
                  testId="current-password-input"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  New Password
                </label>
                <PasswordInput
                  testId="new-password-input"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Enter new password (min 8 characters)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                  Confirm New Password
                </label>
                <PasswordInput
                  testId="confirm-password-input"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-lg font-medium"
                style={{
                  backgroundColor: 'var(--surface-light)',
                  color: 'var(--foreground)',
                }}
              >
                Cancel
              </button>
              <button
                data-testid="save-password-btn"
                onClick={handlePasswordChange}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2"
                style={{
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {activeModal === 'delete' && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={closeModal}
        >
          <div
            data-testid="delete-modal"
            className="w-full max-w-md p-6 rounded-lg mx-4"
            style={{
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: 'rgba(168, 64, 50, 0.2)' }}
              >
                <AlertTriangle size={24} style={{ color: 'var(--error)' }} />
              </div>
              <h3 className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>
                Delete Account
              </h3>
            </div>

            <p className="mb-4" style={{ color: 'var(--foreground-secondary)' }}>
              This action cannot be undone. This will permanently delete your account and remove all your data from our servers, including:
            </p>

            <ul className="mb-6 space-y-2 text-sm" style={{ color: 'var(--foreground-muted)' }}>
              <li className="flex items-center gap-2">
                <span style={{ color: 'var(--error)' }}>•</span> All your looks and designs
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: 'var(--error)' }}>•</span> Your saved collections
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: 'var(--error)' }}>•</span> Account preferences and settings
              </li>
              <li className="flex items-center gap-2">
                <span style={{ color: 'var(--error)' }}>•</span> All associated data
              </li>
            </ul>

            <div className="mb-6">
              <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Type <span style={{ color: 'var(--error)' }}>DELETE</span> to confirm:
              </label>
              <input
                data-testid="delete-confirm-input"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder="DELETE"
                className="w-full mt-2 p-3 rounded-lg border outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--foreground)',
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 py-2.5 rounded-lg font-medium"
                style={{
                  backgroundColor: 'var(--surface-light)',
                  color: 'var(--foreground)',
                }}
              >
                Cancel
              </button>
              <button
                data-testid="confirm-delete-btn"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                className="flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2"
                style={{
                  backgroundColor: deleteConfirmText === 'DELETE' ? 'var(--error)' : 'var(--surface-light)',
                  color: deleteConfirmText === 'DELETE' ? 'white' : 'var(--foreground-muted)',
                  cursor: deleteConfirmText === 'DELETE' ? 'pointer' : 'not-allowed',
                }}
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete Account'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
