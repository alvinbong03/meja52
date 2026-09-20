import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { ledger, netsInCents, settleUp } from '../../shared/settle';
import { fmt } from '../lib/format';
import { createRecordToken, savedRecordToken } from '../lib/device';
import { useTable } from '../lib/table';
import { Icon } from './Icon';

function cash(currency: string, cents: number) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function signedCash(currency: string, cents: number) {
  return cents > 0 ? `+${cash(currency, cents)}` : cents < 0 ? `−${cash(currency, -cents)}` : cash(currency, 0);
}

export function SettlementExperience({ onDone }: { onDone: () => void }) {
  const { room, game, me, isHost, run, busy, v, nameOf } = useTable();
  const settlement = room.settlement!;
  const rows = useMemo(() => ledger(game), [game]);
  const useCash = game.settings.buyInPrice > 0;
  const cents = useMemo(
    () => netsInCents(rows, game.settings.buyInPrice, game.settings.startingStack),
    [game.settings.buyInPrice, game.settings.startingStack, rows],
  );
  const transfers = useMemo(
    () => settleUp(rows.map((row) => ({ id: row.id, net: useCash ? (cents.get(row.id) ?? 0) : row.net }))),
    [cents, rows, useCash],
  );
  const myReview = settlement.reviews.find((review) => review.playerId === me?.id);
  const value = (amount: number) => useCash ? cash(room.currency, amount) : `${fmt(amount)} chips`;

  if (settlement.finalizedAt) {
    return (
      <FinalRecord
        rows={rows}
        transfers={transfers}
        settled={settlement.settledTransfers}
        issues={settlement.reviews.filter((review) => review.status === 'issue')}
        withIssues={settlement.finalizedWithIssues}
        net={(id) => useCash ? signedCash(room.currency, cents.get(id) ?? 0) : signedChips(rows.find((row) => row.id === id)?.net ?? 0)}
        recordHref={isHost && savedRecordToken(room.code) ? `/record/${room.code}/${savedRecordToken(room.code)}` : null}
        onDone={onDone}
      />
    );
  }

  if (me && myReview?.status !== 'correct') {
    const row = rows.find((item) => item.id === me.id);
    if (row) {
      return (
        <PersonalReview
          row={row}
          entries={settlement.entries.filter((entry) => entry.playerId === me.id)}
          review={myReview}
          useCash={useCash}
          price={game.settings.buyInPrice}
          startingStack={game.settings.startingStack}
          currency={room.currency}
          busy={busy}
          submit={(status, reason) => run({ type: 'reviewSettlement', v, status, ...(reason ? { reason } : {}) })}
          onDone={onDone}
        />
      );
    }
  }

  const ownTransferIndexes = transfers.flatMap((transfer, index) => transfer.from === me?.id ? [index] : []);
  const ownSettled = ownTransferIndexes.length > 0 && ownTransferIndexes.every((index) => settlement.settledTransfers.includes(index));
  const issues = settlement.reviews.filter((review) => review.status === 'issue');
  const reviewed = settlement.reviews.length;

  return (
    <SettlementFrame title="Settle the table" onBack={onDone} footer="Settled is a shared acknowledgement only.">
      <section className="settlement-transfer-view">
        <h1>{transfers.length === 0 ? 'Everyone is square' : `${transfers.length} transfer${transfers.length === 1 ? '' : 's'} settle everyone`}</h1>
        <p className="settlement-progress">{reviewed} of {rows.length} players reviewed their result</p>
        <div className="settlement-transfers">
          {transfers.map((transfer, index) => {
            const settled = settlement.settledTransfers.includes(index);
            return (
              <div className="settlement-transfer" key={`${transfer.from}-${transfer.to}-${index}`}>
                <div><strong>{nameOf(transfer.from)}</strong><small>{settled ? 'Settled' : 'Waiting'}</small></div>
                <Icon name="right" size={20} />
                <strong>{nameOf(transfer.to)}</strong>
                <span className="num">{value(transfer.amount)}</span>
              </div>
            );
          })}
          {transfers.length === 0 && <p className="settlement-empty">No payments are needed.</p>}
        </div>

        {ownTransferIndexes.length > 0 && (
          <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={() => {
            void run({ type: 'setMyTransfersSettled', v, settled: !ownSettled });
          }}>{ownSettled ? 'Mark my transfer unsettled' : `Mark my transfer${ownTransferIndexes.length === 1 ? '' : 's'} settled`}</button>
        )}
        <ShareSummary transfers={transfers.map((transfer) => `${nameOf(transfer.from)} pays ${nameOf(transfer.to)} ${value(transfer.amount)}`)} />

        {issues.length > 0 && (
          <div className="settlement-issues" role="status">
            <strong>{issues.length} unresolved issue{issues.length === 1 ? '' : 's'}</strong>
            {issues.map((issue) => <span key={issue.playerId}>{nameOf(issue.playerId)}: {issue.reason}</span>)}
          </div>
        )}
        {isHost && (
          <HostFinalise
            issues={issues.length}
            busy={busy}
            dominant={ownTransferIndexes.length === 0 || ownSettled}
            onFinalise={(withIssues) => run({ type: 'finalizeSettlement', v, withIssues, recordToken: createRecordToken(room.code) })}
          />
        )}
      </section>
    </SettlementFrame>
  );
}

