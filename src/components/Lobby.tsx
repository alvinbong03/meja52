import { useState, type CSSProperties, type DragEvent } from 'react';
import { bySeat, MAX_PLAYERS } from '../../shared/engine';
import { useTable } from '../lib/table';

type HostMode = 'arrange' | 'dealer' | 'controller';

export function Lobby({ onInvite }: { onInvite: () => void }) {
  const { room, game, you, isHost, run, busy, v, nameOf } = useTable();
  const seats = bySeat(game);
  const meIndex = seats.findIndex((player) => player.id === you.id);

  if (!isHost) {
    if (meIndex < 0 || seats.length < 2) {
      return (
        <div className="seat-confirmation seat-confirmation-waiting">
          <h1>Waiting for the table</h1>
          <p>Your seat will appear when another player joins.</p>
        </div>
      );
    }
    const left = seats[(meIndex - 1 + seats.length) % seats.length];
    const right = seats[(meIndex + 1) % seats.length];
    const confirmation = room.seatConfirmations.find((item) => item.playerId === you.id);
    return (
      <div className="seat-confirmation">
        <div className="seat-confirmation-heading">
          <h1>{confirmation?.status === 'confirmed' ? 'Seat confirmed' : confirmation?.status === 'issue' ? 'Host is checking' : 'Confirm your seat'}</h1>
          <p>Does this match where you’re sitting?</p>
        </div>
        <div className="neighbour-map" aria-label={`Seat ${meIndex + 1}. ${left.name} is on your left. ${right.name} is on your right.`}>
          <div><strong>{left.name}</strong><span>Your left</span></div>
          <i aria-hidden="true" />
          <div className="you-seat"><strong>You</strong><span>Seat {meIndex + 1}</span></div>
          <i aria-hidden="true" />
          <div><strong>{right.name}</strong><span>Your right</span></div>
        </div>
        <p className="seat-host-copy">{nameOf(room.hostId)} is arranging the table.</p>
        <div className="seat-confirmation-actions">
          <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={() => run({ type: 'confirmSeat', v, matches: true })}>
            {confirmation?.status === 'confirmed' ? 'Yes, this still matches' : 'Yes, this matches'}
          </button>
          <button className="link-btn seat-issue" disabled={busy} onClick={() => run({ type: 'confirmSeat', v, matches: false })}>
            Something’s wrong
          </button>
        </div>
        <div className="seat-wait-status" role="status">
          <span aria-hidden="true" />
          {confirmation?.status === 'issue' ? 'The host can see your note' : 'Waiting for host to start'}
        </div>
        <p className="hint centre">The host can start before everyone confirms.</p>
      </div>
    );
  }

  return <HostSeatingLobby onInvite={onInvite} />;
}

