import { CHIP_VALUES, chipLabel, composeChips } from '../lib/chips';

export function ChipRack({
  amount,
  currency,
  onChip,
}: {
  amount: number;
  currency: string;
  onChip?: (value: number) => void;
}) {
  const chips = composeChips(amount);
  return (
    <div className="chip-rack" aria-label={`Chip rack. ${amount.toLocaleString('en-MY')} available`}>
      {chips.map(({ value, count }, index) => {
        const label = chipLabel(currency, value);
        const body = (
          <>
            <span className="poker-chip" data-chip={index} aria-hidden="true"><span>{label}</span></span>
            <span className="chip-count" aria-hidden="true">×{count}</span>
          </>
        );
        return onChip ? (
          <button
            key={value}
            type="button"
            className="chip-stack"
            onClick={() => onChip(value)}
            disabled={count === 0}
            aria-label={`Add one ${label} chip. ${count} available`}
          >
            {body}
          </button>
        ) : (
          <div key={value} className="chip-stack" aria-label={`${count} ${label} chips`}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

export function StagedChips({ amount, currency }: { amount: number; currency: string }) {
  return (
    <div className="staged-chips" aria-label={`${chipLabel(currency, amount)} staged`}>
      {composeChips(amount)
        .filter(({ count }) => count > 0)
        .map(({ value, count }, index) => (
          <span key={value} className="staged-stack" aria-hidden="true">
            <span className="poker-chip staged-chip" data-chip={CHIP_VALUES.indexOf(value as (typeof CHIP_VALUES)[number])} style={{ ['--chip-order' as string]: index }}>
              <span>{chipLabel(currency, value)}</span>
            </span>
            {count > 1 && <span className="chip-count">×{count}</span>}
          </span>
        ))}
    </div>
  );
}
