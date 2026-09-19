import { useEffect, useMemo, useRef, useState } from 'react';
import {
  bySeat,
  eligibleForHand,
  findPlayer,
  legalActions,
  potTotal,
  shareOut,
  type ActionKind,
  type Legal,
  type Player,
} from '../../shared/engine';
import { fmt } from '../lib/format';
import { useTable } from '../lib/table';
import { useShake } from '../lib/motion';
import { ChipRack, StagedChips } from './ChipRack';
import { Icon } from './Icon';
import { Num } from './Num';

const ACT_FOR_AFTER_MS = 15_000;

export function Dock() {
  const shaking = useShake();
  return (
    <div className="dock-shake" data-shake={shaking || undefined}>
      <DockBody />
    </div>
  );
}

function DockBody() {
  const { game, you, me, room, serverNow, away, member } = useTable();
  const [actingFor, setActingFor] = useState<string | null>(null);

  const actorId = game.toActId;
  useEffect(() => setActingFor(null), [actorId, game.phase]);

  if (game.phase === 'lobby') return <LobbyDock />;
  if (game.phase === 'showdown') return <AwardPanel />;
  if (game.phase === 'done') return <ResultsPanel />;

  if (you.legal && me) return <ActionPanel legal={you.legal} player={me} />;

  const actor = findPlayer(game, actorId);
  const actorMember = member(actorId);
  const waited = room.turnStartedAt ? serverNow - room.turnStartedAt : 0;
  const canActFor = !!actor && !!me && (actorMember?.manual || (away(actorId) && waited >= ACT_FOR_AFTER_MS));

  if (actingFor && actor && actingFor === actor.id) {
    const legal = legalActions(game, actor.id);
    if (legal) {
      return <ActionPanel legal={legal} player={actor} actingFor onCancel={() => setActingFor(null)} />;
    }
  }

  return (
    <div className="dock">
      <MyStatus />
      {canActFor && actor && (
        <button className="btn btn-quiet btn-lg btn-block" onClick={() => setActingFor(actor.id)}>
          Act for {actor.name}
        </button>
      )}
    </div>
  );
}

function MyStatus() {
  const { game, me, room, run, busy } = useTable();
  if (!me) return null;
  const inHand = me.inHand && (game.phase === 'betting' || game.phase === 'showdown');
  let note: string;
  if (!inHand) note = me.stack === 0 ? 'Busted' : me.sittingOut ? 'Sitting out' : 'In from the next hand';
  else if (me.folded) note = 'Folded';
  else if (me.allIn) note = 'All in';
  else note = me.committed > 0 ? `${fmt(me.committed)} in the pot` : 'In the hand';
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
            <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => run({ type: 'rebuy' })}>
              Rebuy {fmt(game.settings.startingStack)}
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
  onCancel?: () => void;
}

