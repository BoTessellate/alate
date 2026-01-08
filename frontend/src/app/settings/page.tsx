'use client';

import { useState, useEffect, useCallback } from 'react';
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
  DollarSign,
  MessageCircle,
  Store,
  RefreshCw,
  Link,
  Unlink,
  Package,
  Clock,
} from 'lucide-react';
import { useSettingsStore, Theme } from '@/stores/useSettingsStore';
import { useChatStore } from '@/stores/useChatStore';
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
        <h2
          className="text-lg italic"
          style={{
            fontFamily: 'var(--font-cormorant)',
            fontWeight: 500,
            color: 'var(--foreground)',
          }}
        >
          {title}
        </h2>
        <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
          {description}
        </p>
      </div>
    </CardHeader>
  );
}

// Action list item button using Button component styling patterns
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
    <Button
      data-testid={testId}
      onClick={onClick}
      disabled={isLoading}
      variant="ghost"
      fullWidth
      className="h-auto p-3 justify-between outline-none focus:outline-none focus-visible:outline-none"
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
    </Button>
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

// Selection button for options like theme/currency using Button component
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
    <Button
      data-testid={testId}
      onClick={onClick}
      variant="outline"
      className={`h-auto p-4 text-left transition-all border-2 outline-none focus:outline-none focus-visible:outline-none ${className}`}
      style={{
        backgroundColor: isSelected ? 'var(--primary-alpha)' : 'var(--surface-light)',
        borderColor: isSelected ? 'var(--primary-dark)' : 'transparent',
        color: 'var(--foreground)',
      }}
    >
      {children}
    </Button>
  );
}

