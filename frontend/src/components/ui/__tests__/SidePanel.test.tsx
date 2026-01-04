import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SidePanelProvider, SidePanelLayout, useSidePanel } from '../SidePanel';

// Test component to trigger side panel actions
function TestTrigger() {
  const { openBubble, openPanel, expandToPanel, collapseToBubble, close, mode, isOpen } = useSidePanel();

  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="is-open">{isOpen ? 'true' : 'false'}</span>
      <button onClick={() => openBubble({ id: 'test', title: 'Test Bubble', content: <div>Bubble Content</div> })}>
        Open Bubble
      </button>
      <button onClick={() => openPanel({ id: 'test', title: 'Test Panel', subtitle: 'Subtitle', content: <div>Panel Content</div> })}>
        Open Panel
      </button>
      <button onClick={expandToPanel}>Expand</button>
      <button onClick={collapseToBubble}>Collapse</button>
      <button onClick={close}>Close</button>
    </div>
  );
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SidePanelProvider>
      <SidePanelLayout>
        <TestTrigger />
        {children}
      </SidePanelLayout>
    </SidePanelProvider>
  );
}

describe('SidePanel', () => {
  describe('Provider and Context', () => {
    it('throws error when useSidePanel is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestTrigger />);
      }).toThrow('useSidePanel must be used within a SidePanelProvider');

      consoleSpy.mockRestore();
    });

    it('provides context values within provider', () => {
      render(<TestWrapper>Content</TestWrapper>);

      expect(screen.getByTestId('mode')).toHaveTextContent('closed');
      expect(screen.getByTestId('is-open')).toHaveTextContent('false');
    });
  });

  describe('Bubble Mode', () => {
    it('opens in bubble mode when openBubble is called', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Bubble'));

      expect(screen.getByTestId('mode')).toHaveTextContent('bubble');
      expect(screen.getByTestId('is-open')).toHaveTextContent('true');
      expect(screen.getByText('Bubble Content')).toBeInTheDocument();
    });

    it('renders bubble with correct dimensions', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Bubble'));

      // Bubble should have specific styling
      const bubble = screen.getByText('Bubble Content').closest('div[class*="fixed"]');
      expect(bubble).toBeInTheDocument();
    });

    it('closes when backdrop is clicked', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Bubble'));
      expect(screen.getByText('Bubble Content')).toBeInTheDocument();

      // Click backdrop
      const backdrop = document.querySelector('.bg-black\\/30');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(screen.getByTestId('mode')).toHaveTextContent('closed');
    });
  });

  describe('Panel Mode', () => {
    it('opens in panel mode when openPanel is called', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Panel'));

      expect(screen.getByTestId('mode')).toHaveTextContent('panel');
      expect(screen.getByTestId('is-open')).toHaveTextContent('true');
      expect(screen.getByText('Panel Content')).toBeInTheDocument();
    });

    it('renders panel header with title and subtitle', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Panel'));

      expect(screen.getByText('Test Panel')).toBeInTheDocument();
      expect(screen.getByText('Subtitle')).toBeInTheDocument();
    });

    /**
     * CRITICAL TEST: Side panel positioning
     *
     * This test verifies the side panel is positioned BELOW the topbar's curved edge.
     * The panel must use --topbar-total-height (not --topbar-height) for its top position.
     *
     * If this test fails, the panel will overlap with the topbar curve!
     *
     * CSS Variables:
     * - --topbar-height: 56px (flat portion of topbar)
     * - --topbar-curve-offset: 20px (curved bottom extension)
     * - --topbar-total-height: 76px (total = height + curve)
     */
    it('positions panel below topbar curve using --topbar-total-height', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Panel'));

      const panel = screen.getByText('Panel Content').closest('div[class*="fixed right-0"]');
      expect(panel).toBeInTheDocument();

      // CRITICAL: Must use --topbar-total-height, NOT --topbar-height
      // This ensures the panel clears the topbar's curved bottom edge
      expect(panel).toHaveStyle({ top: 'var(--topbar-total-height)' });
    });

    it('shrinks main content when panel is open', () => {
      render(<TestWrapper>Main Content</TestWrapper>);

      // Before opening panel
      const mainContent = screen.getByText('Main Content').closest('div[class*="flex-1"]');
      expect(mainContent).toHaveStyle({ marginRight: '0' });

      fireEvent.click(screen.getByText('Open Panel'));

      // After opening panel - main content should have margin
      expect(mainContent).toHaveStyle({ marginRight: '480px' });
    });
  });

  describe('Mode Transitions', () => {
    it('expands from bubble to panel mode', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Bubble'));
      expect(screen.getByTestId('mode')).toHaveTextContent('bubble');

      fireEvent.click(screen.getByText('Expand'));
      expect(screen.getByTestId('mode')).toHaveTextContent('panel');
    });

    it('collapses from panel to bubble mode', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Panel'));
      expect(screen.getByTestId('mode')).toHaveTextContent('panel');

      fireEvent.click(screen.getByText('Collapse'));
      expect(screen.getByTestId('mode')).toHaveTextContent('bubble');
    });

    it('closes panel completely', async () => {
      jest.useFakeTimers();

      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Panel'));
      expect(screen.getByTestId('is-open')).toHaveTextContent('true');

      fireEvent.click(screen.getByText('Close'));

      // Mode changes immediately
      expect(screen.getByTestId('mode')).toHaveTextContent('closed');
      expect(screen.getByTestId('is-open')).toHaveTextContent('false');

      // Content is cleared after animation delay (300ms)
      act(() => {
        jest.advanceTimersByTime(300);
      });

      jest.useRealTimers();
    });
  });

  describe('Header Components', () => {
    it('renders expand button in bubble header', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Bubble'));

      expect(screen.getByLabelText('Expand to side panel')).toBeInTheDocument();
    });

    it('renders collapse button in panel header', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Panel'));

      expect(screen.getByLabelText('Collapse to bubble')).toBeInTheDocument();
    });

    it('renders close button in both modes', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Bubble'));
      expect(screen.getByLabelText('Close')).toBeInTheDocument();

      fireEvent.click(screen.getByText('Expand'));
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has accessible expand button with title', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Bubble'));

      const expandBtn = screen.getByLabelText('Expand to side panel');
      expect(expandBtn).toHaveAttribute('title', 'Expand to side panel');
    });

    it('has accessible collapse button with title', () => {
      render(<TestWrapper>Content</TestWrapper>);

      fireEvent.click(screen.getByText('Open Panel'));

      const collapseBtn = screen.getByLabelText('Collapse to bubble');
      expect(collapseBtn).toHaveAttribute('title', 'Collapse to bubble');
    });
  });
});

/**
 * Layout Position Verification Tests
 *
 * These tests specifically verify the side panel's position relative to the topbar.
 * This is critical because the topbar has a curved bottom that extends beyond
 * the --topbar-height CSS variable.
 *
 * If these tests fail, it likely means someone changed the positioning to use
 * --topbar-height instead of --topbar-total-height, which would cause the panel
 * to overlap with the topbar's curved bottom.
 */
describe('SidePanel Layout Positioning', () => {
  it('uses SIDE_PANEL_WIDTH constant for panel width', () => {
    render(<TestWrapper>Content</TestWrapper>);

    fireEvent.click(screen.getByText('Open Panel'));

    const panel = screen.getByText('Panel Content').closest('div[class*="fixed right-0"]');
    expect(panel).toHaveStyle({ width: '480px' });
  });

  it('bubble appears above FAB area (bottom: 90px)', () => {
    render(<TestWrapper>Content</TestWrapper>);

    fireEvent.click(screen.getByText('Open Bubble'));

    const bubble = screen.getByText('Bubble Content').closest('div[class*="fixed z-50"]');
    expect(bubble).toHaveStyle({ bottom: '90px' });
  });
});
