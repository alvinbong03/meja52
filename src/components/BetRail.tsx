import { useMemo } from 'react';
import { bySeat } from '../../shared/engine';
import { fmt } from '../lib/format';
import { useTable } from '../lib/table';

export function BetRail() {
  const { game } = useTable();
  const hand = game.phase === 'betting' || game.phase === 'showdown';
  const seats = useMemo(() => bySeat(game).filter((player) => player.inHand), [game]);

  if (!hand) return null;

  return (
    <section className="landscape-bet-rail" aria-label="Current street bets">
      <div className="bet-rail-scroll">
        {seats.length > 0 ? (
          <ul className="bet-rail-list">
            {seats.map((player) => (
              <li key={player.id} data-acting={game.toActId === player.id || undefined} data-folded={player.folded || undefined}>
                <span>{player.name}</span>
                <div className="bet-rail-value">
                  <strong className="num">{fmt(player.bet)}</strong>
                  {player.folded && <em>Folded</em>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="bet-rail-empty">No bets this street</p>
        )}
      </div>
    </section>
  );
}
