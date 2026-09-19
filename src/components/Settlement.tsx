import { handInProgress } from '../../shared/engine';
import { ledger, netsInCents, settleUp } from '../../shared/settle';
import { fmt, money, signed, signedMoney } from '../lib/format';
import { useTable } from '../lib/table';

export function Settlement() {
  const { game, nameOf } = useTable();
  const rows = ledger(game);
  const price = game.settings.buyInPrice;
  const cents = netsInCents(rows, price, game.settings.startingStack);
  const useCash = price > 0;
  const transfers = settleUp(rows.map((r) => ({ id: r.id, net: useCash ? (cents.get(r.id) ?? 0) : r.net })));
  const name = (id: string) => rows.find((r) => r.id === id)?.name ?? nameOf(id);

  if (rows.length === 0) return <p className="muted">Nobody has played yet.</p>;

  return (
    <div className="settle">
      <table className="ledger">
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col" className="num">In</th>
            <th scope="col" className="num">Now</th>
            <th scope="col" className="num">Net</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-sign={Math.sign(r.net)}>
              <th scope="row">
                {r.name}
                {r.departed && <span className="tag">left</span>}
              </th>
              <td className="num">{fmt(r.buyIn)}</td>
              <td className="num">{fmt(r.stack)}</td>
              <td className="num net">{useCash ? signedMoney(cents.get(r.id) ?? 0) : signed(r.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="settle-title">{transfers.length ? 'To square up' : 'Everyone is settled.'}</h3>
      {transfers.length > 0 && (
        <ul className="transfers">
          {transfers.map((t, i) => (
            <li key={i}>
              <span><strong>{name(t.from)}</strong> pays <strong>{name(t.to)}</strong></span>
              <span className="num">{useCash ? money(t.amount) : `${fmt(t.amount)} chips`}</span>
            </li>
          ))}
        </ul>
      )}
      {!useCash && <p className="hint">Set a cash price per buy-in in game settings to see money amounts.</p>}
      {handInProgress(game) && <p className="hint">Chips in the current pot are counted for whoever put them in.</p>}
    </div>
  );
}
