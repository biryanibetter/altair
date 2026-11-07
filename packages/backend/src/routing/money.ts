// Six decimal places are the contract precision. Never aggregate money with floats.
const scale = BigInt(1_000_000)
export function units(value: string): bigint {
  if (!/^\d+(?:\.\d{1,6})?$/.test(value)) throw new Error('invalid_decimal')
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * scale + BigInt(fraction.padEnd(6, '0'))
}
export function decimal(value: bigint): string {
  const fraction = (value % scale).toString().padStart(6, '0').replace(/0+$/, '').padEnd(2, '0')
  return `${value / scale}.${fraction}`
}
export function multiply(amount: string, quantity: number): string {
  // Quantities are explicitly rounded to six decimals; costs round half-up at that precision.
  const q = units(quantity.toFixed(6))
  return decimal((units(amount) * q + scale / BigInt(2)) / scale)
}
