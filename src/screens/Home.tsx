import { Brand } from '../components/Brand';

export function Home({ navigate }: { navigate: (to: string) => void }) {
  return (
    <main className="premium-home">
      <header className="premium-home-nav"><Brand compact /><span>Chips for the table</span></header>
      <section className="premium-hero">
        <p className="eyebrow">Poker, together</p>
        <h1>Your table.<br />No chip case.</h1>
        <p>Turn every phone into a tactile poker stack while real cards stay at the centre of the game.</p>
        <div className="premium-home-actions">
          <button className="premium-primary" onClick={() => navigate('/create')}>Create a room</button>
          <button className="premium-secondary" onClick={() => navigate('/join')}>Join a table</button>
        </div>
      </section>
      <footer className="premium-home-foot"><span>No download</span><span>No account</span><span>Up to 15 players</span></footer>
    </main>
  );
}
