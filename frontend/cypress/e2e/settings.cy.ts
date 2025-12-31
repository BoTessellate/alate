/// <reference types="cypress" />

describe('Settings Page', () => {
  beforeEach(() => {
    // Reset app state and complete onboarding
    cy.resetAppState();
    cy.completeOnboarding();
  });

  describe('Page Layout', () => {
    it('should display settings page with all sections', () => {
      cy.visit('/settings');

      // Check header
      cy.get('h1').should('contain', 'Settings');
      cy.contains('Manage your account and preferences').should('be.visible');

      // Check all sections exist
      cy.contains('h2', 'Account').should('be.visible');
      cy.contains('h2', 'Notifications').should('be.visible');
      cy.contains('h2', 'Currency').should('be.visible');
      cy.contains('h2', 'Appearance').should('be.visible');
      cy.contains('h2', 'Data & Privacy').should('be.visible');
    });
  });

  describe('Theme Settings', () => {
    it('should display theme options', () => {
      cy.visit('/settings');

      // Check theme section
      cy.contains('Theme').should('be.visible');

      // Check all theme buttons exist
      cy.get('[data-testid="theme-light"]').should('be.visible');
      cy.get('[data-testid="theme-dark"]').should('be.visible');
      cy.get('[data-testid="theme-system"]').should('be.visible');
    });

    it('should change theme to light', () => {
      cy.visit('/settings');

      // Click light theme
      cy.get('[data-testid="theme-light"]').click();

      // Should show save status
      cy.get('[data-testid="save-status"]').should('be.visible');

      // Wait for save to complete
      cy.get('[data-testid="save-status"]').should('contain', 'Saved');

      // Verify theme button shows selected state (has primary border)
      cy.get('[data-testid="theme-light"]')
        .should('have.css', 'border-color')
        .and('not.be.empty');
    });

    it('should change theme to dark', () => {
      cy.visit('/settings');

      // Click dark theme
      cy.get('[data-testid="theme-dark"]').click();

      // Should show save status
      cy.get('[data-testid="save-status"]').should('be.visible');

      // Wait for save to complete
      cy.get('[data-testid="save-status"]').should('contain', 'Saved');
    });

    it('should change theme to system', () => {
      cy.visit('/settings');

      // Click system theme
      cy.get('[data-testid="theme-system"]').click();

      // Should show save status
      cy.get('[data-testid="save-status"]').should('be.visible');
    });

    it('should persist theme selection after reload', () => {
      cy.visit('/settings');

      // Click dark theme
      cy.get('[data-testid="theme-dark"]').click();

      // Wait for save
      cy.get('[data-testid="save-status"]').should('contain', 'Saved');

      // Reload page
      cy.reload();

      // Dark theme should still be selected (check border color)
      cy.get('[data-testid="theme-dark"]')
        .should('have.css', 'border-width', '2px');
    });
  });

  describe('Notification Settings', () => {
    it('should display notification toggles', () => {
      cy.visit('/settings');

      // Check notification section
      cy.contains('Email notifications').should('be.visible');
      cy.contains('Push notifications').should('be.visible');

      // Check toggles exist
      cy.get('[data-testid="email-notifications-toggle"]').should('be.visible');
      cy.get('[data-testid="push-notifications-toggle"]').should('be.visible');
    });

    it('should toggle email notifications', () => {
      cy.visit('/settings');

      // Get initial state
      cy.get('[data-testid="email-notifications-toggle"]')
        .invoke('attr', 'aria-pressed')
        .then((initialState) => {
          // Click toggle
          cy.get('[data-testid="email-notifications-toggle"]').click();

          // Should show save status
          cy.get('[data-testid="save-status"]').should('be.visible');

          // State should have changed
          cy.get('[data-testid="email-notifications-toggle"]')
            .invoke('attr', 'aria-pressed')
            .should('not.eq', initialState);
        });
    });

    it('should toggle push notifications', () => {
      cy.visit('/settings');

      // Get initial state
      cy.get('[data-testid="push-notifications-toggle"]')
        .invoke('attr', 'aria-pressed')
        .then((initialState) => {
          // Click toggle
          cy.get('[data-testid="push-notifications-toggle"]').click();

          // Should show save status
          cy.get('[data-testid="save-status"]').should('be.visible');

          // State should have changed
          cy.get('[data-testid="push-notifications-toggle"]')
            .invoke('attr', 'aria-pressed')
            .should('not.eq', initialState);
        });
    });
  });

  describe('Currency Settings', () => {
    it('should display currency options', () => {
      cy.visit('/settings');

      // Check currency section
      cy.contains('Price Display').should('be.visible');

      // Check display mode options
      cy.get('[data-testid="currency-mode-original"]').should('be.visible');
      cy.get('[data-testid="currency-mode-local"]').should('be.visible');
    });

    it('should switch to local currency mode', () => {
      cy.visit('/settings');

      // Click local currency mode
      cy.get('[data-testid="currency-mode-local"]').click();

      // Currency selection should appear
      cy.contains('Your Currency').should('be.visible');

      // Individual currency buttons should be visible
      cy.get('[data-testid="currency-USD"]').should('be.visible');
    });

    it('should select different currencies', () => {
      cy.visit('/settings');

      // Switch to local mode
      cy.get('[data-testid="currency-mode-local"]').click();

      // Wait for currency options
      cy.get('[data-testid="currency-EUR"]').should('be.visible');

      // Select EUR
      cy.get('[data-testid="currency-EUR"]').click();

      // Should show save status
      cy.get('[data-testid="save-status"]').should('be.visible');
    });
  });

  describe('Account Settings', () => {
    it('should display account information', () => {
      cy.visit('/settings');

      // Check account section
      cy.contains('Display Name').should('be.visible');
      cy.contains('Email').should('be.visible');
      cy.contains('Password').should('be.visible');
    });

    it('should open change email modal', () => {
      cy.visit('/settings');

      // Click change email button
      cy.get('[data-testid="change-email-btn"]').click();

      // Modal should open
      cy.get('[data-testid="email-modal"]').should('be.visible');
      cy.contains('Change Email').should('be.visible');

      // Should have input fields
      cy.get('[data-testid="new-email-input"]').should('be.visible');
      cy.get('[data-testid="email-password-input"]').should('be.visible');
    });

    it('should close email modal on cancel', () => {
      cy.visit('/settings');

      // Open modal
      cy.get('[data-testid="change-email-btn"]').click();
      cy.get('[data-testid="email-modal"]').should('be.visible');

      // Click cancel
      cy.contains('button', 'Cancel').click();

      // Modal should close
      cy.get('[data-testid="email-modal"]').should('not.exist');
    });

    it('should open change password modal', () => {
      cy.visit('/settings');

      // Click change password button
      cy.get('[data-testid="change-password-btn"]').click();

      // Modal should open
      cy.get('[data-testid="password-modal"]').should('be.visible');
      cy.contains('Update Password').should('be.visible');

      // Should have password input fields
      cy.get('[data-testid="current-password-input"]').should('be.visible');
      cy.get('[data-testid="new-password-input"]').should('be.visible');
      cy.get('[data-testid="confirm-password-input"]').should('be.visible');
    });

    it('should validate password requirements', () => {
      cy.visit('/settings');

      // Open password modal
      cy.get('[data-testid="change-password-btn"]').click();

      // Fill in short password
      cy.get('[data-testid="current-password-input"]').type('oldpass123');
      cy.get('[data-testid="new-password-input"]').type('short');
      cy.get('[data-testid="confirm-password-input"]').type('short');

      // Click update
      cy.get('[data-testid="save-password-btn"]').click();

      // Should show error
      cy.contains('at least 8 characters').should('be.visible');
    });

    it('should validate password match', () => {
      cy.visit('/settings');

      // Open password modal
      cy.get('[data-testid="change-password-btn"]').click();

      // Fill in mismatched passwords
      cy.get('[data-testid="current-password-input"]').type('oldpass123');
      cy.get('[data-testid="new-password-input"]').type('newpassword123');
      cy.get('[data-testid="confirm-password-input"]').type('different123');

      // Click update
      cy.get('[data-testid="save-password-btn"]').click();

      // Should show error
      cy.contains('do not match').should('be.visible');
    });
  });

  describe('Data & Privacy', () => {
    it('should display data and privacy options', () => {
      cy.visit('/settings');

      // Check section exists
      cy.contains('Export your data').should('be.visible');
      cy.contains('Sign out').should('be.visible');
      cy.contains('Delete account').should('be.visible');
    });

    it('should trigger data export', () => {
      cy.visit('/settings');

      // Click export data
      cy.get('[data-testid="export-data-btn"]').click();

      // Should show exporting state
      cy.contains('Exporting...').should('be.visible');

      // Should complete (text changes back)
      cy.contains('Export your data', { timeout: 5000 }).should('be.visible');
    });

    it('should open delete account modal', () => {
      cy.visit('/settings');

      // Click delete account
      cy.get('[data-testid="delete-account-btn"]').click();

      // Modal should open
      cy.get('[data-testid="delete-modal"]').should('be.visible');
      cy.contains('Delete Account').should('be.visible');

      // Should require typing DELETE
      cy.get('[data-testid="delete-confirm-input"]').should('be.visible');
      cy.get('[data-testid="confirm-delete-btn"]').should('be.disabled');
    });

    it('should enable delete button only when DELETE is typed', () => {
      cy.visit('/settings');

      // Open delete modal
      cy.get('[data-testid="delete-account-btn"]').click();

      // Button should be disabled
      cy.get('[data-testid="confirm-delete-btn"]').should('have.css', 'cursor', 'not-allowed');

      // Type DELETE
      cy.get('[data-testid="delete-confirm-input"]').type('DELETE');

      // Button should now be enabled
      cy.get('[data-testid="confirm-delete-btn"]').should('have.css', 'cursor', 'pointer');
    });

    it('should close delete modal on cancel', () => {
      cy.visit('/settings');

      // Open modal
      cy.get('[data-testid="delete-account-btn"]').click();
      cy.get('[data-testid="delete-modal"]').should('be.visible');

      // Click cancel
      cy.contains('button', 'Cancel').click();

      // Modal should close
      cy.get('[data-testid="delete-modal"]').should('not.exist');
    });
  });

  describe('Sign Out', () => {
    it('should initiate sign out process', () => {
      cy.visit('/settings');

      // Click sign out
      cy.get('[data-testid="sign-out-btn"]').click();

      // Should show signing out state
      cy.contains('Signing out...').should('be.visible');
    });
  });
});
