import { useEffect, useRef, useState, type FormEvent } from 'react';
import { bySeat, handInProgress, LIMITS, physicalRunoutLimit, shareOut } from '../../shared/engine';
import type { LateArrivalView } from '../../shared/protocol';
import { setSoundEnabled, soundEnabled } from '../lib/device';
import { fmt } from '../lib/format';
import { chipLabel } from '../lib/chips';
import { useTable } from '../lib/table';
import { Icon } from './Icon';
import { Invite } from './Invite';
import { Sheet } from './Sheet';
import { Settlement } from './Settlement';

export type SheetName = 'menu' | 'invite' | 'settings' | 'players' | 'settle' | 'rebuy' | 'rebuyRequests' | 'lateArrivals' | 'break' | 'leave' | 'undo' | 'void' | 'runout' | 'override' | 'hostTransfer' | 'hostRequest' | 'backupHost' | null;

interface Props {
  open: SheetName;
  setOpen: (s: SheetName) => void;
  onDisplay: () => void;
  onLeft: () => void;
}

export function Sheets({ open, setOpen, onDisplay, onLeft }: Props) {
  const { room, me, you } = useTable();
  const breakRecord = me ? room.breaks.find((record) => record.playerId === me.id) : undefined;
  const requestForMe = !!you.id && room.hostTransfer?.targetId === you.id;
  const prompted = useRef<string | null>(null);
  const close = () => setOpen(null);

  useEffect(() => {
    const key = requestForMe && room.hostTransfer ? `${room.hostTransfer.kind}:${room.hostTransfer.requestedAt}` : null;
    if (key && prompted.current !== key) {
      prompted.current = key;
      setOpen('hostRequest');
    } else if (!key && open === 'hostRequest') {
      setOpen(null);
    }
  }, [open, requestForMe, room.hostTransfer, setOpen]);

  useEffect(() => {
    if (!you.isHost && (open === 'hostTransfer' || open === 'backupHost')) setOpen(null);
  }, [open, setOpen, you.isHost]);

  return (
    <>
      <Sheet open={open === 'menu'} onClose={close} title="Table">
        <Menu setOpen={setOpen} onDisplay={onDisplay} />
      </Sheet>
      <Sheet open={open === 'invite'} onClose={close} title="Invite players">
        <Invite code={room.code} qrSize={220} />
      </Sheet>
      <Sheet open={open === 'settings'} onClose={close} title="Game settings">
        <SettingsForm onDone={close} />
      </Sheet>
      <Sheet open={open === 'players'} onClose={close} title="Players">
        <Players />
      </Sheet>
      <Sheet open={open === 'settle'} onClose={close} title="Settle up">
        <Settlement />
      </Sheet>
      <Sheet open={open === 'rebuy'} onClose={close} title="Request rebuy">
        <RebuyForm onDone={close} />
      </Sheet>
      <Sheet open={open === 'rebuyRequests'} onClose={close} title="Rebuy requests">
        <RebuyRequests />
      </Sheet>
      <Sheet open={open === 'lateArrivals'} onClose={close} title="Late arrivals">
        <LateArrivalRequests />
      </Sheet>
      <Sheet open={open === 'break'} onClose={close} title={breakRecord ? (breakRecord.status === 'scheduled' ? 'Break scheduled' : 'Welcome back') : 'Take a break'}>
        <BreakFlow onDone={close} />
      </Sheet>
      <Sheet open={open === 'leave'} onClose={close} title="Leave the game">
        <LeaveFlow onDone={close} onLeft={onLeft} onTransfer={() => setOpen('hostTransfer')} />
      </Sheet>
      <Sheet open={open === 'undo'} onClose={close} title="Undo last action">
        <UndoFlow onDone={close} />
      </Sheet>
      <Sheet open={open === 'void'} onClose={close} title="Void this hand">
        <VoidFlow onDone={close} />
      </Sheet>
      <Sheet open={open === 'runout'} onClose={close} title="Run remaining board">
        <RunoutFlow onDone={close} />
      </Sheet>
      <Sheet open={open === 'override'} onClose={close} title="Table override">
        <OverrideFlow onDone={close} />
      </Sheet>
      <Sheet open={open === 'hostTransfer'} onClose={close} title="Transfer hosting">
        <HostTransferFlow mode="transfer" onDone={close} />
      </Sheet>
      <Sheet open={open === 'backupHost'} onClose={close} title="Backup host">
        <HostTransferFlow mode="backup" onDone={close} />
      </Sheet>
      <Sheet
        open={open === 'hostRequest'}
        onClose={close}
        title={room.hostTransfer?.kind === 'recovery' ? 'Hosting recovery' : 'Hosting request'}
      >
        <HostRequestFlow onDone={close} />
      </Sheet>
    </>
  );
}

