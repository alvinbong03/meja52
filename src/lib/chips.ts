export const CHIP_VALUES = [1, 5, 25, 100] as const;

export interface ChipCount {
  value: number;
  count: number;
}

/** Deterministic visual composition. Numeric game state remains authoritative. */
export function composeChips(amount: number, values: readonly number[] = CHIP_VALUES): ChipCount[] {
  let remaining = Math.max(0, Math.floor(amount));
  const counts = [...values]
    .sort((a, b) => b - a)
    .map((value) => {
      const count = Math.floor(remaining / value);
      remaining -= count * value;
      return { value, count };
    })
    .reverse();
  if (remaining > 0) counts.unshift({ value: 1, count: remaining });
  return counts;
}

export function chipLabel(currency: string, value: number) {
  const parts = new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).formatToParts(value);
  const symbol = parts.find((part) => part.type === 'currency')?.value ?? currency;
  return `${symbol}${value.toLocaleString('en-MY')}`;
}
