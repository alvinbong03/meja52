import { useEffect, useMemo, useRef, useState } from 'react';
import {
  bySeat,
  findPlayer,
  legalActions,
  shareOut,
  type ActionKind,
  type Legal,
  type Player,
} from '../../shared/engine';
import { fmt } from '../lib/format';
import { CHIP_VALUES, chipLabel, composeChips, emptyInventory, inventoryTotal, takeExact, type ChipCount, type ChipValue } from '../lib/chips';
import { useTable } from '../lib/table';
import { useShake } from '../lib/motion';
import { ChipRack, StagedChips } from './ChipRack';
import { Icon } from './Icon';
import { Num } from './Num';
import { toast } from './Toast';

const ACT_FOR_AFTER_MS = 15_000;

export function Dock({ onRebuy, onRunout, onOverride }: { onRebuy: () => void; onRunout: () => void; onOverride: () => void }) {
  const shaking = useShake();
  return (
    <div className="dock-shake" data-shake={shaking || undefined}>
      <DockBody onRebuy={onRebuy} onRunout={onRunout} onOverride={onOverride} />
    </div>
  );
}

function DockBody({ onRebuy, onRunout, onOverride }: { onRebuy: () => void; onRunout: () => void; onOverride: () => void }) {
  const { game, you, me, room, serverNow, away, member, isHost, isController } = useTable();
  const [actingFor, setActingFor] = useState<string | null>(null);

  const actorId = game.toActId;
  useEffect(() => setActingFor(null), [actorId, game.phase]);

  if (game.phase === 'lobby') return <LobbyDock />;
  if (room.paused) {
    return (
      <div className="dock dock-hold" role="status">
        <span className="label">Hand paused</span>
        <strong>{room.voidProposal ? 'Void under review' : 'Actions are temporarily locked'}</strong>
        <small>{room.voidProposal ? 'The host is reviewing the hand with the table.' : 'The table remains visible while the host resolves the issue.'}</small>
      </div>
    );
  }

  if (game.phase === 'showdown') {
    if (room.overrideProposal) return <OverrideReview />;
    if (room.awardProposal) return <AwardPreview onOverride={onOverride} />;
    if (game.runout && !room.runoutPlan) return <RunoutGate onRunout={onRunout} />;
    if (room.runoutPlan?.phase === 'dealing') return <RunoutDealPanel />;
    return <AwardPanel />;
  }
  if (game.phase === 'done') return <ResultsPanel onRebuy={onRebuy} />;

  if (room.correctionForId) {
    const correctionPlayer = findPlayer(game, room.correctionForId);
    if (isHost && correctionPlayer) {
      const legal = legalActions(game, correctionPlayer.id);
      if (legal) return <ActionPanel legal={legal} player={correctionPlayer} actingFor correcting />;
    }
    return (
      <div className="dock dock-hold" role="status">
        <span className="label">Correction in progress</span>
        <strong>The host is entering the corrected action</strong>
        <small>The original action stays in table history.</small>
      </div>
    );
  }

  if (you.legal && me) return <ActionPanel legal={you.legal} player={me} />;

  const actor = findPlayer(game, actorId);
  const actorMember = member(actorId);
  const waited = room.turnStartedAt ? serverNow - room.turnStartedAt : 0;
  const canActFor = !!actor && !!me && (isHost || isController) && (actorMember?.manual || (away(actorId) && waited >= ACT_FOR_AFTER_MS));

  if (actingFor && actor && actingFor === actor.id) {
    const legal = legalActions(game, actor.id);
    if (legal) {
      return <ActionPanel legal={legal} player={actor} actingFor onCancel={() => setActingFor(null)} />;
    }
  }

  return (
    <div className="dock">
      <MyStatus onRebuy={onRebuy} />
      {canActFor && actor && (
        <button className="btn btn-quiet btn-lg btn-block" onClick={() => setActingFor(actor.id)}>
          Act for {actor.name}
        </button>
      )}
    </div>
  );
}

function RunoutGate({ onRunout }: { onRunout: () => void }) {
  const { isHost, nameOf, room } = useTable();
  return (
    <div className="dock dock-runout">
      <span className="label">All players are all-in</span>
      <strong>{isHost ? 'Choose how many times to run the board' : `Waiting for ${nameOf(room.hostId)} to choose the runouts`}</strong>
      {isHost && <button className="btn btn-primary btn-xl btn-block" onClick={onRunout}>Run remaining board…</button>}
    </div>
  );
}