function Menu({ setOpen, onDisplay }: { setOpen: (s: SheetName) => void; onDisplay: () => void }) {
  const { room, game, me, isHost, run, busy, v, nameOf, you } = useTable();
  const [sound, setSound] = useState(soundEnabled);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const inHand = !!me?.inHand && handInProgress(game);
  const hostingRequest = !!you.id && room.hostTransfer?.targetId === you.id;
  const myRebuy = me ? room.rebuyRequests.find((request) => request.playerId === me.id) : undefined;
  const pendingRebuys = room.rebuyRequests.filter((request) => request.status === 'pending');
  const pendingArrivals = room.lateArrivals.filter((request) => request.status === 'pending');
  const myBreak = me ? room.breaks.find((record) => record.playerId === me.id) : undefined;
  const myLeave = me ? room.leaveRequests.find((request) => request.playerId === me.id) : undefined;

  const item = (label: string, onClick: () => void, opts: { note?: string; danger?: boolean; disabled?: boolean } = {}) => (
    <li>
      <button className="menu-item" data-danger={opts.danger || undefined} onClick={onClick} disabled={opts.disabled || busy}>
        <span>{label}</span>
        {opts.note && <span className="menu-note">{opts.note}</span>}
      </button>
    </li>
  );

  return (
    <div className="menu">
      <ul className="menu-group">
        {hostingRequest && item(
          room.hostTransfer?.kind === 'recovery' ? 'Take over hosting' : 'Hosting request',
          () => setOpen('hostRequest'),
          { note: room.hostTransfer?.kind === 'recovery' ? 'The table nominated you' : `${nameOf(room.hostTransfer?.fromId)} asked you` },
        )}
        {isHost && room.undoLabel && item('Undo last action', () => setOpen('undo'), { note: room.undoLabel })}
        {item('Invite players', () => setOpen('invite'), { note: room.code })}
        {item('Settle up', () => setOpen('settle'))}
        {item('Table display', onDisplay, { note: 'Big screen view' })}
      </ul>

      {me && (
        <ul className="menu-group">
          {item(
            myBreak?.status === 'scheduled' ? 'Break scheduled' : myBreak?.status === 'waiting' ? 'Waiting for big blind' : myBreak ? 'On break' : 'Take a break',
            () => setOpen('break'),
            { note: myBreak?.missedBlinds ? 'Choose how to return' : myBreak ? 'Your seat stays reserved' : inHand ? 'Starts after this hand' : 'Reserve your seat and chips' },
          )}
          {item(myRebuy ? 'Rebuy request' : 'Request rebuy', () => setOpen('rebuy'), {
            note: myRebuy ? (myRebuy.status === 'approved' ? 'Approved · after this hand' : 'Waiting for host') : 'Ask the host to add chips',
          })}
          {item('Sound on your turn', () => {
            setSoundEnabled(!sound);
            setSound(!sound);
          }, { note: sound ? 'On' : 'Off' })}
        </ul>
      )}

      {isHost && (
        <ul className="menu-group">
          {isHost && item('Game settings', () => setOpen('settings'))}
          {isHost && item('Players and stacks', () => setOpen('players'))}
          {item('Transfer hosting', () => setOpen('hostTransfer'), {
            note: room.hostTransfer?.kind === 'planned' ? `Waiting for ${nameOf(room.hostTransfer.targetId)}` : 'Recipient must accept',
          })}
          {item('Backup host', () => setOpen('backupHost'), {
            note: room.backupHostId ? nameOf(room.backupHostId) : 'First asked if you disconnect',
          })}
          {isHost && item('Rebuy requests', () => setOpen('rebuyRequests'), {
            note: pendingRebuys.length === 0 ? 'None pending' : `${pendingRebuys.length} pending`,
          })}
          {isHost && game.handNo > 0 && item('Late arrivals', () => setOpen('lateArrivals'), {
            note: pendingArrivals.length === 0 ? 'None pending' : `${pendingArrivals.length} pending`,
          })}
          {isHost && handInProgress(game) && item(room.paused ? 'Resume hand' : 'Pause hand', () => {
            if (room.paused) void run({ type: 'resumeHand', v });
            else void run({ type: 'pauseHand', v });
          }, {
            note: room.paused ? 'Unlock player actions' : 'Temporarily lock player actions',
            disabled: !!room.voidProposal,
          })}
          {isHost && game.handNo > 0 && item('Void hand', () => setOpen('void'), {
            note: 'Return every contribution',
            danger: true,
          })}
          {isHost && game.phase === 'showdown' && game.runout && !room.runoutPlan && item('Run remaining board…', () => setOpen('runout'), {
            note: `Choose 1–${physicalRunoutLimit(game)} runouts`,
          })}
          {isHost && game.handNo > 0 &&
            (room.endingAfterHand ? (
              <li className="confirm-row end-game-row">
                <span>Game ends after this hand.</span>
                <button
                  className="btn btn-quiet btn-sm"
                  disabled={busy}
                  onClick={() => run({ type: 'cancelEndGame', v })}
                >
                  Keep playing
                </button>
              </li>
            ) : confirmEnd ? (
              <li className="confirm-row end-game-row">
                <span>{handInProgress(game) ? 'Finish this hand, then settle?' : 'Freeze balances and settle?'}</span>
                <div className="confirm-actions">
                  <button className="btn btn-quiet btn-sm" onClick={() => setConfirmEnd(false)}>Cancel</button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={busy}
                    onClick={async () => {
                      if (await run({ type: 'endGame', v })) setOpen(null);
                    }}
                  >
                    {handInProgress(game) ? 'End after hand' : 'End game'}
                  </button>
                </div>
              </li>
            ) : (
              item(handInProgress(game) ? 'End after this hand' : 'End game', () => setConfirmEnd(true), {
                danger: true,
                note: handInProgress(game) ? 'Finish this hand, then settle' : 'Freeze balances and settle',
              })
            ))}
        </ul>
      )}

      {me && (
        <ul className="menu-group">
          {item(myLeave ? 'Leaving after this hand' : 'Leave game', () => setOpen('leave'), {
            danger: !myLeave,
            note: myLeave ? 'Tap to review or cancel' : 'Your result stays in settlement',
          })}
        </ul>
      )}
    </div>
  );
}

