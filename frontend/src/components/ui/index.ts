/**
 * UI Component Library
 *
 * Centralized, reusable components for consistent styling and behavior.
 *
 * Usage:
 * ```tsx
 * import { Button, Card, Input, Modal } from '@/components/ui';
 *
 * <Card variant="interactive">
 *   <Input label="Name" />
 *   <Button variant="primary">Submit</Button>
 * </Card>
 * ```
 */

// Buttons
export { Button, IconButton, type ButtonProps } from './Button';

// Card/Surface
export {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  type CardProps,
} from './Card';

// Dropdown/Menu
export {
  Dropdown,
  DropdownMenu,
  DropdownTrigger,
  DropdownItem,
  DropdownDivider,
  DropdownLabel,
  type DropdownProps,
  type DropdownMenuProps,
  type DropdownItemProps,
} from './Dropdown';

// Modal/Dialog
export {
  Modal,
  ModalContent,
  ModalFooter,
  type ModalProps,
} from './Modal';

// Input/Form
export {
  Input,
  Textarea,
  FormField,
  PasswordInput,
  type InputProps,
  type TextareaProps,
  type FormFieldProps,
  type PasswordInputProps,
} from './Input';

// Select
export { Select, type SelectProps } from './Select';

// Page Structure
export {
  PageHeader,
  SectionHeader,
  type PageHeaderProps,
  type SectionHeaderProps,
} from './PageHeader';

// Divider
export { Divider, type DividerProps } from './Divider';

// Empty States
export {
  EmptyState,
  InlineEmptyState,
  type EmptyStateProps,
} from './EmptyState';

// Toggle/Switch
export { Toggle, type ToggleProps } from './Toggle';

// Chip
export { Chip, type ChipProps } from './Chip';

// Checkbox
export { Checkbox, type CheckboxProps } from './Checkbox';

// Error Boundary
export {
  ErrorBoundary,
  withErrorBoundary,
  type ErrorBoundaryProps,
} from './ErrorBoundary';

// Topbar-specific components
export {
  getTopbarColors,
  TopbarIconButton,
  TopbarTextButton,
  Logo,
  AgentModeToggle,
  type TopbarColors,
  type TopbarVariant,
  type TopbarIconButtonProps,
  type TopbarTextButtonProps,
  type LogoProps,
  type AgentModeToggleProps,
} from './topbar';
