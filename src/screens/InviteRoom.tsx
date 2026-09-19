import { useState } from 'react';
import { roomUrl } from '../lib/format';
import { Qr } from '../components/Qr';

export function InviteRoom({ code, navigate }: { code: string; navigate: (to: string) => void }) {
  const [copied, setCopied] = useState(false);
  const url = roomUrl(code);
  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `MEJA52 room ${code}`, text: `Join my MEJA52 table with code ${code}.`, url }); return; } catch { return; }
    }
    await copy(url);
  };
  return (
    <main className="setup-shell">
      <section className="setup-panel invite-ready">
        <header className="setup-topbar"><span /><strong>Room ready</strong><button className="plain-action" onClick={() => navigate('/')}>Close</button></header>
        <div className="setup-heading"><h1>Invite your table</h1><p>Friends can scan or enter the four-letter code.</p></div>
        <Qr value={url} size={196} label={`QR code to join room ${code}`} />
        <div className="ready-code"><span>Room code</span><strong aria-label={`Room code ${code.split('').join(' ')}`}>{code}</strong><button className="text-action" onClick={() => void copy(code)}>{copied ? 'Copied' : 'Copy code'}</button></div>
        <div className="ready-actions">
          <button className="premium-primary" onClick={() => void share()}>Share invite</button>
          <button className="premium-secondary" onClick={() => navigate(`/t/${code}`)}>Open lobby</button>
        </div>
        <p className="setup-note ready-foot">No account required.</p>
      </section>
    </main>
  );
}
