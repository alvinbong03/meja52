import { env } from 'cloudflare:workers';
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { AWAY_AFTER_MS, HOST_DISCONNECT_GRACE_MS } from '../../shared/protocol';
import { originAllowed, randomCode } from '../src/index';
import { CREATOR_GRACE_MS, FINAL_TTL_MS } from '../src/room';
import { api, Client, createRoom, table, tokenFor } from './client';

describe('http api', () => {
  it('reports health and creates rooms with valid codes', async () => {
    expect((await api('/api/health')).status).toBe(200);
    const code = await createRoom();
    expect(code).toMatch(/^[A-HJKMNP-Z]{4}$/);
    const info = await api(`/api/rooms/${code}`);
    expect(await info.json()).toEqual({ code, phase: 'lobby', playerCount: 0 });
  });

  it('requires a valid private device token when creating a room', async () => {
    for (const body of [undefined, {}, { token: 'short' }, { token: 'Z'.repeat(64) }]) {
      const res = await api('/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      expect(res.status).toBe(400);
    }
  });

  it('creates a room with its chosen currency, stack and blinds', async () => {
    const token = tokenFor(77);
    const res = await api('/api/rooms', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '203.0.113.77', 'content-type': 'application/json' },
      body: JSON.stringify({
        token,
        currency: 'MYR',
        settings: { sb: 1, bb: 2, startingStack: 250, buyInPrice: 25_000 },
      }),
    });
    expect(res.status).toBe(201);
    const { code } = (await res.json()) as { code: string };
    const creator = await Client.connect(code, token);
    expect(creator.state.room.currency).toBe('MYR');
    expect(creator.state.room.game.settings).toEqual({ sb: 1, bb: 2, startingStack: 250, buyInPrice: 25_000 });
  });

  it('rejects unsupported currencies and invalid room settings', async () => {
    for (const config of [
      { currency: 'DOGE', settings: { sb: 1, bb: 2, startingStack: 250, buyInPrice: 25_000 } },
      { currency: 'MYR', settings: { sb: 3, bb: 2, startingStack: 250, buyInPrice: 25_000 } },
    ]) {
      const res = await api('/api/rooms', {
        method: 'POST',
        headers: { 'cf-connecting-ip': `203.0.113.${Math.floor(Math.random() * 100) + 100}`, 'content-type': 'application/json' },
        body: JSON.stringify({ token: tokenFor(78), ...config }),
      });
      expect(res.status).toBe(400);
    }
  });

  it('returns 404 for unknown or malformed rooms without creating them', async () => {
    expect((await api('/api/rooms/ZZZZ')).status).toBe(404);
    expect((await api('/api/rooms/zz1')).status).toBe(404);
    const ws = await api('/api/rooms/ZZZZ/ws', { headers: { Upgrade: 'websocket' } });
    expect(ws.status).toBe(404);
    const stub = env.ROOMS.get(env.ROOMS.idFromName('ZZZZ'));
    const keys = await runInDurableObject(stub, (_, state) => state.storage.list());
    expect(keys.size).toBe(0);
  });

  it('rejects foreign origins and non websocket upgrades', async () => {
    const code = await createRoom();
    const res = await api(`/api/rooms/${code}/ws`, { headers: { Upgrade: 'websocket', Origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
    expect((await api(`/api/rooms/${code}/ws`)).status).toBe(426);
    expect(originAllowed('http://localhost:5173', {} as never)).toBe(true);
    expect(originAllowed('https://meja52.example.workers.dev', {} as never, 'https://meja52.example.workers.dev')).toBe(true);
    expect(originAllowed('https://evil.example', {} as never, 'https://meja52.example.workers.dev')).toBe(false);
    expect(originAllowed('https://preview.example.workers.dev', {} as never, 'https://meja52.example.workers.dev')).toBe(false);
  });

  it('rate limits table creation per address', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) {
      const res = await api('/api/rooms', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.9', 'content-type': 'application/json' },
        body: JSON.stringify({ token: tokenFor(88) }),
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 201)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('rate limits before parsing oversized table-creation requests', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) {
      const res = await api('/api/rooms', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.10', 'content-type': 'application/json' },
        body: JSON.stringify({ padding: 'x'.repeat(5000) }),
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 20).every((status) => status === 413)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
  });

  it('requires JSON for table creation', async () => {
    const res = await api('/api/rooms', {
      method: 'POST',
      headers: { 'cf-connecting-ip': '203.0.113.11', 'content-type': 'text/plain' },
      body: '{}',
    });
    expect(res.status).toBe(415);
  });

  it('generates codes from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) expect(randomCode()).toMatch(/^[A-HJKMNP-Z]{4}$/);
  });
});

describe('joining', () => {
  it('the room creator hosts even when a guest joins first, and reconnecting keeps the seat', async () => {
    const creatorToken = tokenFor(41);
    const code = await createRoom(creatorToken);
    const guest = await Client.connect(code, tokenFor(42));
    await guest.ok({ type: 'join', name: 'Guest' });
    expect(guest.state.room.hostId).toBeNull();
    expect(guest.state.room.controllerId).toBeNull();
    expect(guest.state.you.isHost).toBe(false);

    const creator = await Client.connect(code, creatorToken);
    await creator.ok({ type: 'join', name: 'Creator' });
    await guest.settle();
    expect(creator.state.room.hostId).toBe(creator.state.you.id);
    expect(creator.state.room.controllerId).toBe(creator.state.you.id);
    expect(creator.state.you).toMatchObject({ isHost: true, isController: true });
    expect(JSON.stringify(creator.state)).not.toContain(creatorToken);
  });

  it('creator hosts, names must be unique, and reconnecting keeps the seat', async () => {
    const { code, clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    expect(ana.state.room.hostId).toBe(idOf(ana));
    expect(ana.state.you.isHost).toBe(true);
    expect(ana.state.you.isController).toBe(true);
    expect(ben.state.you.isHost).toBe(false);
    expect(ana.state.room.members.map((m) => m.name)).toEqual(['Ana', 'Ben']);

    const dup = await Client.connect(code, tokenFor(99));
    const reply = await dup.request({ type: 'join', name: ' ana ' });
    expect(reply).toMatchObject({ type: 'err', code: 'INVALID' });

    const again = await Client.connect(code, tokenFor(2));
    expect(again.state.you.id).toBe(idOf(ben));
    const info = await (await api(`/api/rooms/${code}`)).json();
    expect(info).toMatchObject({ playerCount: 2 });
    expect(JSON.stringify(info)).not.toContain('Ana');
    expect(JSON.stringify(info)).not.toContain('Ben');
  });

  it('sends each device only its own private chip totals while preserving public bets and pot', async () => {
    const { code, clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ben.settle();

    const anaOwn = ana.state.room.game.players.find((player) => player.id === idOf(ana))!;
    const benOnAna = ana.state.room.game.players.find((player) => player.id === idOf(ben))!;
    const benOwn = ben.state.room.game.players.find((player) => player.id === idOf(ben))!;
    const anaOnBen = ben.state.room.game.players.find((player) => player.id === idOf(ana))!;

    expect(anaOwn).toMatchObject({ chipState: 'visible', buyIn: 1000, committed: 5, bet: 5 });
    expect(benOwn).toMatchObject({ chipState: 'visible', buyIn: 1000, committed: 10, bet: 10 });
    expect(benOnAna).toMatchObject({ chipState: 'private', stack: 0, buyIn: 0, committed: 0, bet: 10 });
    expect(anaOnBen).toMatchObject({ chipState: 'private', stack: 0, buyIn: 0, committed: 0, bet: 5 });
    expect(ana.state.room.potTotal).toBe(15);
    expect(ben.state.room.potTotal).toBe(15);
    expect(ana.state.you.chipInventoryPlayerId).toBe(idOf(ana));
    expect(ana.state.you.chipInventory?.reduce((sum, chip) => sum + chip.value * chip.count, 0)).toBe(995);
    expect(ben.state.you.chipInventoryPlayerId).toBe(idOf(ben));
    expect(ben.state.you.chipInventory?.reduce((sum, chip) => sum + chip.value * chip.count, 0)).toBe(990);

    const display = await Client.connect(code, tokenFor(98));
    expect(display.state.you.id).toBeNull();
    expect(display.state.room.game.players.every((player) => player.chipState === 'private')).toBe(true);
    expect(display.state.room.game.players.map((player) => player.bet)).toEqual([5, 10]);
    expect(display.state.room.potTotal).toBe(15);
    expect(display.state.you.chipInventory).toBeNull();
    expect(display.state.you.chipInventoryPlayerId).toBeNull();
  });

  it('reveals a manual seat only to the host and Table Controller who manage it', async () => {
    const { clients } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'addSeat', name: 'Gran' });
    await ben.settle();

    expect(ana.state.room.game.players.find((player) => player.name === 'Gran')).toMatchObject({ chipState: 'visible', stack: 1000 });
    expect(ben.state.room.game.players.find((player) => player.name === 'Gran')).toMatchObject({ chipState: 'private', stack: 0, buyIn: 0, committed: 0 });
  });

  it('accepts fifteen players and rejects a sixteenth', async () => {
    const names = Array.from({ length: 15 }, (_, i) => `Player ${i + 1}`);
    const { code, clients } = await table(names);
    expect(clients[0].state.room.members).toHaveLength(15);

    const extra = await Client.connect(code, tokenFor(99));
    expect(await extra.request({ type: 'join', name: 'Player 16' })).toMatchObject({ code: 'INVALID' });
    expect(extra.state.room.members).toHaveLength(15);
  });

  it('reserves the fifteenth seat until the room creator joins', async () => {
    const creatorToken = tokenFor(61);
    const code = await createRoom(creatorToken);
    for (let i = 0; i < 14; i++) {
      const guest = await Client.connect(code, tokenFor(100 + i));
      await guest.ok({ type: 'join', name: `Guest ${i + 1}` });
    }

    const extra = await Client.connect(code, tokenFor(200));
    expect(await extra.request({ type: 'join', name: 'Extra' })).toMatchObject({
      type: 'err',
      code: 'INVALID',
      message: 'The last seat is reserved for the room creator',
    });

    const creator = await Client.connect(code, creatorToken);
    await creator.ok({ type: 'join', name: 'Creator' });
    expect(creator.state.room.members).toHaveLength(15);
    expect(creator.state.you).toMatchObject({ isHost: true, isController: true });
  });

  it('requires hello before anything else and rejects malformed or oversized messages', async () => {
    const code = await createRoom();
    const c = await Client.connect(code);
    expect(await c.request({ type: 'join', name: 'X' })).toMatchObject({ code: 'FORBIDDEN' });
    c.raw('{nope');
    await c.waitFor((m) => m.type === 'err' && m.code === 'INVALID');
    c.raw(JSON.stringify({ type: 'join', name: 'x'.repeat(9000) }));
    await c.waitFor(() => c.closed !== null);
    expect(c.closed?.code).toBe(1009);
  });

  it('accepts the largest legal-shaped 15-player award envelope without closing the controller socket', async () => {
    const { clients, idOf } = await table(Array.from({ length: 15 }, (_, i) => `P${i + 1}`));
    const controller = clients[0];
    const ids = clients.map(idOf);
    const winners = Object.fromEntries(Array.from({ length: 15 }, (_, i) => [String(i), ids]));
    const envelope = JSON.stringify({ type: 'award', v: controller.state.v, winners, seq: 1 });
    expect(envelope.length).toBeGreaterThan(2048);
    expect(envelope.length).toBeLessThan(8192);
    expect(await controller.request({ type: 'award', v: controller.state.v, winners })).toMatchObject({ code: 'PHASE' });
    expect(controller.closed).toBeNull();
  });

  it('rate limits floods', async () => {
    const code = await createRoom();
    const c = await Client.connect(code, tokenFor(7));
    for (let i = 0; i < 60; i++) c.send({ type: 'cancelClaim' });
    await c.waitFor((m) => m.type === 'err' && m.code === 'RATE');
  });
});

describe('playing a hand', () => {
  it('schedules breaks, records missed blinds and supports both return choices', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana] = clients;
    const foldCurrent = async () => {
      await Promise.all(clients.map((client) => client.settle()));
      const actor = clients.find((client) => client.state.you.legal);
      if (!actor) throw new Error('expected a player to act');
      await actor.ok({ type: 'act', v: actor.state.v, kind: 'fold' });
    };

    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ana.ok({ type: 'takeBreak' });
    expect(ana.state.room.breaks[0]).toMatchObject({ playerId: idOf(ana), status: 'scheduled', missedBlinds: false });
    await foldCurrent();
    await foldCurrent();
    let state = await ana.settle();
    expect(state.room.game.phase).toBe('done');
    expect(state.room.breaks[0]).toMatchObject({ status: 'away', missedBlinds: false });
    expect(state.room.game.players.find((p) => p.id === idOf(ana))?.sittingOut).toBe(true);

    await ana.ok({ type: 'next', v: ana.state.v });
    state = await ana.settle();
    expect(state.room.breaks[0]).toMatchObject({ status: 'away', missedBlinds: true });
    await ana.ok({ type: 'returnFromBreak', mode: 'post' });
    expect(ana.state.room.breaks).toHaveLength(0);
    await foldCurrent();
    await ana.ok({ type: 'next', v: ana.state.v });
    state = await ana.settle();
    const returned = state.room.game.players.find((p) => p.id === idOf(ana));
    expect(returned?.inHand).toBe(true);
    expect(returned?.committed).toBeGreaterThanOrEqual(15);

    const second = await table(['Dee', 'Eli', 'Fay']);
    const [dee] = second.clients;
    await dee.ok({ type: 'start', allowUnconfirmed: true, v: dee.state.v });
    await dee.ok({ type: 'takeBreak' });
    for (let i = 0; i < 2; i++) {
      await Promise.all(second.clients.map((client) => client.settle()));
      const actor = second.clients.find((client) => client.state.you.legal)!;
      await actor.ok({ type: 'act', v: actor.state.v, kind: 'fold' });
    }
    await dee.ok({ type: 'next', v: dee.state.v });
    expect((await dee.settle()).room.breaks[0].missedBlinds).toBe(true);
    await dee.ok({ type: 'returnFromBreak', mode: 'wait' });
    expect(dee.state.room.breaks[0].status).toBe('waiting');
    for (let hand = 0; hand < 2; hand++) {
      await Promise.all(second.clients.map((client) => client.settle()));
      const actor = second.clients.find((client) => client.state.you.legal)!;
      await actor.ok({ type: 'act', v: actor.state.v, kind: 'fold' });
      await dee.ok({ type: 'next', v: dee.state.v });
    }
    const returnedOnBlind = await dee.settle();
    expect(returnedOnBlind.room.breaks).toHaveLength(0);
    expect(returnedOnBlind.room.game.bbId).toBe(second.idOf(dee));
  });

  it('keeps rebuy requests private and applies host-approved amounts between hands', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, ben, cat] = clients;

    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ben.ok({ type: 'requestRebuy', amount: 125 });
    let hostState = await ana.settle();
    let playerState = await ben.settle();
    const otherState = await cat.settle();
    expect(hostState.room.rebuyRequests).toHaveLength(1);
    expect(playerState.room.rebuyRequests).toHaveLength(1);
    expect(otherState.room.rebuyRequests).toHaveLength(0);
    expect(await ben.request({ type: 'requestRebuy', amount: 50 })).toMatchObject({ code: 'INVALID' });
    expect(await cat.request({
      type: 'resolveRebuy',
      v: cat.state.v,
      requestId: hostState.room.rebuyRequests[0].id,
      allow: true,
      amount: 150,
    })).toMatchObject({ code: 'FORBIDDEN' });

    await ana.ok({
      type: 'resolveRebuy',
      v: ana.state.v,
      requestId: hostState.room.rebuyRequests[0].id,
      allow: true,
      amount: 150,
    });
    hostState = await ana.settle();
    expect(hostState.room.rebuyRequests[0]).toMatchObject({ playerId: idOf(ben), amount: 150, status: 'approved' });
    expect(hostState.room.game.players.find((p) => p.id === idOf(ben))).toMatchObject({ chipState: 'private', stack: 0 });

    await ana.ok({ type: 'act', v: ana.state.v, kind: 'fold' });
    await ben.ok({ type: 'act', v: ben.state.v, kind: 'fold' });
    playerState = await ben.settle();
    expect(playerState.room.rebuyRequests).toHaveLength(0);
    expect(playerState.room.game.players.find((p) => p.id === idOf(ben))).toMatchObject({ stack: 1145, buyIn: 1150 });
    expect(playerState.room.log.some((l) => l.text === 'Ben added a rebuy')).toBe(true);
    expect(playerState.room.log.some((l) => l.text.includes('150'))).toBe(false);

    await ana.ok({ type: 'undo', v: ana.state.v });
    hostState = await ana.settle();
    expect(hostState.room.rebuyRequests[0]).toMatchObject({ playerId: idOf(ben), amount: 150, status: 'approved' });
    expect(hostState.room.game.players.find((p) => p.id === idOf(ben))).toMatchObject({ chipState: 'private', stack: 0, buyIn: 0 });
    await ben.ok({ type: 'act', v: ben.state.v, kind: 'fold' });
    playerState = await ben.settle();
    expect(playerState.room.rebuyRequests).toHaveLength(0);
    expect(playerState.room.game.players.find((p) => p.id === idOf(ben))).toMatchObject({ stack: 1145, buyIn: 1150 });
    await ana.ok({ type: 'endGame', v: ana.state.v });
    const entries = (await ben.settle()).room.settlement?.entries.filter((entry) => entry.playerId === idOf(ben));
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'initial', amount: 1000 }),
      expect.objectContaining({ kind: 'rebuy', amount: 150 }),
    ]));
  });

  it('lets a player cancel and the host edit or reject a rebuy request', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    await ben.ok({ type: 'requestRebuy', amount: 100 });
    let request = ben.state.room.rebuyRequests[0];
    await ben.ok({ type: 'cancelRebuy', requestId: request.id });
    expect(ben.state.room.rebuyRequests).toHaveLength(0);

    await ben.ok({ type: 'requestRebuy', amount: 100 });
    request = (await ana.settle()).room.rebuyRequests[0];
    await ana.ok({ type: 'resolveRebuy', v: ana.state.v, requestId: request.id, allow: false });
    expect((await ben.settle()).room.rebuyRequests).toHaveLength(0);

    await ben.ok({ type: 'requestRebuy', amount: 100 });
    request = (await ana.settle()).room.rebuyRequests[0];
    await ana.ok({ type: 'resolveRebuy', v: ana.state.v, requestId: request.id, allow: true, amount: 175 });
    const player = (await ben.settle()).room.game.players.find((p) => p.id === idOf(ben));
    expect(player).toMatchObject({ stack: 1175, buyIn: 1175 });
    expect(ana.state.room.rebuyRequests).toHaveLength(0);
  });

  it('requires host approval and an entry choice for late arrivals', async () => {
    const { code, clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });

    const dee = await Client.connect(code, tokenFor(44));
    await dee.ok({ type: 'join', name: 'Dee' });
    let s = await ana.settle();
    const request = s.room.lateArrivals[0];
    expect(request).toMatchObject({ playerId: idOf(dee), amount: 1000, status: 'pending', mode: null });
    expect(s.room.game.players.some((player) => player.id === idOf(dee))).toBe(false);
    expect(await ben.request({ type: 'resolveLateArrival', v: ben.state.v, requestId: request.id, allow: true, amount: 600 }))
      .toMatchObject({ code: 'FORBIDDEN' });
    expect(await ana.request({ type: 'resolveLateArrival', v: ana.state.v, requestId: request.id, allow: true, amount: 5 }))
      .toMatchObject({ code: 'INVALID' });

    await ana.ok({ type: 'resolveLateArrival', v: ana.state.v, requestId: request.id, allow: true, amount: 600 });
    s = await dee.settle();
    expect(s.room.lateArrivals[0]).toMatchObject({ amount: 600, status: 'choosing', mode: null });
    expect(s.room.game.players.find((player) => player.id === idOf(dee))).toMatchObject({
      stack: 600, buyIn: 600, sittingOut: true, inHand: false,
    });

    await dee.ok({ type: 'chooseLateArrival', mode: 'post' });
    s = await ana.settle();
    expect(s.room.lateArrivals[0]).toMatchObject({ status: 'ready', mode: 'post' });
    expect(s.room.game.players.find((player) => player.id === idOf(dee))).toMatchObject({ sittingOut: false, entryLive: 10 });

    await ana.ok({ type: 'act', v: ana.state.v, kind: 'fold' });
    await ben.ok({ type: 'act', v: ben.state.v, kind: 'fold' });
    await ana.ok({ type: 'next', v: ana.state.v });
    s = await dee.settle();
    expect(s.room.lateArrivals).toHaveLength(0);
    expect(s.room.game.players.find((player) => player.id === idOf(dee))).toMatchObject({
      stack: 590, bet: 10, committed: 10, inHand: true,
    });
  });

  it('supports waiting for the natural big blind and the logged no-entry-blind override', async () => {
    const { code, clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });

    const dee = await Client.connect(code, tokenFor(45));
    await dee.ok({ type: 'join', name: 'Dee' });
    let request = (await ana.settle()).room.lateArrivals[0];
    await ana.ok({ type: 'resolveLateArrival', v: ana.state.v, requestId: request.id, allow: true, amount: 500 });
    await dee.ok({ type: 'chooseLateArrival', mode: 'wait' });
    expect(dee.state.room.lateArrivals[0]).toMatchObject({ status: 'waiting', mode: 'wait' });

    await ana.ok({ type: 'act', v: ana.state.v, kind: 'fold' });
    await ben.ok({ type: 'act', v: ben.state.v, kind: 'fold' });
    await ana.ok({ type: 'next', v: ana.state.v });
    let s = await dee.settle();
    expect(s.room.lateArrivals).toHaveLength(0);
    expect(s.room.game.bbId).toBe(idOf(dee));

    const eli = await Client.connect(code, tokenFor(46));
    await eli.ok({ type: 'join', name: 'Eli' });
    request = (await ana.settle()).room.lateArrivals[0];
    await ana.ok({
      type: 'resolveLateArrival', v: ana.state.v, requestId: request.id, allow: true, amount: 700, noEntryBlind: true,
    });
    s = await eli.settle();
    expect(s.room.lateArrivals[0]).toMatchObject({ status: 'ready', mode: 'free', amount: 700 });
    expect(s.room.log.some((entry) => entry.text.includes('no entry blind'))).toBe(true);
  });

  it('lets only the host end immediately between hands or queue the end of a live hand', async () => {
    const { clients } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;

    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    expect(await ben.request({ type: 'endGame', v: ben.state.v })).toMatchObject({ code: 'FORBIDDEN' });

    await ana.ok({ type: 'endGame', v: ana.state.v });
    let s = await ben.settle();
    expect(s.room).toMatchObject({ endingAfterHand: true, endedAt: null });

    await ana.ok({ type: 'cancelEndGame', v: ana.state.v });
    s = await ben.settle();
    expect(s.room).toMatchObject({ endingAfterHand: false, endedAt: null });

    await ana.ok({ type: 'endGame', v: ana.state.v });
    await ana.ok({ type: 'act', v: ana.state.v, kind: 'fold' });
    s = await ben.settle();
    expect(s.room.endingAfterHand).toBe(false);
    expect(s.room.endedAt).toEqual(expect.any(Number));
    expect(s.room.game.phase).toBe('done');
    expect(await ana.request({ type: 'next', v: s.v })).toMatchObject({ code: 'PHASE' });
    expect(await ana.request({ type: 'requestRebuy', amount: 100 })).toMatchObject({ code: 'PHASE' });

    const { clients: secondTable } = await table(['Cam', 'Dee']);
    const [cam] = secondTable;
    await cam.ok({ type: 'start', allowUnconfirmed: true, v: cam.state.v });
    await cam.ok({ type: 'act', v: cam.state.v, kind: 'fold' });
    await cam.ok({ type: 'endGame', v: cam.state.v });
    expect(cam.state.room.endingAfterHand).toBe(false);
    expect(cam.state.room.endedAt).toEqual(expect.any(Number));
  });

  it('reviews, acknowledges and explicitly finalises a frozen settlement record', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ana.ok({ type: 'act', v: ana.state.v, kind: 'fold' });
    await ana.ok({ type: 'endGame', v: ana.state.v });
    let state = await ben.settle();
    expect(state.room.settlement).toMatchObject({ reviews: [], settledTransfers: [], finalizedAt: null });
    expect(state.room.settlement?.entries.filter((entry) => entry.kind === 'initial')).toHaveLength(2);

    await ana.ok({ type: 'reviewSettlement', v: ana.state.v, status: 'correct' });
    await ben.ok({ type: 'reviewSettlement', v: ben.state.v, status: 'issue', reason: 'Check the final blind' });
    expect(await ana.request({ type: 'finalizeSettlement', v: ana.state.v, withIssues: false, recordToken: tokenFor(501) })).toMatchObject({ code: 'INVALID' });
    await ben.ok({ type: 'reviewSettlement', v: ben.state.v, status: 'correct' });

    state = await ana.settle();
    const debtorId = state.room.game.players.find((player) => player.stack - player.buyIn < 0)!.id;
    const debtor = clients.find((client) => idOf(client) === debtorId)!;
    const creditor = clients.find((client) => idOf(client) !== debtorId)!;
    expect(await creditor.request({ type: 'setMyTransfersSettled', v: creditor.state.v, settled: true })).toMatchObject({ code: 'INVALID' });
    await debtor.ok({ type: 'setMyTransfersSettled', v: debtor.state.v, settled: true });
    expect((await ana.settle()).room.settlement?.settledTransfers).toEqual([0]);

    await ana.ok({ type: 'finalizeSettlement', v: ana.state.v, withIssues: false, recordToken: tokenFor(501) });
    expect(ana.state.room.settlement).toMatchObject({ finalizedAt: expect.any(Number), finalizedWithIssues: false });
    expect(await ben.request({ type: 'reviewSettlement', v: ben.state.v, status: 'issue', reason: 'Too late' })).toMatchObject({ code: 'PHASE' });
  });

  it('allows the host to finalise deliberately with a permanent issue marker', async () => {
    const { clients } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ana.ok({ type: 'act', v: ana.state.v, kind: 'fold' });
    await ana.ok({ type: 'endGame', v: ana.state.v });
    await ana.ok({ type: 'reviewSettlement', v: ana.state.v, status: 'correct' });
    await ben.ok({ type: 'reviewSettlement', v: ben.state.v, status: 'issue', reason: 'Missing cash-out note' });
    await ana.ok({ type: 'finalizeSettlement', v: ana.state.v, withIssues: true, recordToken: tokenFor(502) });
    expect(ana.state.room.settlement).toMatchObject({ finalizedAt: expect.any(Number), finalizedWithIssues: true });
    expect(ana.state.room.log.at(-1)?.text).toContain('with unresolved issues');
  });

  it('keeps a private final record for 30 days and only lets the host delete it early', async () => {
    const { code, clients } = await table(['Ana', 'Ben']);
    const [ana] = clients;
    const recordToken = tokenFor(503);
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ana.ok({ type: 'act', v: ana.state.v, kind: 'fold' });
    await ana.ok({ type: 'endGame', v: ana.state.v });
    await ana.ok({ type: 'reviewSettlement', v: ana.state.v, status: 'correct' });
    await ana.ok({ type: 'finalizeSettlement', v: ana.state.v, withIssues: false, recordToken });

    expect((await api(`/api/records/${code}`, { headers: { 'x-record-token': tokenFor(504) } })).status).toBe(404);
    expect((await api(`/api/records/${code}/${recordToken}`)).status).toBe(404);
    const guestResponse = await api(`/api/records/${code}`, { headers: { 'x-device-token': tokenFor(2), 'x-record-token': recordToken } });
    expect(guestResponse.status).toBe(200);
    const guestBody = await guestResponse.json() as { canDelete: boolean; record: Record<string, unknown> };
    expect(guestBody.canDelete).toBe(false);
    expect(guestBody.record).toMatchObject({ code, handCount: 1, finalizedWithIssues: false });
    expect(JSON.stringify(guestBody)).not.toContain(recordToken);
    expect(JSON.stringify(guestBody)).not.toContain(tokenFor(1));

    const hostResponse = await api(`/api/records/${code}`, { headers: { 'x-device-token': tokenFor(1), 'x-record-token': recordToken } });
    const hostBody = await hostResponse.json() as { canDelete: boolean; record: { finalizedAt: number; expiresAt: number } };
    expect(hostBody.canDelete).toBe(true);
    expect(hostBody.record.expiresAt - hostBody.record.finalizedAt).toBe(FINAL_TTL_MS);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    const alarm = await runInDurableObject(stub, (_, state) => state.storage.getAlarm());
    expect(Math.abs((alarm ?? 0) - hostBody.record.expiresAt)).toBeLessThan(1000);

    expect((await api(`/api/records/${code}`, { method: 'DELETE', headers: { 'x-device-token': tokenFor(2), 'x-record-token': recordToken } })).status).toBe(403);
    expect((await api(`/api/records/${code}`, { method: 'DELETE', headers: { 'x-device-token': tokenFor(1), 'x-record-token': recordToken } })).status).toBe(204);
    expect((await api(`/api/rooms/${code}`)).status).toBe(404);
  });

  it('runs a full hand with turn enforcement, stale protection and awards', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, ben, cat] = clients;
    const v0 = ana.state.v;

    expect(await ben.request({ type: 'start', allowUnconfirmed: true, v: v0 })).toMatchObject({ code: 'FORBIDDEN' });
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: v0 });
    let s = await cat.settle();
    expect(s.room.game.phase).toBe('betting');
    expect(s.room.game.toActId).toBe(idOf(ana));
    expect(ana.state.you.legal).toMatchObject({ toCall: 10, canRaise: true, minRaiseTo: 11 });
    expect(ben.state.you.legal).toBeNull();

    expect(await ben.request({ type: 'act', v: s.v, kind: 'call' })).toMatchObject({ code: 'NOT_TURN' });
    const stale = await ana.request({ type: 'act', v: s.v - 1, kind: 'call' });
    expect(stale).toMatchObject({ code: 'STALE' });

    await ana.ok({ type: 'act', v: ana.state.v, kind: 'raise', amount: 40 });
    await ben.ok({ type: 'act', v: ben.state.v, kind: 'call' });
    await cat.ok({ type: 'act', v: cat.state.v, kind: 'call' });
    s = await ana.settle();
    expect(s.room.game.street).toBe(1);
    expect(s.room.log.map((l) => l.text)).toEqual(
      expect.arrayContaining(['Ana raises to 40', 'Ben calls 35', 'Cat calls 30', 'Flop']),
    );

    for (let street = 1; street <= 3; street++) {
      for (let i = 0; i < 3; i++) {
        const turn = ana.state.room.game.toActId;
        const c = clients.find((x) => idOf(x) === turn)!;
        await c.ok({ type: 'act', v: c.state.v, kind: 'check' });
      }
    }
    s = await ana.settle();
    expect(s.room.game.phase).toBe('showdown');
    const pot = s.room.game.pots.find((p) => !p.paid)!;
    expect(pot.amount).toBe(120);

    expect(await ben.request({ type: 'award', v: s.v, winners: { [pot.id]: [idOf(cat)] } })).toMatchObject({
      code: 'FORBIDDEN',
    });
    const bad = await ana.request({ type: 'award', v: s.v, winners: { [pot.id]: ['0000000000000000'] } });
    expect(bad).toMatchObject({ code: 'INVALID' });
    await ana.ok({ type: 'award', v: s.v, winners: { [pot.id]: [idOf(cat)] } });
    s = await ana.settle();
    expect(s.room.awardProposal).toMatchObject({ disputedBy: null });
    expect(s.room.game.phase).toBe('showdown');
    await ana.ok({ type: 'confirmAward', v: s.v });
    s = await cat.settle();
    expect(s.room.game.phase).toBe('done');
    expect(s.room.game.players.find((p) => p.id === idOf(cat))?.stack).toBe(1080);
    expect(s.room.log.at(-1)?.text).toBe('Cat wins 120');

    const vDone = s.v;
    expect(await ben.request({ type: 'next', v: vDone })).toMatchObject({ code: 'FORBIDDEN' });
    await ana.ok({ type: 'next', v: vDone });
    s = await ana.settle();
    expect(s.room.game.handNo).toBe(2);
  });

  it('undo restores the previous game state, and a double undo only steps back once', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ana.ok({ type: 'act', v: ana.state.v, kind: 'raise', amount: 100 });
    let s = await ben.settle();
    expect(s.room.undoLabel).toBe('Ana raises to 100');
    const v = s.v;
    expect(await ben.request({ type: 'undo', v })).toMatchObject({ code: 'FORBIDDEN' });
    await ana.ok({ type: 'undo', v });
    s = await ana.settle();
    expect(s.room.game.toActId).toBe(idOf(ana));
    expect(s.room.game.currentBet).toBe(10);
    expect(s.room.log.at(-1)?.text).toMatch(/undid: Ana raises to 100/);
  });

  it('lets the host enter one corrected action after undo while keeping other players locked out', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ana.ok({ type: 'act', v: ana.state.v, kind: 'raise', amount: 100 });
    await ana.ok({ type: 'undo', v: ana.state.v, mode: 'correct' });
    let s = await ben.settle();
    expect(s.room.correctionForId).toBe(idOf(ana));
    expect(s.you.legal).toBeNull();
    expect(await ben.request({ type: 'act', v: s.v, kind: 'call' })).toMatchObject({ code: 'FORBIDDEN' });
    await ana.ok({ type: 'act', v: ana.state.v, kind: 'raise', amount: 30, playerId: idOf(ana) });
    s = await ana.settle();
    expect(s.room.correctionForId).toBeNull();
    expect(s.room.game.currentBet).toBe(30);
    expect(s.room.log.at(-1)?.text).toBe('Ana raises to 30');
  });

  it('pauses and resumes a live hand with host-only controls', async () => {
    const { clients } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    expect(await ben.request({ type: 'pauseHand', v: ben.state.v })).toMatchObject({ code: 'FORBIDDEN' });
    await ana.ok({ type: 'pauseHand', v: ana.state.v });
    let s = await ben.settle();
    expect(s.room.paused).toBe(true);
    expect(s.you.legal).toBeNull();
    expect(await ana.request({ type: 'act', v: s.v, kind: 'call' })).toMatchObject({ code: 'PHASE' });
    await ana.ok({ type: 'resumeHand', v: s.v });
    s = await ana.settle();
    expect(s.room.paused).toBe(false);
    expect(s.you.legal).not.toBeNull();
  });

  it('previews a void publicly, freezes actions, and restores every pre-hand stack', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ana.ok({ type: 'act', v: ana.state.v, kind: 'raise', amount: 60 });
    await ben.ok({ type: 'act', v: ben.state.v, kind: 'call' });
    const contribution = ana.state.room.potTotal;
    await ana.ok({ type: 'previewVoid', v: ana.state.v, reason: 'Exposed card', advanceButton: false });
    let s = await ben.settle();
    expect(s.room.paused).toBe(true);
    expect(s.room.voidProposal).toMatchObject({ reason: 'Exposed card', returnAmount: contribution });
    expect(await ben.request({ type: 'act', v: s.v, kind: 'call' })).toMatchObject({ code: 'PHASE' });
    expect(await ben.request({ type: 'confirmVoid', v: s.v })).toMatchObject({ code: 'FORBIDDEN' });
    await ana.ok({ type: 'confirmVoid', v: s.v });
    s = await ana.settle();
    expect(s.room.game.phase).toBe('lobby');
    expect(s.room.game.handNo).toBe(0);
    await Promise.all(clients.map((client) => client.settle()));
    for (const client of clients) {
      const own = client.state.room.game.players.find((player) => player.id === idOf(client));
      expect(own).toMatchObject({ chipState: 'visible', stack: 1000, committed: 0 });
    }
    expect(s.room.game.players.every((player) => player.committed === 0)).toBe(true);
    expect(s.room.paused).toBe(false);
    expect(s.room.voidProposal).toBeNull();
    expect(s.room.undoLabel).toBeNull();
    expect(s.room.log.at(-1)?.text).toMatch(/voided Hand 1: Exposed card/);
  });

  it('lets the host choose physical runouts and the controller award each board exactly', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'setStack', v: ana.state.v, playerId: idOf(ana), stack: 100 });
    await ana.ok({ type: 'setStack', v: ana.state.v, playerId: idOf(ben), stack: 100 });
    await ana.ok({ type: 'transferController', playerId: idOf(ben) });
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ana.ok({ type: 'act', v: ana.state.v, kind: 'raise', amount: 100 });
    await ben.ok({ type: 'act', v: ben.state.v, kind: 'call' });
    let s = await ana.settle();
    expect(s.room.game.runout).toBe(true);
    expect(await ben.request({ type: 'chooseRunouts', v: s.v, count: 2, agreed: true })).toMatchObject({ code: 'FORBIDDEN' });
    expect(await ana.request({ type: 'chooseRunouts', v: s.v, count: 2, agreed: false })).toMatchObject({ code: 'INVALID' });
    await ana.ok({ type: 'chooseRunouts', v: s.v, count: 2, agreed: true });
    s = await ana.settle();
    expect(s.room.runoutPlan).toMatchObject({ count: 2, current: 0, phase: 'dealing' });
    expect(await ana.request({ type: 'completeRunout', v: s.v })).toMatchObject({ code: 'FORBIDDEN' });
    await ben.ok({ type: 'completeRunout', v: s.v });
    s = await ben.settle();
    const first = s.room.runoutPlan!.potIds;
    await ben.ok({ type: 'award', v: s.v, winners: Object.fromEntries(first.map((id) => [id, [idOf(ana)]])) });
    s = await ben.settle();
    await ben.ok({ type: 'confirmAward', v: s.v });
    s = await ben.settle();
    expect(s.room.game.phase).toBe('showdown');
    expect(s.room.runoutPlan).toMatchObject({ current: 1, phase: 'dealing' });
    await ben.ok({ type: 'completeRunout', v: s.v });
    s = await ben.settle();
    const second = s.room.runoutPlan!.potIds;
    await ben.ok({ type: 'award', v: s.v, winners: Object.fromEntries(second.map((id) => [id, [idOf(ben)]])) });
    s = await ben.settle();
    await ben.ok({ type: 'confirmAward', v: s.v });
    s = await ben.settle();
    expect(s.room.game.phase).toBe('done');
    expect(s.room.runoutPlan).toBeNull();
    await ana.settle();
    expect(ana.state.room.game.players.find((player) => player.id === idOf(ana))).toMatchObject({ chipState: 'visible', stack: 100 });
    expect(ben.state.room.game.players.find((player) => player.id === idOf(ben))).toMatchObject({ chipState: 'visible', stack: 100 });
    expect(s.room.log.map((entry) => entry.text)).toEqual(expect.arrayContaining([
      'Ana chose 2 runouts',
      'Ben completed runout 1 of 2',
      'Ben completed runout 2 of 2',
    ]));
  });

  it('holds a disputed award and requires governed approval for a conserved table override', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    const folded = clients.find((client) => idOf(client) === ana.state.room.game.toActId)!;
    await folded.ok({ type: 'act', v: folded.state.v, kind: 'fold' });

    while (ana.state.room.game.phase === 'betting') {
      const actor = clients.find((client) => idOf(client) === ana.state.room.game.toActId)!;
      const legal = actor.state.you.legal!;
      await actor.ok({ type: 'act', v: actor.state.v, kind: legal.canCheck ? 'check' : 'call' });
      await ana.settle();
    }

    const pot = ana.state.room.game.pots.find((candidate) => !candidate.paid)!;
    await ana.ok({ type: 'award', v: ana.state.v, winners: { [pot.id]: [pot.eligible[0]] } });
    const approver = clients.find((client) => idOf(client) !== idOf(ana))!;
    await approver.ok({ type: 'disputeAward', v: approver.state.v });
    expect(await ana.request({ type: 'confirmAward', v: ana.state.v })).toMatchObject({ code: 'INVALID' });
    expect(await ana.request({
      type: 'proposeOverride',
      v: ana.state.v,
      reason: 'Table-agreed correction',
      allocations: { [idOf(folded)]: pot.amount - 1 },
    })).toMatchObject({ code: 'INVALID' });
    await ana.ok({
      type: 'proposeOverride',
      v: ana.state.v,
      reason: 'Table-agreed correction',
      allocations: { [idOf(folded)]: pot.amount },
    });
    expect(await ana.request({ type: 'confirmOverride', v: ana.state.v })).toMatchObject({ code: 'INVALID' });
    await approver.ok({ type: 'approveOverride', v: approver.state.v });
    await ana.ok({ type: 'confirmOverride', v: ana.state.v });
    expect(ana.state.room.game.phase).toBe('done');
    expect(ana.state.room.game.results).toContainEqual({ potId: pot.id, id: idOf(folded), amount: pot.amount });
    expect(ana.state.room.log.some((entry) => entry.text.includes('not rules-validated'))).toBe(true);
  });

  it('undo never removes someone who joined afterwards', async () => {
    const { code, clients } = await table(['Ana', 'Ben']);
    const [ana] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    const late = await Client.connect(code, tokenFor(50));
    await late.ok({ type: 'join', name: 'Late' });
    await ana.ok({ type: 'undo', v: ana.state.v });
    const s = await late.settle();
    expect(s.room.game.phase).toBe('lobby');
    expect(s.room.game.players.map((p) => p.name)).toEqual(['Ana', 'Ben', 'Late']);
    expect(s.you.id).not.toBeNull();
  });

  it('host settings and stack edits are host only and queue during a hand', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    const settings = { sb: 25, bb: 50, startingStack: 5000, buyInPrice: 2000 };
    expect(await ben.request({ type: 'settings', v: ben.state.v, settings })).toMatchObject({ code: 'FORBIDDEN' });
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ana.ok({ type: 'settings', v: ana.state.v, settings });
    let s = await ben.settle();
    expect(s.room.game.pendingSettings).toEqual(settings);
    expect(await ana.request({ type: 'setStack', v: s.v, playerId: idOf(ben), stack: 1 })).toMatchObject({
      code: 'PHASE',
    });
    await ana.ok({ type: 'act', v: ana.state.v, kind: 'fold' });
    await ana.ok({ type: 'setStack', v: ana.state.v, playerId: idOf(ben), stack: 3000 });
    await ana.ok({ type: 'next', v: ana.state.v });
    s = await ana.settle();
    expect(s.room.game.settings).toEqual(settings);
    expect(s.room.game.currentBet).toBe(50);
  });
});