function RunoutDealPanel() {
  const { room, isController, nameOf, run, busy, v } = useTable();
  const plan = room.runoutPlan!;
  const ordinal = ['First', 'Second', 'Third', 'Fourth'][plan.current] ?? `Runout ${plan.current + 1}`;
  const cards = plan.fromStreet === 0 ? 'flop, turn and river' : plan.fromStreet === 1 ? 'turn and river' : 'river';
  if (!isController) {
    return <div className="dock"><p className="dock-wait">Waiting for {nameOf(room.controllerId)} to complete runout {plan.current + 1} of {plan.count}</p></div>;
  }
  return (
    <div className="dock dock-runout">
      <div className="turn-overview">
        <div><span className="turn-title">Runout {plan.current + 1} of {plan.count}</span><span className="turn-sub">Table Controller</span></div>
        <span className="turn-metric"><small>Pot</small><Num value={room.potTotal} /></span>
      </div>
      <div className="runout-deal-copy">
        <strong>Deal the {ordinal.toLowerCase()} {cards}</strong>
        <span>Complete this physical runout before selecting its winner.</span>
      </div>
      <div className="runout-progress" aria-label={`Runout ${plan.current + 1} of ${plan.count}`}>
        {Array.from({ length: plan.count }, (_, index) => <i key={index} data-on={index <= plan.current || undefined} />)}
      </div>
      <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={() => run({ type: 'completeRunout', v })}>
        {ordinal} runout complete
      </button>
      <small className="centre muted">Each runout awards its portion of every pot.</small>
    </div>
  );
}

function MyStatus({ onRebuy }: { onRebuy: () => void }) {
  const { game, me, room } = useTable();
  if (!me) return null;
  const inHand = me.inHand && (game.phase === 'betting' || game.phase === 'showdown');
  let note: string;
  if (!inHand) note = me.stack === 0 ? 'Busted' : me.sittingOut ? 'On break' : 'In from the next hand';
  else if (me.folded) note = 'Folded';
  else if (me.allIn) note = 'All in';
  else note = me.committed > 0 ? `${fmt(me.committed)} in this hand` : 'In the hand';
  const canRebuy = me.stack === 0 && !inHand;
  return (
    <div className="my-status">
      <div className="my-status-line">
        <div>
          <span className="label">Your balance</span>
          <Num value={me.stack} className="my-stack" />
        </div>
        <div className="my-note">
          <span>{note}</span>
          {canRebuy && (
            <button className="btn btn-quiet btn-sm" onClick={onRebuy}>
              Request rebuy
            </button>
          )}
        </div>
      </div>
      <ChipRack amount={me.stack} currency={room.currency} />
    </div>
  );
}

// ---------------- your turn ----------------

interface ActionProps {
  legal: Legal;
  player: Player;
  actingFor?: boolean;
  correcting?: boolean;
  onCancel?: () => void;
}

