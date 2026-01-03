'use client';

export interface AgentModeToggleProps {
  /** Whether agent mode is currently enabled */
  isActive: boolean;
  /** Callback when toggled */
  onToggle: () => void;
  /** The effective theme (light or dark) */
  effectiveTheme: 'light' | 'dark';
}

/**
 * AgentModeToggle - Logo-style toggle for Agent Mode
 *
 * Color scheme based on theme and state:
 * - Dark Mode Default: circle: charcoal, pill: cream
 * - Dark Mode Active:  circle: charcoal, pill: primary (green)
 * - Light Mode Default: circle: cream, pill: charcoal
 * - Light Mode Active:  circle: cream, pill: primary (green)
 *
 * The pill blinks like a human eye when active.
 */
export function AgentModeToggle({
  isActive,
  onToggle,
  effectiveTheme,
}: AgentModeToggleProps) {
  // Circle color: charcoal in dark mode, cream in light mode
  const circleColor =
    effectiveTheme === 'dark' ? 'var(--charcoal)' : 'var(--cream)';

  // Pill color: cream→primary-dark in dark mode, charcoal→primary-dark in light mode
  const pillColor =
    effectiveTheme === 'dark'
      ? isActive
        ? 'var(--primary-dark)'
        : 'var(--cream)'
      : isActive
        ? 'var(--primary-dark)'
        : 'var(--charcoal)';

  return (
    <button
      type="button"
      className="w-8 h-8 rounded-full flex items-center justify-center"
      style={{ backgroundColor: circleColor }}
      onClick={onToggle}
      aria-label={isActive ? 'Disable Agent Mode' : 'Enable Agent Mode'}
      aria-pressed={isActive}
      title="Agent Mode"
    >
      <div
        className={`agent-pill w-3.5 h-1.5 rounded-full ${
          isActive ? 'agent-pill-blink' : 'transition-colors'
        }`}
        style={{ backgroundColor: pillColor }}
        aria-hidden="true"
      />
    </button>
  );
}