function HostTransferFlow({ mode, onDone }: { mode: 'transfer' | 'backup'; onDone: () => void }) {
  const { room, game, isHost, run, busy, nameOf } = useTable();
  const [selected, setSelected] = useState(mode === 'backup' ? (room.backupHostId ?? '') : '');
  const candidates = game.players
    .map((player) => ({ player, member: room.members.find((member) => member.id === player.id) }))
    .filter(({ player, member }) => player.id !== room.hostId && !player.sittingOut && !player.leaving && !player.busted &&
      !!member && !member.manual && member.connections > 0);

  if (!isHost) return <p className="muted">Only the current host can change hosting.</p>;

  if (mode === 'transfer' && room.hostTransfer?.kind === 'planned') {
    return (
      <div className="authority-flow">
        <span className="authority-mark" aria-hidden="true" />
        <div className="authority-copy">
          <span className="eyebrow">Request sent</span>
          <h3>Waiting for {nameOf(room.hostTransfer.targetId)}</h3>
          <p>You remain the host until they accept. Table Controller stays with {nameOf(room.controllerId)}.</p>
        </div>
        <button className="btn btn-quiet btn-lg btn-block" disabled={busy} onClick={async () => {
          if (await run({ type: 'cancelHostTransfer' })) onDone();
        }}>Cancel request</button>
      </div>
    );
  }

  if (candidates.length === 0) {
    return <p className="muted">No connected player is available yet.</p>;
  }

  return (
    <div className="authority-flow">
      <p className="sheet-lead">
        {mode === 'transfer'
          ? 'Choose who to ask. You remain the host until they accept.'
          : 'This player is asked first if you disconnect. You can leave this unset.'}
      </p>
      <div className="return-choices" role="radiogroup" aria-label={mode === 'transfer' ? 'New host' : 'Backup host'}>
        {candidates.map(({ player }) => (
          <button key={player.id} className="return-choice" role="radio" aria-checked={selected === player.id} onClick={() => setSelected(player.id)}>
            <span className="choice-dot" aria-hidden="true" />
            <span><strong>{player.name}</strong><small>{room.controllerId === player.id ? 'Table Controller · connected' : 'Connected at the table'}</small></span>
          </button>
        ))}
      </div>
      <button className="btn btn-primary btn-xl btn-block" disabled={busy || !selected} onClick={async () => {
        const ok = mode === 'transfer'
          ? await run({ type: 'transferHost', playerId: selected })
          : await run({ type: 'setBackupHost', playerId: selected });
        if (ok && mode === 'backup') onDone();
      }}>{mode === 'transfer' ? 'Send hosting request' : 'Set backup host'}</button>
      {mode === 'backup' && room.backupHostId && (
        <button className="btn btn-quiet btn-lg btn-block" disabled={busy} onClick={async () => {
          if (await run({ type: 'setBackupHost' })) onDone();
        }}>Leave unset</button>
      )}
    </div>
  );
}

function HostRequestFlow({ onDone }: { onDone: () => void }) {
  const { room, run, busy, nameOf, you } = useTable();
  const transfer = room.hostTransfer;
  if (!transfer || transfer.targetId !== you.id) return <p className="muted">That hosting request is no longer available.</p>;
  const recovery = transfer.kind === 'recovery';
  return (
    <div className="authority-flow">
      <span className="authority-mark" aria-hidden="true" />
      <div className="authority-copy">
        <span className="eyebrow">{recovery ? 'Host unavailable' : `${nameOf(transfer.fromId)} asked you`}</span>
        <h3>{recovery ? 'Take over hosting?' : 'Become the host?'}</h3>
        <p>The host manages room settings, players and settlement. Table Controller stays with {nameOf(room.controllerId)}.</p>
      </div>
      <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={async () => {
        if (await run({ type: 'respondHostTransfer', allow: true })) onDone();
      }}>{recovery ? 'Take over hosting' : 'Accept hosting'}</button>
      <button className="btn btn-quiet btn-lg btn-block" disabled={busy} onClick={async () => {
        if (await run({ type: 'respondHostTransfer', allow: false })) onDone();
      }}>Decline</button>
    </div>
  );
}

