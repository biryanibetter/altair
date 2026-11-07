import { z } from 'zod'

// Expand JSON number tokens with string arithmetic, never through IEEE-754.
// Node >=22 supplies the original token in JSON.parse's reviver context.
export function decimalToken(token: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token)
  if (!match || token.length > 300 || Math.abs(Number(match[4] ?? 0)) > 100) throw new Error('invalid_trade_decimal')
  const digits = match[2] + (match[3] ?? '')
  if (match[1] && /[1-9]/.test(digits)) throw new Error('negative_trade_decimal')
  const point = match[2].length + Number(match[4] ?? 0)
  const expanded = point <= 0 ? `0.${'0'.repeat(-point)}${digits}` : point >= digits.length ? digits + '0'.repeat(point - digits.length) : `${digits.slice(0, point)}.${digits.slice(point)}`
  return expanded.replace(/^0+(?=\d)/, '').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

// Production HTTP passes strings preserved from numeric tokens. Numeric input is
// supported for explicitly constructed fixtures; unsafe numeric inputs are rejected.
export const tradeDecimal = z.union([
  z.string().regex(/^\d+(?:\.\d+)?$/).max(400),
  z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER).transform(v => decimalToken(String(v))),
])
