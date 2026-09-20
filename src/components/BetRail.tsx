import { useMemo } from 'react';
import { bySeat } from '../../shared/engine';
import { fmt } from '../lib/format';
import { useTable } from '../lib/table';
import { Num } from './Num';

export function BetRail() {
  const { game } = useTable();
  const hand = game.phase === 'betting' || game.phase === 'showdown';
  const seats = useMemo(() => bySeat(game).filter((player) => player.inHand), [game]);
  const pot = game.players.reduce((sum, player) => sum + player.committed, 0);

  if (!hand) return null;

  return (
    <section className="landscape-bet-rail" aria-label="Current street bets">
      <div className="bet-rail-pot">
        <span>Pot</span>
        <Num value={pot} />
      </div>
      <div className="bet-rail-scroll">
        {seats.length > 0 ? (
          <ul className="bet-rail-list">
            {seats.map((player) => (
              <li key={player.id} data-acting={game.toActId === player.id || undefined}>
                <span>{player.name}</span>
                <strong className="num">{fmt(player.bet)}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="bet-rail-empty">No bets this street</p>
        )}
      </div>
      <span className="bet-rail-hint">Current bets</span>
    </section>
  );
}
