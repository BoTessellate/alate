/**
 * Shared Test Selectors - SINGLE SOURCE OF TRUTH
 *
 * This file defines selectors used by both:
 * 1. Components (via data-testid attributes)
 * 2. Cypress/Jest tests (via imports)
 *
 * RULE: When changing a component's structure, update this file.
 * Tests will automatically use the new selectors.
 */

export const SELECTORS = {
  // TopBar elements
  topbar: {
    header: 'header',
    logo: '[data-testid="logo"]',
    breadcrumb: '[aria-label="Breadcrumb"]',
  },

  // Search (expandable icon pattern)
  search: {
    trigger: '[data-testid="search-trigger"]',
    triggerAria: 'button[aria-label="Search"]',
    input: '[data-testid="search-input"]',
    placeholder: 'Search a mood or product...',
    closeButton: '[data-testid="search-close"]',
    results: '[data-testid="search-results"]',
    resultItem: '[data-testid="search-result-item"]',
  },

  // Navigation
  navigation: {
    container: 'header nav',
    layersLink: 'a[href="/looks"]',
    closetLink: 'a[href="/closet"]',
    discoverLink: 'a[href="/discover"]',
  },

  // User menu
  userMenu: {
    trigger: 'button[aria-label="User menu"]',
    dropdown: '[role="menu"]',
    settingsLink: '[role="menuitem"]',
  },

  // Currency selector
  currency: {
    trigger: 'button[aria-label="Select currency"]',
    dropdown: '[role="listbox"]',
    option: '[role="option"]',
  },

  // Agent mode toggle
  agentMode: {
    trigger: '[data-testid="agent-mode-toggle"]',
    triggerAria: 'button[aria-label*="Agent Mode"]',
  },

  // Breadcrumb dropdowns
  breadcrumb: {
    segment: '[data-testid="breadcrumb-segment"]',
    dropdown: '[data-testid="breadcrumb-dropdown"]',
    dropdownTrigger: '[data-testid="breadcrumb-dropdown-trigger"]',
  },

  // Help & Feedback
  help: {
    trigger: 'button[aria-label="Help"]',
  },
  feedback: {
    trigger: 'button[aria-label="Send feedback"]',
  },
} as const;

/**
 * Placeholder texts - update here when copy changes
 */
export const PLACEHOLDERS = {
  search: 'Search a mood or product...',
} as const;

/**
 * Aria labels - for accessibility-based selectors
 */
export const ARIA_LABELS = {
  search: 'Search',
  userMenu: 'User menu',
  currency: 'Select currency',
  agentModeEnable: 'Enable Agent Mode',
  agentModeDisable: 'Disable Agent Mode',
  help: 'Help',
  feedback: 'Send feedback',
  breadcrumb: 'Breadcrumb',
} as const;

/**
 * Helper to build Cypress selector from data-testid
 */
export function testId(id: string): string {
  return `[data-testid="${id}"]`;
}

/**
 * Helper to build placeholder selector
 */
export function placeholder(text: string): string {
  return `input[placeholder="${text}"]`;
}
