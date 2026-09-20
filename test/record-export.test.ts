import { describe, expect, it } from 'vitest';
import { csvCell } from '../src/lib/record-export';

describe('CSV cells', () => {
  it('preserves ordinary values and escapes quotes', () => {
    expect(csvCell('Alice')).toBe('"Alice"');
    expect(csvCell('Al "Ace"')).toBe('"Al ""Ace"""');
    expect(csvCell(-100)).toBe('"-100"');
  });

  it.each(['=HYPERLINK("https://example.com")', '+SUM(1,2)', '-1+2', '@SUM(1,2)', '  =1+1', '\t@SUM(1,2)'])(
    'neutralizes formula-like text: %s',
    (value) => expect(csvCell(value)).toBe(`"'${value.replaceAll('"', '""')}"`),
  );
});