function ActionPanel({ legal, player, actingFor, correcting, onCancel }: ActionProps) {
  const { game, room, run, busy, v, you } = useTable();
  const [raising, setRaising] = useState(false);
  const [staged, setStaged] = useState<ChipCount[]>(emptyInventory());
  const [changing, setChanging] = useState(false);
  const pot = room.potTotal;
  const openLabel = game.currentBet === 0 ? 'Bet' : 'Raise';
  const inventory = you.chipInventoryPlayerId === player.id && you.chipInventory ? you.chipInventory : composeChips(player.stack);
  const stagedAmount = inventoryTotal(staged);
  const available = inventory.map((chip) => ({ ...chip, count: Math.max(0, chip.count - (staged.find((row) => row.value === chip.value)?.count ?? 0)) }));

  const act = (kind: ActionKind, amount?: number, chips?: ChipCount[]) =>
    run({ type: 'act', v, kind, ...(amount !== undefined ? { amount } : {}), ...(chips ? { chips } : {}), ...(actingFor ? { playerId: player.id } : {}) });

  useEffect(() => {
    setRaising(false);
    setStaged(emptyInventory());
    setChanging(false);
  }, [v]);

  useEffect(() => {
    if (raising) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest('input, textarea, dialog[open]')) return;
      const k = e.key.toLowerCase();
      if (k === 'f' && legal.canFold) void act('fold');
      else if (k === 'c') void act(legal.canCheck ? 'check' : 'call');
      else if (k === 'r' && legal.canRaise) setRaising(true);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (raising && legal.canRaise) {
    return (
      <RaisePanel
        legal={legal}
        pot={pot}
        currentBet={game.currentBet}
        bb={game.settings.bb}
        label={openLabel}
        player={player}
        inventory={inventory}
        currency={room.currency}
        busy={busy}
        onBack={() => setRaising(false)}
        onConfirm={(amount, chips) => act('raise', amount, chips)}
      />
    );
  }

  const raiseTo = player.bet + stagedAmount;
  const stagesCall = stagedAmount > 0 && stagedAmount === legal.callAmount;
  const stagesRaise = stagedAmount > 0 && legal.canRaise && raiseTo > game.currentBet && raiseTo <= legal.maxRaiseTo;
  const stagedValid = stagesCall || stagesRaise;
  const stagedAllIn = stagedAmount === player.stack;
  const stagedStatus = stagesCall
    ? stagedAllIn ? `All in ${fmt(stagedAmount)}` : `Calling ${fmt(stagedAmount)}`
    : stagesRaise
      ? stagedAllIn ? `All in to ${fmt(raiseTo)}` : `${openLabel === 'Bet' ? 'Betting' : 'Raising'} to ${fmt(raiseTo)}`
      : raiseTo > game.currentBet
        ? `Raise to ${fmt(raiseTo)}`
        : `${fmt(Math.max(0, legal.callAmount - stagedAmount))} more to call`;

  const addChip = (value: ChipValue) => setStaged((current) => {
    const used = current.find((chip) => chip.value === value)?.count ?? 0;
    const owned = inventory.find((chip) => chip.value === value)?.count ?? 0;
    if (used >= owned || inventoryTotal(current) + value > player.stack) return current;
    return current.map((chip) => chip.value === value ? { ...chip, count: chip.count + 1 } : chip);
  });
  const returnOne = (value: ChipValue) => setStaged((current) => current.map((chip) => chip.value === value ? { ...chip, count: Math.max(0, chip.count - 1) } : chip));
  const stageExact = (amount: number) => {
    const result = takeExact(inventory, amount);
    if (!result) return;
    setStaged(result.taken);
    if (result.broken.length > 0) toast(`Made change automatically for ${fmt(amount)}.`);
  };
  const place = () => {
    if (stagesCall) void act('call', undefined, staged);
    else if (stagesRaise) void act('raise', raiseTo, staged);
  };

  const callText = legal.callIsAllIn ? `All in ${fmt(legal.callAmount)}` : `Call ${fmt(legal.callAmount)}`;
  const buttons = [
    legal.canFold && { key: 'fold', label: 'Fold', hint: 'F', cls: 'btn-turn-quiet', onClick: () => act('fold') },
    legal.canCheck
      ? { key: 'check', label: 'Check', hint: 'C', cls: 'btn-turn-main', onClick: () => act('check') }
      : { key: 'call', label: callText, hint: 'C', cls: 'btn-turn-main', onClick: () => act('call') },
    legal.canRaise && { key: 'raise', label: openLabel, hint: 'R', cls: 'btn-turn-quiet', onClick: () => setRaising(true) },
  ].filter(Boolean) as { key: string; label: string; hint: string; cls: string; onClick: () => void }[];

  return (
    <div className="dock dock-turn" data-acting-for={actingFor || undefined}>
      <div className="turn-overview">
        <div>
          <span className="turn-title">{correcting ? `Correcting ${player.name}` : actingFor ? `Acting for ${player.name}` : 'Your turn'}</span>
          <span className="turn-sub">{legal.toCall > 0 ? `${fmt(legal.callAmount)} to call` : 'Check is available'}</span>
        </div>
        <span className="turn-metric"><small>Pot</small><Num value={pot} /></span>
        <span className="turn-metric"><small>Balance</small><Num value={player.stack} /></span>
        {actingFor && onCancel && (
          <button className="icon-btn" onClick={onCancel} aria-label="Stop acting for this player">
            <Icon name="close" />
          </button>
        )}
      </div>
      {stagedAmount > 0 && <StagedChips chips={staged} currency={room.currency} onCommit={stagedValid ? place : undefined} onReturnOne={returnOne} />}
      {stagedAmount > 0 ? (
        <div className="staged-actions">
          <button className="staged-clear" onClick={() => setStaged(emptyInventory())}>Clear</button>
          <span className="staged-status"><i aria-hidden="true" />{stagedStatus}</span>
          <button className="btn btn-turn btn-turn-main staged-place" onClick={place} disabled={!stagedValid || busy}>
            {stagedValid ? `Place ${fmt(stagedAmount)}` : 'Add chips'}
          </button>
        </div>
      ) : (
        <div className="turn-buttons" data-count={buttons.length}>
          {buttons.map((b) => (
            <button key={b.key} className={`btn btn-turn ${b.cls}`} onClick={b.key === 'call' ? () => stageExact(legal.callAmount) : b.onClick} disabled={busy}>
              {b.label}
              <kbd className="kbd">{b.hint}</kbd>
            </button>
          ))}
        </div>
      )}
      {!actingFor && (
        <div className="private-hand-total">
          <span>In this hand</span>
          <Num value={player.committed} />
        </div>
      )}
      {changing ? (
        <ChangeChipPanel
          inventory={available}
          currency={room.currency}
          busy={busy}
          onCancel={() => setChanging(false)}
          onConfirm={(value, into) => void run({ type: 'changeChip', v, value, into, ...(actingFor ? { playerId: player.id } : {}) })}
        />
      ) : (
        <ChipRack inventory={available} currency={room.currency} onChip={addChip} onMakeChange={available.some((chip) => chip.value > 1 && chip.count > 0) ? () => setChanging(true) : undefined} />
      )}
    </div>
  );
}

function ChangeChipPanel({ inventory, currency, busy, onCancel, onConfirm }: { inventory: ChipCount[]; currency: string; busy: boolean; onCancel: () => void; onConfirm: (value: ChipValue, into: ChipCount[]) => void }) {
  const [source, setSource] = useState<ChipValue | null>(null);
  const [into, setInto] = useState<ChipCount[]>(emptyInventory());
  const total = inventoryTotal(into);
  const ready = source !== null && total === source && into.some((chip) => chip.count > 0);
  const chooseSource = (value: ChipValue) => { setSource(value); setInto(emptyInventory()); };
  const setCount = (value: ChipValue, count: number) => setInto((current) => current.map((chip) => chip.value === value
    ? { ...chip, count: Math.max(0, Math.min(source === null ? 0 : Math.floor(source / value), Number.isFinite(count) ? Math.floor(count) : 0)) }
    : chip));
  const add = (value: ChipValue) => setCount(value, (into.find((chip) => chip.value === value)?.count ?? 0) + 1);
  const remaining = source === null ? 0 : source - total;
  return (
    <div className="change-chip-panel" role="dialog" aria-labelledby="change-chip-title">
      <div className="change-chip-heading">
        <div><span className="label">Balance stays the same</span><strong id="change-chip-title">Make change</strong></div>
        {source !== null && <span className="change-chip-total" data-ready={ready || undefined}>{chipLabel(currency, total)} of {chipLabel(currency, source)}</span>}
      </div>
      <div className="change-chip-step">
        <span className="change-chip-instruction">1 · Choose one chip to break</span>
        <div className="change-chip-rack" aria-label="Choose a chip to break">
          {inventory.map(({ value, count }) => {
            const selectable = value > 1 && count > 0;
            return <button key={value} type="button" className="chip-stack" data-selected={source === value || undefined} disabled={!selectable} onClick={() => chooseSource(value)} aria-label={`Break one ${chipLabel(currency, value)} chip. ${count} available`}>
              <span className="poker-chip" data-chip-value={value} aria-hidden="true"><span>{chipLabel(currency, value)}</span></span>
              <span className="chip-count" aria-hidden="true">×{count}</span>
            </button>;
          })}
        </div>
      </div>
      {source !== null && (
        <div className="change-chip-step change-chip-compose">
          <div className="change-chip-copy">
            <span className="change-chip-instruction">2 · Build {chipLabel(currency, source)} in smaller chips</span>
            <span aria-live="polite">{ready ? 'Exact amount ready' : remaining >= 0 ? `${chipLabel(currency, remaining)} remaining` : `${chipLabel(currency, Math.abs(remaining))} over`}</span>
          </div>
          <div className="change-chip-rack change-chip-builder" aria-label="Replacement chip rack">
            {CHIP_VALUES.filter((value) => value < source).map((value) => {
              const count = into.find((chip) => chip.value === value)?.count ?? 0;
              return <div className="change-chip-option" key={value}>
                <button type="button" className="chip-stack" onClick={() => add(value)} aria-label={`Add one ${chipLabel(currency, value)} replacement chip`}>
                  <span className="poker-chip" data-chip-value={value} aria-hidden="true"><span>{chipLabel(currency, value)}</span></span>
                </button>
                <label><span className="sr-only">Number of {chipLabel(currency, value)} chips</span><input type="number" inputMode="numeric" min="0" max={Math.floor(source / value)} value={count} onChange={(event) => setCount(value, Number(event.target.value))} aria-label={`Number of ${chipLabel(currency, value)} chips`} /></label>
              </div>;
            })}
          </div>
        </div>
      )}
      <div className="change-chip-actions">
        <button className="btn btn-quiet btn-sm" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary btn-sm" type="button" disabled={!ready || busy} onClick={() => source !== null && onConfirm(source, into.filter((chip) => chip.count > 0))}>Break chip</button>
      </div>
    </div>
  );
}

interface RaiseProps {
  legal: Legal;
  pot: number;
  currentBet: number;
  bb: number;
  label: string;
  player: Player;
  inventory: ChipCount[];
  currency: string;
  busy: boolean;
  onBack: () => void;
  onConfirm: (amount: number, chips: ChipCount[]) => void;
}

function RaisePanel({ legal, pot, currentBet, bb, label, player, inventory, currency, busy, onBack, onConfirm }: RaiseProps) {
  const min = legal.minRaiseTo;
  const max = legal.maxRaiseTo;
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const clamp = (n: number) => Math.max(min, Math.min(max, Math.round(n)));
  const set = (n: number) => {
    const c = clamp(n);
    setAmount(c);
    setText(String(c));
  };

  const presets = useMemo(() => {
    const potAfterCall = pot + legal.toCall;
    const opening = currentBet === 0;
    const half = opening ? pot / 2 : currentBet + potAfterCall / 2;
    const full = opening ? pot : currentBet + potAfterCall;
    return [
      { label: 'Next', value: min },
      { label: '½ pot', value: clamp(half) },
      { label: 'Pot', value: clamp(full) },
      { label: 'All in', value: max },
    ];
  }, [pot, legal.toCall, currentBet, min, max]);

  const valid = amount !== null && Number.isSafeInteger(amount) && amount <= max && (amount >= min || amount === max);
  const final = amount ?? min;
  const allIn = amount === max;
  const contribution = amount === null ? 0 : Math.max(0, amount - player.bet);
  const stagedResult = takeExact(inventory, contribution);
  const stagedChips = stagedResult?.taken ?? emptyInventory();
  const confirm = () => {
    if (valid && !busy && stagedResult) onConfirm(final, stagedChips);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
      else if (e.key === 'Enter') confirm();
      else if (e.key === 'ArrowUp' && e.target !== inputRef.current) set((amount ?? currentBet) + bb);
      else if (e.key === 'ArrowDown' && e.target !== inputRef.current) set((amount ?? currentBet) - bb);
      else if (e.key.toLowerCase() === 'a' && e.target !== inputRef.current) set(max);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="dock dock-turn dock-raise">
      <div className="turn-overview">
        <div><span className="turn-title">Your turn</span><span className="turn-sub">Build your wager</span></div>
        <span className="turn-metric"><small>Pot</small><Num value={pot} /></span>
        <span className="turn-metric"><small>Balance</small><Num value={player.stack} /></span>
      </div>
      <div className="raise-heading">
        <span className="turn-title">{label === 'Bet' ? 'Bet' : 'Raise to'}</span>
        <span className="turn-sub">Any amount above {fmt(currentBet)}</span>
      </div>
      {amount !== null && <StagedChips chips={stagedChips} currency={currency} onCommit={valid ? confirm : undefined} />}
      <div className="raise-utility">
        <button className="staged-clear" onClick={amount === null ? onBack : () => { setAmount(null); setText(''); setCustom(false); }}>{amount === null ? 'Back' : 'Clear'}</button>
        <span>{amount === null ? 'Tap chips or choose a shortcut.' : `${label === 'Bet' ? 'Betting' : 'Raising'} to ${fmt(final)}`}</span>
      </div>
      {custom && (
        <label className="raise-amount custom-amount">
          <span className="turn-sub">Custom amount</span>
          <input ref={inputRef} className="raise-input num" inputMode="numeric" pattern="[0-9]*" value={text} aria-invalid={text.length > 0 && !valid} autoFocus
            onChange={(e) => { const digits = e.target.value.replace(/\D/g, '').slice(0, 10); setText(digits); const n = Number(digits); setAmount(digits ? Math.min(max, n) : null); }} />
        </label>
      )}
      {amount !== null && (
        <button className="btn btn-turn btn-turn-main staged-place" onClick={confirm} disabled={!valid || busy}>
          {allIn ? `Place all in ${fmt(max)}` : `Place ${fmt(final)}`}
        </button>
      )}
      <div className="presets raise-presets">
        {presets.map((p) => (
          <button key={p.label} className="preset" data-on={(amount !== null && final === p.value) || undefined} onClick={() => set(p.value)}>
            <span>{p.label}</span><strong>{fmt(p.value)}</strong>
          </button>
        ))}
        <button className="preset" data-on={custom || undefined} onClick={() => { setCustom(true); setAmount(null); setText(''); }}><span>Custom</span><strong>Type amount</strong></button>
      </div>
      <div className="private-hand-total">
        <span>In this hand</span>
        <Num value={player.committed} />
      </div>
      <ChipRack
        inventory={stagedResult?.remaining ?? inventory}
        currency={currency}
        onChip={(value) => setAmount(Math.min(max, (amount ?? player.bet) + value))}
      />
    </div>
  );
}

// ---------------- showdown ----------------

function useProposedAwards() {
  const { game, room } = useTable();
  const proposal = room.awardProposal;
  if (!proposal) return [];
  return proposal.potIds.flatMap((potId) => {
    const pot = game.pots.find((item) => item.id === potId);
    const winners = proposal.winners[String(potId)] ?? [];
    return pot ? shareOut(game, pot.amount, winners) : [];
  }).reduce<{ id: string; amount: number }[]>((rows, item) => {
    const existing = rows.find((row) => row.id === item.id);
    if (existing) existing.amount += item.amount;
    else rows.push({ ...item });
    return rows;
  }, []);
}

function AwardPreview({ onOverride }: { onOverride: () => void }) {
  const { room, me, isHost, isController, nameOf, run, busy, v } = useTable();
  const proposal = room.awardProposal!;
  const awards = useProposedAwards();
  const disputed = !!proposal.disputedBy;
  const canRevise = isHost || isController;
  return (
    <div className="dock dock-award-review" role="status">
      <div className="award-review-head">
        <div>
          <span className="label">Award preview</span>
          <strong>{disputed ? 'Payout disputed' : 'Check the result together'}</strong>
        </div>
        <span className="award-state" data-disputed={disputed || undefined}>{disputed ? 'On hold' : 'Preview'}</span>
      </div>
      <div className="award-lines">
        {awards.map((award) => (
          <div className="award-line" key={award.id}>
            <span>{nameOf(award.id)}</span>
            <span className="num">+{fmt(award.amount)}</span>
          </div>
        ))}
      </div>
      <p className="award-note">
        {disputed ? `${nameOf(proposal.disputedBy!)} asked the table to review this award.` : 'No chips move until the Table Controller confirms.'}
      </p>
      {disputed ? (
        <div className="award-actions">
          {canRevise && <button className="btn btn-quiet btn-lg" disabled={busy} onClick={() => run({ type: 'cancelAward', v })}>Choose winners again</button>}
          {isHost && <button className="btn btn-primary btn-lg" onClick={onOverride}>Table override…</button>}
        </div>
      ) : (
        <div className="award-actions">
          {me && <button className="btn btn-quiet btn-lg" disabled={busy} onClick={() => run({ type: 'disputeAward', v })}>Dispute</button>}
          {isController && <button className="btn btn-primary btn-lg" disabled={busy} onClick={() => run({ type: 'confirmAward', v })}>Confirm award</button>}
        </div>
      )}
      {!isController && !disputed && <small className="centre muted">Waiting for {nameOf(room.controllerId)} to confirm</small>}
    </div>
  );
}

function OverrideReview() {
  const { room, me, isHost, nameOf, run, busy, v } = useTable();
  const proposal = room.overrideProposal!;
  const controllerId = room.controllerId ?? room.hostId;
  const approved = new Set(proposal.approvals);
  const connected = new Set(room.members.filter((member) => member.connections > 0).map((member) => member.id));
  const controllerApproved = !!controllerId && approved.has(controllerId) && connected.has(controllerId);
  const secondApproved = [...approved].some((id) => id !== controllerId && connected.has(id));
  const ready = controllerApproved && secondApproved;
  return (
    <div className="dock dock-override-review" role="status">
      <div className="award-review-head">
        <div>
          <span className="label">Table override</span>
          <strong>Not rules-validated</strong>
        </div>
        <span className="award-state" data-disputed>Review</span>
      </div>
      <p className="override-reason">{proposal.reason}</p>
      <div className="award-lines">
        {Object.entries(proposal.allocations).filter(([, amount]) => amount > 0).map(([id, amount]) => (
          <div className="award-line" key={id}><span>{nameOf(id)}</span><span className="num">+{fmt(amount)}</span></div>
        ))}
      </div>
      <div className="approval-line"><span>Table Controller</span><strong>{controllerApproved ? 'Approved' : 'Waiting'}</strong></div>
      <div className="approval-line"><span>One other connected player</span><strong>{secondApproved ? 'Approved' : 'Waiting'}</strong></div>
      {me && !approved.has(me.id) && (
        <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => run({ type: 'approveOverride', v })}>Approve table ruling</button>
      )}
      {isHost && (
        <div className="award-actions">
          <button className="btn btn-quiet btn-lg" disabled={busy} onClick={() => run({ type: 'cancelOverride', v })}>Cancel</button>
          <button className="btn btn-primary btn-lg" disabled={busy || !ready} onClick={() => run({ type: 'confirmOverride', v })}>Confirm override</button>
        </div>
      )}
      {!ready && <small className="centre muted">Confirmation unlocks after both approvals are present.</small>}
    </div>
  );
}

