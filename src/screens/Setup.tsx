import { useState } from 'react';
import { CURRENCIES, type CurrencyCode } from '../../shared/protocol';
import { createRoom } from '../lib/api';
import { unlockAudio } from '../lib/device-features';

const money = (currency: CurrencyCode, value: number) =>
  new Intl.NumberFormat('en-MY', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);

export function Setup({ navigate }: { navigate: (to: string) => void }) {
  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState<CurrencyCode>('MYR');
  const [startingStack, setStartingStack] = useState(250);
  const [sb, setSb] = useState(1);
  const [bb, setBb] = useState(2);
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => (step === 1 ? navigate('/') : setStep((value) => value - 1));
  const valid = Number.isInteger(startingStack) && startingStack >= bb && sb >= 0 && bb >= 1 && sb <= bb;
  const submit = async () => {
    if (!valid) return;
    unlockAudio();
    setBusy(true);
    setError(null);
    try {
      const code = await createRoom({
        currency,
        settings: { sb, bb, startingStack, buyInPrice: startingStack * 100 },
      });
      navigate(`/invite/${code}`);
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="setup-shell">
      <section className="setup-panel">
        <header className="setup-topbar">
          <button className="plain-action" onClick={back}>Back</button>
          <strong>Create a room</strong>
          <span>{step} of 3</span>
        </header>
        <div className="setup-progress" aria-label={`Step ${step} of 3`}><span style={{ width: `${(step / 3) * 100}%` }} /></div>

        {step === 1 && (
          <div className="setup-content">
            <div className="setup-heading">
              <h1>How will you play?</h1>
              <p>Choose who handles the cards.</p>
            </div>
            <div className="choice-list">
              <button className="choice-row" aria-pressed="true">
                <span><strong>Physical cards</strong><small>Use your own deck. The host deals by default.</small></span>
                <span className="choice-check" aria-hidden="true">✓</span>
              </button>
              <button className="choice-row" disabled>
                <span><strong>Digital cards</strong><small>Available in a later release.</small></span>
                <span>Later release</span>
              </button>
            </div>
            <p className="setup-note">You can assign the Table Controller before starting.</p>
          </div>
        )}

        {step === 2 && (
          <div className="setup-content">
            <div className="setup-heading">
              <h1>Set the stakes</h1>
              <p>These values apply to every player.</p>
            </div>
            <div className="stake-fields">
              <label>Currency<select value={currency} onChange={(event) => setCurrency(event.target.value as CurrencyCode)}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select></label>
              <label>Starting balance<div className="money-input"><span>{currency}</span><input aria-label="Starting balance" inputMode="numeric" min={1} value={startingStack} onChange={(event) => setStartingStack(Number(event.target.value))} /></div></label>
              <label>Small blind<div className="money-input"><span>{currency}</span><input aria-label="Small blind" inputMode="numeric" min={0} value={sb} onChange={(event) => setSb(Number(event.target.value))} /></div></label>
              <label>Big blind<div className="money-input"><span>{currency}</span><input aria-label="Big blind" inputMode="numeric" min={1} value={bb} onChange={(event) => setBb(Number(event.target.value))} /></div></label>
            </div>
            {!valid && <p className="form-error" role="alert">Use whole values. The starting balance must cover the big blind, and the small blind cannot exceed it.</p>}
            <p className="setup-note">Currency is for bookkeeping only.</p>
          </div>
        )}

        {step === 3 && (
          <div className="setup-content">
            <div className="setup-heading"><h1>Review your room</h1></div>
            <dl className="review-list">
              <div><dt>Physical cards</dt><dd><button onClick={() => setStep(1)}>Change</button></dd></div>
              <div><dt>Texas Hold’em · Cash game</dt><dd /></div>
              <div><dt>{money(currency, startingStack)} starting balance</dt><dd><button onClick={() => setStep(2)}>Change</button></dd></div>
              <div><dt>{money(currency, sb)} / {money(currency, bb)} blinds</dt><dd><button onClick={() => setStep(2)}>Change</button></dd></div>
              <div><dt>Table Controller · You (Host)</dt><dd>Change in lobby</dd></div>
              <div><dt>Sound</dt><dd><button className="switch" role="switch" aria-checked={sound} onClick={() => setSound(!sound)}><span /></button></dd></div>
              <div><dt>Haptics</dt><dd><button className="switch" role="switch" aria-checked={haptics} onClick={() => setHaptics(!haptics)}><span /></button></dd></div>
            </dl>
            <p className="setup-note">No real money is handled.</p>
            {error && <p className="form-error" role="alert">{error}</p>}
          </div>
        )}

        <button className="premium-primary" disabled={(step === 2 && !valid) || busy} onClick={() => step < 3 ? setStep(step + 1) : void submit()}>
          {step === 3 ? busy ? 'Creating room…' : 'Create room' : 'Continue'}
        </button>
      </section>
    </main>
  );
}