function HostSeatingLobby({ onInvite }: { onInvite: () => void }) {
  const { room, game, run, busy, v, member, nameOf } = useTable();
  const seats = bySeat(game);
  const [mode, setMode] = useState<HostMode>('arrange');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const confirmations = new Map(room.seatConfirmations.map((item) => [item.playerId, item.status]));
  const confirmable = seats.filter((player) => !member(player.id)?.manual);
  const confirmed = confirmable.filter((player) => player.id === room.hostId || confirmations.get(player.id) === 'confirmed').length;
  const issues = confirmable.filter((player) => confirmations.get(player.id) === 'issue').length;

  const moveBefore = (movingId: string, targetId: string) => {
    if (movingId === targetId) return;
    const ids = seats.map((player) => player.id);
    const from = ids.indexOf(movingId);
    if (from < 0 || !ids.includes(targetId)) return;
    ids.splice(from, 1);
    ids.splice(ids.indexOf(targetId), 0, movingId);
    setSelectedId(null);
    void run({ type: 'seatOrder', v, ids });
  };

  const chooseSeat = (playerId: string) => {
    if (mode === 'dealer') {
      void run({ type: 'setDealerButton', v, playerId }).then((ok) => ok && setMode('arrange'));
      return;
    }
    if (mode === 'controller') {
      void run({ type: 'transferController', playerId }).then((ok) => ok && setMode('arrange'));
      return;
    }
    if (selectedId) moveBefore(selectedId, playerId);
    else setSelectedId(playerId);
  };

  const dropSeat = (event: DragEvent<HTMLButtonElement>, targetId: string) => {
    event.preventDefault();
    const movingId = event.dataTransfer.getData('text/plain');
    if (movingId) moveBefore(movingId, targetId);
  };

  return (
    <div className="seating-lobby">
      <div className="seating-heading">
        <h1>Seat the table</h1>
        <p>{seats.length} of {MAX_PLAYERS} players</p>
      </div>

      {seats.length === 0 ? (
        <p className="muted centre">Nobody has joined yet.</p>
      ) : (
        <div className="table-map" data-mode={mode} data-crowded={seats.length > 8 || undefined}>
          <div className="table-map-centre">
            <strong>{mode === 'dealer' ? 'Choose the first dealer' : mode === 'controller' ? 'Choose the Table Controller' : selectedId ? `Move ${nameOf(selectedId)}` : 'Arrange clockwise'}</strong>
            <span>{mode === 'arrange' ? (selectedId ? 'Tap the seat they should come before.' : 'Drag a name, or tap it then choose its place.') : 'Tap a player to assign the role.'}</span>
          </div>
          {seats.map((player, index) => {
            const angle = -Math.PI / 2 + (index / seats.length) * Math.PI * 2;
            const style = {
              '--seat-x': `${50 + Math.cos(angle) * 43}%`,
              '--seat-y': `${50 + Math.sin(angle) * 43}%`,
            } as CSSProperties;
            const status = player.id === room.hostId ? 'confirmed' : confirmations.get(player.id);
            return (
              <button
                key={player.id}
                className="table-map-seat"
                style={style}
                data-selected={selectedId === player.id || undefined}
                data-status={status}
                draggable={mode === 'arrange'}
                disabled={busy || (mode === 'controller' && member(player.id)?.manual)}
                aria-label={`${player.name}, seat ${index + 1}${room.dealerButtonId === player.id ? ', proposed dealer' : ''}${status === 'issue' ? ', asked host to check seat' : ''}`}
                onClick={() => chooseSeat(player.id)}
                onDragStart={(event) => event.dataTransfer.setData('text/plain', player.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropSeat(event, player.id)}
              >
                <span className="seat-grip" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
                <strong>{player.name}</strong>
                {room.dealerButtonId === player.id && <span className="dealer-proposal" aria-label="Dealer button">D</span>}
                {player.id === room.hostId && <small>Host</small>}
                {status === 'issue' && <small>Check seat</small>}
              </button>
            );
          })}
        </div>
      )}

      <div className="lobby-role-rows">
        <button onClick={() => setMode(mode === 'dealer' ? 'arrange' : 'dealer')} data-active={mode === 'dealer' || undefined}>
          <span>Dealer button</span><strong>{nameOf(room.dealerButtonId)}</strong><em>{mode === 'dealer' ? 'Cancel' : 'Change'}</em>
        </button>
        <button onClick={() => setMode(mode === 'controller' ? 'arrange' : 'controller')} data-active={mode === 'controller' || undefined}>
          <span>Table Controller</span><strong>{nameOf(room.controllerId)}{room.controllerId === room.hostId ? ' (Host)' : ''}</strong><em>{mode === 'controller' ? 'Cancel' : 'Change'}</em>
        </button>
      </div>

      <div className="seat-progress" role="status">
        <strong>{confirmed} of {confirmable.length} seats confirmed</strong>
        <span>{issues > 0 ? `${issues} ${issues === 1 ? 'player asked' : 'players asked'} you to check the order.` : 'Player confirmation is advisory.'}</span>
      </div>
      <button className="link-btn centre" onClick={onInvite}>Invite more players</button>
    </div>
  );
}
