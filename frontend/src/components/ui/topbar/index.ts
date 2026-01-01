/**
 * Topbar UI Components
 *
 * Reusable, themed components for the TopBar.
 * All components accept a `colors` object from getTopbarColors()
 * for consistent theming across the topbar.
 *
 * Usage:
 * ```tsx
 * import { getTopbarColors, TopbarIconButton, Logo } from '@/components/ui/topbar';
 *
 * const colors = getTopbarColors(isLooksListPage);
 *
 * <Logo isWarmTopbar={isLooksListPage} effectiveTheme={effectiveTheme} />
 * <TopbarIconButton icon={Search} aria-label="Search" colors={colors} />
 * ```
 */

export { getTopbarColors, type TopbarColors, type TopbarVariant } from './useTopbarColors';
export { TopbarIconButton, type TopbarIconButtonProps } from './TopbarIconButton';
export { TopbarTextButton, type TopbarTextButtonProps } from './TopbarTextButton';
export { Logo, type LogoProps } from './Logo';
export { AgentModeToggle, type AgentModeToggleProps } from './AgentModeToggle';
