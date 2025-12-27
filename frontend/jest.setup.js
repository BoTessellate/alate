import '@testing-library/jest-dom';

// Mock CSS variables
const mockCSSVariables = {
  '--primary': '#4c7031',
  '--primary-light': '#5d8a3d',
  '--surface': '#2a2a2a',
  '--surface-light': '#3a3a3a',
  '--surface-elevated': '#4a4a4a',
  '--foreground': '#f6e9cf',
  '--foreground-secondary': '#d4c9b0',
  '--foreground-muted': '#9a9080',
  '--background': '#1a1a1a',
  '--border': '#3a3a3a',
  '--error': '#a84032',
  '--success': '#4c7031',
};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
class IntersectionObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: IntersectionObserver,
});

// Mock ResizeObserver
class ResizeObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

Object.defineProperty(window, 'ResizeObserver', {
  writable: true,
  configurable: true,
  value: ResizeObserver,
});