function AwardPanel() {
  const { game, run, busy, v, nameOf, isController, room } = useTable();
  const boardIds = room.runoutPlan ? new Set(room.runoutPlan.potIds) : null;
  const open = game.pots.filter((p) => !p.paid && (!boardIds || boardIds.has(p.id)));
  const [picks, setPicks] = useState<Record<number, string[]>>({});
  const [touched, setTouched] = useState<Record<number, boolean>>({});

  const toggle = (potId: number, id: string) => {
    const index = open.findIndex((p) => p.id === potId);
    const current = picks[potId] ?? [];
    const nextPick = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    const next = { ...picks, [potId]: nextPick };
    // Whoever wins a pot usually has the best hand among everyone in later side pots too.
    open.slice(index + 1).forEach((later) => {
      if (touched[later.id]) return;
      next[later.id] = nextPick.filter((x) => later.eligible.includes(x));
    });
    setPicks(next);
    setTouched({ ...touched, [potId]: true });
  };

  const complete = open.every((p) => (picks[p.id] ?? []).length > 0);
  const potName = (i: number) => (open.length === 1 ? 'Pot' : i === 0 ? 'Main pot' : `Side pot ${i}`);
  const only = open.length === 1 ? (picks[open[0].id] ?? []) : null;
  const payLabel = !complete
    ? 'Tap the winner'
    : only && only.length === 1
      ? `Pay ${nameOf(only[0])} ${fmt(open[0].amount)}`
      : only && only.length > 1
        ? `Chop ${fmt(open[0].amount)} ${WAYS[only.length] ?? `${only.length} ways`}`
        : 'Pay out';

  if (!isController) {
    return (
      <div className="dock">
        <p className="dock-wait">Waiting for {nameOf(room.controllerId)} to confirm the winner</p>
      </div>
    );
  }

  return (
    <div className="dock dock-award">
      <div className="turn-head">
        <div>
          <span className="turn-title">{room.runoutPlan ? `Who won runout ${room.runoutPlan.current + 1}?` : 'Who won?'}</span>
          <span className="turn-sub">Tap every winner. Two or more chop it.</span>
        </div>
      </div>
      <div className="pots">
        {open.map((pot, i) => {
          const picked = picks[pot.id] ?? [];
          const cut = shareOut(game, pot.amount, picked);
          const take = new Map(cut.map((c) => [c.id, c.amount]));
          const seats = bySeat(game).filter((p) => pot.eligible.includes(p.id));
          return (
            <fieldset key={pot.id} className="pot-pick">
              <legend>
                <span>{potName(i)}</span>
                <span className="num">{fmt(pot.amount)}</span>
              </legend>
              <div className="win-list">
                {seats.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <button key={p.id} className="win-row" aria-pressed={on} onClick={() => toggle(pot.id, p.id)}>
                      <span className="win-box">{on && <Icon name="check" size={15} />}</span>
                      <span className="win-name">{nameOf(p.id)}</span>
                      <span className="win-take num">{on ? `+${fmt(take.get(p.id) ?? 0)}` : picked.length > 0 ? 'Split' : ''}</span>
                    </button>
                  );
                })}
              </div>
              {picked.length > 1 && <p className="win-note">{chopNote(cut, nameOf)}</p>}
            </fieldset>
          );
        })}
      </div>
      <button
        className="btn btn-primary btn-xl btn-block"
        disabled={!complete || busy}
        onClick={() => run({ type: 'award', v, winners: Object.fromEntries(open.map((p) => [p.id, picks[p.id]])) })}
      >
        {payLabel}
      </button>
    </div>
  );
}

