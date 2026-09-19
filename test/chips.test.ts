import { describe, expect, it } from 'vitest';
import { chipLabel, composeChips } from '../src/lib/chips';

describe('visual chip composition', () => {
  it('recomposes a balance exactly using the approved denominations', () => {
    const result = composeChips(995);
    expect(result.reduce((sum, chip) => sum + chip.value * chip.count, 0)).toBe(995);
    expect(result).toEqual([
      { value: 1, count: 0 },
      { value: 5, count: 4 },
      { value: 25, count: 3 },
      { value: 100, count: 9 },
    ]);
  });

  it('can always represent an odd legal amount', () => {
    const result = composeChips(137);
    expect(result.reduce((sum, chip) => sum + chip.value * chip.count, 0)).toBe(137);
  });

  it('uses the room currency symbol on every chip', () => {
    expect(chipLabel('MYR', 25)).toBe('RM25');
    expect(chipLabel('USD', 5)).toBe('$5');
  });
});
