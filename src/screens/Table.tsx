import { useEffect, useRef, useState } from 'react';
import { Claims } from '../components/Claims';
import { BetRail } from '../components/BetRail';
import { Dock } from '../components/Dock';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { Lobby } from '../components/Lobby';
import { LateArrival } from '../components/LateArrival';
import { Seats } from '../components/Seats';
import { Sheets, type SheetName } from '../components/Sheets';
import { Stage } from '../components/Stage';
import { SettlementExperience } from '../components/SettlementExperience';
import { turnAlert, unlockAudio, useWakeLock } from '../lib/device-features';
import { chipLabel } from '../lib/chips';
import { useTable } from '../lib/table';

export function Table({ onDisplay, onLeft }: { onDisplay: () => void; onLeft: () => void }) {
  const { room, game, you, conn, isHost, run, busy, v, away, nameOf, serverNow } = useTable();
  const [sheet, setSheet] = useState<SheetName>(null);
  const myTurn = !!you.legal;
  const lateArrival = room.lateArrivals.find((request) => request.playerId === you.id);
  const wasMyTurn = useRef(false);

  useWakeLock(true);

  useEffect(() => {
    if (myTurn && !wasMyTurn.current) turnAlert();
    wasMyTurn.current = myTurn;
    document.title = myTurn ? 'Your turn · MEJA52' : `${game.phase === 'lobby' ? 'Lobby' : `Hand ${game.handNo}`} · MEJA52`;
  }, [myTurn, game.phase, game.handNo]);

  useEffect(() => () => void (document.title = 'MEJA52'), []);

  useEffect(() => {
    if (you.id && !game.players.some((player) => player.id === you.id) && game.departed.some((player) => player.id === you.id)) {
      onLeft();
    }
  }, [game.departed, game.players, onLeft, you.id]);

  if (room.endedAt) {
    return (
      <div className="table-shell final-settlement-shell" data-host={isHost || undefined} onPointerDown={unlockAudio}>
        <SettlementExperience onDone={onLeft} />
      </div>
    );
  }

  const hostMissing = room.hostId ? away(room.hostId) : !!room.hostRecoveryAt;
  const recoveryTransfer = room.hostTransfer?.kind === 'recovery' ? room.hostTransfer : null;
  const recoverySeconds = room.hostRecoveryAt ? Math.max(0, Math.ceil((room.hostRecoveryAt - serverNow) / 1000)) : 0;
  const nextHostId = room.backupHostId ?? room.members.find((member) =>
    member.id !== room.hostId && !member.manual && member.connections > 0 && game.players.some((player) => player.id === member.id && !player.sittingOut && !player.leaving && player.stack > 0),
  )?.id;

  return (
    <div className="table-shell" data-turn={myTurn || undefined} data-host={isHost || undefined} data-phase={game.phase} onPointerDown={unlockAudio}>
      <Header onInvite={() => setSheet('invite')} onMenu={() => setSheet('menu')} />
      <Claims />
      {hostMissing && (
        <div className="host-recovery-band" role="status" aria-live="polite">
          <span className="host-recovery-dot" aria-hidden="true" />
          <div>
            <strong>
              {recoveryTransfer
                ? `${nameOf(recoveryTransfer.targetId)} is being asked to host`
                : recoverySeconds > 0
                  ? `Host reconnecting · ${recoverySeconds}s`
                  : 'Waiting for a host'}
            </strong>
            <span>
              {recoveryTransfer
                ? 'The table stays as it is until they accept.'
                : recoverySeconds > 0
                  ? `This hand can continue${nextHostId ? ` · ${nameOf(nextHostId)} will be asked next` : ''}.`
                  : 'This hand is preserved. Host-only decisions will wait.'}
            </span>
          </div>
        </div>
      )}
      {room.endingAfterHand && (
        <div className="final-hand-notice" role="status">
          <strong>Final hand</strong>
          <span>The host will open settlement after the payout.</span>
        </div>
      )}
      {room.voidProposal ? (
        <div className="void-review" role="status">
          <div>
            <span className="eyebrow">Hand paused · Void review</span>
            <strong>{room.voidProposal.reason}</strong>
            <small>{chipLabel(room.currency, room.voidProposal.returnAmount)} will return to its pre-hand owners.</small>
          </div>
          {isHost ? (
            <div className="void-review-actions">
              <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => run({ type: 'cancelVoid', v })}>Cancel preview</button>
              <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => run({ type: 'confirmVoid', v })}>Confirm void</button>
            </div>
          ) : <span className="void-waiting">Waiting for host confirmation</span>}
        </div>
      ) : room.paused ? (
        <div className="void-review" role="status">
          <div>
            <span className="eyebrow">Hand paused</span>
            <strong>Player actions are locked</strong>
            <small>The table remains visible while the host resolves the issue.</small>
          </div>
          {isHost && <button className="btn btn-quiet btn-sm" disabled={busy} onClick={() => run({ type: 'resumeHand', v })}>Resume hand</button>}
        </div>
      ) : null}
      <BetRail />
      <main className="table-main">
        {lateArrival ? (
          <LateArrival />
        ) : game.phase === 'lobby' ? (
          <Lobby onSettings={() => setSheet('settings')} onPlayers={() => setSheet('players')} />
        ) : (
          <>
            <Stage />
            <Seats />
          </>
        )}
      </main>
      <aside className="dock-wrap" aria-label="Your actions">
        {conn.status === 'reconnecting' ? (
          <div className="reconnect-panel" role="alert">
            <span className="eyebrow">Connection lost</span>
            <strong>Reconnecting…</strong>
            <p>Last confirmed: {room.log[room.log.length - 1]?.text ?? 'Table state saved'}</p>
            <button className="btn btn-primary btn-lg btn-block" onClick={conn.reconnect}>Try now</button>
            <small>Your seat and balance are safe. Actions stay locked until you’re back.</small>
          </div>
        ) : !lateArrival ? <Dock onRebuy={() => setSheet('rebuy')} onRunout={() => setSheet('runout')} onOverride={() => setSheet('override')} /> : null}
        <button className="table-controls-handle" onClick={() => setSheet('menu')}>
          <Icon name="up" size={16} />
          Table controls
        </button>
      </aside>
      <Sheets open={sheet} setOpen={setSheet} onDisplay={onDisplay} onLeft={onLeft} />
    </div>
  );
}
