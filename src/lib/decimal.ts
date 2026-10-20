import DecimalJs from 'decimal.js'

/**
 * Decimal constructor configured like Elixir's default `Decimal` context
 * (28 significant digits, round half up), so intermediate rounding matches the
 * original implementation step for step.
 */
export const Decimal = DecimalJs.clone({ precision: 28, rounding: DecimalJs.ROUND_HALF_UP })

export type Decimal = DecimalJs
export type DecimalValue = DecimalJs.Value
