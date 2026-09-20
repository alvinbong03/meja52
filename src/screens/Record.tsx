import { useEffect, useMemo, useState } from 'react';
import type { LogKind, SettlementRecord } from '../../shared/protocol';
import { deleteSettlementRecord, settlementRecord } from '../lib/api';
import { exportRecordCsv, exportRecordImage, exportRecordJson } from '../lib/record-export';
import { Icon } from '../components/Icon';

type View = 'summary' | 'history' | 'data' | 'delete';
type Filter = 'all' | LogKind;

export function Record({ code, token, navigate }: { code: string; token: string; navigate: (to: string) => void }) {
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof settlementRecord>>>();
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('summary');

  useEffect(() => {
    document.title = `${code} · Private record · MEJA52`;
    void settlementRecord(code, token).then(setPayload).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load this record'));
    return () => { document.title = 'MEJA52'; };
  }, [code, token]);

  if (error || payload === null) return <RecordNotice title="This private record is unavailable" body={error || 'The link may be incomplete, deleted, or past its 30-day window.'} onDone={() => navigate('/')} />;
  if (!payload) return <main className="record-loading" aria-busy="true"><strong>{code}</strong><span>Opening private record…</span></main>;

  const props = { record: payload.record, canDelete: payload.canDelete, code, token, navigate, setView };
  if (view === 'history') return <HistoryView {...props} />;
  if (view === 'data') return <DataView {...props} />;
  if (view === 'delete') return <DeleteView {...props} />;
  return <SummaryView {...props} />;
}

interface RecordViewProps {
  record: SettlementRecord;
  canDelete: boolean;
  code: string;
  token: string;
  navigate: (to: string) => void;
  setView: (view: View) => void;
}

function Frame({ title, kicker, onBack, children, footer = 'Private link · Available for 30 days' }: {
  title: string;
  kicker: string;
  onBack: () => void;
  children: React.ReactNode;
  footer?: string;
}) {
  return (
    <main className="record-page">
      <header className="record-nav">
        <button className="icon-btn" aria-label="Back" onClick={onBack}><Icon name="back" /></button>
        <div><strong>{title}</strong><span>{kicker}</span></div>
        <span aria-hidden="true" />
      </header>
      {children}
      <footer>{footer}</footer>
    </main>
  );
}

function SummaryView({ record, setView, navigate }: RecordViewProps) {
  const amount = amountFormatter(record);
  return (
    <Frame title="Final record" kicker={record.code} onBack={() => navigate('/')}>
      <section className="record-summary">
        <div className="record-title">
          <span>{dateTime(record.finalizedAt)}</span>
          <h1>{record.finalizedWithIssues ? 'Settlement recorded' : 'Settlement complete'}</h1>
          <p>{record.players.length} players · {record.handCount} hand{record.handCount === 1 ? '' : 's'}</p>
        </div>
        <div className="record-player-list">
          {record.players.map((player) => (
            <div key={player.id}>
              <span>{player.name}{player.leftEarly && <small>Left early</small>}</span>
              <strong className="num" data-sign={Math.sign(player.net)}>{amount(player.net, true)}</strong>
            </div>
          ))}
        </div>
        <div className="record-actions">
          <button className="btn btn-primary btn-lg btn-block" onClick={() => exportRecordImage(record, amount)}>Save summary image</button>
          <button className="record-row-button" onClick={() => setView('history')}><span><strong>Session history</strong><small>{record.history.length} recorded events</small></span><Icon name="right" /></button>
          <button className="record-row-button" onClick={() => setView('data')}><span><strong>Room data & exports</strong><small>CSV, JSON and private link</small></span><Icon name="right" /></button>
        </div>
      </section>
    </Frame>
  );
}

function HistoryView({ record, setView }: RecordViewProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const events = useMemo(() => filter === 'all' ? record.history : record.history.filter((entry) => entry.kind === filter), [filter, record.history]);
  return (
    <Frame title="Session history" kicker={`${record.handCount} hand${record.handCount === 1 ? '' : 's'} · ${record.code}`} onBack={() => setView('summary')}>
      <section className="record-history">
        <div className="record-section-head">
          <div><h1>Table timeline</h1><p>Meaningful actions, payouts and corrections.</p></div>
          <label><span className="sr-only">Filter events</span><select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="all">All events</option><option value="hand">Hands</option><option value="action">Actions</option><option value="win">Payouts</option><option value="undo">Corrections</option><option value="table">Table</option></select></label>
        </div>
        <ol className="history-list">
          {events.map((event) => <li key={event.id}><time>{time(event.at)}</time><span data-kind={event.kind} /><p>{event.text}</p></li>)}
          {events.length === 0 && <li className="history-empty">No events in this filter.</li>}
        </ol>
        <div className="record-export-pair"><button className="btn btn-quiet btn-lg" onClick={() => exportRecordCsv(record)}>Export CSV</button><button className="btn btn-primary btn-lg" onClick={() => exportRecordJson(record)}>Export JSON</button></div>
      </section>
    </Frame>
  );
}

