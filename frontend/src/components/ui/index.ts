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

// Page Structure
export {
  PageHeader,
  SectionHeader,
  type PageHeaderProps,
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

// Topbar-specific components
export {
  getTopbarColors,
  TopbarIconButton,
  TopbarTextButton,
  Logo,
  AgentModeToggle,
  type TopbarColors,
  type TopbarIconButtonProps,
  type TopbarTextButtonProps,
  type LogoProps,
  type AgentModeToggleProps,
} from './topbar';
