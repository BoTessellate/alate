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
  Edit2,
} from 'lucide-react';
import { useSettingsStore, Theme } from '@/stores/useSettingsStore';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  Modal,
  ModalContent,
  ModalFooter,
  Input,
  PasswordInput,
  PageHeader,
  Toggle,
  Divider,
} from '@/components/ui';

type ModalType = 'email' | 'password' | 'delete' | null;

// Settings section header with icon
function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <CardHeader className="flex items-center gap-3 p-4 border-b" style={{ borderColor: 'var(--border)' }}>
      <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}>
        <Icon size={20} style={{ color: 'var(--primary)' }} />
      </div>
      <div>
        <h2 className="font-semibold" style={{ color: 'var(--foreground)' }}>
          {title}
        </h2>
        <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
          {description}
        </p>
      </div>
    </CardHeader>
  );
}

// Action list item button
function ActionButton({
  icon: Icon,
  title,
  description,
  onClick,
  isLoading,
  loadingText,
  variant = 'default',
  testId,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  onClick: () => void;
  isLoading?: boolean;
  loadingText?: string;
  variant?: 'default' | 'destructive';
  testId?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const bgColors = {
    default: {
      normal: 'var(--surface-light)',
      hover: 'var(--surface-elevated)',
    },
    destructive: {
      normal: 'rgba(168, 64, 50, 0.15)',
      hover: 'rgba(168, 64, 50, 0.25)',
    },
  };

  const colors = bgColors[variant];

  return (
    <button
      data-testid={testId}
      onClick={onClick}
      disabled={isLoading}
      className="w-full flex items-center justify-between p-3 rounded-lg transition-colors"
      style={{ backgroundColor: isHovered ? colors.hover : colors.normal }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex items-center gap-3">
        {isLoading ? (
          <Loader2 size={20} className="animate-spin" style={{ color: variant === 'destructive' ? 'var(--error)' : 'var(--foreground-secondary)' }} />
        ) : (
          <Icon size={20} style={{ color: variant === 'destructive' ? 'var(--error)' : 'var(--foreground-secondary)' }} />
        )}
        <div className="text-left">
          <p className="font-medium" style={{ color: variant === 'destructive' ? 'var(--error)' : 'var(--foreground)' }}>
            {isLoading ? loadingText : title}
          </p>
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            {description}
          </p>
        </div>
      </div>
      <ChevronRight size={20} style={{ color: variant === 'destructive' ? 'var(--error)' : 'var(--foreground-muted)' }} />
    </button>
  );
}

// Setting row with label and control
function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium" style={{ color: 'var(--foreground)' }}>
          {title}
        </p>
        {description && (
          <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

// Selection button for options like theme/currency
function SelectionButton({
  isSelected,
  onClick,
  children,
  testId,
  className = '',
}: {
  isSelected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={`p-4 rounded-lg border-2 text-left transition-all ${className}`}
      style={{
        backgroundColor: isSelected ? 'rgba(76, 112, 49, 0.1)' : 'var(--surface-light)',
        borderColor: isSelected ? 'var(--primary)' : 'transparent',
        color: 'var(--foreground)',
      }}
    >
      {children}
    </button>
  );
}

export default function SettingsPage() {
  const {
    theme,
    emailNotifications,
    pushNotifications,
    userName,
    setTheme,
    setEmailNotifications,
    setPushNotifications,
    setUserName,
    setIsLoggedIn,
  } = useSettingsStore();

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(userName || '');

  // Form states
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock user data
  const [user, setUser] = useState({
    email: 'user@example.com',
    name: 'Demo User',
    createdAt: '2024-01-15',
    lastPasswordChange: null as string | null,
  });

  // Save helpers
  const showSaveStatus = async () => {
    setSaveStatus('saving');
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const updateDisplayName = async () => {
    if (!editedName.trim()) return;
    setUserName(editedName.trim());
    setIsLoggedIn(true);
    setIsEditingName(false);
    await showSaveStatus();
  };

  const updateTheme = async (newTheme: Theme) => {
    setTheme(newTheme);
    await showSaveStatus();
  };

  const updateEmailNotifications = async (value: boolean) => {
    setEmailNotifications(value);
    await showSaveStatus();
  };

  const updatePushNotifications = async (value: boolean) => {
    setPushNotifications(value);
    await showSaveStatus();
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const exportData = {
        user: { email: user.email, createdAt: user.createdAt },
        preferences: { theme, emailNotifications, pushNotifications },
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
      setUser((prev) => ({ ...prev, email: newEmail }));
      setFormSuccess('Email updated successfully! Please check your new email for verification.');
      setNewEmail('');
      setEmailPassword('');
      setTimeout(() => {
        setActiveModal(null);
        setFormSuccess('');
      }, 2000);
    } catch {
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
    } catch {
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
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const themeOptions = [
    { value: 'light' as Theme, label: 'Light', icon: Sun },
    { value: 'dark' as Theme, label: 'Dark', icon: Moon },
    { value: 'system' as Theme, label: 'System', icon: Monitor },
  ];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Manage your account and preferences."
        className="mb-8"
      />

      {/* Save Status Toast */}
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
        <Card>
          <SectionHeader icon={User} title="Account" description="Manage your profile information" />
          <CardContent className="p-4 space-y-4">
            {/* Display Name */}
            <SettingRow
              title="Display Name"
              description={isEditingName ? undefined : userName || 'Not set - displays as "Guest" in navigation'}
            >
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    placeholder="Enter your name"
                    size="sm"
                    className="w-48"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') updateDisplayName();
                      if (e.key === 'Escape') {
                        setIsEditingName(false);
                        setEditedName(userName || '');
                      }
                    }}
                  />
                  <Button size="sm" onClick={updateDisplayName}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setIsEditingName(false);
                    setEditedName(userName || '');
                  }}>Cancel</Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={Edit2}
                  onClick={() => {
                    setEditedName(userName || '');
                    setIsEditingName(true);
                  }}
                >
                  Edit
                </Button>
              )}
            </SettingRow>

            <Divider />

            {/* Email */}
            <SettingRow title="Email" description={user.email}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveModal('email')}
                data-testid="change-email-btn"
              >
                Change
              </Button>
            </SettingRow>

            <Divider />

            {/* Password */}
            <SettingRow title="Password" description={`Last changed: ${formatDate(user.lastPasswordChange)}`}>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveModal('password')}
                data-testid="change-password-btn"
              >
                Update
              </Button>
            </SettingRow>
          </CardContent>
        </Card>

        {/* Notifications Section */}
        <Card>
          <SectionHeader icon={Bell} title="Notifications" description="Control how you receive updates" />
          <CardContent className="p-4 space-y-4">
            <SettingRow title="Email notifications" description="Receive updates about your layers and collections">
              <Toggle
                checked={emailNotifications}
                onChange={updateEmailNotifications}
                data-testid="email-notifications-toggle"
              />
            </SettingRow>

            <Divider />

            <SettingRow title="Push notifications" description="Get browser notifications for activity">
              <Toggle
                checked={pushNotifications}
                onChange={updatePushNotifications}
                data-testid="push-notifications-toggle"
              />
            </SettingRow>
          </CardContent>
        </Card>

        {/* Appearance Section */}
        <Card>
          <SectionHeader icon={Palette} title="Appearance" description="Customize how Mood Layer looks" />
          <CardContent className="p-4">
            <p className="font-medium mb-3" style={{ color: 'var(--foreground)' }}>
              Theme
            </p>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <SelectionButton
                    key={option.value}
                    isSelected={theme === option.value}
                    onClick={() => updateTheme(option.value)}
                    testId={`theme-${option.value}`}
                    className="flex flex-col items-center justify-center gap-2 !p-4"
                  >
                    <Icon size={24} />
                    <span className="text-sm font-medium">{option.label}</span>
                  </SelectionButton>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Data & Privacy Section */}
        <Card>
          <SectionHeader icon={Shield} title="Data & Privacy" description="Manage your data and account" />
          <CardContent className="p-4 space-y-4">
            <ActionButton
              icon={Download}
              title="Export your data"
              description="Download all your layers, collections, and preferences"
              onClick={handleExportData}
              isLoading={isExporting}
              loadingText="Exporting..."
              testId="export-data-btn"
            />

            <ActionButton
              icon={LogOut}
              title="Sign out"
              description="Sign out of your account on this device"
              onClick={handleSignOut}
              isLoading={isSigningOut}
              loadingText="Signing out..."
              testId="sign-out-btn"
            />

            <Divider />

            <ActionButton
              icon={Trash2}
              title="Delete account"
              description="Permanently delete your account and all data"
              onClick={() => setActiveModal('delete')}
              variant="destructive"
              testId="delete-account-btn"
            />
          </CardContent>
        </Card>
      </div>

      {/* Email Change Modal */}
      <Modal
        isOpen={activeModal === 'email'}
        onClose={closeModal}
        title="Change Email"
        size="sm"
        data-testid="email-modal"
      >
        <ModalContent className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
            Enter your new email address. We'll send a verification link to confirm.
          </p>

          {formError && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(168, 64, 50, 0.2)', color: 'var(--error)' }}
            >
              {formError}
            </div>
          )}

          {formSuccess && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)', color: 'var(--success)' }}
            >
              {formSuccess}
            </div>
          )}

          <Input
            label="New Email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="your@email.com"
            data-testid="new-email-input"
          />

          <PasswordInput
            label="Current Password"
            value={emailPassword}
            onChange={(e) => setEmailPassword(e.target.value)}
            placeholder="Enter your password to confirm"
            data-testid="email-password-input"
          />
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            onClick={handleEmailChange}
            disabled={isSubmitting}
            data-testid="save-email-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Password Change Modal */}
      <Modal
        isOpen={activeModal === 'password'}
        onClose={closeModal}
        title="Update Password"
        size="sm"
        data-testid="password-modal"
      >
        <ModalContent className="space-y-4">
          {formError && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(168, 64, 50, 0.2)', color: 'var(--error)' }}
            >
              {formError}
            </div>
          )}

          {formSuccess && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)', color: 'var(--success)' }}
            >
              {formSuccess}
            </div>
          )}

          <PasswordInput
            label="Current Password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            data-testid="current-password-input"
          />

          <PasswordInput
            label="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password (min 8 characters)"
            data-testid="new-password-input"
          />

          <PasswordInput
            label="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            data-testid="confirm-password-input"
          />
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            onClick={handlePasswordChange}
            disabled={isSubmitting}
            data-testid="save-password-btn"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        isOpen={activeModal === 'delete'}
        onClose={closeModal}
        title=""
        size="sm"
        data-testid="delete-modal"
      >
        <ModalContent>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(168, 64, 50, 0.2)' }}>
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
              <span style={{ color: 'var(--error)' }}>•</span> All your layers and designs
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

          <div>
            <label className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
              Type <span style={{ color: 'var(--error)' }}>DELETE</span> to confirm:
            </label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
              placeholder="DELETE"
              className="mt-2"
              data-testid="delete-confirm-input"
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={closeModal}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteAccount}
            disabled={deleteConfirmText !== 'DELETE' || isDeleting}
            data-testid="confirm-delete-btn"
          >
            {isDeleting ? (
              <>
                <Loader2 size={16} className="animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              'Delete Account'
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