function UndoFlow({ onDone }: { onDone: () => void }) {
  const { room, run, busy, v } = useTable();
  const [mode, setMode] = useState<'return' | 'correct'>('return');
  if (!room.undoLabel) return <p className="muted">There is no recent action to undo.</p>;
  return (
    <div className="correction-flow">
      <p className="sheet-lead"><strong>{room.undoLabel}</strong><br />No later action has been committed.</p>
      <div className="return-choices" role="radiogroup" aria-label="After undoing">
        <button className="return-choice" role="radio" aria-checked={mode === 'return'} onClick={() => setMode('return')}>
          <span className="choice-dot" aria-hidden="true" />
          <span><strong>Return the turn</strong><small>Let the original player choose again.</small></span>
        </button>
        <button className="return-choice" role="radio" aria-checked={mode === 'correct'} onClick={() => setMode('correct')}>
          <span className="choice-dot" aria-hidden="true" />
          <span><strong>Enter corrected action</strong><small>The host acts once for that player.</small></span>
        </button>
      </div>
      <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={async () => {
        if (await run({ type: 'undo', v, mode })) onDone();
      }}>Undo action</button>
      <p className="hint centre">The original action and correction remain in table history.</p>
    </div>
  );
}

function VoidFlow({ onDone }: { onDone: () => void }) {
  const { room, run, busy, v } = useTable();
  const [reason, setReason] = useState('Misdeal');
  const [advanceButton, setAdvanceButton] = useState(false);
  const returned = room.potTotal;
  return (
    <div className="void-flow">
      <p className="sheet-lead">This pauses the table and shows everyone a review before anything is restored.</p>
      <div className="void-warning">
        <strong>{chipLabel(room.currency, returned)} returns to players</strong>
        <span>Blinds and all other contributions go back to their pre-hand owners.</span>
      </div>
      <div className="field">
        <label className="field-label" htmlFor="void-reason">Reason</label>
        <select id="void-reason" className="text-input" value={reason} onChange={(event) => setReason(event.target.value)}>
          <option>Misdeal</option>
          <option>Exposed card</option>
          <option>Dispute</option>
          <option>Technical problem</option>
          <option>Other</option>
        </select>
      </div>
      <div className="return-choices" role="radiogroup" aria-label="Dealer button after void">
        <button className="return-choice" role="radio" aria-checked={!advanceButton} onClick={() => setAdvanceButton(false)}>
          <span className="choice-dot" aria-hidden="true" />
          <span><strong>Keep the button</strong><small>Replay from the same dealer position.</small></span>
        </button>
        <button className="return-choice" role="radio" aria-checked={advanceButton} onClick={() => setAdvanceButton(true)}>
          <span className="choice-dot" aria-hidden="true" />
          <span><strong>Advance the button</strong><small>Move on to the next dealer position.</small></span>
        </button>
      </div>
      <button className="btn btn-danger btn-xl btn-block" disabled={busy} onClick={async () => {
        if (await run({ type: 'previewVoid', v, reason, advanceButton })) onDone();
      }}>Preview void</button>
      <button className="btn btn-quiet btn-lg btn-block" onClick={onDone}>Cancel</button>
    </div>
  );
}

function RunoutFlow({ onDone }: { onDone: () => void }) {
  const { game, run, busy, v } = useTable();
  const maximum = physicalRunoutLimit(game);
  const [count, setCount] = useState(Math.min(2, maximum));
  const [agreed, setAgreed] = useState(false);
  const street = ['preflop', 'flop', 'turn', 'river'][game.street];
  return (
    <div className="runout-flow">
      <div className="runout-heading">
        <strong>Run it how many times?</strong>
        <span>Available only because every remaining player is all-in.</span>
      </div>
      <div className="runout-counts" role="radiogroup" aria-label="Number of runouts">
        {[1, 2, 3, 4].map((option) => (
          <button key={option} role="radio" aria-checked={count === option} disabled={option > maximum} onClick={() => setCount(option)}>
            <strong>{option}×</strong>
            {option > maximum && <small>Not enough cards</small>}
          </button>
        ))}
      </div>
      {count > 1 && (
        <label className="agreement-check">
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
          <span><strong>Players agreed verbally</strong><small>From the {street} · Physical cards</small></span>
        </label>
      )}
      <button className="btn btn-primary btn-xl btn-block" disabled={busy || (count > 1 && !agreed)} onClick={async () => {
        if (await run({ type: 'chooseRunouts', v, count, agreed: count === 1 || agreed })) onDone();
      }}>{count === 1 ? 'Keep one board' : `Run it ${count} times`}</button>
      <p className="hint centre">The same count applies to every pot.</p>
    </div>
  );
}

