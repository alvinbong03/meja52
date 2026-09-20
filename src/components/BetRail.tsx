import { useMemo } from 'react';
import { bySeat } from '../../shared/engine';
import { fmt, STREET_NAMES } from '../lib/format';
import { useTable } from '../lib/table';

export function BetRail() {
  const { game } = useTable();
  const hand = game.phase === 'betting' || game.phase === 'showdown';
  const seats = useMemo(() => bySeat(game).filter((player) => player.inHand), [game]);
  const street = game.phase === 'showdown' ? 'Showdown' : STREET_NAMES[game.street];

  if (!hand) return null;

  return (
    <section className="landscape-bet-rail" aria-label="Current street bets">
      <div className="bet-rail-street" aria-label={`Hand ${game.handNo}, ${street}`}>
        <span>Hand {game.handNo}</span>
        <strong>{street}</strong>
      </div>
      <div className="bet-rail-scroll">
        {seats.length > 0 ? (
          <ul className="bet-rail-list">
            {seats.map((player) => {
              const positions = [
                game.buttonId === player.id && { short: 'D', full: 'Dealer' },
                game.sbId === player.id && { short: 'SB', full: 'Small blind' },
                game.bbId === player.id && { short: 'BB', full: 'Big blind' },
              ].filter(Boolean) as { short: string; full: string }[];
              return (
                <li key={player.id} data-acting={game.toActId === player.id || undefined} data-folded={player.folded || undefined}>
                  <div className="bet-rail-player">
                    <span className="bet-rail-name">{player.name}</span>
                    {positions.length > 0 && (
                      <span className="bet-rail-positions" aria-label={positions.map((position) => position.full).join(', ')}>
                        {positions.map((position) => (
                          <span key={position.short} className="bet-position" data-position={position.short} title={position.full} aria-hidden="true">{position.short}</span>
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="bet-rail-value">
                    <strong className="num">{fmt(player.bet)}</strong>
                    {player.folded && <em>Folded</em>}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="bet-rail-empty">No bets this street</p>
        )}
      </div>
    </section>
  );
}