export default function SettingsPage() {
  const {
    theme,
    emailNotifications,
    pushNotifications,
    userName,
    priceRange,
    localCurrency,
    setTheme,
    setEmailNotifications,
    setPushNotifications,
    setUserName,
    setIsLoggedIn,
    setPriceRange,
  } = useSettingsStore();

  const { messages, clearHistory } = useChatStore();

  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isClearingChat, setIsClearingChat] = useState(false);
  const [showChatClearConfirm, setShowChatClearConfirm] = useState(false);
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

  // Shopify integration state
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [shopifyShop, setShopifyShop] = useState<string | null>(null);
  const [shopifyProductCount, setShopifyProductCount] = useState<number | null>(null);
  const [shopifyLastSync, setShopifyLastSync] = useState<string | null>(null);
  const [isShopifyLoading, setIsShopifyLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-tml.vercel.app';

  // Check Shopify connection status on mount
  const checkShopifyStatus = useCallback(async () => {
    const connectedShop = localStorage.getItem('connected_shop_domain');
    if (!connectedShop) {
      setIsShopifyLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/shopify?action=status&shop=${encodeURIComponent(connectedShop)}`
      );

      if (response.ok) {
        const data = await response.json();
        setShopifyConnected(data.status === 'connected');
        setShopifyShop(connectedShop);
        setShopifyProductCount(data.productCount || 0);
        setShopifyLastSync(data.lastSyncAt || null);
      } else {
        // Connection no longer valid
        localStorage.removeItem('connected_shop_domain');
        setShopifyConnected(false);
      }
    } catch (error) {
      console.error('Failed to check Shopify status:', error);
    } finally {
      setIsShopifyLoading(false);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    checkShopifyStatus();
  }, [checkShopifyStatus]);

  const handleShopifyConnect = () => {
    // Open OAuth flow
    const authUrl = `${API_BASE_URL}/api/shopify?action=auth`;
    window.location.href = authUrl;
  };

  const handleShopifySync = async () => {
    if (!shopifyShop) return;

    setIsSyncing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shopify?action=sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop: shopifyShop }),
      });

      if (response.ok) {
        const data = await response.json();
        setShopifyProductCount(data.productCount || shopifyProductCount);
        setShopifyLastSync(new Date().toISOString());
        await showSaveStatus();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleShopifyDisconnect = async () => {
    if (!shopifyShop) return;

    setIsDisconnecting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/shopify?action=disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop: shopifyShop }),
      });

      if (response.ok) {
        localStorage.removeItem('connected_shop_domain');
        setShopifyConnected(false);
        setShopifyShop(null);
        setShopifyProductCount(null);
        setShopifyLastSync(null);
        await showSaveStatus();
      }
    } catch (error) {
      console.error('Disconnect failed:', error);
    } finally {
      setIsDisconnecting(false);
    }
  };

  const formatShopifyDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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

  const updatePriceRange = async (field: 'min' | 'max', value: number) => {
    setPriceRange({
      ...priceRange,
      [field]: value,
    });
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

  const handleClearChatHistory = async () => {
    if (!showChatClearConfirm) {
      setShowChatClearConfirm(true);
      return;
    }
    setIsClearingChat(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      clearHistory();
      setShowChatClearConfirm(false);
      await showSaveStatus();
    } catch (error) {
      console.error('Clear chat failed:', error);
    } finally {
      setIsClearingChat(false);
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

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://backend-tml.vercel.app';

    try {
      // Check if there's a connected Shopify store (saved during OAuth flow)
      const connectedShop = localStorage.getItem('connected_shop_domain');

      if (connectedShop) {
        console.log('[Settings] Deleting Shopify data for:', connectedShop);

        // Call the delete-data API with confirmation
        const response = await fetch(`${API_BASE_URL}/api/shopify?action=delete-data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shop: connectedShop,
            confirm: true,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to delete account data');
        }

        const result = await response.json();
        console.log('[Settings] Deletion result:', result);

        // Clear local storage
        localStorage.removeItem('connected_shop_domain');
      }

      // Clear any local data
      clearHistory();
      setUserName('');
      setIsLoggedIn(false);

      // Redirect to home
      window.location.href = '/';
    } catch (error) {
      console.error('Delete failed:', error);
      setFormError(error instanceof Error ? error.message : 'Failed to delete account. Please try again.');
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
          className="fixed top-20 right-8 px-4 py-2 rounded-lg flex items-center gap-2 z-50 shadow-lg border"
          style={{
            backgroundColor: saveStatus === 'saved' ? 'var(--success)' : 'var(--surface)',
            borderColor: saveStatus === 'saved' ? 'var(--success)' : 'var(--border)',
            color: saveStatus === 'saved' ? 'white' : 'var(--foreground)',
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

        {/* Price Range Section */}
        <Card>
          <SectionHeader icon={DollarSign} title="Price Range" description="Set your budget range for price indicators ($, $$, $$$)" />
          <CardContent className="p-4 space-y-4">
            <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
              Products will show $ (budget), $$ (mid-range), or $$$ (premium) based on how their price compares to your range in {localCurrency}.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--foreground)' }}>
                  Minimum ({localCurrency})
                </label>
                <Input
                  type="number"
                  value={priceRange.min}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    updatePriceRange('min', value);
                  }}
                  placeholder="0"
                  data-testid="price-range-min"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--foreground)' }}>
                  Maximum ({localCurrency})
                </label>
                <Input
                  type="number"
                  value={priceRange.max}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    updatePriceRange('max', value);
                  }}
                  placeholder="100000"
                  data-testid="price-range-max"
                />
              </div>
            </div>

            <div
              className="p-3 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--surface-elevated)' }}
            >
              <p style={{ color: 'var(--foreground-secondary)' }}>
                <strong style={{ color: 'var(--primary)' }}>$</strong> = up to {Math.round(priceRange.max / 3).toLocaleString()} {localCurrency}
                <span className="mx-2">•</span>
                <strong style={{ color: 'var(--primary)' }}>$$</strong> = up to {Math.round((priceRange.max * 2) / 3).toLocaleString()} {localCurrency}
                <span className="mx-2">•</span>
                <strong style={{ color: 'var(--primary)' }}>$$$</strong> = above {Math.round((priceRange.max * 2) / 3).toLocaleString()} {localCurrency}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Store Integration Section */}
        <Card>
          <SectionHeader icon={Store} title="Store Integration" description="Connect your Shopify store to import products" />
          <CardContent className="p-4 space-y-4">
            {isShopifyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
              </div>
            ) : shopifyConnected && shopifyShop ? (
              <>
                {/* Connected Store Info */}
                <div
                  className="p-4 rounded-lg border"
                  style={{
                    backgroundColor: 'rgba(76, 112, 49, 0.1)',
                    borderColor: 'var(--primary)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-full" style={{ backgroundColor: 'var(--primary)' }}>
                      <Check size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                        Connected to Shopify
                      </p>
                      <p className="text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                        {shopifyShop}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: 'var(--surface-light)' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Package size={14} style={{ color: 'var(--foreground-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                          Products
                        </span>
                      </div>
                      <p className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>
                        {shopifyProductCount?.toLocaleString() || '0'}
                      </p>
                    </div>
                    <div
                      className="p-3 rounded-lg"
                      style={{ backgroundColor: 'var(--surface-light)' }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} style={{ color: 'var(--foreground-muted)' }} />
                        <span className="text-xs" style={{ color: 'var(--foreground-muted)' }}>
                          Last Sync
                        </span>
                      </div>
                      <p className="text-lg font-medium" style={{ color: 'var(--foreground)' }}>
                        {formatShopifyDate(shopifyLastSync)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sync Button */}
                <ActionButton
                  icon={RefreshCw}
                  title="Sync products"
                  description="Import the latest products from your store"
                  onClick={handleShopifySync}
                  isLoading={isSyncing}
                  loadingText="Syncing..."
                  testId="shopify-sync-btn"
                />

                <Divider />

                {/* Disconnect Button */}
                <ActionButton
                  icon={Unlink}
                  title="Disconnect store"
                  description="Remove the connection to your Shopify store"
                  onClick={handleShopifyDisconnect}
                  isLoading={isDisconnecting}
                  loadingText="Disconnecting..."
                  variant="destructive"
                  testId="shopify-disconnect-btn"
                />
              </>
            ) : (
              <>
                {/* Not Connected State */}
                <div
                  className="p-6 rounded-lg text-center"
                  style={{ backgroundColor: 'var(--surface-light)' }}
                >
                  <div
                    className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(76, 112, 49, 0.2)' }}
                  >
                    <Store size={24} style={{ color: 'var(--primary)' }} />
                  </div>
                  <h3
                    className="text-lg italic mb-2"
                    style={{
                      fontFamily: 'var(--font-cormorant)',
                      fontWeight: 500,
                      color: 'var(--foreground)',
                    }}
                  >
                    Connect Your Store
                  </h3>
                  <p className="text-sm mb-4" style={{ color: 'var(--foreground-secondary)' }}>
                    Import products from your Shopify store to create beautiful moodboards and virtual try-ons.
                  </p>
                  <Button
                    onClick={handleShopifyConnect}
                    icon={Link}
                    data-testid="shopify-connect-btn"
                  >
                    Connect Shopify
                  </Button>
                </div>

                <p className="text-xs text-center" style={{ color: 'var(--foreground-muted)' }}>
                  We only request read access to your products. Your store data is secure.
                </p>
              </>
            )}
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

            {/* Clear Chat History */}
            {showChatClearConfirm ? (
              <div
                className="p-3 rounded-lg"
                style={{ backgroundColor: 'var(--surface-light)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageCircle size={20} style={{ color: 'var(--foreground-secondary)' }} />
                    <div>
                      <p className="font-medium" style={{ color: 'var(--foreground)' }}>
                        Clear {messages.length} message{messages.length !== 1 ? 's' : ''}?
                      </p>
                      <p className="text-sm" style={{ color: 'var(--foreground-muted)' }}>
                        This action cannot be undone
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowChatClearConfirm(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleClearChatHistory}
                      disabled={isClearingChat}
                    >
                      {isClearingChat ? 'Clearing...' : 'Clear'}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <ActionButton
                icon={MessageCircle}
                title="Clear chat history"
                description={`${messages.length} message${messages.length !== 1 ? 's' : ''} stored locally`}
                onClick={handleClearChatHistory}
                testId="clear-chat-btn"
              />
            )}

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
            <h3
              className="text-xl italic"
              style={{
                fontFamily: 'var(--font-cormorant)',
                fontWeight: 500,
                color: 'var(--foreground)',
              }}
            >
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

          {formError && activeModal === 'delete' && (
            <div
              className="p-3 rounded-lg text-sm mb-4"
              style={{ backgroundColor: 'rgba(168, 64, 50, 0.2)', color: 'var(--error)' }}
            >
              {formError}
            </div>
          )}

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