function OverrideFlow({ onDone }: { onDone: () => void }) {
  const { game, room, run, busy, v } = useTable();
  const proposal = room.awardProposal;
  const expected = proposal?.potIds.reduce((sum, id) => sum + (game.pots.find((pot) => pot.id === id)?.amount ?? 0), 0) ?? 0;
  const seed = () => {
    const amounts: Record<string, string> = Object.fromEntries(game.players.map((player) => [player.id, '0']));
    if (!proposal) return amounts;
    for (const potId of proposal.potIds) {
      const pot = game.pots.find((item) => item.id === potId);
      if (!pot) continue;
      for (const result of shareOut(game, pot.amount, proposal.winners[String(potId)] ?? [])) {
        amounts[result.id] = String(Number(amounts[result.id] ?? 0) + result.amount);
      }
    }
    return amounts;
  };
  const [amounts, setAmounts] = useState<Record<string, string>>(seed);
  const [reason, setReason] = useState('Table-agreed correction');
  if (!proposal?.disputedBy) return <p className="muted">An award must be disputed before the host can create an override.</p>;
  const allocations = Object.fromEntries(Object.entries(amounts).map(([id, amount]) => [id, Number(amount || 0)]));
  const allocated = Object.values(allocations).reduce((sum, amount) => sum + amount, 0);
  const valid = reason.trim().length > 0 && allocated === expected && Object.values(allocations).every(Number.isSafeInteger);
  return (
    <form className="override-flow" onSubmit={async (event) => {
      event.preventDefault();
      if (valid && await run({ type: 'proposeOverride', v, reason, allocations })) onDone();
    }}>
      <p className="sheet-lead">Use only for a table-agreed ruling that normal winner selection cannot represent. Every chip must still be assigned.</p>
      <div className="override-total" data-valid={allocated === expected || undefined}>
        <span>Allocated</span>
        <strong className="num">{fmt(allocated)} / {fmt(expected)}</strong>
      </div>
      <div className="override-allocations">
        {bySeat(game).map((player) => (
          <NumberField
            key={player.id}
            id={`override-${player.id}`}
            label={player.name}
            value={amounts[player.id] ?? '0'}
            onChange={(value) => setAmounts((current) => ({ ...current, [player.id]: value }))}
            hint={player.folded ? 'Folded · allowed only in this governed override' : undefined}
          />
        ))}
      </div>
      <div className="field">
        <label className="field-label" htmlFor="override-reason">Reason</label>
        <select id="override-reason" className="text-input" value={reason} onChange={(event) => setReason(event.target.value)}>
          <option>Table-agreed correction</option>
          <option>Incorrect contribution</option>
          <option>Incorrect eligibility</option>
          <option>Dead hand ruling</option>
          <option>Other table ruling</option>
        </select>
      </div>
      <button className="btn btn-primary btn-xl btn-block" disabled={busy || !valid}>Preview override</button>
      <p className="hint centre">The Table Controller and one other connected player must approve before it can be confirmed.</p>
    </form>
  );
}

function LateArrivalRequests() {
  const { room } = useTable();
  const pending = room.lateArrivals.filter((request) => request.status === 'pending');
  if (pending.length === 0) return <p className="muted">No late-arrival requests are waiting.</p>;
  return (
    <div className="rebuy-requests">
      {pending.map((request) => <LateArrivalReview key={request.id} request={request} />)}
    </div>
  );
}

function LateArrivalReview({ request }: { request: LateArrivalView }) {
  const { room, run, busy, v, nameOf } = useTable();
  const [amount, setAmount] = useState(String(request.amount));
  const value = Number(amount);
  const valid = Number.isSafeInteger(value) && value >= room.game.settings.bb && value <= LIMITS.maxStack;
  return (
    <section className="rebuy-review" aria-label={`${nameOf(request.playerId)} late-arrival request`}>
      <p className="sheet-lead"><strong>{nameOf(request.playerId)}</strong> wants to join between hands.</p>
      <NumberField id={`arrival-${request.id}`} label="Starting balance" value={amount} onChange={setAmount} />
      <button className="btn btn-primary btn-xl btn-block" disabled={busy || !valid} onClick={() => run({
        type: 'resolveLateArrival', v, requestId: request.id, allow: true, amount: value,
      })}>Approve {valid ? chipLabel(room.currency, value) : 'entry'}</button>
      <button className="btn btn-quiet btn-lg btn-block" disabled={busy || !valid} onClick={() => run({
        type: 'resolveLateArrival', v, requestId: request.id, allow: true, amount: value, noEntryBlind: true,
      })}>Approve — no entry blind</button>
      <button className="btn btn-danger-quiet btn-lg btn-block" disabled={busy} onClick={() => run({
        type: 'resolveLateArrival', v, requestId: request.id, allow: false,
      })}>Decline</button>
    </section>
  );
}

