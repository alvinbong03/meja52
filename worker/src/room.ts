import { DurableObject } from 'cloudflare:workers';
import {
  act,
  addBuyIn,
  addPlayer,
  award,
  createGame,
  findPlayer,
  handInProgress,
  legalActions,
  removePlayer,
  RuleError,
  setSeatOrder,
  setSittingOut,
  setStack,
  startHand,
  updateSettings,
  MAX_PLAYERS,
  type Game,
  type Settings,
} from '../../shared/engine';
import { cleanName, sameName } from '../../shared/names';
import {
  AWAY_AFTER_MS,
  MAX_MESSAGE_BYTES,
  parseClientMessage,
  PING,
  PONG,
  type ClaimView,
  type Envelope,
  type ErrorCode,
  type LogEntry,
  type LogKind,
  type MemberView,
  type RoomView,
  type RebuyRequestView,
  type ServerMessage,
  type CurrencyCode,
} from '../../shared/protocol';
import type { Env } from './index';

export const DEFAULT_SETTINGS: Settings = { sb: 5, bb: 10, startingStack: 1000, buyInPrice: 0 };
export const IDLE_TTL_MS = 12 * 60 * 60 * 1000;
export const CREATOR_GRACE_MS = 2 * 60 * 1000;
const UNDO_DEPTH = 30;
const LOG_KEEP = 100;
const LOG_SEND = 40;
const MAX_SOCKETS = 40;
const RATE_PER_SEC = 8;
const RATE_BURST = 20;
const STREETS = ['Preflop', 'Flop', 'Turn', 'River'];

interface Member {
  id: string;
  name: string;
  avatar: string | null;
  tokenHash: string | null;
  manual: boolean;
  joinedAt: number;
}

interface Claim extends ClaimView {
  tokenHash: string;
  connId: string;
}

interface RebuyRequest extends RebuyRequestView {}

interface Snapshot {
  label: string;
  game: Game;
  rebuyRequests?: RebuyRequest[];
}

interface Stored {
  code: string;
  createdAt: number;
  lastActivity: number;
  hostId: string | null;
  controllerId?: string | null;
  /** One-time bootstrap capability. Cleared as soon as the creator takes a seat. */
  hostTokenHash?: string | null;
  currency?: CurrencyCode;
  members: Member[];
  game: Game;
  v: number;
  log: LogEntry[];
  logSeq: number;
  claims: Claim[];
  rebuyRequests?: RebuyRequest[];
  turnStartedAt: number | null;
  turnId: string | null;
  endingAfterHand?: boolean;
  endedAt?: number | null;
}

interface Attachment {
  connId: string;
  memberId: string | null;
  tokenHash: string | null;
  openedAt: number;
}

class Reject extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const deny = (code: ErrorCode, message: string): never => {
  throw new Reject(code, message);
};

