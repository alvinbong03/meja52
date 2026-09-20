import { randomBytes } from 'node:crypto';

const base = (process.argv[2] ?? 'https://meja52.meja52.workers.dev').replace(/\/$/, '');
const token = () => randomBytes(32).toString('hex');
const latest = new Map();

async function waitFor(label, predicate) {
  for (let attempt = 0; attempt < 160; attempt += 1) {
    const state = latest.get(label);
    if (state && predicate(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function connect(code, deviceToken, label) {
  const wsUrl = new URL(`/api/rooms/${code}/ws`, base);
  wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.type === 'state') latest.set(label, message);
  };
  ws.send(JSON.stringify({ type: 'hello', token: deviceToken }));
  await waitFor(label, () => true);
  return ws;
}

const health = await fetch(`${base}/api/health`);
if (!health.ok || !(await health.json()).ok) throw new Error(`Health check failed: ${health.status}`);

const hostToken = token();
const guestToken = token();
const created = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', Origin: base },
  body: JSON.stringify({ token: hostToken }),
});
if (created.status !== 201) throw new Error(`Room creation failed: ${created.status}`);
const { code } = await created.json();

const host = await connect(code, hostToken, 'host');
host.send(JSON.stringify({ type: 'join', name: 'Smoke Host', seq: 1 }));
await waitFor('host', (state) => state.room.members.length === 1);

const guest = await connect(code, guestToken, 'guest');
guest.send(JSON.stringify({ type: 'join', name: 'Smoke Guest', seq: 1 }));
await waitFor('host', (state) => state.room.members.length === 2);
await waitFor('guest', (state) => state.room.members.length === 2);

host.send(JSON.stringify({ type: 'start', v: latest.get('host').v, seq: 2 }));
const hostState = await waitFor('host', (state) => state.room.game.phase === 'betting');
const guestState = await waitFor('guest', (state) => state.room.game.phase === 'betting');

const hostOwn = hostState.room.game.players.find((player) => player.id === hostState.you.id);
const guestOnHost = hostState.room.game.players.find((player) => player.id === guestState.you.id);
const guestOwn = guestState.room.game.players.find((player) => player.id === guestState.you.id);
const hostOnGuest = guestState.room.game.players.find((player) => player.id === hostState.you.id);
if (
  hostOwn?.chipState !== 'visible'
  || guestOwn?.chipState !== 'visible'
  || guestOnHost?.chipState !== 'private'
  || hostOnGuest?.chipState !== 'private'
) throw new Error('Per-player privacy boundary failed');
if (hostState.room.potTotal <= 0) throw new Error('Public pot state was not populated');

host.close();
guest.close();
console.log(`PASS ${base} · table ${code} · two players · WebSockets · private balances · pot ${hostState.room.potTotal}`);