function LeaveFlow({ onDone, onLeft, onTransfer }: { onDone: () => void; onLeft: () => void; onTransfer: () => void }) {
  const { room, game, me, isHost, run, busy } = useTable();
  const [mode, setMode] = useState<'afterHand' | 'now'>('afterHand');
  if (!me) return null;
  const request = room.leaveRequests.find((item) => item.playerId === me.id);
  const live = me.inHand && handInProgress(game);
  const result = me.stack - me.buyIn;
  const resultLabel = result > 0
    ? `+${chipLabel(room.currency, result)}`
    : result < 0
      ? `−${chipLabel(room.currency, -result)}`
      : chipLabel(room.currency, 0);

  if (isHost) {
    return (
      <div className="leave-flow">
        <p className="sheet-lead">A table always needs a host. Transfer hosting to another player before you leave.</p>
        <button className="btn btn-primary btn-xl btn-block" onClick={onTransfer}>Choose a new host</button>
        <button className="btn btn-quiet btn-lg btn-block" onClick={onDone}>Stay in game</button>
      </div>
    );
  }

  if (request) {
    return (
      <div className="leave-flow">
        <p className="sheet-lead">You’ll finish this hand normally, then leave with your final stack.</p>
        <div className="break-detail"><strong>Departure scheduled</strong><span>Your result remains in final settlement.</span></div>
        <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={async () => {
          if (await run({ type: 'cancelLeave' })) onDone();
        }}>Stay in the game</button>
        <button className="btn btn-quiet btn-lg btn-block" onClick={onDone}>Close</button>
      </div>
    );
  }

  return (
    <div className="leave-flow">
      <p className="sheet-lead">Review what will be carried into final settlement.</p>
      <dl className="review-list leave-review">
        <div><dt>Current stack</dt><dd>{chipLabel(room.currency, me.stack)}</dd></div>
        <div><dt>Total entries</dt><dd>{chipLabel(room.currency, me.buyIn)}</dd></div>
        <div><dt>Provisional result</dt><dd>{resultLabel}</dd></div>
      </dl>
      {live && (
        <div className="return-choices" role="radiogroup" aria-label="When to leave">
          <button className="return-choice" role="radio" aria-checked={mode === 'afterHand'} onClick={() => setMode('afterHand')}>
            <span className="choice-dot" aria-hidden="true" />
            <span><strong>Leave after this hand</strong><small>Finish the current hand normally.</small></span>
          </button>
          <button className="return-choice" role="radio" aria-checked={mode === 'now'} onClick={() => setMode('now')}>
            <span className="choice-dot" aria-hidden="true" />
            <span><strong>Leave now</strong><small>Fold at the next legal moment.</small></span>
          </button>
        </div>
      )}
      <button className="btn btn-danger btn-xl btn-block" disabled={busy} onClick={async () => {
        const chosen = live ? mode : 'now';
        if (!(await run({ type: 'requestLeave', mode: chosen }))) return;
        if (chosen === 'now') onLeft();
        else onDone();
      }}>Request to leave</button>
      <button className="btn btn-quiet btn-lg btn-block" onClick={onDone}>Cancel</button>
      <p className="leave-foot">Your {chipLabel(room.currency, me.stack)} remains in final settlement.</p>
    </div>
  );
}

function BreakFlow({ onDone }: { onDone: () => void }) {
  const { room, game, me, run, busy } = useTable();
  const [returnMode, setReturnMode] = useState<'post' | 'wait'>('post');
  if (!me) return null;
  const record = room.breaks.find((item) => item.playerId === me.id);
  const inHand = me.inHand && handInProgress(game);
  const post = game.settings.sb + game.settings.bb;

  if (!record) {
    return (
      <div className="break-flow">
        <p className="sheet-lead">Your seat and {chipLabel(room.currency, me.stack)} stay reserved.</p>
        <div className="break-detail">
          <strong>{inHand ? 'Starts after this hand' : 'Starts now'}</strong>
          <span>You won’t receive cards while away.</span>
        </div>
        <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={async () => {
          if (await run({ type: 'takeBreak' })) onDone();
        }}>
          {inHand ? 'Take break after hand' : 'Take a break'}
        </button>
      </div>
    );
  }

  if (record.status === 'scheduled') {
    return (
      <div className="break-flow">
        <p className="sheet-lead">Your break starts when this hand ends.</p>
        <div className="break-detail"><strong>Seat reserved</strong><span>You still finish this hand normally.</span></div>
        <button className="btn btn-quiet btn-xl btn-block" disabled={busy} onClick={async () => {
          if (await run({ type: 'returnFromBreak', mode: 'now' })) onDone();
        }}>Cancel break</button>
      </div>
    );
  }

  if (record.status === 'waiting') {
    return (
      <div className="break-flow">
        <p className="sheet-lead">You’ll return automatically when the big blind reaches your seat.</p>
        <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={async () => {
          if (await run({ type: 'returnFromBreak', mode: 'post' })) onDone();
        }}>Post {chipLabel(room.currency, post)} and return sooner</button>
        <button className="btn btn-quiet btn-lg btn-block" onClick={onDone}>Stay on break</button>
      </div>
    );
  }

  if (!record.missedBlinds) {
    return (
      <div className="break-flow">
        <p className="sheet-lead">No blinds were missed. You can rejoin the next hand.</p>
        <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={async () => {
          if (await run({ type: 'returnFromBreak', mode: 'now' })) onDone();
        }}>I’m back</button>
        <button className="btn btn-quiet btn-lg btn-block" onClick={onDone}>Stay on break</button>
      </div>
    );
  }

  return (
    <div className="break-flow">
      <p className="sheet-lead">You missed the small and big blind.</p>
      <div className="return-choices" role="radiogroup" aria-label="Return option">
        <button className="return-choice" role="radio" aria-checked={returnMode === 'post'} onClick={() => setReturnMode('post')}>
          <span className="choice-dot" aria-hidden="true" />
          <span><strong>Post {chipLabel(room.currency, post)} and return</strong><small>{chipLabel(room.currency, game.settings.bb)} live · {chipLabel(room.currency, game.settings.sb)} dead</small></span>
        </button>
        <button className="return-choice" role="radio" aria-checked={returnMode === 'wait'} onClick={() => setReturnMode('wait')}>
          <span className="choice-dot" aria-hidden="true" />
          <span><strong>Wait for big blind</strong><small>Return automatically without an extra post.</small></span>
        </button>
      </div>
      <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={async () => {
        if (await run({ type: 'returnFromBreak', mode: returnMode })) onDone();
      }}>Return to table</button>
      <button className="btn btn-quiet btn-lg btn-block" onClick={onDone}>Stay on break</button>
    </div>
  );
}

