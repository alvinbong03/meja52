import { DurableObject } from 'cloudflare:workers';
import {
  act,
  addBuyIn,
  addPlayer,
  awardPots,
  bySeat,
  createGame,
  eligibleForHand,
  findPlayer,
  handInProgress,
  legalActions,
  potTotal,
  physicalRunoutLimit,
  overridePots,
  removePlayer,
  returnWithPost,
  RuleError,
  setSeatOrder,
  setInitialButton,
  setSittingOut,
  setStack,
  splitPotsForRunouts,
  startHand,
  updateSettings,
  MAX_PLAYERS,
  type Game,
  type Settings,
} from '../../shared/engine';
import { cleanName, sameName } from '../../shared/names';
import { breakChipInto, inventoryTotal, normalizeInventory, reconcileInventory, takeExact, type ChipCount } from '../../shared/chips';
import { ledger, netsInCents, settleUp } from '../../shared/settle';
import {
  AWAY_AFTER_MS,
  HOST_DISCONNECT_GRACE_MS,
  HOST_TRANSFER_RESPONSE_MS,
  MAX_MESSAGE_BYTES,
  parseClientMessage,
  PING,
  PONG,
  type ClaimView,
  type BreakView,
  type Envelope,
  type ErrorCode,
  type LogEntry,
  type LogKind,
  type LeaveRequestView,
  type HostTransferView,
  type LateArrivalView,
  type VoidProposalView,
  type MemberView,
  type RoomView,
  type RebuyRequestView,
  type RunoutPlanView,
  type AwardProposalView,
  type OverrideProposalView,
  type SettlementStateView,
  type SettlementEntryView,
  type SettlementRecord,
  type SeatConfirmationView,
  type ServerMessage,
  type CurrencyCode,
} from '../../shared/protocol';
import type { Env } from './index';

export const DEFAULT_SETTINGS: Settings = { sb: 5, bb: 10, startingStack: 1000, buyInPrice: 0 };
export const IDLE_TTL_MS = 12 * 60 * 60 * 1000;
export const FINAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CREATOR_GRACE_MS = 2 * 60 * 1000;
const UNDO_DEPTH = 30;
const LOG_KEEP = 5000;
const LOG_SEND = 40;
const MAX_SOCKETS = 40;
const MAX_UNAFFILIATED_SOCKETS = 20;
const RATE_PER_SEC = 8;
const RATE_BURST = 20;
const STREETS = ['Preflop', 'Flop', 'Turn', 'River'];
const CHIP_INVENTORY_VERSION = 2;

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

interface StoredSeatConfirmation extends SeatConfirmationView {
  leftId: string;
  rightId: string;
}

interface StoredRunoutPlan extends RunoutPlanView {
  boards: number[][];
}

interface Snapshot {
  label: string;
  game: Game;
  members?: Member[];
  restoreMemberIds?: string[];
  controllerId?: string | null;
  rebuyRequests?: RebuyRequest[];
  breaks?: BreakView[];
  leaveRequests?: LeaveRequestView[];
  lateArrivals?: LateArrivalView[];
  buyInEvents?: SettlementEntryView[];
  handStart?: Game | null;
  runoutPlan?: StoredRunoutPlan | null;
  awardProposal?: AwardProposalView | null;
  overrideProposal?: OverrideProposalView | null;
  settlement?: SettlementStateView | null;
  chipInventories?: Record<string, ChipCount[]>;
}