const WAYS: Record<number, string> = { 2: 'two ways', 3: 'three ways', 4: 'four ways', 5: 'five ways' };

/** Spells out an uneven chop so nobody has to count the odd chips themselves. */
function chopNote(cut: { id: string; amount: number }[], nameOf: (id: string) => string) {
  const low = Math.min(...cut.map((c) => c.amount));
  const odd = cut.filter((c) => c.amount > low);
  const ways = WAYS[cut.length] ?? `${cut.length} ways`;
  if (odd.length === 0) return `Chopped ${ways}. ${fmt(low)} each.`;
  const names = odd.map((c) => nameOf(c.id));
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${fmt(low)} each. Odd chip${odd.length > 1 ? 's' : ''} to ${list}, first past the dealer.`;
}

// ---------------- hand over ----------------

function ResultsPanel({ onRebuy }: { onRebuy: () => void }) {
  const { game, run, busy, v, room, me, isHost, isController, nameOf } = useTable();
  const ready = game.players.filter((player) => !player.sittingOut && !player.leaving && !player.busted).length >= 2;
  const iAmOut = me && me.stack === 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, dialog[open]')) return;
      if (e.key.toLowerCase() === 'n' && isController && ready && !busy) {
        e.preventDefault();
        void run({ type: 'next', v });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="dock dock-done">
      {iAmOut && (
        <button className="btn btn-quiet btn-lg btn-block" disabled={busy} onClick={onRebuy}>
          Request rebuy
        </button>
      )}
      <div className="done-actions">
        {isHost && room.undoLabel && (
          <button className="btn btn-quiet btn-lg" disabled={busy} onClick={() => run({ type: 'undo', v })} aria-label="Undo payout">
            <Icon name="undo" />
          </button>
        )}
        {isController ? (
          <button className="btn btn-primary btn-xl grow" disabled={!ready || busy} onClick={() => run({ type: 'next', v })}>
            {ready ? 'Deal next hand' : 'Needs two players with chips'}
            {ready && <kbd className="kbd">N</kbd>}
          </button>
        ) : (
          <p className="dock-wait grow">Waiting for {nameOf(room.controllerId)} to deal the next hand</p>
        )}
      </div>
    </div>
  );
}

// ---------------- lobby ----------------

function LobbyDock() {
  const { game, isHost, run, busy, v } = useTable();
  const ready = game.players.filter((player) => !player.sittingOut && !player.leaving && !player.busted).length >= 2;
  if (!isHost) return null;
  return (
    <div className="dock">
      <button className="btn btn-primary btn-xl btn-block" disabled={!ready || busy} onClick={() => run({ type: 'start', v, allowUnconfirmed: true })}>
        {ready ? 'Lock seats & start' : 'Needs one more player'}
      </button>
    </div>
  );
}
