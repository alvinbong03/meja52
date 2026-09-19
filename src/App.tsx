import { useCallback, useEffect, useState } from 'react';
import { isRoomCode } from '../shared/protocol';
import { Toaster } from './components/Toast';
import { Home } from './screens/Home';
import { InviteRoom } from './screens/InviteRoom';
import { JoinCode } from './screens/JoinCode';
import { Room } from './screens/Room';
import { Setup } from './screens/Setup';

type Route =
  | { screen: 'home' | 'setup' | 'join' }
  | { screen: 'invite'; code: string }
  | { screen: 'room'; code: string; display: boolean };

function parse(url: string): Route | null {
  const { pathname, searchParams } = new URL(url, location.origin);
  if (pathname === '/') return { screen: 'home' };
  if (pathname === '/create') return { screen: 'setup' };
  if (pathname === '/join') return { screen: 'join' };
  const invite = pathname.match(/^\/invite\/([A-Za-z]{4})\/?$/)?.[1].toUpperCase();
  if (invite && isRoomCode(invite)) return { screen: 'invite', code: invite };
  const room = pathname.match(/^\/t\/([A-Za-z]{4})\/?$/)?.[1].toUpperCase();
  if (room && isRoomCode(room)) return { screen: 'room', code: room, display: searchParams.get('view') === 'display' };
  return null;
}

export function App() {
  const [href, setHref] = useState(() => location.pathname + location.search);
  useEffect(() => {
    const onPop = () => setHref(location.pathname + location.search);
    window.addEventListener('popstate', onPop);
    if (!parse(location.href)) history.replaceState(null, '', '/');
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((to: string) => {
    history.pushState(null, '', to);
    setHref(to);
    window.scrollTo(0, 0);
  }, []);
  const route = parse(href) ?? { screen: 'home' as const };
  return (
    <>
      {route.screen === 'home' && <Home navigate={navigate} />}
      {route.screen === 'setup' && <Setup navigate={navigate} />}
      {route.screen === 'join' && <JoinCode navigate={navigate} />}
      {route.screen === 'invite' && <InviteRoom code={route.code} navigate={navigate} />}
      {route.screen === 'room' && <Room key={route.code} code={route.code} display={route.display} navigate={navigate} />}
      <Toaster />
    </>
  );
}
