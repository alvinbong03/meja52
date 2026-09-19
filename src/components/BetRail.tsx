import { useMemo, useState } from 'react';
import { bySeat } from '../../shared/engine';
import { fmt } from '../lib/format';
import { useTable } from '../lib/table';
import { Num } from './Num';

export function BetRail() {
  const { game } = useTable();
  const [expanded, setExpanded] = useState(false);
  const hand = game.phase === 'betting' || game.phase === 'showdown';
  const seats = useMemo(() => bySeat(game).filter((player) => player.inHand), [game]);
  const shown = expanded ? seats : seats.filter((player) => player.bet > 0);
  const pot = game.players.reduce((sum, player) => sum + player.committed, 0);

  if (!hand) return null;

  return (
    <section className="landscape-bet-rail" aria-label="Current street bets">
      <button
        type="button"
        className="bet-rail-pot"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <span>Pot</span>
        <Num value={pot} />
      </button>
      <div className="bet-rail-scroll">
        {shown.length > 0 ? (
          <ul className="bet-rail-list">
            {shown.map((player) => (
              <li key={player.id} data-acting={game.toActId === player.id || undefined}>
                <span>{player.name}</span>
                <strong className="num">{player.bet > 0 ? fmt(player.bet) : '—'}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="bet-rail-empty">No bets this street</p>
        )}
      </div>
      <span className="bet-rail-hint">{expanded ? 'Hide zero bets' : 'Show all bets'}</span>
    </section>
  );
}