function RebuyForm({ onDone }: { onDone: () => void }) {
  const { room, game, me, run, busy } = useTable();
  const request = me ? room.rebuyRequests.find((item) => item.playerId === me.id) : undefined;
  const [amount, setAmount] = useState(String(game.settings.startingStack));
  if (!me) return null;

  if (request) {
    return (
      <div className="rebuy-flow">
        <p className="sheet-lead">
          {request.status === 'approved' ? 'Approved by the host.' : 'Waiting for the host to review your request.'}
        </p>
        <dl className="review-list">
          <div><dt>Current balance</dt><dd className="num">{chipLabel(room.currency, me.stack)}</dd></div>
          <div><dt>Requested</dt><dd className="num">{chipLabel(room.currency, request.amount)}</dd></div>
          <div><dt>Balance after approval</dt><dd className="num">{chipLabel(room.currency, me.stack + request.amount)}</dd></div>
        </dl>
        {request.status === 'pending' ? (
          <button
            className="btn btn-quiet btn-xl btn-block"
            disabled={busy}
            onClick={async () => {
              if (await run({ type: 'cancelRebuy', requestId: request.id })) onDone();
            }}
          >
            Cancel request
          </button>
        ) : (
          <p className="hint">The chips will be added after the current hand.</p>
        )}
      </div>
    );
  }

  const value = Number(amount);
  const error = !Number.isSafeInteger(value) || value < 1 || value + me.stack > LIMITS.maxStack
    ? 'Enter a whole amount that keeps your balance within the table limit'
    : null;

  return (
    <form
      className="rebuy-flow"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!error && await run({ type: 'requestRebuy', amount: value })) onDone();
      }}
    >
      <p className="sheet-lead">Added between hands after host approval.</p>
      <NumberField id="rebuy-amount" label="Amount" value={amount} onChange={setAmount} />
      <p className="rebuy-after">New balance after approval <strong className="num">{chipLabel(room.currency, me.stack + (error ? 0 : value))}</strong></p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary btn-xl btn-block" disabled={!!error || busy}>Send request</button>
      <p className="hint centre">No money is transferred by this website.</p>
    </form>
  );
}

function RebuyRequests() {
  const { room } = useTable();
  const pending = room.rebuyRequests.filter((request) => request.status === 'pending');
  if (pending.length === 0) return <p className="muted">No rebuy requests are waiting.</p>;
  return <div className="rebuy-requests">{pending.map((request) => <RebuyReview key={request.id} requestId={request.id} />)}</div>;
}

function RebuyReview({ requestId }: { requestId: string }) {
  const { room, game, run, busy, v, nameOf } = useTable();
  const request = room.rebuyRequests.find((item) => item.id === requestId);
  const player = request ? game.players.find((item) => item.id === request.playerId) : undefined;
  const [amount, setAmount] = useState(String(request?.amount ?? ''));
  if (!request || !player) return null;
  const value = Number(amount);
  const error = !Number.isSafeInteger(value) || value < 1 || value > LIMITS.maxStack;

  return (
    <section className="rebuy-review" aria-label={`${nameOf(player.id)} rebuy request`}>
      <p className="sheet-lead"><strong>{nameOf(player.id)}</strong> requested {chipLabel(room.currency, request.amount)}.</p>
      <dl className="review-list">
        <div><dt>Requested</dt><dd className="num">{chipLabel(room.currency, request.amount)}</dd></div>
        <div><dt>Player balance</dt><dd>Private</dd></div>
      </dl>
      <NumberField id={`rebuy-${request.id}`} label="Edit amount" value={amount} onChange={setAmount} />
      <button
        className="btn btn-primary btn-xl btn-block"
        disabled={error || busy}
        onClick={() => run({ type: 'resolveRebuy', v, requestId: request.id, allow: true, amount: value })}
      >
        Approve {error ? '' : chipLabel(room.currency, value)}
      </button>
      <button
        className="btn btn-quiet btn-lg btn-block"
        disabled={busy}
        onClick={() => run({ type: 'resolveRebuy', v, requestId: request.id, allow: false })}
      >
        Reject
      </button>
      {handInProgress(game) && <p className="hint centre">Applies after this hand.</p>}
    </section>
  );
}