function SettlementFrame({ title, onBack, footer, children }: {
  title: string;
  onBack: () => void;
  footer: string;
  children: ReactNode;
}) {
  return (
    <main className="settlement-page">
      <header className="settlement-nav">
        <button className="icon-btn" aria-label="Back to home" onClick={onBack}><Icon name="back" /></button>
        <div><strong>{title}</strong><span>Settlement</span></div>
        <span aria-hidden="true" />
      </header>
      {children}
      <footer>{footer}</footer>
    </main>
  );
}

function PersonalReview({ row, entries, review, useCash, price, startingStack, currency, busy, submit, onDone }: {
  row: ReturnType<typeof ledger>[number];
  entries: NonNullable<ReturnType<typeof useTable>['room']['settlement']>['entries'];
  review: NonNullable<ReturnType<typeof useTable>['room']['settlement']>['reviews'][number] | undefined;
  useCash: boolean;
  price: number;
  startingStack: number;
  currency: string;
  busy: boolean;
  submit: (status: 'correct' | 'issue', reason?: string) => Promise<boolean>;
  onDone: () => void;
}) {
  const [reporting, setReporting] = useState(review?.status === 'issue');
  const [reason, setReason] = useState(review?.reason ?? '');
  const cashFromChips = (chips: number) => cash(currency, Math.round(chips * price / startingStack));
  const amount = (chips: number) => useCash ? cashFromChips(chips) : `${fmt(chips)} chips`;
  const net = useCash ? signedCash(currency, Math.round(row.net * price / startingStack)) : signedChips(row.net);
  const knownEntries = entries.length > 0 ? entries : [{ id: 'legacy', playerId: row.id, kind: 'initial' as const, amount: row.buyIn, at: 0 }];

  const report = async (event: FormEvent) => {
    event.preventDefault();
    if (reason.trim() && await submit('issue', reason.trim())) setReporting(false);
  };

  return (
    <SettlementFrame title="Game ended" onBack={onDone} footer="No money is transferred by this website.">
      <section className="personal-result">
        <div className="personal-result-hero">
          <span>Your result</span>
          <h1>{net}</h1>
          <p>Final balance {amount(row.stack)}</p>
        </div>
        <dl className="result-ledger">
          {knownEntries.map((entry, index) => (
            <div key={entry.id}>
              <dt>{entry.kind === 'initial' ? 'Starting amount' : entry.kind === 'rebuy' ? `Rebuy${knownEntries.filter((item) => item.kind === 'rebuy').length > 1 ? ` ${index}` : ''}` : 'Host adjustment'}</dt>
              <dd className="num">{entry.amount < 0 ? `−${amount(-entry.amount)}` : amount(entry.amount)}</dd>
            </div>
          ))}
          <div className="result-total"><dt>Total entered</dt><dd className="num">{amount(row.buyIn)}</dd></div>
          <div><dt>Final balance</dt><dd className="num">{amount(row.stack)}</dd></div>
        </dl>

        {review?.status === 'issue' && (
          <div className="settlement-issue-reported" role="status"><strong>Issue reported</strong><span>{review.reason}</span></div>
        )}

        {reporting ? (
          <form className="settlement-report" onSubmit={report}>
            <label htmlFor="settlement-issue">What looks wrong?</label>
            <textarea id="settlement-issue" className="text-input" maxLength={160} value={reason} autoFocus onChange={(event) => setReason(event.target.value)} placeholder="For example, a rebuy is missing" />
            <button className="btn btn-danger btn-lg btn-block" disabled={busy || !reason.trim()}>Report issue</button>
            <button type="button" className="btn btn-quiet btn-lg btn-block" onClick={() => setReporting(false)}>Cancel</button>
          </form>
        ) : (
          <div className="settlement-review-actions">
            <button className="btn btn-primary btn-xl btn-block" disabled={busy} onClick={() => submit('correct')}>{review ? 'Resolved — looks correct' : 'Looks correct'}</button>
            <button className="btn btn-quiet btn-lg btn-block" onClick={() => setReporting(true)}>Report an issue</button>
          </div>
        )}
      </section>
    </SettlementFrame>
  );
}