function ActionPanel({ legal, player, actingFor, onCancel }: ActionProps) {
  const { game, room, run, busy, v } = useTable();
  const [raising, setRaising] = useState(false);
  const [staged, setStaged] = useState(0);
  const pot = potTotal(game);
  const openLabel = game.currentBet === 0 ? 'Bet' : 'Raise';

  const act = (kind: ActionKind, amount?: number) =>
    run({ type: 'act', v, kind, ...(amount !== undefined ? { amount } : {}), ...(actingFor ? { playerId: player.id } : {}) });

  useEffect(() => {
    setRaising(false);
    setStaged(0);
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
        currency={room.currency}
        busy={busy}
        onBack={() => setRaising(false)}
        onConfirm={(amount) => act('raise', amount)}
      />
    );
  }

  const raiseTo = player.bet + staged;
  const stagesCall = staged > 0 && staged === legal.callAmount;
  const stagesRaise = staged > 0 && legal.canRaise && raiseTo > game.currentBet && (raiseTo >= legal.minRaiseTo || raiseTo === legal.maxRaiseTo);
  const stagedValid = stagesCall || stagesRaise;
  const stagedAllIn = staged === player.stack;
  const stagedStatus = stagesCall
    ? stagedAllIn ? `All in ${fmt(staged)}` : `Calling ${fmt(staged)}`
    : stagesRaise
      ? stagedAllIn ? `All in to ${fmt(raiseTo)}` : `${openLabel === 'Bet' ? 'Betting' : 'Raising'} to ${fmt(raiseTo)}`
      : raiseTo > game.currentBet
        ? `Minimum ${fmt(legal.minRaiseTo)}`
        : `${fmt(Math.max(0, legal.callAmount - staged))} more to call`;

  const addChip = (value: number) => setStaged((amount) => Math.min(player.stack, amount + value));
  const place = () => {
    if (stagesCall) void act('call');
    else if (stagesRaise) void act('raise', raiseTo);
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
          <span className="turn-title">{actingFor ? `Acting for ${player.name}` : 'Your turn'}</span>
          <span className="turn-sub">{legal.toCall > 0 ? `${fmt(legal.callAmount)} to call` : 'Check is available'}</span>
        </div>
        <span className="turn-metric"><small>Pot</small><Num value={pot} /></span>
        <span className="turn-metric"><small>Balance</small><Num value={player.stack} /></span>
        {actingFor && (
          <button className="icon-btn" onClick={onCancel} aria-label="Stop acting for this player">
            <Icon name="close" />
          </button>
        )}
      </div>
      {staged > 0 && <StagedChips amount={staged} currency={room.currency} />}
      {staged > 0 ? (
        <div className="staged-actions">
          <button className="staged-clear" onClick={() => setStaged(0)}>Clear</button>
          <span className="staged-status"><i aria-hidden="true" />{stagedStatus}</span>
          <button className="btn btn-turn btn-turn-main staged-place" onClick={place} disabled={!stagedValid || busy}>
            {stagedValid ? `Place ${fmt(staged)}` : 'Add chips'}
          </button>
        </div>
      ) : (
        <div className="turn-buttons" data-count={buttons.length}>
          {buttons.map((b) => (
            <button key={b.key} className={`btn btn-turn ${b.cls}`} onClick={b.key === 'call' ? () => setStaged(legal.callAmount) : b.onClick} disabled={busy}>
              {b.label}
              <kbd className="kbd">{b.hint}</kbd>
            </button>
          ))}
        </div>
      )}
      <ChipRack amount={player.stack - staged} currency={room.currency} onChip={addChip} />
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
  currency: string;
  busy: boolean;
  onBack: () => void;
  onConfirm: (amount: number) => void;
}

function RaisePanel({ legal, pot, currentBet, bb, label, player, currency, busy, onBack, onConfirm }: RaiseProps) {
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
      { label: 'Min', value: min },
      { label: '½ pot', value: clamp(half) },
      { label: 'Pot', value: clamp(full) },
      { label: 'All in', value: max },
    ];
  }, [pot, legal.toCall, currentBet, min, max]);

  const valid = amount !== null && Number.isSafeInteger(amount) && amount <= max && (amount >= min || amount === max);
  const final = amount ?? min;
  const allIn = amount === max;
  const confirm = () => {
    if (valid && !busy) onConfirm(final);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
      else if (e.key === 'Enter') confirm();
      else if (e.key === 'ArrowUp' && e.target !== inputRef.current) set(final + bb);
      else if (e.key === 'ArrowDown' && e.target !== inputRef.current) set(final - bb);
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
        <span className="turn-sub">{fmt(min)} minimum</span>
      </div>
      {amount !== null && <StagedChips amount={Math.max(0, amount - player.bet)} currency={currency} />}
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
      <ChipRack
        amount={player.stack - (amount === null ? 0 : Math.max(0, amount - player.bet))}
        currency={currency}
        onChip={(value) => setAmount(Math.min(max, (amount ?? player.bet) + value))}
      />
    </div>
  );
}

// ---------------- showdown ----------------

function AwardPanel() {
  const { game, run, busy, v, nameOf, isController, room } = useTable();
  const open = game.pots.filter((p) => !p.paid);
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
          <span className="turn-title">Who won?</span>
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

function ResultsPanel() {
  const { game, run, busy, v, room, me, isHost, isController, nameOf } = useTable();
  const ready = game.players.filter(eligibleForHand).length >= 2;
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
        <button className="btn btn-quiet btn-lg btn-block" disabled={busy} onClick={() => run({ type: 'rebuy' })}>
          Rebuy for {fmt(game.settings.startingStack)}
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
  const { game, isHost, room, run, busy, v, nameOf, away, serverNow } = useTable();
  const ready = game.players.filter(eligibleForHand).length >= 2;
  if (!isHost) {
    const hostAway = (!!room.hostId && away(room.hostId)) || (!!room.hostTakeoverAt && serverNow >= room.hostTakeoverAt);
    return (
      <div className="dock">
        <p className="dock-wait">
          {room.hostId ? `Waiting for ${nameOf(room.hostId)} to deal the first hand` : 'Waiting for a host'}
        </p>
        {hostAway && (
          <button className="btn btn-quiet btn-lg btn-block" disabled={busy} onClick={() => run({ type: 'takeHost' })}>
            Take over hosting
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="dock">
      <button className="btn btn-primary btn-xl btn-block" disabled={!ready || busy} onClick={() => run({ type: 'start', v })}>
        {ready ? 'Deal the first hand' : 'Needs one more player'}
      </button>
    </div>
  );
}
