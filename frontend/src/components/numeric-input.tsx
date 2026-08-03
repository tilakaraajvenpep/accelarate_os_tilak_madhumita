import type { ComponentProps } from 'react'
import { Input } from '@/components/ui/input'

function sanitizeNumeric(raw: string, allowDecimal: boolean, allowNegative: boolean) {
  const negative = allowNegative && raw.trimStart().startsWith('-')
  const digitsAndDot = raw.replace(/-/g, '').replace(allowDecimal ? /[^0-9.]/g : /[^0-9]/g, '')

  if (!allowDecimal) return (negative ? '-' : '') + digitsAndDot

  const [whole, ...rest] = digitsAndDot.split('.')
  const decimals = rest.join('')
  return (negative ? '-' : '') + whole + (rest.length > 0 ? '.' + decimals : '')
}

interface NumericInputProps extends Omit<ComponentProps<typeof Input>, 'type' | 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  allowDecimal?: boolean
  allowNegative?: boolean
}

/** A text input restricted to digits (optionally one decimal point / a leading minus sign) — avoids the native number input's scroll-wheel-changes-the-value and inconsistent-formatting quirks. */
export function NumericInput({ value, onChange, allowDecimal, allowNegative, ...props }: NumericInputProps) {
  return (
    <Input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={value}
      onChange={(e) => onChange(sanitizeNumeric(e.target.value, !!allowDecimal, !!allowNegative))}
      {...props}
    />
  )
}
