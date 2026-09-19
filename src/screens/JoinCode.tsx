import { useState, type FormEvent } from 'react';
import { CODE_LENGTH, normalizeCode } from '../../shared/protocol';
import { Brand } from '../components/Brand';
import { roomInfo } from '../lib/api';

export function JoinCode({ navigate }: { navigate: (to: string) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    setBusy(true); setError(null);
    try {
      if (!(await roomInfo(code))) { setError(`No room called ${code}. Check the code and try again.`); setBusy(false); return; }
      navigate(`/t/${code}`);
    } catch (cause) { setError((cause as Error).message); setBusy(false); }
  };
  return (
    <main className="entry-shell">
      <header className="entry-nav"><Brand compact /><button className="plain-action" onClick={() => navigate('/')}>Close</button></header>
      <section className="entry-card">
        <p className="eyebrow">Join a table</p>
        <h1>Enter room code</h1>
        <p className="entry-copy">Ask the host for the four letters shown on their screen.</p>
        <form className="entry-form" onSubmit={submit}>
          <label htmlFor="room-code">Room code</label>
          <input id="room-code" className="premium-code-input" value={code} onChange={(event) => setCode(normalizeCode(event.target.value))} placeholder="ABCD" autoCapitalize="characters" autoCorrect="off" spellCheck={false} autoFocus />
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="premium-primary" disabled={code.length !== CODE_LENGTH || busy}>{busy ? 'Finding room…' : 'Continue'}</button>
        </form>
      </section>
    </main>
  );
}
