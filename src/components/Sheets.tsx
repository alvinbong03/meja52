import { useState, type FormEvent } from 'react';
import { bySeat, handInProgress, LIMITS } from '../../shared/engine';
import { setSoundEnabled, soundEnabled } from '../lib/device';
import { fmt } from '../lib/format';
import { chipLabel } from '../lib/chips';
import { useTable } from '../lib/table';
import { Icon } from './Icon';
import { Invite } from './Invite';
import { Sheet } from './Sheet';
import { Settlement } from './Settlement';

export type SheetName = 'menu' | 'invite' | 'settings' | 'players' | 'settle' | 'rebuy' | 'rebuyRequests' | 'break' | 'leave' | null;

interface Props {
  open: SheetName;
  setOpen: (s: SheetName) => void;
  onDisplay: () => void;
  onLeft: () => void;
}

export function Sheets({ open, setOpen, onDisplay, onLeft }: Props) {
  const { room, me } = useTable();
  const breakRecord = me ? room.breaks.find((record) => record.playerId === me.id) : undefined;
  const close = () => setOpen(null);
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
      <Sheet open={open === 'break'} onClose={close} title={breakRecord ? (breakRecord.status === 'scheduled' ? 'Break scheduled' : 'Welcome back') : 'Take a break'}>
        <BreakFlow onDone={close} />
      </Sheet>
      <Sheet open={open === 'leave'} onClose={close} title="Leave the game">
        <LeaveFlow onDone={close} onLeft={onLeft} onTransfer={() => setOpen('players')} />
      </Sheet>
    </>
  );
}

function Menu({ setOpen, onDisplay }: { setOpen: (s: SheetName) => void; onDisplay: () => void }) {
  const { room, game, me, isHost, run, busy, v, away, serverNow } = useTable();
  const [sound, setSound] = useState(soundEnabled);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const inHand = !!me?.inHand && handInProgress(game);
  const hostAway =
    !isHost && ((!!room.hostId && away(room.hostId)) || (!!room.hostTakeoverAt && serverNow >= room.hostTakeoverAt));
  const myRebuy = me ? room.rebuyRequests.find((request) => request.playerId === me.id) : undefined;
  const pendingRebuys = room.rebuyRequests.filter((request) => request.status === 'pending');
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
        {isHost && room.undoLabel && item('Undo', () => run({ type: 'undo', v }).then((ok) => ok && setOpen(null)), { note: room.undoLabel })}
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

      {(isHost || hostAway) && (
        <ul className="menu-group">
          {isHost && item('Game settings', () => setOpen('settings'))}
          {isHost && item('Players and stacks', () => setOpen('players'))}
          {isHost && item('Rebuy requests', () => setOpen('rebuyRequests'), {
            note: pendingRebuys.length === 0 ? 'None pending' : `${pendingRebuys.length} pending`,
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
          {hostAway && item('Take over hosting', () => run({ type: 'takeHost' }))}
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
  const error = !Number.isSafeInteger(value) || value < 1 || value + player.stack > LIMITS.maxStack;

  return (
    <section className="rebuy-review" aria-label={`${nameOf(player.id)} rebuy request`}>
      <p className="sheet-lead"><strong>{nameOf(player.id)}</strong> requested {chipLabel(room.currency, request.amount)}.</p>
      <dl className="review-list">
        <div><dt>Current balance</dt><dd className="num">{chipLabel(room.currency, player.stack)}</dd></div>
        <div><dt>Requested</dt><dd className="num">{chipLabel(room.currency, request.amount)}</dd></div>
        <div><dt>Balance after approval</dt><dd className="num">{chipLabel(room.currency, player.stack + (error ? 0 : value))}</dd></div>
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
                <span className="num">{fmt(p.stack)}</span>
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
                      setStack(String(p.stack));
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
                  {m && !m.manual && room.hostId !== p.id && (
                    <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => run({ type: 'transferHost', playerId: p.id })}>
                      Make host
                    </button>
                  )}
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