export const randomId = (bytes = 8) =>
  [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('');

async function sha256(input: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const fmt = (n: number) => n.toLocaleString('en-US');

export class Room extends DurableObject<Env> {
  private s: Stored | null = null;
  private undo: Snapshot[] = [];
  private alarmAt: number | null = null;
  private buckets = new Map<string, { tokens: number; at: number; strikes: number }>();
  private lastMsg = new Map<string, number>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
    void ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get<Stored>('room')) ?? null;
      this.undo = (await ctx.storage.get<Snapshot[]>('undo')) ?? [];
      this.alarmAt = await ctx.storage.getAlarm();
    });
  }

  // ---------- HTTP ----------

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const route = url.pathname.split('/').pop();

    if (route === 'init' && request.method === 'POST') {
      if (this.s) return new Response('exists', { status: 409 });
      const { code, creatorToken, currency, settings } = (await request.json()) as {
        code: string;
        creatorToken: string;
        currency?: CurrencyCode;
        settings?: Settings;
      };
      const now = Date.now();
      this.s = {
        code,
        createdAt: now,
        lastActivity: now,
        hostId: null,
        controllerId: null,
        hostTokenHash: await sha256(`${code}:${creatorToken}`),
        currency: currency ?? 'USD',
        members: [],
        game: createGame(settings ?? DEFAULT_SETTINGS),
        v: 1,
        log: [],
        logSeq: 0,
        claims: [],
        rebuyRequests: [],
        turnStartedAt: null,
        turnId: null,
        endingAfterHand: false,
        endedAt: null,
      };
      this.undo = [];
      this.persist();
      return Response.json({ code }, { status: 201 });
    }

    if (!this.s) return new Response('not found', { status: 404 });

    if (route === 'info') {
      return Response.json({
        code: this.s.code,
        phase: this.s.game.phase,
        players: this.s.members.map((m) => m.name),
      });
    }

    if (route === 'ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      if (this.ctx.getWebSockets().length >= MAX_SOCKETS) {
        return new Response('Table is crowded', { status: 503 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const att: Attachment = { connId: randomId(), memberId: null, tokenHash: null, openedAt: Date.now() };
      server.serializeAttachment(att);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('not found', { status: 404 });
  }

  // ---------- WebSocket ----------

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_BYTES) {
      ws.close(1009, 'Message too large');
      return;
    }
    const att = ws.deserializeAttachment() as Attachment;
    if (!this.s) {
      this.send(ws, { type: 'closed', reason: 'expired' });
      ws.close(4004, 'Room expired');
      return;
    }
    if (!this.takeToken(att.connId)) {
      const b = this.buckets.get(att.connId);
      if (b && b.strikes > 20) ws.close(4008, 'Too many messages');
      else this.send(ws, { type: 'err', code: 'RATE', message: 'Slow down' });
      return;
    }
    this.lastMsg.set(att.connId, Date.now());

    const msg = parseClientMessage(message);
    if (!msg) {
      this.send(ws, { type: 'err', code: 'INVALID', message: 'Malformed message' });
      return;
    }
    try {
      await this.handle(ws, att, msg);
      if (msg.seq !== undefined) this.send(ws, { type: 'ok', seq: msg.seq });
    } catch (e) {
      if (e instanceof Reject || e instanceof RuleError) {
        const code = e.code as ErrorCode;
        this.send(ws, { type: 'err', seq: msg.seq, code, message: e.message });
        if (code === 'STALE') this.sendState(ws);
      } else {
        console.error('room error', e);
        this.send(ws, { type: 'err', seq: msg.seq, code: 'INVALID', message: 'Something went wrong' });
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.dropConnection(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.dropConnection(ws);
  }

  async alarm() {
    if (!this.s) return;
    const now = Date.now();
    const expiry = this.s.lastActivity + IDLE_TTL_MS;
    if (now < expiry) {
      this.alarmAt = null;
      if (this.s.hostTokenHash && now >= this.s.createdAt + CREATOR_GRACE_MS && !this.creatorCapabilityPresent()) {
        this.broadcast();
      }
      this.scheduleAlarm();
      return;
    }
    for (const ws of this.ctx.getWebSockets()) {
      this.send(ws, { type: 'closed', reason: 'expired' });
      try {
        ws.close(4004, 'Room expired');
      } catch {
        // already closed
      }
    }
    this.s = null;
    this.undo = [];
    this.alarmAt = null;
    await this.ctx.storage.deleteAll();
  }

  // ---------- dispatch ----------

  private async handle(ws: WebSocket, att: Attachment, msg: Envelope) {
    const s = this.s as Stored;
    if (msg.type === 'hello') {
      att.tokenHash = await sha256(`${s.code}:${msg.token}`);
      att.memberId = s.members.find((m) => m.tokenHash === att.tokenHash)?.id ?? null;
      ws.serializeAttachment(att);
      this.scheduleAlarm();
      this.broadcast();
      return;
    }
    if (!att.tokenHash) deny('FORBIDDEN', 'Say hello first');

    const me = att.memberId ? s.members.find((m) => m.id === att.memberId) : undefined;
    const requireMember = () => me ?? deny('FORBIDDEN', 'Join the table first');
    const requireHost = () => {
      const m = requireMember();
      if (s.hostId !== m.id) deny('FORBIDDEN', 'Only the host can do that');
      return m;
    };
    const requireController = () => {
      const m = requireMember();
      if ((s.controllerId ?? s.hostId) !== m.id) deny('FORBIDDEN', 'Only the Table Controller can do that');
      return m;
    };
    const checkV = (v: number) => {
      if (v !== s.v) deny('STALE', 'The table changed. Try again.');
    };
    const nameOf = (id: string) => s.members.find((m) => m.id === id)?.name ?? findPlayer(s.game, id)?.name ?? 'Someone';
    /** Self, the host, or anyone acting for a seat without a present player. */
    const requireControl = (targetId: string | undefined) => {
      const m = requireMember();
      const id = targetId ?? m.id;
      if (id === m.id || s.hostId === m.id) return id;
      const target = s.members.find((x) => x.id === id) ?? deny('INVALID', 'Unknown player');
      if (!this.isAway(target)) deny('FORBIDDEN', `${target.name} is still here`);
      return id;
    };

    if (s.endedAt && !['claim', 'cancelClaim', 'resolveClaim'].includes(msg.type)) {
      deny('PHASE', 'The game has ended');
    }

    switch (msg.type) {
      case 'join': {
        if (me) deny('INVALID', 'Already seated');
        const name = this.uniqueName(msg.name);
        if (s.members.length >= MAX_PLAYERS) deny('INVALID', 'Table is full');
        const creatorJoining = s.hostTokenHash === att.tokenHash;
        if (s.hostTokenHash && !creatorJoining && s.members.length >= MAX_PLAYERS - 1) {
          deny('INVALID', 'The last seat is reserved for the room creator');
        }
        const member: Member = {
          id: randomId(),
          name,
          avatar: msg.avatar?.slice(0, 4) ?? null,
          tokenHash: att.tokenHash,
          manual: false,
          joinedAt: Date.now(),
        };
        s.game = addPlayer(s.game, member.id, name);
        s.members.push(member);
        if (s.hostTokenHash === undefined && !s.hostId) {
          // Compatibility for rooms created before creator binding was introduced.
          s.hostId = member.id;
          s.controllerId ??= member.id;
        } else if (creatorJoining) {
          s.hostId = member.id;
          s.controllerId ??= member.id;
          s.hostTokenHash = null;
        }
        s.claims = s.claims.filter((c) => c.connId !== att.connId);
        for (const other of this.ctx.getWebSockets()) {
          const oa = other.deserializeAttachment() as Attachment;
          if (oa.tokenHash === att.tokenHash) {
            oa.memberId = member.id;
            other.serializeAttachment(oa);
          }
        }
        this.log('table', `${name} joined`);
        this.commit();
        return;
      }
      case 'addSeat': {
        requireHost();
        const name = this.uniqueName(msg.name);
        if (s.members.length >= MAX_PLAYERS) deny('INVALID', 'Table is full');
        const member: Member = { id: randomId(), name, avatar: null, tokenHash: null, manual: true, joinedAt: Date.now() };
        s.game = addPlayer(s.game, member.id, name);
        s.members.push(member);
        this.log('table', `${name} sat down without a phone`);
        this.commit();
        return;
      }
      case 'claim': {
        if (me) deny('INVALID', 'Already seated');
        const target = s.members.find((m) => m.id === msg.playerId) ?? deny('INVALID', 'Unknown player');
        const othersHere = s.members.some((m) => m.id !== target.id && !this.isAway(m));
        const targetHere = !target.manual && !this.isAway(target);
        if (!othersHere && !targetHere) {
          this.applyClaim(target, att.tokenHash as string);
          this.log('table', `${target.name} is back on a new device`);
          this.commit();
          return;
        }
        s.claims = s.claims.filter((c) => c.connId !== att.connId);
        s.claims.push({
          id: randomId(),
          playerId: target.id,
          at: Date.now(),
          tokenHash: att.tokenHash as string,
          connId: att.connId,
        });
        this.commit();
        return;
      }
      case 'cancelClaim': {
        s.claims = s.claims.filter((c) => c.connId !== att.connId);
        this.commit();
        return;
      }
      case 'resolveClaim': {
        const m = requireMember();
        const claim = s.claims.find((c) => c.id === msg.claimId) ?? deny('INVALID', 'Request already handled');
        s.claims = s.claims.filter((c) => c.id !== claim.id);
        const target = s.members.find((x) => x.id === claim.playerId);
        if (msg.allow && target) {
          this.applyClaim(target, claim.tokenHash);
          this.log('table', `${m.name} moved ${target.name} to a new device`);
        } else {
          for (const other of this.ctx.getWebSockets()) {
            const oa = other.deserializeAttachment() as Attachment;
            if (oa.connId === claim.connId) {
              this.send(other, { type: 'err', code: 'FORBIDDEN', message: 'The table declined that request' });
            }
          }
        }
        this.commit();
        return;
      }
      case 'start': {
        requireHost();
        checkV(msg.v);
        if (s.game.phase !== 'lobby') deny('PHASE', 'The game already started');
        this.mutate('Start the game', (g) => startHand(g));
        return;
      }
      case 'next': {
        requireController();
        checkV(msg.v);
        if (s.game.phase !== 'done') deny('PHASE', 'The hand is not over');
        this.mutate('Deal the next hand', (g) => startHand(g));
        return;
      }
      case 'endGame': {
        const host = requireHost();
        checkV(msg.v);
        if (s.game.phase === 'lobby') deny('PHASE', 'Start a game before ending it');
        if (s.endingAfterHand) deny('INVALID', 'The game is already ending after this hand');
        if (s.game.phase === 'betting' || s.game.phase === 'showdown') {
          s.endingAfterHand = true;
          s.v += 1;
          this.log('table', `${host.name} will end the game after this hand`);
        } else {
          s.endedAt = Date.now();
          this.undo = [];
          this.log('table', `${host.name} ended the game`);
          s.v += 1;
        }
        this.commit();
        return;
      }
      case 'cancelEndGame': {
        const host = requireHost();
        checkV(msg.v);
        if (!s.endingAfterHand) deny('INVALID', 'The game is not scheduled to end');
        s.endingAfterHand = false;
        s.v += 1;
        this.log('table', `${host.name} kept the game running`);
        this.commit();
        return;
      }
      case 'act': {
        const m = requireMember();
        checkV(msg.v);
        const actorId = msg.playerId ?? m.id;
        if (actorId !== m.id) {
          const target = s.members.find((x) => x.id === actorId) ?? deny('INVALID', 'Unknown player');
          if (!this.isAway(target)) deny('FORBIDDEN', `${target.name} is still here`);
        }
        const before = s.game;
        const after = act(before, actorId, { kind: msg.kind, amount: msg.amount });
        const text = this.describeAction(before, after, actorId);
        const suffix = actorId !== m.id ? ` (by ${m.name})` : '';
        this.mutate(text + suffix, () => after, 'action');
        return;
      }
      case 'award': {
        requireController();
        checkV(msg.v);
        this.mutate('Award the pot', (g) => award(g, msg.winners));
        return;
      }
      case 'undo': {
        const m = requireHost();
        checkV(msg.v);
        const snap = this.undo.pop() ?? deny('INVALID', 'Nothing to undo');
        s.game = this.reconcile(snap.game);
        if (snap.rebuyRequests) s.rebuyRequests = structuredClone(snap.rebuyRequests);
        s.v += 1;
        this.log('undo', `${m.name} undid: ${snap.label}`);
        this.commit();
        return;
      }
      case 'sit': {
        const id = requireControl(msg.playerId);
        this.mutate(`${nameOf(id)} ${msg.out ? 'sits out' : 'sits back in'}`, (g) => setSittingOut(g, id, msg.out), 'table');
        return;
      }
      case 'requestRebuy': {
        const m = requireMember();
        if (s.endingAfterHand) deny('PHASE', 'This is the final hand');
        const requests = (s.rebuyRequests ??= []);
        if (requests.some((r) => r.playerId === m.id)) deny('INVALID', 'You already have a rebuy request');
        addBuyIn(s.game, m.id, msg.amount);
        requests.push({
          id: randomId(),
          playerId: m.id,
          amount: msg.amount,
          status: 'pending',
          requestedAt: Date.now(),
        });
        s.v += 1;
        this.commit();
        return;
      }
      case 'cancelRebuy': {
        const m = requireMember();
        const requests = (s.rebuyRequests ??= []);
        const request = requests.find((r) => r.id === msg.requestId) ?? deny('INVALID', 'Request already handled');
        if (request.playerId !== m.id) deny('FORBIDDEN', 'That is not your request');
        if (request.status !== 'pending') deny('INVALID', 'The host already approved this rebuy');
        s.rebuyRequests = requests.filter((r) => r.id !== request.id);
        s.v += 1;
        this.commit();
        return;
      }
      case 'resolveRebuy': {
        const host = requireHost();
        checkV(msg.v);
        const requests = (s.rebuyRequests ??= []);
        const request = requests.find((r) => r.id === msg.requestId) ?? deny('INVALID', 'Request already handled');
        if (request.status !== 'pending') deny('INVALID', 'Request already approved');
        if (!msg.allow) {
          s.rebuyRequests = requests.filter((r) => r.id !== request.id);
          s.v += 1;
          this.commit();
          return;
        }
        if (s.endingAfterHand) deny('PHASE', 'This is the final hand');
        const amount = msg.amount as number;
        addBuyIn(s.game, request.playerId, amount);
        request.amount = amount;
        request.status = 'approved';
        s.v += 1;
        if (handInProgress(s.game)) {
          this.log('table', `${host.name} approved ${nameOf(request.playerId)}'s rebuy of ${fmt(amount)} for after this hand`);
        } else {
          this.applyApprovedRebuys();
        }
        this.commit();
        return;
      }
      case 'leave': {
        const m = requireMember();
        this.removeMember(m, 'left');
        return;
      }
      case 'kick': {
        const host = requireHost();
        if (msg.playerId === host.id) deny('INVALID', 'Use leave instead');
        const target = s.members.find((x) => x.id === msg.playerId) ?? deny('INVALID', 'Unknown player');
        this.removeMember(target, 'kicked');
        return;
      }
      case 'settings': {
        requireHost();
        checkV(msg.v);
        const pending = s.game.phase === 'betting' || s.game.phase === 'showdown';
        const { sb, bb, startingStack } = msg.settings;
        this.mutate(
          `Blinds ${fmt(sb)}/${fmt(bb)}, stack ${fmt(startingStack)}${pending ? ' from next hand' : ''}`,
          (g) => updateSettings(g, msg.settings),
          'table',
        );
        return;
      }
      case 'setStack': {
        requireHost();
        checkV(msg.v);
        if ((s.rebuyRequests ?? []).some((request) => request.playerId === msg.playerId && request.status === 'approved')) {
          deny('PHASE', 'Apply or undo the approved rebuy before changing this stack');
        }
        this.mutate(
          `${nameOf(msg.playerId)} set to ${fmt(msg.stack)}`,
          (g) => setStack(g, msg.playerId, msg.stack),
          'table',
        );
        return;
      }
      case 'seatOrder': {
        requireHost();
        checkV(msg.v);
        this.mutate('Seats rearranged', (g) => setSeatOrder(g, msg.ids), 'table');
        return;
      }
      case 'transferHost': {
        const host = requireHost();
        const target = s.members.find((x) => x.id === msg.playerId) ?? deny('INVALID', 'Unknown player');
        if (target.manual) deny('INVALID', 'That seat has no phone');
        s.hostId = target.id;
        s.hostTokenHash = null;
        this.log('table', `${host.name} made ${target.name} the host`);
        this.commit();
        return;
      }
      case 'transferController': {
        const host = requireHost();
        const target = s.members.find((x) => x.id === msg.playerId) ?? deny('INVALID', 'Unknown player');
        if (target.manual) deny('INVALID', 'That seat has no phone');
        s.controllerId = target.id;
        this.log('table', `${host.name} made ${target.name} the Table Controller`);
        this.commit();
        return;
      }
      case 'takeHost': {
        const m = requireMember();
        if (m.manual) deny('FORBIDDEN', 'Not allowed');
        if (s.hostTokenHash) {
          if (this.creatorCapabilityPresent()) deny('FORBIDDEN', 'The room creator is still connected');
          if (Date.now() < s.createdAt + CREATOR_GRACE_MS) deny('FORBIDDEN', 'The room creator still has time to join');
        }
        const host = s.members.find((x) => x.id === s.hostId);
        if (host && !this.isAway(host)) deny('FORBIDDEN', `${host.name} is still hosting`);
        s.hostId = m.id;
        s.controllerId ??= m.id;
        s.hostTokenHash = null;
        this.log('table', `${m.name} is now the host`);
        this.commit();
        return;
      }
    }
  }

  // ---------- state changes ----------

  private mutate(label: string, fn: (g: Game) => Game, kind: LogKind = 'hand') {
    const s = this.s as Stored;
    const before = s.game;
    const after = fn(before);
    this.undo.push({ label, game: before, rebuyRequests: structuredClone(s.rebuyRequests ?? []) });
    if (this.undo.length > UNDO_DEPTH) this.undo.shift();
    s.game = after;
    s.v += 1;
    this.logTransition(before, after, label, kind);
    this.applyApprovedRebuys();
    this.finishIfScheduled(after);
    this.commit();
  }

  private finishIfScheduled(game: Game) {
    const s = this.s as Stored;
    if (!s.endingAfterHand || game.phase !== 'done') return;
    s.endingAfterHand = false;
    s.endedAt = Date.now();
    this.undo = [];
    this.log('table', 'The game ended after the final hand');
  }

  private applyApprovedRebuys() {
    const s = this.s as Stored;
    if (handInProgress(s.game)) return;
    const approved = (s.rebuyRequests ?? []).filter((r) => r.status === 'approved');
    for (const request of approved) {
      s.game = addBuyIn(s.game, request.playerId, request.amount);
      this.log('table', `${this.playerName(request.playerId)} added ${fmt(request.amount)} chips`);
    }
    if (approved.length > 0) {
      const ids = new Set(approved.map((r) => r.id));
      s.rebuyRequests = (s.rebuyRequests ?? []).filter((r) => !ids.has(r.id));
    }
  }

  private playerName(id: string) {
    const s = this.s as Stored;
    return s.members.find((m) => m.id === id)?.name ?? findPlayer(s.game, id)?.name ?? 'Someone';
  }

  private logTransition(before: Game, after: Game, label: string, kind: LogKind) {
    const s = this.s as Stored;
    const name = (id: string | null) => findPlayer(after, id)?.name ?? s.members.find((m) => m.id === id)?.name ?? '';
    if (after.handNo !== before.handNo) {
      this.log('hand', `Hand ${after.handNo}. ${name(after.buttonId)} has the button`);
    } else if (kind !== 'hand') {
      this.log(kind, label);
    }
    if (after.phase === 'betting' && after.handNo === before.handNo && after.street !== before.street) {
      this.log('hand', STREETS[after.street]);
    }
    if (after.phase === 'showdown' && before.phase !== 'showdown') {
      this.log('hand', after.runout ? 'All in. Run out the board' : 'Showdown');
    }
    if (after.results.length > 0 && after.phase === 'done' && before.phase !== 'done') {
      const totals = new Map<string, number>();
      for (const r of after.results) totals.set(r.id, (totals.get(r.id) ?? 0) + r.amount);
      for (const [id, amount] of totals) {
        const p = findPlayer(after, id) ?? after.departed.find((d) => d.id === id);
        this.log('win', `${p?.name ?? 'Someone'} wins ${fmt(amount)}`);
      }
    }
  }

  private describeAction(before: Game, after: Game, id: string) {
    const p = findPlayer(after, id);
    const la = after.lastAction;
    if (!p || !la) return 'Action';
    switch (la.kind) {
      case 'fold':
        return `${p.name} folds`;
      case 'check':
        return `${p.name} checks`;
      case 'call':
        return la.allIn ? `${p.name} calls all in for ${fmt(la.amount)}` : `${p.name} calls ${fmt(la.amount)}`;
      case 'raise':
        if (la.allIn) return `${p.name} is all in for ${fmt(la.amount)}`;
        return before.currentBet === 0 ? `${p.name} bets ${fmt(la.amount)}` : `${p.name} raises to ${fmt(la.amount)}`;
      default:
        return `${p.name} acts`;
    }
  }

  /** Undo restores game state only. Seats follow current membership. */
  private reconcile(game: Game): Game {
    const s = this.s as Stored;
    let g = game;
    for (const p of [...g.players]) {
      if (!s.members.some((m) => m.id === p.id) && !p.leaving) g = removePlayer(g, p.id);
    }
    for (const m of s.members) {
      if (!findPlayer(g, m.id)) {
        try {
          g = addPlayer(g, m.id, m.name);
        } catch {
          // table full of players still finishing a hand; they are seated next undo-free change
        }
      }
    }
    return g;
  }

  private removeMember(target: Member, how: 'left' | 'kicked') {
    const s = this.s as Stored;
    const before = s.game;
    const after = findPlayer(before, target.id) ? removePlayer(before, target.id) : before;
    s.members = s.members.filter((m) => m.id !== target.id);
    s.claims = s.claims.filter((c) => c.playerId !== target.id);
    s.rebuyRequests = (s.rebuyRequests ?? []).filter((r) => r.playerId !== target.id);
    if (s.hostId === target.id) {
      s.hostId = (s.members.find((m) => !m.manual && !this.isAway(m)) ?? s.members.find((m) => !m.manual))?.id ?? null;
    }
    if (s.controllerId === target.id) {
      s.controllerId = s.hostId ?? s.members.find((m) => !m.manual)?.id ?? null;
    }
    for (const ws of this.ctx.getWebSockets()) {
      const oa = ws.deserializeAttachment() as Attachment;
      if (oa.memberId !== target.id) continue;
      oa.memberId = null;
      ws.serializeAttachment(oa);
      if (how === 'kicked') {
        this.send(ws, { type: 'closed', reason: 'kicked' });
        ws.close(4002, 'Removed by host');
      }
    }
    this.undo.push({ label: `${target.name} ${how}`, game: before, rebuyRequests: structuredClone(s.rebuyRequests ?? []) });
    if (this.undo.length > UNDO_DEPTH) this.undo.shift();
    s.game = after;
    s.v += 1;
    this.log('table', how === 'left' ? `${target.name} left` : `${target.name} was removed`);
    this.logTransition(before, after, '', 'hand');
    this.finishIfScheduled(after);
    this.commit();
  }

  private applyClaim(target: Member, tokenHash: string) {
    const s = this.s as Stored;
    target.tokenHash = tokenHash;
    target.manual = false;
    s.claims = s.claims.filter((c) => c.playerId !== target.id);
    for (const ws of this.ctx.getWebSockets()) {
      const oa = ws.deserializeAttachment() as Attachment;
      if (oa.tokenHash === tokenHash) {
        oa.memberId = target.id;
        ws.serializeAttachment(oa);
      } else if (oa.memberId === target.id) {
        oa.memberId = null;
        ws.serializeAttachment(oa);
        this.send(ws, { type: 'closed', reason: 'replaced' });
        ws.close(4001, 'Seat moved to another device');
      }
    }
  }

  private uniqueName(raw: string) {
    const s = this.s as Stored;
    const name = cleanName(raw) ?? deny('INVALID', 'Pick a name');
    if (s.members.some((m) => sameName(m.name, name))) {
      deny('INVALID', `${name} is already at the table. If that is you, tap your name.`);
    }
    return name;
  }

  private log(kind: LogKind, text: string) {
    const s = this.s as Stored;
    s.logSeq += 1;
    s.log.push({ id: s.logSeq, at: Date.now(), kind, text });
    if (s.log.length > LOG_KEEP) s.log.splice(0, s.log.length - LOG_KEEP);
  }

  private commit() {
    const s = this.s as Stored;
    const turn = s.game.toActId;
    if (turn !== s.turnId) {
      s.turnStartedAt = turn ? Date.now() : null;
      s.turnId = turn;
    }
    s.lastActivity = Date.now();
    this.persist();
    this.broadcast();
  }

  private persist() {
    const s = this.s as Stored;
    void this.ctx.storage.put({ room: s, undo: this.undo });
    this.scheduleAlarm();
  }

  private scheduleAlarm() {
    const s = this.s;
    if (!s) return;
    const now = Date.now();
    let deadline = s.lastActivity + IDLE_TTL_MS;
    if (s.hostTokenHash) {
      const lastSeen = this.creatorCapabilityLastSeen();
      const takeoverAt = Math.max(s.createdAt + CREATOR_GRACE_MS, lastSeen ? lastSeen + AWAY_AFTER_MS : 0);
      if (takeoverAt > now) deadline = Math.min(deadline, takeoverAt);
    }
    if (this.alarmAt === null || Math.abs(deadline - this.alarmAt) > 1000) {
      this.alarmAt = deadline;
      void this.ctx.storage.setAlarm(deadline);
    }
  }

  // ---------- presence ----------

  private socketLastSeen(ws: WebSocket, att: Attachment) {
    const auto = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
    return Math.max(att.openedAt, auto, this.lastMsg.get(att.connId) ?? 0);
  }

  private presence(memberId: string) {
    const now = Date.now();
    let connections = 0;
    let lastSeen = 0;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const att = ws.deserializeAttachment() as Attachment;
      if (att.memberId !== memberId) continue;
      const seen = this.socketLastSeen(ws, att);
      lastSeen = Math.max(lastSeen, seen);
      if (now - seen < AWAY_AFTER_MS) connections += 1;
    }
    return { connections, lastSeen };
  }

  private isAway(m: Member) {
    return m.manual || this.presence(m.id).connections === 0;
  }

  private creatorCapabilityPresent() {
    const lastSeen = this.creatorCapabilityLastSeen();
    return lastSeen > 0 && Date.now() - lastSeen < AWAY_AFTER_MS;
  }

  private creatorCapabilityLastSeen() {
    const tokenHash = this.s?.hostTokenHash;
    if (!tokenHash) return 0;
    let lastSeen = 0;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws.readyState !== WebSocket.OPEN) continue;
      const att = ws.deserializeAttachment() as Attachment;
      if (att.tokenHash === tokenHash) lastSeen = Math.max(lastSeen, this.socketLastSeen(ws, att));
    }
    return lastSeen;
  }

  private dropConnection(ws: WebSocket) {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (!att || !this.s) return;
    this.buckets.delete(att.connId);
    this.lastMsg.delete(att.connId);
    const before = this.s.claims.length;
    this.s.claims = this.s.claims.filter((c) => c.connId !== att.connId);
    if (before !== this.s.claims.length) this.persist();
    this.broadcast(ws);
  }

  private takeToken(connId: string) {
    const now = Date.now();
    const b = this.buckets.get(connId) ?? { tokens: RATE_BURST, at: now, strikes: 0 };
    b.tokens = Math.min(RATE_BURST, b.tokens + ((now - b.at) / 1000) * RATE_PER_SEC);
    b.at = now;
    const ok = b.tokens >= 1;
    if (ok) b.tokens -= 1;
    else b.strikes += 1;
    this.buckets.set(connId, b);
    return ok;
  }

  // ---------- output ----------

  private view(): RoomView {
    const s = this.s as Stored;
    const members: MemberView[] = s.members.map((m) => ({
      id: m.id,
      name: m.name,
      avatar: m.avatar ?? null,
      manual: m.manual,
      ...this.presence(m.id),
    }));
    return {
      code: s.code,
      createdAt: s.createdAt,
      hostId: s.hostId,
      hostTakeoverAt: s.hostTokenHash && !this.creatorCapabilityPresent() ? s.createdAt + CREATOR_GRACE_MS : null,
      controllerId: s.controllerId ?? s.hostId,
      currency: s.currency ?? 'USD',
      members,
      game: s.game,
      claims: s.claims.map(({ id, playerId, at }) => ({ id, playerId, at })),
      rebuyRequests: s.rebuyRequests ?? [],
      log: s.log.slice(-LOG_SEND),
      undoLabel: this.undo.at(-1)?.label ?? null,
      turnStartedAt: s.turnStartedAt,
      endingAfterHand: s.endingAfterHand ?? false,
      endedAt: s.endedAt ?? null,
    };
  }

  private stateFor(ws: WebSocket, room: RoomView): ServerMessage {
    const s = this.s as Stored;
    const att = ws.deserializeAttachment() as Attachment;
    const id = att.memberId;
    const isHost = !!id && s.hostId === id;
    const privateRoom: RoomView = {
      ...room,
      rebuyRequests: room.rebuyRequests.filter((r) => isHost || r.playerId === id),
    };
    return {
      type: 'state',
      v: s.v,
      serverNow: Date.now(),
      room: privateRoom,
      you: {
        id,
        isHost,
        isController: !!id && (s.controllerId ?? s.hostId) === id,
        claimId: s.claims.find((c) => c.connId === att.connId)?.id ?? null,
        legal: id ? legalActions(s.game, id) : null,
      },
    };
  }

  private sendState(ws: WebSocket) {
    if (!this.s) return;
    this.send(ws, this.stateFor(ws, this.view()));
  }

  private broadcast(except?: WebSocket) {
    if (!this.s) return;
    const room = this.view();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except || ws.readyState !== WebSocket.OPEN) continue;
      const att = ws.deserializeAttachment() as Attachment;
      if (!att.tokenHash) continue;
      this.send(ws, this.stateFor(ws, room));
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // socket went away mid-send
    }
  }
}