function ShareSummary({ transfers }: { transfers: string[] }) {
  const [shared, setShared] = useState(false);
  const share = async () => {
    const text = transfers.length ? `MEJA52 settlement\n${transfers.join('\n')}` : 'MEJA52 settlement\nEveryone is square.';
    if (navigator.share) await navigator.share({ title: 'MEJA52 settlement', text });
    else await navigator.clipboard.writeText(text);
    setShared(true);
  };
  return <button className="btn btn-quiet btn-lg btn-block" onClick={() => void share()}>{shared ? 'Summary copied' : 'Share summary'}</button>;
}

function HostFinalise({ issues, busy, dominant, onFinalise }: { issues: number; busy: boolean; dominant: boolean; onFinalise: (withIssues: boolean) => Promise<boolean> }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming && issues > 0) {
    return (
      <div className="finalise-warning">
        <strong>The issue marker will be permanent</strong>
        <span>The record can still be shared, but it will not say everyone agreed.</span>
        <div><button className="btn btn-quiet btn-lg" onClick={() => setConfirming(false)}>Cancel</button><button className="btn btn-danger btn-lg" disabled={busy} onClick={() => onFinalise(true)}>Finalize with issue</button></div>
      </div>
    );
  }
  return <button className={`btn ${issues ? 'btn-danger-quiet' : dominant ? 'btn-primary' : 'btn-quiet'} btn-xl btn-block`} disabled={busy} onClick={() => issues ? setConfirming(true) : onFinalise(false)}>{issues ? 'Finalize with issue' : 'Finalize record'}</button>;
}

function FinalRecord({ rows, transfers, settled, issues, withIssues, net, recordHref, onDone }: {
  rows: ReturnType<typeof ledger>;
  transfers: ReturnType<typeof settleUp>;
  settled: number[];
  issues: NonNullable<ReturnType<typeof useTable>['room']['settlement']>['reviews'];
  withIssues: boolean;
  net: (id: string) => string;
  recordHref: string | null;
  onDone: () => void;
}) {
  const unsettled = transfers.length - settled.length;
  return (
    <SettlementFrame title="Final record" onBack={onDone} footer="No money is transferred by this website.">
      <section className="final-record">
        <div className="final-record-head"><h1>{withIssues ? 'Settlement recorded with an issue' : 'Settlement complete'}</h1><p>{rows.length} players</p></div>
        <div className="record-checks">
          <div><Icon name="check" size={17} /><span>Results sum to zero</span></div>
          {unsettled > 0 && <div data-warning><Icon name="warning" size={17} /><span>{unsettled} transfer{unsettled === 1 ? '' : 's'} unconfirmed</span></div>}
          {withIssues && <div data-warning><Icon name="warning" size={17} /><span>{issues.length} unresolved issue{issues.length === 1 ? '' : 's'}</span></div>}
        </div>
        <div className="final-result-list">
          {rows.map((row) => <div key={row.id} data-sign={Math.sign(row.net)}><span>{row.name}{row.departed && <small>Left early</small>}</span><strong className="num">{net(row.id)}</strong></div>)}
        </div>
        {recordHref && <a className="btn btn-primary btn-xl btn-block" href={recordHref}>Open private record</a>}
        <button className={`btn ${recordHref ? 'btn-quiet btn-lg' : 'btn-primary btn-xl'} btn-block`} onClick={onDone}>Done</button>
      </section>
    </SettlementFrame>
  );
}

function signedChips(amount: number) {
  return amount > 0 ? `+${fmt(amount)}` : amount < 0 ? `−${fmt(-amount)}` : '0';
}