describe('seats and devices', () => {
  it('records advisory seat confirmations and clears only players whose neighbours change', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben', 'Cat', 'Dee', 'Eli']);
    const [ana, ben, cat, dee, eli] = clients;
    void ben;
    void dee;
    for (const client of clients) await client.ok({ type: 'confirmSeat', v: client.state.v, matches: true });
    expect((await ana.settle()).room.seatConfirmations).toHaveLength(5);

    await ana.ok({
      type: 'seatOrder',
      v: ana.state.v,
      ids: [idOf(ana), idOf(cat), idOf(ben), idOf(dee), idOf(eli)],
    });
    const confirmations = (await eli.settle()).room.seatConfirmations;
    expect(confirmations).toEqual([expect.objectContaining({ playerId: idOf(eli), status: 'confirmed' })]);
  });

  it('requires the host to acknowledge unconfirmed seats and honours the chosen first dealer', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, , cat] = clients;
    expect(await ana.request({ type: 'start', v: ana.state.v })).toMatchObject({
      code: 'INVALID',
      message: 'Some players have not confirmed their seats',
    });
    await ana.ok({ type: 'setDealerButton', v: ana.state.v, playerId: idOf(cat) });
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    expect(ana.state.room.game.buttonId).toBe(idOf(cat));
  });

  it('host can assign a phone player as Table Controller before play', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, ben, cat] = clients;
    expect(await ben.request({ type: 'transferController', playerId: idOf(cat) })).toMatchObject({ code: 'FORBIDDEN' });
    await ana.ok({ type: 'transferController', playerId: idOf(ben) });
    await ben.settle();
    expect(ben.state.room.controllerId).toBe(idOf(ben));
    expect(ben.state.you).toMatchObject({ isHost: false, isController: true });
    expect(ana.state.you).toMatchObject({ isHost: true, isController: false });

    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ana.ok({ type: 'transferController', playerId: idOf(cat) });
    expect(cat.state.you.isController).toBe(true);
    await ana.ok({ type: 'transferController', playerId: idOf(ben) });
    await ana.ok({ type: 'act', v: ana.state.v, kind: 'fold' });
    await ben.ok({ type: 'act', v: ben.state.v, kind: 'fold' });
    await ben.ok({ type: 'next', v: ben.state.v });
    expect(ben.state.room.game.handNo).toBe(2);
  });

  it('host can replace a disconnected Table Controller at showdown without changing eligibility', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, ben, cat] = clients;
    await ana.ok({ type: 'transferController', playerId: idOf(ben) });
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });

    while (ana.state.room.game.phase === 'betting') {
      const actor = clients.find((client) => idOf(client) === ana.state.room.game.toActId)!;
      const legal = actor.state.you.legal!;
      await actor.ok({ type: 'act', v: actor.state.v, kind: legal.canCheck ? 'check' : 'call' });
      await ana.settle();
    }

    const pot = ana.state.room.game.pots.find((candidate) => !candidate.paid)!;
    expect(pot.eligible).toContain(idOf(ben));
    ben.ws.close(1000, 'controller disconnected');
    await new Promise((resolve) => setTimeout(resolve, 50));
    await ana.ok({ type: 'transferController', playerId: idOf(cat) });
    await cat.ok({ type: 'award', v: cat.state.v, winners: { [pot.id]: [idOf(ben)] } });
    await cat.ok({ type: 'confirmAward', v: cat.state.v });
    expect(cat.state.room.game.phase).toBe('done');
    expect(cat.state.room.game.results.some((result) => result.id === idOf(ben))).toBe(true);
  });

  it('only the host or Table Controller can manage or act for an unattended seat', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'addSeat', name: 'Dee' });
    let s = await ben.settle();
    const dee = s.room.members.find((m) => m.name === 'Dee')!;
    expect(dee.manual).toBe(true);
    expect(await ben.request({ type: 'takeBreak', playerId: dee.id })).toMatchObject({ code: 'FORBIDDEN' });

    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    s = await ben.settle();
    const turn = s.room.game.toActId!;
    if (turn === idOf(ana)) {
      expect(await ben.request({ type: 'act', v: s.v, kind: 'call', playerId: idOf(ana) })).toMatchObject({
        code: 'FORBIDDEN',
      });
    }
    // Play until it is Dee's turn. A regular member still cannot act for the unattended seat.
    for (let i = 0; i < 6 && ben.state.room.game.toActId !== dee.id; i++) {
      const t = ben.state.room.game.toActId!;
      const c = clients.find((x) => idOf(x) === t)!;
      const legal = c.state.you.legal!;
      await c.ok({ type: 'act', v: c.state.v, kind: legal.canCheck ? 'check' : 'call' });
    }
    expect(ben.state.room.game.toActId).toBe(dee.id);
    const game = ben.state.room.game;
    const deeSeat = game.players.find((p) => p.id === dee.id)!;
    const kind = game.currentBet > deeSeat.bet ? 'call' : 'check';
    expect(await ben.request({ type: 'act', v: ben.state.v, kind, playerId: dee.id })).toMatchObject({ code: 'FORBIDDEN' });
    await ana.ok({ type: 'act', v: ana.state.v, kind, playerId: dee.id });
    s = await ana.settle();
    expect(s.room.log.some((l) => l.text.startsWith('Dee ') && l.text.endsWith('(by Ana)'))).toBe(true);
  });

  it('a new device must be approved to take over a seat, and the old device is signed out', async () => {
    const { code, clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    const benId = idOf(ben);
    const phone2 = await Client.connect(code, tokenFor(77));
    await phone2.ok({ type: 'claim', playerId: benId });
    let s = await ana.settle();
    expect(s.room.claims).toHaveLength(1);
    expect(phone2.state.you.claimId).toBe(s.room.claims[0].id);
    await ana.ok({ type: 'resolveClaim', claimId: s.room.claims[0].id, allow: true });
    s = await phone2.settle();
    expect(s.you.id).toBe(benId);
    await ben.waitFor((m) => m.type === 'closed' && m.reason === 'replaced');
    expect(ana.state.room.log.at(-1)?.text).toBe('Ana moved Ben to a new device');
  });

  it('does not let an unrelated member approve their own device taking the host seat', async () => {
    const { code, clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    const secondAttackerDevice = await Client.connect(code, tokenFor(177));
    await secondAttackerDevice.ok({ type: 'claim', playerId: idOf(ana) });
    const claimId = (await ben.settle()).room.claims[0].id;

    expect(await ben.request({ type: 'resolveClaim', claimId, allow: true })).toMatchObject({ code: 'FORBIDDEN' });
    expect((await ana.settle()).room.claims).toHaveLength(1);
    expect(ana.state.room.hostId).toBe(idOf(ana));
    expect(secondAttackerDevice.state.you.id).toBeNull();

    await ana.ok({ type: 'resolveClaim', claimId, allow: false });
    await secondAttackerDevice.waitFor((message) => message.type === 'err' && message.code === 'FORBIDDEN');
  });

  it('declined claims tell the requester', async () => {
    const { code, clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    const phone2 = await Client.connect(code, tokenFor(78));
    await phone2.ok({ type: 'claim', playerId: idOf(ben) });
    const claimId = (await ana.settle()).room.claims[0].id;
    await ana.ok({ type: 'resolveClaim', claimId, allow: false });
    await phone2.waitFor((m) => m.type === 'err' && m.code === 'FORBIDDEN');
    expect(phone2.state.you.id).toBeNull();
  });

  it('claims are approved automatically when nobody else is at the table', async () => {
    const { code, clients, idOf } = await table(['Ana']);
    const anaId = idOf(clients[0]);
    clients[0].ws.close(1000, 'bye');
    await new Promise((r) => setTimeout(r, 50));
    const phone2 = await Client.connect(code, tokenFor(79));
    await phone2.ok({ type: 'claim', playerId: anaId });
    expect((await phone2.settle()).you.id).toBe(anaId);
  });

  it('kicking folds the player, closes their socket and passes nothing else', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, ben, cat] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    expect(await ben.request({ type: 'kick', playerId: idOf(cat) })).toMatchObject({ code: 'FORBIDDEN' });
    await ana.ok({ type: 'kick', playerId: idOf(cat) });
    await cat.waitFor((m) => m.type === 'closed' && m.reason === 'kicked');
    const s = await ben.settle();
    const catSeat = s.room.game.players.find((p) => p.name === 'Cat');
    expect(catSeat?.folded).toBe(true);
    expect(s.room.members.map((m) => m.name)).toEqual(['Ana', 'Ben']);
  });

  it('requires a host transfer before leaving', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    expect(await ana.request({ type: 'requestLeave', mode: 'now' })).toMatchObject({
      code: 'FORBIDDEN',
      message: 'Transfer hosting before leaving',
    });
    await ana.ok({ type: 'transferHost', playerId: idOf(ben) });
    expect((await ana.settle()).room.hostId).toBe(idOf(ana));
    expect(ana.state.room.hostTransfer).toMatchObject({ kind: 'planned', targetId: idOf(ben) });
    await ben.ok({ type: 'respondHostTransfer', allow: true });
    await ana.ok({ type: 'requestLeave', mode: 'now' });
    const s = await ben.settle();
    expect(s.room.hostId).toBe(idOf(ben));
    expect(s.you.isHost).toBe(true);
    expect(s.room.members.map((member) => member.name)).toEqual(['Ben']);
    expect(s.room.game.players.map((player) => player.name)).toEqual(['Ben']);
  });

  it('keeps a planned transfer with the host until the named player accepts', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, ben, cat] = clients;
    const logBefore = ana.state.room.log.length;
    await ana.ok({ type: 'transferHost', playerId: idOf(ben) });
    expect(await cat.request({ type: 'respondHostTransfer', allow: true })).toMatchObject({ code: 'FORBIDDEN' });
    expect((await ana.settle()).you.isHost).toBe(true);
    await ben.ok({ type: 'respondHostTransfer', allow: false });
    expect((await ana.settle()).room.hostTransfer).toBeNull();
    expect(ana.state.room.log).toHaveLength(logBefore);

    await ana.ok({ type: 'transferHost', playerId: idOf(cat) });
    await ana.ok({ type: 'cancelHostTransfer' });
    expect((await cat.settle()).room.hostTransfer).toBeNull();
    expect(ana.state.you.isHost).toBe(true);
  });

  it('asks the configured backup first and leaves Table Controller unchanged', async () => {
    const { code, clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, ben, cat] = clients;
    await ana.ok({ type: 'setBackupHost', playerId: idOf(cat) });
    expect((await ben.settle()).room.backupHostId).toBe(idOf(cat));
    ana.ws.close(1000, 'bye');
    await new Promise((r) => setTimeout(r, 50));
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    await runInDurableObject(stub, async (instance: unknown) => {
      (instance as { s: { hostAwaySince: number } }).s.hostAwaySince = Date.now() - HOST_DISCONNECT_GRACE_MS - 1;
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await cat.settle();
    expect(cat.state.room.hostTransfer).toMatchObject({ kind: 'recovery', targetId: idOf(cat) });
    await cat.ok({ type: 'respondHostTransfer', allow: true });
    expect(cat.state.you.isHost).toBe(true);
    expect(cat.state.room.controllerId).toBe(idOf(ana));
    expect(cat.state.room.log.at(-1)?.text).toBe('Cat is now the host');
  });

  it('cancels recovery when the original host reconnects before acceptance', async () => {
    const { code, clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    ana.ws.close(1000, 'bye');
    await new Promise((r) => setTimeout(r, 50));
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    await runInDurableObject(stub, async (instance: unknown) => {
      (instance as { s: { hostAwaySince: number } }).s.hostAwaySince = Date.now() - HOST_DISCONNECT_GRACE_MS - 1;
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await ben.settle();
    expect(ben.state.room.hostTransfer).toMatchObject({ kind: 'recovery', targetId: idOf(ben) });

    const returned = await Client.connect(code, tokenFor(1));
    await ben.settle();
    expect(returned.state.you.id).toBe(idOf(ana));
    expect(ben.state.room.hostTransfer).toBeNull();
    expect(ben.state.room.hostId).toBe(idOf(ana));
  });

  it('lets a player finish the hand before leaving and keeps their result in settlement', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ben.ok({ type: 'requestLeave', mode: 'afterHand' });

    let s = await ana.settle();
    expect(s.room.leaveRequests).toEqual([
      expect.objectContaining({ playerId: idOf(ben), mode: 'afterHand' }),
    ]);
    expect(s.room.game.players.find((player) => player.id === idOf(ben))).toMatchObject({ folded: false, leaving: false });

    await ana.ok({ type: 'act', v: ana.state.v, kind: 'fold' });
    s = await ana.settle();
    expect(s.room.game.players.map((player) => player.name)).toEqual(['Ana']);
    expect(s.room.members.map((member) => member.name)).toEqual(['Ana']);
    expect(s.room.leaveRequests).toHaveLength(0);
    expect(s.room.game.departed).toEqual([
      expect.objectContaining({ id: idOf(ben), name: 'Ben', chipState: 'private', buyIn: 0, cashOut: 0 }),
    ]);
    expect(s.room.log.some((entry) => entry.text === 'Ben left the table')).toBe(true);
  });

  it('queues leave now until the player can legally fold', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, ben, cat] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ben.ok({ type: 'requestLeave', mode: 'now' });

    let s = await cat.settle();
    expect(s.room.game.toActId).toBe(idOf(ana));
    expect(s.room.game.players.find((player) => player.id === idOf(ben))).toMatchObject({ folded: false });
    expect(s.room.leaveRequests).toEqual([expect.objectContaining({ playerId: idOf(ben), mode: 'now' })]);

    await ana.ok({ type: 'act', v: ana.state.v, kind: 'fold' });
    s = await cat.settle();
    expect(s.room.game.players.map((player) => player.name)).toEqual(['Ana', 'Cat']);
    expect(s.room.game.departed).toEqual([expect.objectContaining({ id: idOf(ben), name: 'Ben' })]);
    expect(s.room.log.some((entry) => entry.text === 'Ben folds and leaves')).toBe(true);
  });

  it('allows a scheduled departure to be cancelled or undone with the hand result', async () => {
    const { clients, idOf } = await table(['Ana', 'Ben']);
    const [ana, ben] = clients;
    await ana.ok({ type: 'start', allowUnconfirmed: true, v: ana.state.v });
    await ben.ok({ type: 'requestLeave', mode: 'afterHand' });
    await ben.ok({ type: 'cancelLeave' });
    expect((await ana.settle()).room.leaveRequests).toHaveLength(0);

    await ben.ok({ type: 'requestLeave', mode: 'afterHand' });
    await ana.ok({ type: 'act', v: ana.state.v, kind: 'fold' });
    expect((await ana.settle()).room.game.players.map((player) => player.name)).toEqual(['Ana']);

    await ana.ok({ type: 'undo', v: ana.state.v });
    const s = await ben.settle();
    expect(s.room.members.map((member) => member.name)).toEqual(['Ana', 'Ben']);
    expect(s.room.game.players.map((player) => player.name)).toEqual(['Ana', 'Ben']);
    expect(s.room.game.toActId).toBe(idOf(ana));
    expect(s.room.leaveRequests).toEqual([
      expect.objectContaining({ playerId: idOf(ben), mode: 'afterHand' }),
    ]);
  });

  it('offers recovery only after the host grace period and only the nominee can accept', async () => {
    const { code, clients, idOf } = await table(['Ana', 'Ben', 'Cat']);
    const [ana, ben] = clients;
    expect(await ben.request({ type: 'takeHost' })).toMatchObject({ code: 'FORBIDDEN' });
    ana.ws.close(1000, 'bye');
    await new Promise((r) => setTimeout(r, 50));
    expect((await ben.settle()).room.hostTransfer).toBeNull();
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    await runInDurableObject(stub, async (instance: unknown) => {
      (instance as { s: { hostAwaySince: number } }).s.hostAwaySince = Date.now() - HOST_DISCONNECT_GRACE_MS - 1;
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await ben.settle();
    expect(ben.state.room.hostTransfer).toMatchObject({ kind: 'recovery', targetId: idOf(ben) });
    expect(await clients[2].request({ type: 'takeHost' })).toMatchObject({ code: 'FORBIDDEN' });
    await ben.ok({ type: 'takeHost' });
    expect(ben.state.you.isHost).toBe(true);
  });

  it('allows takeover after the creator grace period when the original device token is lost', async () => {
    const code = await createRoom(tokenFor(301));
    await Client.connect(code, tokenFor(301));
    const guest = await Client.connect(code, tokenFor(302));
    await guest.ok({ type: 'join', name: 'Guest' });
    expect(await guest.request({ type: 'takeHost' })).toMatchObject({ code: 'FORBIDDEN' });

    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    await runInDurableObject(stub, async (instance: unknown) => {
      (instance as { s: { createdAt: number } }).s.createdAt = Date.now() - CREATOR_GRACE_MS - 1;
    });
    expect(await guest.request({ type: 'takeHost' })).toMatchObject({
      type: 'err',
      code: 'FORBIDDEN',
      message: 'Wait until the table nominates you',
    });
    expect(guest.state.room.hostTakeoverAt).toBeNull();

    await runInDurableObject(stub, async (instance: unknown, state) => {
      (instance as { lastMsg: Map<string, number> }).lastMsg.clear();
      for (const socket of state.getWebSockets()) {
        const attachment = socket.deserializeAttachment() as { memberId: string | null; openedAt: number };
        if (attachment.memberId !== null) continue;
        attachment.openedAt = Date.now() - AWAY_AFTER_MS - 1;
        socket.serializeAttachment(attachment);
      }
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await guest.settle();
    expect(guest.state.room.hostTakeoverAt).not.toBeNull();
    expect(guest.state.room.hostTransfer).toMatchObject({ kind: 'recovery', targetId: guest.state.you.id });
    await guest.ok({ type: 'takeHost' });
    expect(guest.state.you).toMatchObject({ isHost: true, isController: true });
    expect(guest.state.room.hostTakeoverAt).toBeNull();
  });

  it('keeps pre-foundation rooms usable when controller and creator capability fields are absent', async () => {
    const { code, clients } = await table(['Legacy host', 'Guest']);
    clients.forEach((client) => client.ws.close(1000, 'prepare eviction'));
    await new Promise((resolve) => setTimeout(resolve, 50));
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    await runInDurableObject(stub, async (_, state) => {
      const stored = (await state.storage.get<Record<string, unknown>>('room'))!;
      delete stored.controllerId;
      delete stored.hostTokenHash;
      await state.storage.put('room', stored);
    });
    await evictDurableObject(stub, { webSockets: 'close' });

    const legacyHost = await Client.connect(code, tokenFor(1));
    expect(legacyHost.state.you).toMatchObject({ isHost: true, isController: true });
    await legacyHost.ok({ type: 'start', allowUnconfirmed: true, v: legacyHost.state.v });
    await legacyHost.ok({ type: 'act', v: legacyHost.state.v, kind: 'fold' });
    await legacyHost.ok({ type: 'next', v: legacyHost.state.v });
    expect(legacyHost.state.room.game.handNo).toBe(2);
  });
});

describe('lifecycle', () => {
  it('persists state and expires idle rooms', async () => {
    const { code, clients } = await table(['Ana', 'Ben']);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    const stored = await runInDurableObject(stub, async (_, state) => state.storage.get<{ v: number }>('room'));
    expect(stored?.v).toBe(clients[0].state.v);
    expect(await runInDurableObject(stub, (_, state) => state.storage.getAlarm())).not.toBeNull();

    await runInDurableObject(stub, async (instance: unknown) => {
      (instance as { s: { lastActivity: number } }).s.lastActivity = 0;
    });
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await clients[0].waitFor((m) => m.type === 'closed' && m.reason === 'expired');
    expect((await api(`/api/rooms/${code}`)).status).toBe(404);
    const keys = await runInDurableObject(stub, (_, state) => state.storage.list());
    expect(keys.size).toBe(0);
  });
});