interface Stored {
  code: string;
  createdAt: number;
  lastActivity: number;
  hostId: string | null;
  controllerId?: string | null;
  /** One-time bootstrap capability. Cleared as soon as the creator takes a seat. */
  hostTokenHash?: string | null;
  backupHostId?: string | null;
  hostTransfer?: HostTransferView | null;
  hostAwaySince?: number | null;
  hostRecoveryDeclinedIds?: string[];
  seatConfirmations?: StoredSeatConfirmation[];
  currency?: CurrencyCode;
  members: Member[];
  game: Game;
  v: number;
  log: LogEntry[];
  logSeq: number;
  claims: Claim[];
  rebuyRequests?: RebuyRequest[];
  breaks?: BreakView[];
  leaveRequests?: LeaveRequestView[];
  lateArrivals?: LateArrivalView[];
  buyInEvents?: SettlementEntryView[];
  handStart?: Game | null;
  paused?: boolean;
  voidProposal?: VoidProposalView | null;
  correctionForId?: string | null;
  runoutPlan?: StoredRunoutPlan | null;
  awardProposal?: AwardProposalView | null;
  overrideProposal?: OverrideProposalView | null;
  settlement?: SettlementStateView | null;
  /** Private visual chip composition, always reconciled to the numeric stack. */
  chipInventories?: Record<string, ChipCount[]>;
  chipInventoryVersion?: number;
  turnStartedAt: number | null;
  turnId: string | null;
  endingAfterHand?: boolean;
  endedAt?: number | null;
  /** Hash of the separate private record capability; never sent in live room state. */
  settlementTokenHash?: string | null;
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
        backupHostId: null,
        hostTransfer: null,
        hostAwaySince: null,
        hostRecoveryDeclinedIds: [],
        seatConfirmations: [],
        currency: currency ?? 'USD',
        members: [],
        game: createGame(settings ?? DEFAULT_SETTINGS),
        v: 1,
        log: [],
        logSeq: 0,
        claims: [],
        rebuyRequests: [],
        breaks: [],
        leaveRequests: [],
        lateArrivals: [],
        buyInEvents: [],
        handStart: null,
        paused: false,
        voidProposal: null,
        correctionForId: null,
        runoutPlan: null,
        awardProposal: null,
        overrideProposal: null,
        settlement: null,
        turnStartedAt: null,
        turnId: null,
        endingAfterHand: false,
        endedAt: null,
        settlementTokenHash: null,
      };
      this.undo = [];
      this.persist();
      return Response.json({ code }, { status: 201 });
    }

    if (!this.s) return new Response('not found', { status: 404 });

    if (route === 'record') {
      if (request.method !== 'GET' && request.method !== 'DELETE') return new Response('method not allowed', { status: 405 });
      const token = request.headers.get('x-record-token') ?? '';
      const valid = /^[a-f0-9]{64}$/.test(token) && this.s.settlementTokenHash === await sha256(`${this.s.code}:settlement:${token}`);
      if (!valid || !this.s.settlement?.finalizedAt) return new Response('not found', { status: 404 });
      const deviceToken = request.headers.get('x-device-token') ?? '';
      const host = this.s.members.find((member) => member.id === this.s?.hostId);
      const canDelete = /^[a-f0-9]{64}$/.test(deviceToken) && host?.tokenHash === await sha256(`${this.s.code}:${deviceToken}`);
      if (request.method === 'GET') return Response.json({ record: this.record(), canDelete });
      if (!canDelete) return new Response('forbidden', { status: 403 });
      await this.destroy();
      return new Response(null, { status: 204 });
    }

    if (route === 'info') {
      return Response.json({
        code: this.s.code,
        phase: this.s.game.phase,
        playerCount: this.s.members.length,
      });
    }

    if (route === 'ws') {
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      if (this.ctx.getWebSockets().length >= MAX_SOCKETS) {
        return new Response('Table is crowded', { status: 503 });
      }
      const unaffiliated = this.ctx.getWebSockets().filter((socket) => {
        const attachment = socket.deserializeAttachment() as Attachment;
        return !attachment.memberId;
      }).length;
      if (unaffiliated >= MAX_UNAFFILIATED_SOCKETS) {
        return new Response('Too many pending connections', { status: 503 });
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
    const expiry = this.expiryAt();
    if (now < expiry) {
      this.alarmAt = null;
      const changed = this.reconcileHostAuthority(now);
      if (changed) this.persist();
      this.broadcast();
      this.scheduleAlarm();
      return;
    }
    await this.destroy();
  }

  // ---------- dispatch ----------

  private async handle(ws: WebSocket, att: Attachment, msg: Envelope) {
    const s = this.s as Stored;
    if (msg.type === 'hello') {
      att.tokenHash = await sha256(`${s.code}:${msg.token}`);
      att.memberId = s.members.find((m) => m.tokenHash === att.tokenHash)?.id ?? null;
      ws.serializeAttachment(att);
      if (this.reconcileHostAuthority(Date.now())) this.persist();
      else this.scheduleAlarm();
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
    /** Self, the host, or the Table Controller. */
    const requireControl = (targetId: string | undefined): string => {
      const m = requireMember();
      const id: string = targetId ?? m.id;
      if (id === m.id || s.hostId === m.id || (s.controllerId ?? s.hostId) === m.id) return id;
      return deny('FORBIDDEN', 'Only the host or Table Controller can manage another player');
    };

    if (s.endedAt && ![
      'claim', 'cancelClaim', 'resolveClaim', 'reviewSettlement', 'setTransferSettled', 'setMyTransfersSettled', 'finalizeSettlement',
    ].includes(msg.type)) {
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
        s.members.push(member);
        if (s.hostTokenHash === undefined && !s.hostId) {
          // Compatibility for rooms created before creator binding was introduced.
          s.hostId = member.id;
          s.controllerId ??= member.id;
        } else if (creatorJoining) {
          s.hostId = member.id;
          s.controllerId ??= member.id;
          s.hostTokenHash = null;
          s.hostAwaySince = null;
          s.hostTransfer = null;
          s.hostRecoveryDeclinedIds = [];
        }
        if (s.game.phase === 'lobby') {
          s.game = addPlayer(s.game, member.id, name);
          this.recordBuyIn(member.id, 'initial', s.game.settings.startingStack);
        } else {
          (s.lateArrivals ??= []).push({
            id: randomId(),
            playerId: member.id,
            amount: s.game.settings.startingStack,
            status: 'pending',
            mode: null,
            requestedAt: Date.now(),
          });
        }
        s.claims = s.claims.filter((c) => c.connId !== att.connId);
        for (const other of this.ctx.getWebSockets()) {
          const oa = other.deserializeAttachment() as Attachment;
          if (oa.tokenHash === att.tokenHash) {
            oa.memberId = member.id;
            other.serializeAttachment(oa);
          }
        }
        this.log('table', s.game.phase === 'lobby' ? `${name} joined` : `${name} requested a late seat`);
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
        this.recordBuyIn(member.id, 'initial', s.game.settings.startingStack);
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
        const target = s.members.find((x) => x.id === claim.playerId);
        const controllerId = s.controllerId ?? s.hostId;
        if (m.id !== claim.playerId && m.id !== s.hostId && m.id !== controllerId) {
          deny('FORBIDDEN', 'Only that player, the host, or the Table Controller can handle this request');
        }
        s.claims = s.claims.filter((c) => c.id !== claim.id);
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
        if (this.unconfirmedSeatIds().length > 0 && msg.allowUnconfirmed !== true) {
          deny('INVALID', 'Some players have not confirmed their seats');
        }
        this.mutate('Start the game', (g) => this.startPreparedHand(g), 'hand', true);
        return;
      }
      case 'next': {
        requireController();
        checkV(msg.v);
        if (s.paused) deny('PHASE', 'The hand is paused');
        if (s.game.phase !== 'done') deny('PHASE', 'The hand is not over');
        this.mutate('Deal the next hand', (g) => this.startPreparedHand(g), 'hand', true);
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
          s.settlement = this.newSettlementState();
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
      case 'reviewSettlement': {
        const member = requireMember();
        checkV(msg.v);
        const settlement = this.requireOpenSettlement();
        const review = {
          playerId: member.id,
          status: msg.status,
          reason: msg.status === 'issue' ? msg.reason!.trim() : null,
          reviewedAt: Date.now(),
        } as const;
        settlement.reviews = settlement.reviews.filter((item) => item.playerId !== member.id);
        settlement.reviews.push(review);
        s.v += 1;
        this.log('table', msg.status === 'correct'
          ? `${member.name} confirmed their settlement result`
          : `${member.name} reported a settlement issue: ${review.reason}`);
        this.commit();
        return;
      }
      case 'setTransferSettled': {
        const member = requireMember();
        checkV(msg.v);
        const settlement = this.requireOpenSettlement();
        const transfer = this.settlementTransfers()[msg.transferIndex] ?? deny('INVALID', 'Unknown settlement transfer');
        if (transfer.from !== member.id) deny('FORBIDDEN', 'Only the player who owes this transfer can update it');
        const current = new Set(settlement.settledTransfers);
        if (msg.settled) current.add(msg.transferIndex);
        else current.delete(msg.transferIndex);
        settlement.settledTransfers = [...current].sort((a, b) => a - b);
        s.v += 1;
        this.log('table', `${member.name} marked a settlement transfer ${msg.settled ? 'settled' : 'unsettled'}`);
        this.commit();
        return;
      }
      case 'setMyTransfersSettled': {
        const member = requireMember();
        checkV(msg.v);
        const settlement = this.requireOpenSettlement();
        const indexes = this.settlementTransfers().flatMap((transfer, index) => transfer.from === member.id ? [index] : []);
        if (indexes.length === 0) deny('INVALID', 'You have no outgoing settlement transfers');
        const current = new Set(settlement.settledTransfers);
        for (const index of indexes) {
          if (msg.settled) current.add(index);
          else current.delete(index);
        }
        settlement.settledTransfers = [...current].sort((a, b) => a - b);
        s.v += 1;
        this.log('table', `${member.name} marked ${indexes.length === 1 ? 'their transfer' : 'their transfers'} ${msg.settled ? 'settled' : 'unsettled'}`);
        this.commit();
        return;
      }
      case 'finalizeSettlement': {
        const host = requireHost();
        checkV(msg.v);
        const settlement = this.requireOpenSettlement();
        if (!settlement.reviews.some((review) => review.playerId === host.id)) deny('INVALID', 'Review your result before finalising');
        const hasIssues = settlement.reviews.some((review) => review.status === 'issue');
        if (hasIssues && !msg.withIssues) deny('INVALID', 'Resolve the reported issues or finalise with the issue marker');
        if (!hasIssues && msg.withIssues) deny('INVALID', 'There are no unresolved issues');
        settlement.finalizedAt = Date.now();
        settlement.finalizedWithIssues = hasIssues;
        s.settlementTokenHash = await sha256(`${s.code}:settlement:${msg.recordToken}`);
        s.v += 1;
        this.log('table', `${host.name} finalised the settlement${hasIssues ? ' with unresolved issues' : ''}`);
        this.commit();
        return;
      }
      case 'act': {
        if (s.paused) deny('PHASE', 'The hand is paused');
        const m = requireMember();
        checkV(msg.v);
        if (s.correctionForId && s.hostId !== m.id) deny('FORBIDDEN', 'The host is correcting the last action');
        const actorId = msg.playerId ?? m.id;
        if (actorId !== m.id) {
          const target = s.members.find((x) => x.id === actorId) ?? deny('INVALID', 'Unknown player');
          const correcting = s.hostId === m.id && s.correctionForId === actorId;
          const controlsTable = s.hostId === m.id || (s.controllerId ?? s.hostId) === m.id;
          if (!correcting && !controlsTable) deny('FORBIDDEN', 'Only the host or Table Controller can act for another player');
          if (!correcting && !this.isAway(target)) deny('FORBIDDEN', `${target.name} is still here`);
        }
        const before = s.game;
        const after = act(before, actorId, { kind: msg.kind, amount: msg.amount });
        const beforePlayer = findPlayer(before, actorId) ?? deny('INVALID', 'Unknown player');
        const afterPlayer = findPlayer(after, actorId) ?? deny('INVALID', 'Unknown player');
        const spent = beforePlayer.stack - afterPlayer.stack;
        if (spent < 0) deny('INVALID', 'Invalid chip movement');
        const text = this.describeAction(before, after, actorId);
        const suffix = actorId !== m.id ? ` (by ${m.name})` : '';
        s.correctionForId = null;
        this.mutate(text + suffix, () => after, 'action', false, undefined, { playerId: actorId, amount: spent, chips: msg.chips });
        return;
      }
      case 'changeChip': {
        const m = requireMember();
        checkV(msg.v);
        const playerId = msg.playerId ?? m.id;
        if (playerId !== m.id) {
          const target = s.members.find((candidate) => candidate.id === playerId) ?? deny('INVALID', 'Unknown player');
          const controlsTable = s.hostId === m.id || (s.controllerId ?? s.hostId) === m.id;
          if (!controlsTable || (!target.manual && !this.isAway(target) && s.correctionForId !== playerId)) {
            deny('FORBIDDEN', 'You cannot change this player’s chips');
          }
        }
        const player = findPlayer(s.game, playerId) ?? deny('INVALID', 'Unknown player');
        const changed = breakChipInto(this.inventoryFor(playerId, player.stack), msg.value, msg.into);
        if (!changed) return deny('INVALID', 'Choose smaller chips whose total exactly matches the chip being broken');
        (s.chipInventories ??= {})[playerId] = changed;
        s.v += 1;
        this.commit();
        return;
      }
      case 'award': {
        if (s.paused) deny('PHASE', 'The hand is paused');
        const controller = requireController();
        checkV(msg.v);
        if (s.awardProposal) deny('INVALID', 'An award is already under review');
        const potIds = this.currentAwardPotIds();
        awardPots(s.game, msg.winners, potIds);
        s.awardProposal = {
          winners: structuredClone(msg.winners),
          potIds,
          proposedBy: controller.id,
          proposedAt: Date.now(),
          disputedBy: null,
        };
        s.overrideProposal = null;
        s.v += 1;
        this.log('win', `${controller.name} proposed the award`);
        this.commit();
        return;
      }
      case 'confirmAward': {
        const controller = requireController();
        checkV(msg.v);
        const proposal = s.awardProposal ?? deny('PHASE', 'There is no award to confirm');
        if (proposal.disputedBy) deny('INVALID', 'Resolve the dispute before confirming');
        this.applyAward(proposal.winners, proposal.potIds, `${controller.name} confirmed the award`);
        return;
      }
      case 'disputeAward': {
        const member = requireMember();
        checkV(msg.v);
        const proposal = s.awardProposal ?? deny('PHASE', 'There is no award to dispute');
        if (proposal.disputedBy) deny('INVALID', 'This award is already disputed');
        proposal.disputedBy = member.id;
        s.v += 1;
        this.log('table', `${member.name} disputed the proposed award`);
        this.commit();
        return;
      }
      case 'cancelAward': {
        const member = requireMember();
        checkV(msg.v);
        if (member.id !== s.hostId && member.id !== (s.controllerId ?? s.hostId)) deny('FORBIDDEN', 'Only the host or Table Controller can revise the award');
        if (!s.awardProposal) deny('PHASE', 'There is no award to revise');
        s.awardProposal = null;
        s.overrideProposal = null;
        s.v += 1;
        this.log('table', `${member.name} returned the award to winner selection`);
        this.commit();
        return;
      }
      case 'proposeOverride': {
        const host = requireHost();
        checkV(msg.v);
        const awardProposal = s.awardProposal ?? deny('PHASE', 'There is no disputed award');
        if (!awardProposal.disputedBy) deny('INVALID', 'A table override is available only after a dispute');
        overridePots(s.game, awardProposal.potIds, msg.allocations);
        const total = awardProposal.potIds.reduce((sum, id) => sum + (s.game.pots.find((pot) => pot.id === id)?.amount ?? 0), 0);
        s.overrideProposal = {
          reason: msg.reason.trim(),
          allocations: structuredClone(msg.allocations),
          approvals: [host.id],
          proposedBy: host.id,
          proposedAt: Date.now(),
          total,
        };
        s.v += 1;
        this.log('table', `${host.name} proposed a table override: ${msg.reason.trim()}`);
        this.commit();
        return;
      }
      case 'approveOverride': {
        const member = requireMember();
        checkV(msg.v);
        const proposal = s.overrideProposal ?? deny('PHASE', 'There is no override to approve');
        if (proposal.approvals.includes(member.id)) deny('INVALID', 'You already approved this override');
        proposal.approvals.push(member.id);
        s.v += 1;
        this.log('table', `${member.name} approved the table override`);
        this.commit();
        return;
      }
      case 'cancelOverride': {
        const host = requireHost();
        checkV(msg.v);
        if (!s.overrideProposal) deny('PHASE', 'There is no override to cancel');
        s.overrideProposal = null;
        s.v += 1;
        this.log('table', `${host.name} cancelled the table override`);
        this.commit();
        return;
      }
      case 'confirmOverride': {
        const host = requireHost();
        checkV(msg.v);
        const proposal = s.overrideProposal ?? deny('PHASE', 'There is no override to confirm');
        const controllerId = s.controllerId ?? s.hostId ?? deny('INVALID', 'There is no Table Controller');
        const connectedApprovals = proposal.approvals.filter((id) =>
          s.members.some((member) => member.id === id) && this.presence(id).connections > 0,
        );
        if (!connectedApprovals.includes(controllerId)) deny('INVALID', 'The Table Controller must approve');
        if (!connectedApprovals.some((id) => id !== controllerId)) deny('INVALID', 'One other connected player must approve');
        const potIds = s.awardProposal?.potIds ?? deny('PHASE', 'The disputed award is missing');
        this.applyOverride(proposal.allocations, potIds, `${host.name} confirmed the table override — not rules-validated`);
        return;
      }
      case 'chooseRunouts': {
        const host = requireHost();
        checkV(msg.v);
        if (s.runoutPlan) deny('INVALID', 'The runout count is already set');
        if (s.game.phase !== 'showdown' || !s.game.runout) deny('PHASE', 'Multiple runouts are not available');
        const maximum = physicalRunoutLimit(s.game);
        if (msg.count > maximum) deny('INVALID', `This hand supports at most ${maximum} runouts`);
        if (msg.count > 1 && !msg.agreed) deny('INVALID', 'Confirm that the players agreed');
        const split = splitPotsForRunouts(s.game, msg.count);
        s.game = split.game;
        s.runoutPlan = {
          count: msg.count,
          current: 0,
          phase: 'dealing',
          fromStreet: s.game.street,
          potIds: split.boards[0] ?? [],
          boards: split.boards,
        };
        s.v += 1;
        this.log('hand', `${host.name} chose ${msg.count} runout${msg.count === 1 ? '' : 's'}`);
        this.commit();
        return;
      }
      case 'completeRunout': {
        const controller = requireController();
        checkV(msg.v);
        const plan = s.runoutPlan ?? deny('PHASE', 'The host has not chosen the runout count');
        if (plan.phase !== 'dealing') deny('PHASE', 'This runout is already complete');
        plan.phase = 'awarding';
        s.v += 1;
        this.log('hand', `${controller.name} completed runout ${plan.current + 1} of ${plan.count}`);
        this.commit();
        return;
      }
      case 'undo': {
        const m = requireHost();
        checkV(msg.v);
        const snap = this.undo.pop() ?? deny('INVALID', 'Nothing to undo');
        if (snap.members && snap.restoreMemberIds?.length) {
          const restoredIds = new Set(snap.restoreMemberIds);
          const restored = snap.members.filter(
            (member) => restoredIds.has(member.id) && !s.members.some((current) => current.id === member.id),
          );
          s.members.push(...structuredClone(restored));
          if (restored.length > 0 && snap.controllerId !== undefined) s.controllerId = snap.controllerId;
        }
        if (snap.leaveRequests) s.leaveRequests = structuredClone(snap.leaveRequests);
        if (snap.lateArrivals) s.lateArrivals = structuredClone(snap.lateArrivals);
        if (snap.buyInEvents) s.buyInEvents = structuredClone(snap.buyInEvents);
        if (snap.handStart !== undefined) s.handStart = snap.handStart ? structuredClone(snap.handStart) : null;
        if (snap.chipInventories) s.chipInventories = structuredClone(snap.chipInventories);
        s.game = this.reconcile(snap.game);
        if (snap.rebuyRequests) s.rebuyRequests = structuredClone(snap.rebuyRequests);
        if (snap.breaks) s.breaks = structuredClone(snap.breaks);
        s.correctionForId = msg.mode === 'correct' ? snap.game.toActId : null;
        s.runoutPlan = snap.runoutPlan ? structuredClone(snap.runoutPlan) : null;
        s.awardProposal = snap.awardProposal ? structuredClone(snap.awardProposal) : null;
        s.overrideProposal = snap.overrideProposal ? structuredClone(snap.overrideProposal) : null;
        s.v += 1;
        this.log('undo', `${m.name} undid: ${snap.label}`);
        this.commit();
        return;
      }
      case 'pauseHand': {
        const host = requireHost();
        checkV(msg.v);
        if (!handInProgress(s.game)) deny('PHASE', 'There is no live hand to pause');
        s.paused = true;
        s.v += 1;
        this.log('table', `${host.name} paused the hand`);
        this.commit();
        return;
      }
      case 'resumeHand': {
        const host = requireHost();
        checkV(msg.v);
        if (!s.paused) deny('PHASE', 'The hand is not paused');
        if (s.voidProposal) deny('PHASE', 'Cancel the void preview first');
        s.paused = false;
        s.v += 1;
        this.log('table', `${host.name} resumed the hand`);
        this.commit();
        return;
      }
      case 'previewVoid': {
        const host = requireHost();
        checkV(msg.v);
        if (!s.handStart || s.game.handNo === 0) deny('PHASE', 'There is no hand to void');
        s.paused = true;
        s.voidProposal = {
          reason: msg.reason.trim(),
          advanceButton: msg.advanceButton,
          returnAmount: potTotal(s.game),
          proposedAt: Date.now(),
        };
        s.v += 1;
        this.log('table', `${host.name} proposed voiding Hand ${s.game.handNo}: ${msg.reason.trim()}`);
        this.commit();
        return;
      }
      case 'cancelVoid': {
        const host = requireHost();
        checkV(msg.v);
        if (!s.voidProposal) deny('PHASE', 'There is no void preview');
        s.voidProposal = null;
        s.v += 1;
        this.log('table', `${host.name} cancelled the void preview`);
        this.commit();
        return;
      }
      case 'confirmVoid': {
        const host = requireHost();
        checkV(msg.v);
        const proposal = s.voidProposal ?? deny('PHASE', 'Preview the void first');
        const current = s.game;
        let restored = structuredClone(s.handStart ?? deny('PHASE', 'There is no hand to void'));
        if (proposal.advanceButton) {
          restored.lastBbId = current.bbId;
          restored.lastBbSeat = findPlayer(current, current.bbId)?.seat ?? current.lastBbSeat;
        }
        restored = this.reconcileVoid(restored, current);
        s.game = restored;
        s.handStart = null;
        s.paused = false;
        s.voidProposal = null;
        s.correctionForId = null;
        s.runoutPlan = null;
        s.awardProposal = null;
        s.overrideProposal = null;
        this.undo = [];
        s.v += 1;
        this.log('table', `${host.name} voided Hand ${current.handNo}: ${proposal.reason}`);
        this.commit();
        return;
      }
      case 'takeBreak': {
        const id = requireControl(msg.playerId);
        if ((s.breaks ?? []).some((item) => item.playerId === id)) deny('INVALID', 'That break is already scheduled');
        const player = findPlayer(s.game, id) ?? deny('INVALID', 'Unknown player');
        const scheduled = handInProgress(s.game) && player.inHand;
        s.game = setSittingOut(s.game, id, true);
        (s.breaks ??= []).push({
          playerId: id,
          status: scheduled ? 'scheduled' : 'away',
          missedBlinds: false,
          startedAt: Date.now(),
        });
        s.v += 1;
        this.log('table', `${nameOf(id)} ${scheduled ? 'will take a break after this hand' : 'is on a break'}`);
        this.commit();
        return;
      }
      case 'returnFromBreak': {
        const id = requireControl(msg.playerId);
        const record = (s.breaks ?? []).find((item) => item.playerId === id) ?? deny('INVALID', 'That player is not on a break');
        if (record.status === 'scheduled') {
          s.game = setSittingOut(s.game, id, false);
          s.breaks = (s.breaks ?? []).filter((item) => item.playerId !== id);
          s.v += 1;
          this.log('table', `${nameOf(id)} cancelled the break`);
          this.commit();
          return;
        }
        if (record.missedBlinds && msg.mode === 'now') deny('INVALID', 'Choose how to handle the missed blinds');
        if (msg.mode === 'wait') {
          record.status = 'waiting';
          s.v += 1;
          this.log('table', `${nameOf(id)} will return on the big blind`);
          this.commit();
          return;
        }
        s.game = record.missedBlinds
          ? returnWithPost(s.game, id, s.game.settings.sb, s.game.settings.bb)
          : setSittingOut(s.game, id, false);
        s.breaks = (s.breaks ?? []).filter((item) => item.playerId !== id);
        s.v += 1;
        this.log('table', record.missedBlinds
          ? `${nameOf(id)} will post ${fmt(s.game.settings.sb + s.game.settings.bb)} and return`
          : `${nameOf(id)} is back`);
        this.commit();
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
          this.log('table', `${host.name} approved ${nameOf(request.playerId)}'s rebuy for after this hand`);
        } else {
          this.applyApprovedRebuys();
        }
        this.commit();
        return;
      }
      case 'cancelLateArrival': {
        const m = requireMember();
        const request = (s.lateArrivals ?? []).find((item) => item.playerId === m.id) ??
          deny('INVALID', 'No late-arrival request to cancel');
        if (request.status === 'ready') deny('PHASE', 'You are already joining the next hand');
        this.removeMember(m, 'left');
        return;
      }
      case 'resolveLateArrival': {
        const host = requireHost();
        checkV(msg.v);
        const request = (s.lateArrivals ?? []).find((item) => item.id === msg.requestId) ??
          deny('INVALID', 'Request already handled');
        if (request.status !== 'pending') deny('INVALID', 'Request already handled');
        const target = s.members.find((item) => item.id === request.playerId) ?? deny('INVALID', 'Player left');
        if (!msg.allow) {
          this.removeMember(target, 'left');
          return;
        }
        const amount = msg.amount as number;
        if (amount < s.game.settings.bb) deny('INVALID', 'Starting balance must cover the big blind');
        let game = addPlayer(s.game, target.id, target.name);
        game = setStack(game, target.id, amount);
        game = setSittingOut(game, target.id, true);
        request.amount = amount;
        if (msg.noEntryBlind) {
          game = setSittingOut(game, target.id, false);
          request.status = 'ready';
          request.mode = 'free';
          this.log('table', `${host.name} approved ${target.name} with no entry blind`);
        } else {
          request.status = 'choosing';
          this.log('table', `${host.name} approved ${target.name} to join`);
        }
        s.game = game;
        this.recordBuyIn(target.id, 'initial', amount);
        s.v += 1;
        this.commit();
        return;
      }
      case 'chooseLateArrival': {
        const m = requireMember();
        const request = (s.lateArrivals ?? []).find((item) => item.playerId === m.id) ??
          deny('INVALID', 'No late-arrival request');
        if (request.status !== 'choosing') deny('PHASE', 'Entry timing is already set');
        request.mode = msg.mode;
        if (msg.mode === 'post') {
          s.game = returnWithPost(s.game, m.id, 0, s.game.settings.bb);
          request.status = 'ready';
          this.log('table', `${m.name} will post ${fmt(s.game.settings.bb)} and join next hand`);
        } else {
          request.status = 'waiting';
          this.log('table', `${m.name} will wait for the big blind`);
        }
        s.v += 1;
        this.commit();
        return;
      }
      case 'requestLeave': {
        const m = requireMember();
        if (s.hostId === m.id) deny('FORBIDDEN', 'Transfer hosting before leaving');
        if ((s.leaveRequests ?? []).some((request) => request.playerId === m.id)) {
          deny('INVALID', 'Your leave request is already scheduled');
        }
        const player = findPlayer(s.game, m.id) ?? deny('INVALID', 'Unknown player');
        const live = handInProgress(s.game) && player.inHand;
        if (!live) {
          this.removeMember(m, 'left');
          return;
        }
        const before = s.game;
        const membersBefore = structuredClone(s.members);
        const controllerBefore = s.controllerId;
        const rebuyRequestsBefore = structuredClone(s.rebuyRequests ?? []);
        const breaksBefore = structuredClone(s.breaks ?? []);
        const leaveRequestsBefore = structuredClone(s.leaveRequests ?? []);
        s.rebuyRequests = (s.rebuyRequests ?? []).filter((request) => request.playerId !== m.id);
        s.breaks = (s.breaks ?? []).filter((record) => record.playerId !== m.id);
        (s.leaveRequests ??= []).push({ playerId: m.id, mode: msg.mode, requestedAt: Date.now() });
        if (s.controllerId === m.id) s.controllerId = s.hostId;
        this.undo.push({
          label: msg.mode === 'now' ? `${m.name} leaves now` : `${m.name} leaves after this hand`,
          game: before,
          members: membersBefore,
          restoreMemberIds: [m.id],
          controllerId: controllerBefore,
          rebuyRequests: rebuyRequestsBefore,
          breaks: breaksBefore,
          leaveRequests: leaveRequestsBefore,
        });
        if (this.undo.length > UNDO_DEPTH) this.undo.shift();
        this.log('table', msg.mode === 'now' ? `${m.name} will fold when action reaches them` : `${m.name} will leave after this hand`);
        this.applyImmediateLeaves();
        this.finishScheduledLeaves(before, s.game);
        s.v += 1;
        this.commit();
        return;
      }
      case 'cancelLeave': {
        const m = requireMember();
        const request = (s.leaveRequests ?? []).find((item) => item.playerId === m.id) ??
          deny('INVALID', 'No leave request to cancel');
        if (request.mode !== 'afterHand') deny('INVALID', 'That departure cannot be cancelled');
        s.leaveRequests = (s.leaveRequests ?? []).filter((item) => item.playerId !== m.id);
        s.v += 1;
        this.log('table', `${m.name} is staying in the game`);
        this.commit();
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
        const player = findPlayer(s.game, msg.playerId) ?? deny('INVALID', 'Unknown player');
        const delta = msg.stack - player.stack;
        this.mutate(
          `${nameOf(msg.playerId)}'s balance was corrected`,
          (g) => setStack(g, msg.playerId, msg.stack),
          'table',
          false,
          () => {
            if (delta === 0) return;
            const initial = (s.buyInEvents ?? []).find((entry) => entry.playerId === msg.playerId && entry.kind === 'initial');
            if (s.game.handNo === 0 && initial) initial.amount += delta;
            else this.recordBuyIn(msg.playerId, 'adjustment', delta);
          },
        );
        return;
      }
      case 'seatOrder': {
        requireHost();
        checkV(msg.v);
        this.mutate('Seats rearranged', (g) => setSeatOrder(g, msg.ids), 'table');
        return;
      }
      case 'setDealerButton': {
        requireHost();
        checkV(msg.v);
        if (s.game.phase !== 'lobby') deny('PHASE', 'Choose the first dealer before play starts');
        s.game = setInitialButton(s.game, msg.playerId);
        s.v += 1;
        this.commit();
        return;
      }
      case 'confirmSeat': {
        const member = requireMember();
        checkV(msg.v);
        if (s.game.phase !== 'lobby') deny('PHASE', 'Seats are already locked');
        const neighbours = this.seatNeighbours(member.id) ?? deny('INVALID', 'Wait for another player to join');
        const confirmation: StoredSeatConfirmation = {
          playerId: member.id,
          status: msg.matches ? 'confirmed' : 'issue',
          confirmedAt: Date.now(),
          ...neighbours,
        };
        s.seatConfirmations = [...(s.seatConfirmations ?? []).filter((item) => item.playerId !== member.id), confirmation];
        s.v += 1;
        this.commit();
        return;
      }
      case 'transferHost': {
        const host = requireHost();
        const target = s.members.find((x) => x.id === msg.playerId) ?? deny('INVALID', 'Unknown player');
        if (target.id === host.id) deny('INVALID', 'You are already the host');
        if (target.manual) deny('INVALID', 'That seat has no phone');
        if (!findPlayer(s.game, target.id)) deny('PHASE', 'That player is still waiting for a seat');
        if (!this.hostCandidate(target)) deny('INVALID', `${target.name} is not available to host`);
        const now = Date.now();
        s.hostTransfer = { kind: 'planned', fromId: host.id, targetId: target.id, requestedAt: now, expiresAt: now + HOST_TRANSFER_RESPONSE_MS };
        s.v += 1;
        this.commit();
        return;
      }
      case 'cancelHostTransfer': {
        requireHost();
        if (s.hostTransfer?.kind !== 'planned') deny('INVALID', 'There is no transfer request to cancel');
        s.hostTransfer = null;
        s.v += 1;
        this.commit();
        return;
      }
      case 'respondHostTransfer': {
        const member = requireMember();
        const transfer = s.hostTransfer ?? deny('INVALID', 'That hosting request is no longer available');
        if (transfer.targetId !== member.id) deny('FORBIDDEN', 'That hosting request is for another player');
        if (Date.now() >= transfer.expiresAt) {
          this.expireHostTransfer(transfer);
          this.commit();
          deny('INVALID', 'That hosting request expired');
        }
        if (!msg.allow) {
          this.declineHostTransfer(transfer, member.id);
          s.v += 1;
          this.commit();
          return;
        }
        this.acceptHostTransfer(member, transfer);
        this.commit();
        return;
      }
      case 'setBackupHost': {
        const host = requireHost();
        if (msg.playerId === undefined) {
          s.backupHostId = null;
        } else {
          const target = s.members.find((x) => x.id === msg.playerId) ?? deny('INVALID', 'Unknown player');
          if (target.id === host.id) deny('INVALID', 'Choose another player');
          if (!this.hostCandidate(target)) deny('INVALID', 'Choose an active player with a connected phone');
          s.backupHostId = target.id;
        }
        s.v += 1;
        this.commit();
        return;
      }
      case 'transferController': {
        const host = requireHost();
        const target = s.members.find((x) => x.id === msg.playerId) ?? deny('INVALID', 'Unknown player');
        if (target.manual) deny('INVALID', 'That seat has no phone');
        if (!findPlayer(s.game, target.id)) deny('PHASE', 'That player is still waiting for a seat');
        s.controllerId = target.id;
        this.log('table', `${host.name} made ${target.name} the Table Controller`);
        this.commit();
        return;
      }
      case 'takeHost': {
        const m = requireMember();
        const transfer = s.hostTransfer ?? deny('FORBIDDEN', 'Wait until the table nominates you');
        if (transfer.kind !== 'recovery' || transfer.targetId !== m.id) {
          deny('FORBIDDEN', 'Wait until the table nominates you');
        }
        this.acceptHostTransfer(m, transfer);
        this.commit();
        return;
      }
    }
  }

  // ---------- state changes ----------

  private newSettlementState(): SettlementStateView {
    const s = this.s as Stored;
    return {
      reviews: [],
      entries: structuredClone(s.buyInEvents ?? []),
      settledTransfers: [],
      finalizedAt: null,
      finalizedWithIssues: false,
    };
  }

  private recordBuyIn(playerId: string, kind: SettlementEntryView['kind'], amount: number) {
    const s = this.s as Stored;
    (s.buyInEvents ??= []).push({ id: randomId(), playerId, kind, amount, at: Date.now() });
  }

  private requireOpenSettlement() {
    const s = this.s as Stored;
    if (!s.endedAt) deny('PHASE', 'End the game before settlement');
    const settlement = (s.settlement ??= this.newSettlementState());
    if (settlement.finalizedAt) deny('PHASE', 'The settlement record is final');
    return settlement;
  }

  private settlementTransfers() {
    const s = this.s as Stored;
    const rows = ledger(s.game);
    const cents = netsInCents(rows, s.game.settings.buyInPrice, s.game.settings.startingStack);
    const useCash = s.game.settings.buyInPrice > 0;
    return settleUp(rows.map((row) => ({ id: row.id, net: useCash ? (cents.get(row.id) ?? 0) : row.net })));
  }

  private currentAwardPotIds() {
    const s = this.s as Stored;
    if (!s.game.runout) return s.game.pots.filter((pot) => !pot.paid).map((pot) => pot.id);
    const plan = s.runoutPlan ?? deny('PHASE', 'The host must choose the runout count first');
    if (plan.phase !== 'awarding') deny('PHASE', 'Complete this physical runout first');
    return [...(plan.boards[plan.current] ?? deny('INVALID', 'Runout state is invalid'))];
  }

  private finishAwardState() {
    const s = this.s as Stored;
    s.awardProposal = null;
    s.overrideProposal = null;
    const plan = s.runoutPlan;
    if (!plan) return;
    if (plan.current === plan.count - 1) s.runoutPlan = null;
    else {
      plan.current += 1;
      plan.phase = 'dealing';
      plan.potIds = plan.boards[plan.current] ?? [];
    }
  }

  private applyAward(winners: Record<string, string[]>, potIds: number[], label: string) {
    this.mutate(label, (game) => awardPots(game, winners, potIds), 'win', false, () => this.finishAwardState());
  }

  private applyOverride(allocations: Record<string, number>, potIds: number[], label: string) {
    this.mutate(label, (game) => overridePots(game, potIds, allocations), 'win', false, () => this.finishAwardState());
  }

  private mutate(
    label: string,
    fn: (g: Game) => Game,
    kind: LogKind = 'hand',
    startsHand = false,
    afterGame?: () => void,
    chipSpend?: { playerId: string; amount: number; chips?: ChipCount[] },
  ) {
    const s = this.s as Stored;
    const before = s.game;
    const rebuyRequestsBefore = structuredClone(s.rebuyRequests ?? []);
    const breaksBefore = structuredClone(s.breaks ?? []);
    const leaveRequestsBefore = structuredClone(s.leaveRequests ?? []);
    const lateArrivalsBefore = structuredClone(s.lateArrivals ?? []);
    const buyInEventsBefore = structuredClone(s.buyInEvents ?? []);
    const membersBefore = structuredClone(s.members);
    const controllerBefore = s.controllerId;
    const handStartBefore = s.handStart ? structuredClone(s.handStart) : null;
    const after = fn(before);
    this.undo.push({
      label,
      game: before,
      members: membersBefore,
      restoreMemberIds: leaveRequestsBefore.map((request) => request.playerId),
      controllerId: controllerBefore,
      rebuyRequests: rebuyRequestsBefore,
      breaks: breaksBefore,
      leaveRequests: leaveRequestsBefore,
      lateArrivals: lateArrivalsBefore,
      buyInEvents: buyInEventsBefore,
      handStart: handStartBefore,
      runoutPlan: s.runoutPlan ? structuredClone(s.runoutPlan) : null,
      awardProposal: s.awardProposal ? structuredClone(s.awardProposal) : null,
      overrideProposal: s.overrideProposal ? structuredClone(s.overrideProposal) : null,
      chipInventories: structuredClone(s.chipInventories ?? {}),
    });
    if (this.undo.length > UNDO_DEPTH) this.undo.shift();
    s.game = after;
    if (chipSpend && chipSpend.amount > 0) this.spendInventory(chipSpend.playerId, chipSpend.amount, chipSpend.chips);
    afterGame?.();
    if (startsHand) s.handStart = structuredClone(before);
    s.v += 1;
    this.logTransition(before, after, label, kind);
    this.updateBreaks(before, after);
    this.applyImmediateLeaves();
    this.finishScheduledLeaves(before, s.game);
    this.applyApprovedRebuys();
    this.finishIfScheduled(s.game);
    this.commit();
  }

  private reconcileVoid(base: Game, current: Game) {
    const s = this.s as Stored;
    let restored = base;
    for (const player of [...restored.players]) {
      if (!s.members.some((member) => member.id === player.id)) restored = removePlayer(restored, player.id);
    }
    for (const member of s.members) {
      if (findPlayer(restored, member.id)) continue;
      if ((s.lateArrivals ?? []).some((entry) => entry.playerId === member.id && entry.status === 'pending')) continue;
      const existing = findPlayer(current, member.id);
      restored = addPlayer(restored, member.id, member.name);
      if (existing) {
        restored = setStack(restored, member.id, existing.stack + existing.committed);
        restored = setSittingOut(restored, member.id, existing.sittingOut);
        if (existing.entryDead || existing.entryLive) {
          restored = returnWithPost(restored, member.id, existing.entryDead, existing.entryLive);
        }
      }
    }
    return restored;
  }

  private applyImmediateLeaves() {
    const s = this.s as Stored;
    while (s.game.phase === 'betting' && s.game.toActId) {
      const request = (s.leaveRequests ?? []).find(
        (item) => item.mode === 'now' && item.playerId === s.game.toActId,
      );
      if (!request) break;
      const before = s.game;
      const name = this.playerName(request.playerId);
      s.game = act(s.game, request.playerId, { kind: 'fold' });
      this.logTransition(before, s.game, `${name} folds and leaves`, 'action');
    }
    if (s.game.phase !== 'showdown') return;
    for (const request of (s.leaveRequests ?? []).filter((item) => item.mode === 'now')) {
      if (findPlayer(s.game, request.playerId)) s.game = removePlayer(s.game, request.playerId);
    }
  }

  private finishScheduledLeaves(before: Game, after: Game) {
    const s = this.s as Stored;
    if (after.phase !== 'done' || before.phase === 'done') return;
    const scheduled = [...(s.leaveRequests ?? [])];
    for (const request of scheduled) {
      const member = s.members.find((item) => item.id === request.playerId);
      const player = findPlayer(s.game, request.playerId) ?? s.game.departed.find((item) => item.id === request.playerId);
      if (!member || !player) continue;
      if (findPlayer(s.game, request.playerId)) s.game = removePlayer(s.game, request.playerId);
      this.detachMember(member, false);
      this.log('table', `${member.name} left the table`);
    }
    if (scheduled.length > 0) s.leaveRequests = [];
  }

  private finishIfScheduled(game: Game) {
    const s = this.s as Stored;
    if (!s.endingAfterHand || game.phase !== 'done') return;
    s.endingAfterHand = false;
    s.endedAt = Date.now();
    s.settlement = this.newSettlementState();
    this.undo = [];
    this.log('table', 'The game ended after the final hand');
  }

  private applyApprovedRebuys() {
    const s = this.s as Stored;
    if (handInProgress(s.game)) return;
    const approved = (s.rebuyRequests ?? []).filter((r) => r.status === 'approved');
    for (const request of approved) {
      s.game = addBuyIn(s.game, request.playerId, request.amount);
      this.recordBuyIn(request.playerId, 'rebuy', request.amount);
      this.log('table', `${this.playerName(request.playerId)} added a rebuy`);
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

  private startPreparedHand(game: Game) {
    const s = this.s as Stored;
    let prepared = game;
    if (game.lastBbSeat !== null) {
      const seats = bySeat(game);
      const rotated = [...seats.filter((p) => p.seat > game.lastBbSeat!), ...seats.filter((p) => p.seat <= game.lastBbSeat!)];
      const next = rotated.find((p) =>
        eligibleForHand(p) ||
        (s.breaks ?? []).some((b) => b.playerId === p.id && b.status === 'waiting') ||
        (s.lateArrivals ?? []).some((entry) => entry.playerId === p.id && entry.status === 'waiting'),
      );
      const waiting = next && (s.breaks ?? []).find((b) => b.playerId === next.id && b.status === 'waiting');
      const lateWaiting = next && (s.lateArrivals ?? []).find((entry) => entry.playerId === next.id && entry.status === 'waiting');
      if (waiting && next) {
        prepared = setSittingOut(prepared, next.id, false);
        s.breaks = (s.breaks ?? []).filter((b) => b.playerId !== next.id);
        this.log('table', `${next.name} returned on the big blind`);
      } else if (lateWaiting && next) {
        prepared = setSittingOut(prepared, next.id, false);
        s.lateArrivals = (s.lateArrivals ?? []).filter((entry) => entry.id !== lateWaiting.id);
        this.log('table', `${next.name} joined on the big blind`);
      }
    }
    const started = startHand(prepared);
    const ready = new Set((s.lateArrivals ?? []).filter((entry) => entry.status === 'ready').map((entry) => entry.id));
    if (ready.size > 0) s.lateArrivals = (s.lateArrivals ?? []).filter((entry) => !ready.has(entry.id));
    return started;
  }

  private updateBreaks(before: Game, after: Game) {
    const s = this.s as Stored;
    if (after.phase === 'done' && before.phase !== 'done') {
      for (const record of s.breaks ?? []) if (record.status === 'scheduled') record.status = 'away';
    }
    if (after.handNo === before.handNo || before.lastBbSeat === null || after.bbId === null) return;
    const bb = findPlayer(after, after.bbId);
    if (!bb) return;
    const seats = bySeat(after);
    const passed = [...seats.filter((p) => p.seat > before.lastBbSeat!), ...seats.filter((p) => p.seat <= before.lastBbSeat!)];
    for (const player of passed) {
      if (player.id === bb.id) break;
      const record = (s.breaks ?? []).find((item) => item.playerId === player.id && item.status === 'away');
      if (record) record.missedBlinds = true;
    }
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
      const pendingArrival = (s.lateArrivals ?? []).some((entry) => entry.playerId === m.id && entry.status === 'pending');
      if (!findPlayer(g, m.id) && !pendingArrival) {
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
    const membersBefore = structuredClone(s.members);
    const controllerBefore = s.controllerId;
    const rebuyRequestsBefore = structuredClone(s.rebuyRequests ?? []);
    const breaksBefore = structuredClone(s.breaks ?? []);
    const leaveRequestsBefore = structuredClone(s.leaveRequests ?? []);
    const lateArrivalsBefore = structuredClone(s.lateArrivals ?? []);
    const after = findPlayer(before, target.id) ? removePlayer(before, target.id) : before;
    this.detachMember(target, how === 'kicked');
    if (s.hostId === target.id) {
      s.hostId = (s.members.find((m) => !m.manual && !this.isAway(m)) ?? s.members.find((m) => !m.manual))?.id ?? null;
    }
    if (s.controllerId === target.id) {
      s.controllerId = s.hostId ?? s.members.find((m) => !m.manual)?.id ?? null;
    }
    this.undo.push({
      label: `${target.name} ${how}`,
      game: before,
      members: membersBefore,
      controllerId: controllerBefore,
      rebuyRequests: rebuyRequestsBefore,
      breaks: breaksBefore,
      leaveRequests: leaveRequestsBefore,
      lateArrivals: lateArrivalsBefore,
    });
    if (this.undo.length > UNDO_DEPTH) this.undo.shift();
    s.game = after;
    s.v += 1;
    this.log('table', how === 'left' ? `${target.name} left` : `${target.name} was removed`);
    this.logTransition(before, after, '', 'hand');
    this.finishIfScheduled(after);
    this.commit();
  }

  private detachMember(target: Member, closeSocket: boolean) {
    const s = this.s as Stored;
    s.members = s.members.filter((m) => m.id !== target.id);
    s.claims = s.claims.filter((c) => c.playerId !== target.id);
    s.rebuyRequests = (s.rebuyRequests ?? []).filter((r) => r.playerId !== target.id);
    s.breaks = (s.breaks ?? []).filter((r) => r.playerId !== target.id);
    s.leaveRequests = (s.leaveRequests ?? []).filter((r) => r.playerId !== target.id);
    s.lateArrivals = (s.lateArrivals ?? []).filter((r) => r.playerId !== target.id);
    s.seatConfirmations = (s.seatConfirmations ?? []).filter((confirmation) => confirmation.playerId !== target.id);
    if (s.backupHostId === target.id) s.backupHostId = null;
    if (s.hostTransfer?.targetId === target.id) s.hostTransfer = null;
    if (s.controllerId === target.id) s.controllerId = s.hostId;
    if (!closeSocket) return;
    for (const ws of this.ctx.getWebSockets()) {
      const oa = ws.deserializeAttachment() as Attachment;
      if (oa.memberId !== target.id) continue;
      oa.memberId = null;
      ws.serializeAttachment(oa);
      this.send(ws, { type: 'closed', reason: 'kicked' });
      ws.close(4002, 'Removed by host');
    }
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

  private inventoryFor(playerId: string, stack: number) {
    const s = this.s as Stored;
    this.ensureChipInventoryVersion();
    const inventory = reconcileInventory(s.chipInventories?.[playerId], stack);
    (s.chipInventories ??= {})[playerId] = inventory;
    return inventory;
  }

  private spendInventory(playerId: string, amount: number, requested?: ChipCount[]) {
    const s = this.s as Stored;
    const player = findPlayer(s.game, playerId) ?? deny('INVALID', 'Unknown player');
    const beforeStack = player.stack + amount;
    const inventory = this.inventoryFor(playerId, beforeStack);
    if (requested) {
      const chips = normalizeInventory(requested);
      if (inventoryTotal(chips) !== amount) deny('INVALID', 'Placed chips do not match the wager');
      const canSubtract = inventory.every((row) => (chips.find((chip) => chip.value === row.value)?.count ?? 0) <= row.count);
      if (!canSubtract) {
        const automatic = takeExact(inventory, amount) ?? deny('INVALID', 'The wager cannot be composed from this rack');
        const same = automatic.taken.every((row) => row.count === (chips.find((chip) => chip.value === row.value)?.count ?? 0));
        if (!same) deny('INVALID', 'A placed chip is no longer available');
        s.chipInventories![playerId] = automatic.remaining;
        return;
      }
      const next = inventory.map((row) => {
        const used = chips.find((chip) => chip.value === row.value)?.count ?? 0;
        return { ...row, count: row.count - used };
      });
      s.chipInventories![playerId] = next;
      return;
    }
    const result = takeExact(inventory, amount) ?? deny('INVALID', 'The wager cannot be composed from this rack');
    s.chipInventories![playerId] = result.remaining;
  }

  private reconcileChipInventories() {
    const s = this.s as Stored;
    this.ensureChipInventoryVersion();
    const active = new Set(s.game.players.map((player) => player.id));
    const inventories = (s.chipInventories ??= {});
    for (const player of s.game.players) inventories[player.id] = reconcileInventory(inventories[player.id], player.stack);
    for (const id of Object.keys(inventories)) if (!active.has(id)) delete inventories[id];
  }

  private ensureChipInventoryVersion() {
    const s = this.s as Stored;
    if (s.chipInventoryVersion === CHIP_INVENTORY_VERSION) return;
    s.chipInventories = {};
    s.chipInventoryVersion = CHIP_INVENTORY_VERSION;
  }

  private commit() {
    const s = this.s as Stored;
    this.reconcileChipInventories();
    if (s.game.phase === 'lobby') {
      this.ensureDealerButton();
      this.reconcileSeatConfirmations();
    }
    const turn = s.game.toActId;
    if (turn !== s.turnId) {
      s.turnStartedAt = turn ? Date.now() : null;
      s.turnId = turn;
    }
    s.lastActivity = Date.now();
    this.persist();
    this.broadcast();
  }

  private seatNeighbours(playerId: string) {
    const seats = bySeat((this.s as Stored).game);
    if (seats.length < 2) return null;
    const index = seats.findIndex((player) => player.id === playerId);
    if (index < 0) return null;
    return {
      leftId: seats[(index - 1 + seats.length) % seats.length].id,
      rightId: seats[(index + 1) % seats.length].id,
    };
  }

  private reconcileSeatConfirmations() {
    const s = this.s as Stored;
    s.seatConfirmations = (s.seatConfirmations ?? []).filter((confirmation) => {
      const member = s.members.find((candidate) => candidate.id === confirmation.playerId);
      const neighbours = this.seatNeighbours(confirmation.playerId);
      return !!member && !member.manual && !!neighbours &&
        neighbours.leftId === confirmation.leftId && neighbours.rightId === confirmation.rightId;
    });
  }

  private unconfirmedSeatIds() {
    const s = this.s as Stored;
    const confirmed = new Set((s.seatConfirmations ?? [])
      .filter((confirmation) => confirmation.status === 'confirmed')
      .map((confirmation) => confirmation.playerId));
    return bySeat(s.game)
      .filter((player) => {
        const member = s.members.find((candidate) => candidate.id === player.id);
        return !!member && !member.manual && player.id !== s.hostId && !confirmed.has(player.id);
      })
      .map((player) => player.id);
  }

  private ensureDealerButton() {
    const s = this.s as Stored;
    const seats = bySeat(s.game).filter(eligibleForHand);
    if (seats.length < 2) {
      s.game.buttonId = null;
      return;
    }
    if (s.game.buttonId && seats.some((player) => player.id === s.game.buttonId)) return;
    const random = crypto.getRandomValues(new Uint32Array(1))[0];
    s.game.buttonId = seats[random % seats.length].id;
  }

  private persist() {
    const s = this.s as Stored;
    void this.ctx.storage.put({ room: s, undo: this.undo });
    this.scheduleAlarm();
  }

  private hostCandidate(member: Member) {
    const s = this.s as Stored;
    const player = findPlayer(s.game, member.id);
    const leaving = (s.leaveRequests ?? []).some((request) => request.playerId === member.id);
    return !member.manual && !!player && !player.sittingOut && !player.leaving && player.stack > 0 && !leaving && !this.isAway(member);
  }

  private hostRecoveryAt() {
    const s = this.s as Stored;
    if (s.hostId) return s.hostAwaySince ? s.hostAwaySince + HOST_DISCONNECT_GRACE_MS : null;
    if (s.hostTokenHash) {
      const lastSeen = this.creatorCapabilityLastSeen();
      return Math.max(s.createdAt + CREATOR_GRACE_MS, lastSeen ? lastSeen + AWAY_AFTER_MS : 0);
    }
    return s.createdAt;
  }

  private nominateRecovery(now = Date.now()) {
    const s = this.s as Stored;
    const declined = new Set(s.hostRecoveryDeclinedIds ?? []);
    const eligible = s.members
      .filter((member) => member.id !== s.hostId && !declined.has(member.id) && this.hostCandidate(member))
      .sort((a, b) => a.joinedAt - b.joinedAt);
    const backup = s.backupHostId ? eligible.find((member) => member.id === s.backupHostId) : undefined;
    const target = backup ?? eligible[0];
    if (!target) {
      s.hostTransfer = null;
      return;
    }
    s.hostTransfer = {
      kind: 'recovery',
      fromId: s.hostId,
      targetId: target.id,
      requestedAt: now,
      expiresAt: now + HOST_TRANSFER_RESPONSE_MS,
    };
  }

  private declineHostTransfer(transfer: HostTransferView, memberId: string) {
    const s = this.s as Stored;
    s.hostTransfer = null;
    if (transfer.kind === 'recovery') {
      s.hostRecoveryDeclinedIds = [...new Set([...(s.hostRecoveryDeclinedIds ?? []), memberId])];
      this.nominateRecovery();
    }
  }

  private expireHostTransfer(transfer: HostTransferView) {
    this.declineHostTransfer(transfer, transfer.targetId);
  }

  private acceptHostTransfer(member: Member, transfer: HostTransferView) {
    const s = this.s as Stored;
    if (!this.hostCandidate(member) || (transfer.kind === 'planned' && transfer.fromId !== s.hostId)) {
      s.hostTransfer = null;
      s.v += 1;
      this.persist();
      deny('INVALID', 'That hosting request is no longer available');
    }
    if (transfer.kind === 'recovery') {
      const host = s.hostId ? s.members.find((candidate) => candidate.id === s.hostId) : undefined;
      if ((host && !this.isAway(host)) || (!s.hostId && s.hostTokenHash && this.creatorCapabilityPresent())) {
        s.hostTransfer = null;
        s.hostAwaySince = null;
        s.hostRecoveryDeclinedIds = [];
        deny('INVALID', 'The host is back');
      }
    }
    s.hostId = member.id;
    s.controllerId ??= member.id;
    s.hostTokenHash = null;
    if (s.backupHostId === member.id) s.backupHostId = null;
    s.hostTransfer = null;
    s.hostAwaySince = null;
    s.hostRecoveryDeclinedIds = [];
    s.v += 1;
    this.log('table', `${member.name} is now the host`);
  }

  private reconcileHostAuthority(now = Date.now()) {
    const s = this.s as Stored;
    let changed = false;
    s.hostRecoveryDeclinedIds ??= [];

    if (s.hostTransfer?.kind === 'planned') {
      const target = s.members.find((member) => member.id === s.hostTransfer?.targetId);
      if (!target || !this.hostCandidate(target) || now >= s.hostTransfer.expiresAt || s.hostTransfer.fromId !== s.hostId) {
        s.hostTransfer = null;
        changed = true;
      }
    }

    const host = s.hostId ? s.members.find((member) => member.id === s.hostId) : undefined;
    const hostPresent = host ? !this.isAway(host) : !!s.hostTokenHash && this.creatorCapabilityPresent();
    if (hostPresent) {
      if (s.hostAwaySince !== null && s.hostAwaySince !== undefined) changed = true;
      s.hostAwaySince = null;
      s.hostRecoveryDeclinedIds = [];
      if (s.hostTransfer?.kind === 'recovery') {
        s.hostTransfer = null;
        changed = true;
      }
      return changed;
    }

    if (s.hostId && !s.hostAwaySince) {
      s.hostAwaySince = now;
      changed = true;
    }

    if (s.hostTransfer?.kind === 'recovery') {
      const target = s.members.find((member) => member.id === s.hostTransfer?.targetId);
      if (!target || !this.hostCandidate(target) || now >= s.hostTransfer.expiresAt) {
        const expired = s.hostTransfer;
        this.expireHostTransfer(expired);
        changed = true;
      }
    }

    const recoveryAt = this.hostRecoveryAt();
    if (recoveryAt !== null && now >= recoveryAt && !s.hostTransfer) {
      this.nominateRecovery(now);
      changed = true;
    }
    return changed;
  }

  private scheduleAlarm() {
    const s = this.s;
    if (!s) return;
    const now = Date.now();
    let deadline = this.expiryAt();
    if (s.settlement?.finalizedAt) {
      if (this.alarmAt === null || Math.abs(deadline - this.alarmAt) > 1000) {
        this.alarmAt = deadline;
        void this.ctx.storage.setAlarm(deadline);
      }
      return;
    }
    if (s.hostTransfer) deadline = Math.min(deadline, s.hostTransfer.expiresAt);
    const recoveryAt = this.hostRecoveryAt();
    if (recoveryAt && recoveryAt > now) deadline = Math.min(deadline, recoveryAt);
    if (s.hostId && !s.hostAwaySince) {
      const hostPresence = this.presence(s.hostId);
      if (hostPresence.lastSeen > 0) deadline = Math.min(deadline, hostPresence.lastSeen + AWAY_AFTER_MS);
    }
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

  private expiryAt() {
    const s = this.s as Stored;
    return s.settlement?.finalizedAt ? s.settlement.finalizedAt + FINAL_TTL_MS : s.lastActivity + IDLE_TTL_MS;
  }

  private record(): SettlementRecord {
    const s = this.s as Stored;
    const settlement = s.settlement as SettlementStateView & { finalizedAt: number };
    const rows = ledger(s.game);
    const cents = netsInCents(rows, s.game.settings.buyInPrice, s.game.settings.startingStack);
    const useCash = s.game.settings.buyInPrice > 0;
    const transfers = settleUp(rows.map((row) => ({ id: row.id, net: useCash ? (cents.get(row.id) ?? 0) : row.net })));
    return {
      code: s.code,
      createdAt: s.createdAt,
      endedAt: s.endedAt ?? settlement.finalizedAt,
      finalizedAt: settlement.finalizedAt,
      expiresAt: settlement.finalizedAt + FINAL_TTL_MS,
      currency: s.currency ?? 'USD',
      handCount: s.game.handNo,
      settings: s.game.settings,
      players: rows.map((row) => ({
        id: row.id,
        name: row.name,
        totalEntered: row.buyIn,
        finalBalance: row.stack,
        net: useCash ? (cents.get(row.id) ?? 0) : row.net,
        leftEarly: row.departed,
      })),
      transfers: transfers.map((transfer, index) => ({ ...transfer, settled: settlement.settledTransfers.includes(index) })),
      reviews: structuredClone(settlement.reviews),
      finalizedWithIssues: settlement.finalizedWithIssues,
      history: structuredClone(s.log),
    };
  }

  private async destroy() {
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
    const authorityChanged = this.reconcileHostAuthority(Date.now());
    if (before !== this.s.claims.length || authorityChanged) this.persist();
    else this.scheduleAlarm();
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
    const recoveryAt = !s.hostId && s.hostTokenHash && this.creatorCapabilityPresent() ? null : this.hostRecoveryAt();
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
      hostTakeoverAt: recoveryAt,
      backupHostId: s.backupHostId ?? null,
      hostTransfer: s.hostTransfer ?? null,
      hostRecoveryAt: recoveryAt,
      seatConfirmations: (s.seatConfirmations ?? []).map(({ playerId, status, confirmedAt }) => ({ playerId, status, confirmedAt })),
      dealerButtonId: s.game.phase === 'lobby' ? s.game.buttonId : null,
      controllerId: s.controllerId ?? s.hostId,
      currency: s.currency ?? 'USD',
      members,
      game: {
        ...s.game,
        players: s.game.players.map((player) => ({ ...player, chipState: 'visible' as const, busted: player.stack === 0 })),
        departed: s.game.departed.map((player) => ({ ...player, chipState: 'visible' as const })),
      },
      potTotal: potTotal(s.game),
      claims: s.claims.map(({ id, playerId, at }) => ({ id, playerId, at })),
      rebuyRequests: s.rebuyRequests ?? [],
      breaks: s.breaks ?? [],
      leaveRequests: s.leaveRequests ?? [],
      lateArrivals: s.lateArrivals ?? [],
      paused: s.paused ?? false,
      voidProposal: s.voidProposal ?? null,
      correctionForId: s.correctionForId ?? null,
      runoutPlan: s.runoutPlan ? {
        count: s.runoutPlan.count,
        current: s.runoutPlan.current,
        phase: s.runoutPlan.phase,
        fromStreet: s.runoutPlan.fromStreet,
        potIds: s.runoutPlan.boards[s.runoutPlan.current] ?? [],
      } : null,
      awardProposal: s.awardProposal ?? null,
      overrideProposal: s.overrideProposal ?? null,
      settlement: s.endedAt ? (s.settlement ?? this.newSettlementState()) : null,
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
    const isController = !!id && (s.controllerId ?? s.hostId) === id;
    const revealAll = !!s.endedAt;
    const actorId = s.game.toActId;
    const actorMember = actorId ? s.members.find((candidate) => candidate.id === actorId) : undefined;
    const canControlActor = !!actorId && !!actorMember && (isHost || isController)
      && (actorMember.manual || this.isAway(actorMember) || (isHost && s.correctionForId === actorId));
    const inventoryPlayerId = canControlActor ? actorId : id;
    const inventoryPlayer = inventoryPlayerId ? findPlayer(s.game, inventoryPlayerId) : undefined;
    const game = {
      ...room.game,
      players: room.game.players.map((player) => {
        const member = s.members.find((candidate) => candidate.id === player.id);
        const actingForUnattended = (isHost || isController)
          && s.game.toActId === player.id
          && !!member
          && this.isAway(member);
        const correcting = isHost && s.correctionForId === player.id;
        const managingManualSeat = (isHost || isController) && !!member?.manual;
        const visible = revealAll || player.id === id || actingForUnattended || correcting || managingManualSeat;
        return visible
          ? { ...player, chipState: 'visible' as const }
          : { ...player, stack: 0, buyIn: 0, committed: 0, chipState: 'private' as const };
      }),
      departed: room.game.departed.map((player) => revealAll
        ? { ...player, chipState: 'visible' as const }
        : { ...player, buyIn: 0, cashOut: 0, chipState: 'private' as const }),
    };
    const privateRoom: RoomView = {
      ...room,
      game,
      rebuyRequests: room.rebuyRequests.filter((r) => isHost || r.playerId === id),
      breaks: room.breaks.filter((record) => isHost || record.playerId === id),
    };
    return {
      type: 'state',
      v: s.v,
      serverNow: Date.now(),
      room: privateRoom,
      you: {
        id,
        isHost,
        isController,
        claimId: s.claims.find((c) => c.connId === att.connId)?.id ?? null,
        legal: id && !s.paused && (!s.correctionForId || isHost) ? legalActions(s.game, id) : null,
        chipInventory: inventoryPlayer && inventoryPlayerId
          ? this.inventoryFor(inventoryPlayerId, inventoryPlayer.stack)
          : null,
        chipInventoryPlayerId: inventoryPlayer ? inventoryPlayerId : null,
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
