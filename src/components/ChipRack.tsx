import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { chipLabel, composeChips, inventoryTotal, type ChipCount, type ChipValue } from '../lib/chips';
import { Icon } from './Icon';
import { chipPlaceHaptic } from '../lib/device-features';

export function ChipRack({
  amount,
  inventory,
  currency,
  onChip,
  onMakeChange,
}: {
  amount?: number;
  inventory?: ChipCount[];
  currency: string;
  onChip?: (value: ChipValue) => void;
  onMakeChange?: () => void;
}) {
  const chips = inventory ?? composeChips(amount ?? 0);
  const total = inventoryTotal(chips);
  const holdTimer = useRef<number | null>(null);
  const repeatTimer = useRef<number | null>(null);
  const repeated = useRef(false);
  const stop = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    if (repeatTimer.current !== null) window.clearInterval(repeatTimer.current);
    holdTimer.current = repeatTimer.current = null;
  };
  const start = (value: ChipValue) => {
    if (!onChip) return;
    repeated.current = false;
    holdTimer.current = window.setTimeout(() => {
      repeated.current = true;
      onChip(value);
      repeatTimer.current = window.setInterval(() => onChip(value), 120);
    }, 350);
  };
  return (
    <div className="chip-rack-wrap">
      <div className="chip-rack" aria-label={`Chip rack. ${total.toLocaleString('en-MY')} available`}>
      {chips.map(({ value, count }) => {
        const label = chipLabel(currency, value);
        const body = (
          <>
            <span className="poker-chip" data-chip-value={value} aria-hidden="true"><span>{label}</span></span>
            <span className="chip-count" aria-hidden="true">×{count}</span>
          </>
        );
        return onChip ? (
          <button
            key={value}
            type="button"
            className="chip-stack"
            onPointerDown={() => start(value)}
            onPointerUp={stop}
            onPointerCancel={stop}
            onPointerLeave={stop}
            onClick={() => { if (!repeated.current) onChip(value); repeated.current = false; }}
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
      {onMakeChange && (
        <button className="make-change-btn" type="button" onClick={onMakeChange} aria-label="Make change" title="Make change">
          <span className="mini-chip" aria-hidden="true" /><Icon name="edit" size={16} />
        </button>
      )}
    </div>
  );
}

export function StagedChips({ chips: supplied, amount: suppliedAmount, currency, onCommit, onReturnOne }: { chips?: ChipCount[]; amount?: number; currency: string; onCommit?: () => void; onReturnOne?: (value: ChipValue) => void }) {
  const chips = supplied ?? composeChips(suppliedAmount ?? 0);
  const amount = inventoryTotal(chips);
  const [dragY, setDragY] = useState(0);
  const drag = useRef<{ y: number; value: ChipValue; pointerId: number } | null>(null);
  const ready = dragY < -48;
  const down = (event: ReactPointerEvent, value: ChipValue) => {
    drag.current = { y: event.clientY, value, pointerId: event.pointerId };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    setDragY(Math.max(-92, Math.min(72, event.clientY - drag.current.y)));
  };
  const end = (event: ReactPointerEvent) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dy = event.clientY - current.y;
    if (dy < -48) { chipPlaceHaptic(); onCommit?.(); }
    else if (dy > 48) onReturnOne?.(current.value);
    drag.current = null;
    setDragY(0);
  };
  const cancel = () => { drag.current = null; setDragY(0); };
  return (
    <div className="betting-workspace" data-ready={ready || undefined}>
      <div className="bet-drop-hint" aria-live="polite">{ready ? `Release to place ${chipLabel(currency, amount)}` : 'Drag chips here to place bet'}</div>
      <div className="staged-chips" aria-label={`${chipLabel(currency, amount)} staged`} style={{ ['--staged-drag-y' as string]: `${dragY}px` }}>
      {chips.filter(({ count }) => count > 0)
        .map(({ value, count }, index) => (
          <button key={value} type="button" className="staged-stack" aria-label={`${count} ${chipLabel(currency, value)} chip${count === 1 ? '' : 's'} staged. Drag down to return one.`}
            onPointerDown={(event) => down(event, value)} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel}>
            <span className="poker-chip staged-chip" data-chip-value={value} style={{ ['--chip-order' as string]: index }} aria-hidden="true">
              <span>{chipLabel(currency, value)}</span>
            </span>
            {count > 1 && <span className="chip-count" aria-hidden="true">×{count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