function SettingsForm({ onDone }: { onDone: () => void }) {
  const { game, run, busy, v } = useTable();
  const current = game.pendingSettings ?? game.settings;
  const [sb, setSb] = useState(String(current.sb));
  const [bb, setBb] = useState(String(current.bb));
  const [stack, setStack] = useState(String(current.startingStack));
  const [price, setPrice] = useState(current.buyInPrice ? (current.buyInPrice / 100).toFixed(2) : '');

  const n = (s: string) => (s.trim() === '' ? NaN : Number(s));
  const sbN = n(sb);
  const bbN = n(bb);
  const stackN = n(stack);
  const priceCents = price.trim() === '' ? 0 : Math.round(Number(price) * 100);
  const error =
    !Number.isSafeInteger(bbN) || bbN < 1 || bbN > LIMITS.maxBlind
      ? 'Big blind must be a whole number of at least 1'
      : !Number.isSafeInteger(sbN) || sbN < 0 || sbN > bbN
        ? 'Small blind must be between 0 and the big blind'
        : !Number.isSafeInteger(stackN) || stackN < bbN || stackN > LIMITS.maxStack
          ? 'Starting stack must be at least one big blind'
          : !Number.isFinite(priceCents) || priceCents < 0 || priceCents > LIMITS.maxPrice
            ? 'Buy-in price looks off'
            : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (error) return;
    const ok = await run({
      type: 'settings',
      v,
      settings: { sb: sbN, bb: bbN, startingStack: stackN, buyInPrice: priceCents },
    });
    if (ok) onDone();
  };

  return (
    <form className="stack-form" onSubmit={submit}>
      <div className="field-row">
        <NumberField id="sb" label="Small blind" value={sb} onChange={setSb} />
        <NumberField id="bb" label="Big blind" value={bb} onChange={setBb} />
      </div>
      <NumberField id="stack" label="Starting stack" value={stack} onChange={setStack} hint="New players begin with this amount" />
      <NumberField
        id="price"
        label="Cash per buy-in"
        value={price}
        onChange={setPrice}
        decimal
        placeholder="Optional, e.g. 20"
        hint="Turns chip results into who pays whom"
      />
      {handInProgress(game) && <p className="hint">Changes apply from the next hand.</p>}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary btn-xl btn-block" disabled={!!error || busy}>
        Save
      </button>
    </form>
  );
}

function NumberField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (s: string) => void;
  hint?: string;
  placeholder?: string;
  decimal?: boolean;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id} className="field-label">
        {props.label}
      </label>
      <input
        id={props.id}
        className="text-input num"
        inputMode={props.decimal ? 'decimal' : 'numeric'}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value.replace(props.decimal ? /[^\d.]/g : /\D/g, ''))}
      />
      {props.hint && <span className="hint">{props.hint}</span>}
    </div>
  );
}

function Players() {
  const { game, room, run, busy, v, member } = useTable();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [stack, setStack] = useState('');
  const hand = handInProgress(game);

  const addSeat = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim() && (await run({ type: 'addSeat', name: name.trim() }))) setName('');
  };

  return (
    <div className="players">
      <ul className="player-rows">
        {bySeat(game).map((p) => {
          const m = member(p.id);
          const locked = hand && p.inHand;
          const breakRecord = room.breaks.find((record) => record.playerId === p.id);
          return (
            <li key={p.id} className="player-row">
              <div className="player-line">
                <span className="lobby-name">
                  {p.name}
                  {room.hostId === p.id && <span className="tag">host</span>}
                  {room.controllerId === p.id && <span className="tag">table controller</span>}
                  {m?.manual && <span className="tag">no phone</span>}
                </span>
                <span className="num">{p.chipState === 'visible' ? fmt(p.stack) : 'Private'}</span>
              </div>
              {editing === p.id ? (
                <form
                  className="inline-form"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const value = Number(stack);
                    if (!Number.isSafeInteger(value) || value < 0) return;
                    if (await run({ type: 'setStack', v, playerId: p.id, stack: value })) setEditing(null);
                  }}
                >
                  <input
                    className="text-input num"
                    inputMode="numeric"
                    value={stack}
                    autoFocus
                    aria-label={`New stack for ${p.name}`}
                    onChange={(e) => setStack(e.target.value.replace(/\D/g, ''))}
                  />
                  <button className="btn btn-primary btn-sm" disabled={busy || stack === ''}>
                    Set
                  </button>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div className="player-actions">
                  <button
                    className="btn btn-quiet btn-sm"
                    disabled={busy || locked}
                    title={locked ? 'After this hand' : undefined}
                    onClick={() => {
                      setEditing(p.id);
                      setStack(p.chipState === 'visible' ? String(p.stack) : '');
                    }}
                  >
                    Set stack
                  </button>
                  <button
                    className="btn btn-quiet btn-sm"
                    disabled={busy || !!breakRecord}
                    onClick={() => run({ type: 'takeBreak', playerId: p.id })}
                  >
                    {breakRecord ? 'On break' : 'Put on break'}
                  </button>
                  {m && !m.manual && room.controllerId !== p.id && (
                    <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => run({ type: 'transferController', playerId: p.id })}>
                      Make controller
                    </button>
                  )}
                  {room.hostId !== p.id && (
                    <button className="btn btn-danger-quiet btn-sm" disabled={busy} onClick={() => run({ type: 'kick', playerId: p.id })}>
                      Remove
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {hand && <p className="hint">Stacks of players in the current hand can be changed once it ends.</p>}
      <form className="inline-form add-seat" onSubmit={addSeat}>
        <label htmlFor="seat-name" className="field-label">
          Add someone without a phone
        </label>
        <div className="join-row">
          <input
            id="seat-name"
            className="text-input"
            value={name}
            maxLength={24}
            placeholder="Name"
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn btn-quiet btn-lg" disabled={busy || !name.trim()}>
            <Icon name="plus" size={18} /> Add
          </button>
        </div>
        <span className="hint">Anyone at the table can act for them.</span>
      </form>
    </div>
  );
}
