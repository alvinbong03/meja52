import { useState } from 'react';
import { chipLabel } from '../lib/chips';
import { useTable } from '../lib/table';

export function LateArrival() {
  const { room, you, run, busy } = useTable();
  const [mode, setMode] = useState<'post' | 'wait'>('post');
  const request = room.lateArrivals.find((item) => item.playerId === you.id);
  if (!request) return null;

  if (request.status === 'pending') {
    return (
      <section className="late-arrival-card" aria-labelledby="late-title">
        <h1 id="late-title">Waiting for the host</h1>
        <p>Your request for a {chipLabel(room.currency, request.amount)} seat is at the table.</p>
        <div className="waiting-dots" aria-hidden="true"><span /><span /><span /></div>
        <button className="btn btn-quiet btn-lg btn-block" disabled={busy} onClick={() => run({ type: 'cancelLateArrival' })}>
          Cancel request
        </button>
      </section>
    );
  }

  if (request.status === 'ready') {
    return (
      <section className="late-arrival-card" aria-labelledby="late-title">
        <h1 id="late-title">Joining next hand</h1>
        <p>{request.mode === 'free' ? 'The host waived the entry blind.' : `${chipLabel(room.currency, room.game.settings.bb)} will post as your live big blind.`}</p>
        <div className="late-arrival-status" role="status">Your seat and {chipLabel(room.currency, request.amount)} are ready.</div>
      </section>
    );
  }

  if (request.status === 'waiting') {
    return (
      <section className="late-arrival-card" aria-labelledby="late-title">
        <h1 id="late-title">Waiting for big blind</h1>
        <p>You’ll join automatically when the big blind reaches your seat.</p>
        <div className="late-arrival-status" role="status">Your {chipLabel(room.currency, request.amount)} stays reserved.</div>
      </section>
    );
  }

  return (
    <section className="late-arrival-card" aria-labelledby="late-title">
      <div>
        <h1 id="late-title">Choose when to enter</h1>
        <p>You’ll join between hands with {chipLabel(room.currency, request.amount)}.</p>
      </div>
      <div className="return-choices" role="radiogroup" aria-label="Late arrival entry">
        <button className="return-choice" role="radio" aria-checked={mode === 'post'} onClick={() => setMode('post')}>
          <span className="choice-dot" aria-hidden="true" />
          <span>
            <strong>Post {chipLabel(room.currency, room.game.settings.bb)} &amp; join next hand</strong>
            <small>Enter immediately after this hand.</small>
          </span>
        </button>
        <button className="return-choice" role="radio" aria-checked={mode === 'wait'} onClick={() => setMode('wait')}>
          <span className="choice-dot" aria-hidden="true" />
          <span>
            <strong>Wait for big blind</strong>
            <small>Join when the big blind reaches your seat.</small>
          </span>
        </button>
      </div>
      <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={() => run({ type: 'chooseLateArrival', mode })}>
        Confirm entry
      </button>
      <p className="late-arrival-foot">The host can choose Join next hand — no entry blind.</p>
    </section>
  );
}
