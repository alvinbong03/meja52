import { describe, expect, it } from 'vitest';
import { breakChip, breakChipInto, chipLabel, composeChips, inventoryTotal, takeExact } from '../src/lib/chips';

describe('visual chip composition', () => {
  it('recomposes a balance exactly using the approved denominations', () => {
    const result = composeChips(995);
    expect(result.reduce((sum, chip) => sum + chip.value * chip.count, 0)).toBe(995);
    expect(result).toEqual([
      { value: 1, count: 10 },
      { value: 5, count: 5 },
      { value: 10, count: 2 },
      { value: 20, count: 2 },
      { value: 50, count: 18 },
    ]);
  });

  it('gives a 50-unit rack the approved useful small-chip mix', () => {
    expect(composeChips(50)).toEqual([
      { value: 1, count: 10 },
      { value: 5, count: 4 },
      { value: 10, count: 2 },
      { value: 20, count: 0 },
      { value: 50, count: 0 },
    ]);
  });

  it('can always represent an odd legal amount', () => {
    const result = composeChips(137);
    expect(result.reduce((sum, chip) => sum + chip.value * chip.count, 0)).toBe(137);
  });

  it('uses the room currency symbol on every chip', () => {
    expect(chipLabel('MYR', 20)).toBe('RM20');
    expect(chipLabel('USD', 5)).toBe('$5');
  });

  it('breaks a chip without changing the balance', () => {
    const rack = [
      { value: 1 as const, count: 0 },
      { value: 5 as const, count: 0 },
      { value: 10 as const, count: 0 },
      { value: 20 as const, count: 0 },
      { value: 50 as const, count: 1 },
    ];
    const changed = breakChip(rack, 50)!;
    expect(inventoryTotal(changed)).toBe(50);
    expect(changed.find((chip) => chip.value === 20)?.count).toBe(2);
    expect(changed.find((chip) => chip.value === 10)?.count).toBe(1);
  });

  it('accepts a custom exact-value breakdown and rejects invalid replacements', () => {
    const rack = composeChips(50).map((chip) => chip.value === 50 ? { ...chip, count: 1 } : { ...chip, count: 0 });
    const changed = breakChipInto(rack, 50, [{ value: 1, count: 20 }, { value: 5, count: 6 }])!;
    expect(inventoryTotal(changed)).toBe(50);
    expect(changed.find((chip) => chip.value === 1)?.count).toBe(20);
    expect(changed.find((chip) => chip.value === 5)?.count).toBe(6);
    expect(breakChipInto(rack, 50, [{ value: 20, count: 2 }])).toBeNull();
    expect(breakChipInto(rack, 20, [{ value: 50, count: 1 }])).toBeNull();
  });

  it('automatically makes exact change for a wager', () => {
    const result = takeExact(composeChips(25), 7)!;
    expect(inventoryTotal(result.taken)).toBe(7);
    expect(inventoryTotal(result.remaining)).toBe(18);
    expect(result.broken.length).toBeGreaterThan(0);
  });
});
