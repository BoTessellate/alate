'use client';

import { SelectDropdown, type SelectDropdownProps } from './SelectDropdown';

const CURRENCY_OPTIONS = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'INR', label: 'INR' },
  { value: 'JPY', label: 'JPY' },
  { value: 'AUD', label: 'AUD' },
  { value: 'CAD', label: 'CAD' },
  { value: 'CHF', label: 'CHF' },
];

export interface CurrencySelectProps extends Omit<SelectDropdownProps, 'options'> {
  /** Additional currencies to include */
  additionalCurrencies?: Array<{ value: string; label: string }>;
}

/**
 * CurrencySelect - Pre-configured currency dropdown
 *
 * Usage:
 * ```tsx
 * <CurrencySelect
 *   label="Currency"
 *   value={currency}
 *   onChange={setCurrency}
 * />
 * ```
 */
export function CurrencySelect({
  additionalCurrencies = [],
  ...props
}: CurrencySelectProps) {
  const allOptions = [...CURRENCY_OPTIONS, ...additionalCurrencies];

  return (
    <SelectDropdown
      {...props}
      options={allOptions}
    />
  );
}
