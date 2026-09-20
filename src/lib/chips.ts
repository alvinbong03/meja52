export { CHIP_VALUES, breakChip, composeChips, emptyInventory, inventoryTotal, normalizeInventory, reconcileInventory, takeExact } from '../../shared/chips';
export type { ChipCount, ChipValue, TakeResult } from '../../shared/chips';

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