function DataView({ record, canDelete, setView }: RecordViewProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(location.href);
    setCopied(true);
  };
  return (
    <Frame title="Room data" kicker={record.code} onBack={() => setView('summary')}>
      <section className="record-data">
        <div className="record-title record-title-left"><span>Private record</span><h1>Available for 30 days</h1><p>Deletes automatically on {shortDate(record.expiresAt)}.</p></div>
        <dl className="record-facts">
          <div><dt>Settlement</dt><dd>{record.finalizedWithIssues ? 'Final · issue noted' : 'Final'}</dd></div>
          <div><dt>Hand history</dt><dd>{record.handCount} hand{record.handCount === 1 ? '' : 's'}</dd></div>
          <div><dt>Player records</dt><dd>{record.players.length}</dd></div>
        </dl>
        <div className="record-actions">
          <button className="btn btn-primary btn-lg btn-block" onClick={() => void copy()}>{copied ? 'Private link copied' : 'Copy private link'}</button>
          <button className="btn btn-quiet btn-lg btn-block" onClick={() => exportRecordCsv(record)}>Export ledger CSV</button>
          <button className="btn btn-quiet btn-lg btn-block" onClick={() => exportRecordJson(record)}>Export all data</button>
        </div>
        {canDelete && <button className="record-delete-link" onClick={() => setView('delete')}>Delete room early</button>}
      </section>
    </Frame>
  );
}

function DeleteView({ record, code, token, navigate, setView }: RecordViewProps) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteSettlementRecord(code, token);
      navigate('/');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete this record');
      setBusy(false);
    }
  };
  return (
    <Frame title="Delete room" kicker={code} onBack={() => setView('data')} footer="Deletion is permanent and closes the private link.">
      <section className="record-delete">
        <div className="record-delete-mark" aria-hidden="true"><Icon name="warning" size={28} /></div>
        <div className="record-title"><span>Host control</span><h1>Delete this room?</h1><p>The settlement, {record.handCount}-hand history and all player records will be erased now.</p></div>
        <button className="record-export-before" onClick={() => exportRecordJson(record)}>Export all data before deleting</button>
        <label htmlFor="delete-room-code">Type <strong>{code}</strong> to confirm</label>
        <input id="delete-room-code" className="text-input" value={typed} autoCapitalize="characters" autoComplete="off" onChange={(event) => setTyped(event.target.value.toUpperCase())} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="record-delete-actions"><button className="btn btn-quiet btn-lg" onClick={() => setView('data')}>Keep room</button><button className="btn btn-danger btn-lg" disabled={busy || typed !== code} onClick={() => void remove()}>Delete permanently</button></div>
      </section>
    </Frame>
  );
}

function amountFormatter(record: SettlementRecord) {
  const cash = record.settings.buyInPrice > 0;
  const formatter = new Intl.NumberFormat('en-MY', cash ? { style: 'currency', currency: record.currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 } : { maximumFractionDigits: 0 });
  return (value: number, signed = false) => {
    const absolute = formatter.format(Math.abs(cash ? value / 100 : value));
    if (!signed || value === 0) return absolute;
    return `${value > 0 ? '+' : '−'}${absolute}`;
  };
}

const dateTime = (at: number) => new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(at);
const shortDate = (at: number) => new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium' }).format(at);
const time = (at: number) => new Intl.DateTimeFormat('en-MY', { hour: '2-digit', minute: '2-digit' }).format(at);

function RecordNotice({ title, body, onDone }: { title: string; body: string; onDone: () => void }) {
  return <main className="notice"><h1 className="notice-title">{title}</h1><p className="muted">{body}</p><button className="btn btn-primary btn-lg" onClick={onDone}>Back home</button></main>;
}
