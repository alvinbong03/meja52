import { Brand } from '../components/Brand';

export function Home({ navigate }: { navigate: (to: string) => void }) {
  return (
    <main className="premium-home">
      <header className="premium-home-nav"><Brand compact /><span>Chips for the table</span></header>
      <section className="premium-hero">
        <h1>Poker chips.<br />Any table.<br />Any time.</h1>
        <p>Turn every phone into a tactile poker stack while real cards stay at the centre of the game.</p>
        <div className="premium-home-actions">
          <button className="premium-primary" onClick={() => navigate('/create')}>Create a room</button>
          <button className="premium-secondary" onClick={() => navigate('/join')}>Join a table</button>
        </div>
      </section>
      <div className="home-card home-card-back" aria-hidden="true"><span>K<small>♠</small></span><b>♠</b></div>
      <div className="home-card home-card-front" aria-hidden="true"><span>A<small>♥</small></span><b>♥</b></div>
      <div className="home-chips" aria-hidden="true">
        {Array.from({ length: 7 }, (_, index) => <i key={index} />)}
      </div>
      <div className="home-table-edge" aria-hidden="true" />
      <footer className="premium-home-foot"><span>Up to 15 players</span></footer>
    </main>
  );
}
