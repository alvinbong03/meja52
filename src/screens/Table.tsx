import { useEffect, useRef, useState } from 'react';
import { Claims } from '../components/Claims';
import { BetRail } from '../components/BetRail';
import { Dock } from '../components/Dock';
import { Header } from '../components/Header';
import { Icon } from '../components/Icon';
import { Lobby } from '../components/Lobby';
import { Seats } from '../components/Seats';
import { Sheets, type SheetName } from '../components/Sheets';
import { Stage } from '../components/Stage';
import { Settlement } from '../components/Settlement';
import { turnAlert, unlockAudio, useWakeLock } from '../lib/device-features';
import { useTable } from '../lib/table';

export function Table({ onDisplay, onLeft }: { onDisplay: () => void; onLeft: () => void }) {
  const { room, game, you, conn, isHost } = useTable();
  const [sheet, setSheet] = useState<SheetName>(null);
  const myTurn = !!you.legal;
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
        <main className="final-settlement">
          <header className="final-settlement-head">
            <span className="eyebrow">Room {room.code}</span>
            <h1>Final settlement</h1>
            <p>The game has ended. Balances are frozen.</p>
          </header>
          <section className="final-settlement-card" aria-label="Final balances">
            <Settlement />
          </section>
          <button className="btn btn-primary btn-xl btn-block" onClick={onLeft}>Back to home</button>
        </main>
      </div>
    );
  }

  return (
    <div className="table-shell" data-turn={myTurn || undefined} data-host={isHost || undefined} data-phase={game.phase} onPointerDown={unlockAudio}>
      <Header onInvite={() => setSheet('invite')} onMenu={() => setSheet('menu')} />
      {conn.status === 'reconnecting' && (
        <div className="offline" role="status">
          Reconnecting…
        </div>
      )}
      <Claims />
      {room.endingAfterHand && (
        <div className="final-hand-notice" role="status">
          <strong>Final hand</strong>
          <span>The host will open settlement after the payout.</span>
        </div>
      )}
      <BetRail />
      <main className="table-main">
        {game.phase === 'lobby' ? (
          <Lobby onSettings={() => setSheet('settings')} onPlayers={() => setSheet('players')} />
        ) : (
          <>
            <Stage />
            <Seats />
          </>
        )}
      </main>
      <aside className="dock-wrap" aria-label="Your actions">
        <Dock onRebuy={() => setSheet('rebuy')} />
        <button className="table-controls-handle" onClick={() => setSheet('menu')}>
          <Icon name="up" size={16} />
          Table controls
        </button>
      </aside>
      <Sheets open={sheet} setOpen={setSheet} onDisplay={onDisplay} onLeft={onLeft} />
    </div>
  );
}
