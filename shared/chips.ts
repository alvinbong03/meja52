export const CHIP_VALUES = [1, 5, 10, 20, 50] as const;

export type ChipValue = (typeof CHIP_VALUES)[number];

export interface ChipCount {
  value: ChipValue;
  count: number;
}

const BREAKS: Record<Exclude<ChipValue, 1>, ChipCount[]> = {
  5: [{ value: 1, count: 5 }],
  10: [{ value: 5, count: 2 }],
  20: [{ value: 10, count: 2 }],
  50: [{ value: 20, count: 2 }, { value: 10, count: 1 }],
};

export function emptyInventory(): ChipCount[] {
  return CHIP_VALUES.map((value) => ({ value, count: 0 }));
}

export function normalizeInventory(chips: readonly ChipCount[]): ChipCount[] {
  const counts = new Map<ChipValue, number>(CHIP_VALUES.map((value) => [value, 0]));
  for (const chip of chips) {
    if (!CHIP_VALUES.includes(chip.value) || !Number.isSafeInteger(chip.count) || chip.count < 0) continue;
    counts.set(chip.value, (counts.get(chip.value) ?? 0) + chip.count);
  }
  return CHIP_VALUES.map((value) => ({ value, count: counts.get(value) ?? 0 }));
}

export function inventoryTotal(chips: readonly ChipCount[]) {
  return chips.reduce((sum, chip) => sum + chip.value * chip.count, 0);
}

/**
 * Deterministic practical rack composition. A balance of 50 starts with
 * 10 × 1, 4 × 5 and 2 × 10; larger racks keep that useful small-chip floor,
 * then introduce 20s before filling the remainder with the largest values.
 * Numeric game state remains authoritative.
 */
export function composeChips(amount: number): ChipCount[] {
  let remaining = Math.max(0, Math.floor(amount));
  const byValue = new Map<ChipValue, number>(CHIP_VALUES.map((value) => [value, 0]));
  const add = (value: ChipValue, count: number) => {
    const affordable = Math.min(count, Math.floor(remaining / value));
    byValue.set(value, (byValue.get(value) ?? 0) + affordable);
    remaining -= affordable * value;
  };

  if (remaining >= 50) {
    add(1, 10);
    add(5, 4);
    add(10, 2);
    if (remaining >= 40) add(20, 2);
  }
  for (const value of [...CHIP_VALUES].reverse()) {
    const count = Math.floor(remaining / value);
    byValue.set(value, (byValue.get(value) ?? 0) + count);
    remaining -= count * value;
  }
  return CHIP_VALUES.map((value) => ({ value, count: byValue.get(value) ?? 0 }));
}

export function breakChip(chips: readonly ChipCount[], value: ChipValue): ChipCount[] | null {
  if (value === 1) return null;
  const next = normalizeInventory(chips);
  const source = next.find((chip) => chip.value === value);
  if (!source || source.count < 1) return null;
  source.count -= 1;
  for (const part of BREAKS[value]) {
    const target = next.find((chip) => chip.value === part.value)!;
    target.count += part.count;
  }
  return next;
}

export interface TakeResult {
  remaining: ChipCount[];
  taken: ChipCount[];
  broken: ChipValue[];
}

/** Takes an exact amount, automatically breaking the smallest useful larger chip when needed. */
export function takeExact(chips: readonly ChipCount[], amount: number): TakeResult | null {
  if (!Number.isSafeInteger(amount) || amount < 0 || inventoryTotal(chips) < amount) return null;
  let available = normalizeInventory(chips);
  const taken = emptyInventory();
  const broken: ChipValue[] = [];
  let left = amount;
  let guard = 0;

  while (left > 0 && guard++ < 10_000) {
    const usable = [...CHIP_VALUES].reverse().find((value) => value <= left && available.find((chip) => chip.value === value)!.count > 0);
    if (usable !== undefined) {
      available.find((chip) => chip.value === usable)!.count -= 1;
      taken.find((chip) => chip.value === usable)!.count += 1;
      left -= usable;
      continue;
    }
    const source = CHIP_VALUES.find((value) => value > left && available.find((chip) => chip.value === value)!.count > 0);
    if (source === undefined || source === 1) return null;
    const next = breakChip(available, source);
    if (!next) return null;
    available = next;
    broken.push(source);
  }

  return left === 0 ? { remaining: available, taken, broken } : null;
}

export function reconcileInventory(chips: readonly ChipCount[] | undefined, target: number): ChipCount[] {
  const current = chips ? normalizeInventory(chips) : composeChips(target);
  const total = inventoryTotal(current);
  if (total === target) return current;
  if (total < target) {
    const extra = composeChips(target - total);
    return current.map((chip, index) => ({ ...chip, count: chip.count + extra[index].count }));
  }
  return takeExact(current, total - target)?.remaining ?? composeChips(target);
}
