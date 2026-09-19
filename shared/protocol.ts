import { MAX_PLAYERS, type ActionKind, type Game, type Legal, type Settings } from './engine';

/** Bounded above the largest legal 15-player multi-pot award envelope. */
export const MAX_MESSAGE_BYTES = 8192;
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;
export const PING = 'ping';
export const PONG = 'pong';
/** A socket silent (no ping) for longer than this counts as away. */
export const AWAY_AFTER_MS = 30_000;

export const CURRENCIES = ['MYR', 'SGD', 'USD', 'GBP', 'EUR'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export interface RoomConfig {
  currency: CurrencyCode;
  settings: Settings;
}

export const isRoomCode = (code: unknown): code is string =>
  typeof code === 'string' && new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code);

export const normalizeCode = (input: string) =>
  input
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, CODE_LENGTH);

export type ClientMessage =
  | { type: 'hello'; token: string }
  | { type: 'join'; name: string; avatar?: string }
  | { type: 'addSeat'; name: string }
  | { type: 'claim'; playerId: string }
  | { type: 'cancelClaim' }
  | { type: 'resolveClaim'; claimId: string; allow: boolean }
  | { type: 'start'; v: number }
  | { type: 'act'; v: number; kind: ActionKind; amount?: number; playerId?: string }
  | { type: 'award'; v: number; winners: Record<string, string[]> }
  | { type: 'next'; v: number }
  | { type: 'undo'; v: number }
  | { type: 'endGame'; v: number }
  | { type: 'cancelEndGame'; v: number }
  | { type: 'takeBreak'; playerId?: string }
  | { type: 'returnFromBreak'; mode: 'now' | 'post' | 'wait'; playerId?: string }
  | { type: 'requestRebuy'; amount: number }
  | { type: 'cancelRebuy'; requestId: string }
  | { type: 'resolveRebuy'; v: number; requestId: string; allow: boolean; amount?: number }
  | { type: 'requestLeave'; mode: 'afterHand' | 'now' }
  | { type: 'cancelLeave' }
  | { type: 'settings'; v: number; settings: Settings }
  | { type: 'setStack'; v: number; playerId: string; stack: number }
  | { type: 'seatOrder'; v: number; ids: string[] }
  | { type: 'kick'; playerId: string }
  | { type: 'transferHost'; playerId: string }
  | { type: 'transferController'; playerId: string }
  | { type: 'takeHost' };

export type Envelope = ClientMessage & { seq?: number };

export interface MemberView {
  id: string;
  name: string;
  avatar: string | null;
  manual: boolean;
  connections: number;
  lastSeen: number;
}

export interface ClaimView {
  id: string;
  playerId: string;
  at: number;
}

export interface RebuyRequestView {
  id: string;
  playerId: string;
  amount: number;
  status: 'pending' | 'approved';
  requestedAt: number;
}

export interface BreakView {
  playerId: string;
  status: 'scheduled' | 'away' | 'waiting';
  missedBlinds: boolean;
  startedAt: number;
}

export interface LeaveRequestView {
  playerId: string;
  mode: 'afterHand' | 'now';
  requestedAt: number;
}

export type LogKind = 'action' | 'hand' | 'win' | 'undo' | 'table';

export interface LogEntry {
  id: number;
  at: number;
  kind: LogKind;
  text: string;
}

export interface RoomView {
  code: string;
  createdAt: number;
  hostId: string | null;
  hostTakeoverAt: number | null;
  controllerId: string | null;
  currency: CurrencyCode;
  members: MemberView[];
  game: Game;
  claims: ClaimView[];
  rebuyRequests: RebuyRequestView[];
  breaks: BreakView[];
  leaveRequests: LeaveRequestView[];
  log: LogEntry[];
  undoLabel: string | null;
  turnStartedAt: number | null;
  endingAfterHand: boolean;
  endedAt: number | null;
}

export interface YouView {
  id: string | null;
  isHost: boolean;
  isController: boolean;
  claimId: string | null;
  legal: Legal | null;
}

export type ErrorCode = 'STALE' | 'NOT_TURN' | 'INVALID' | 'PHASE' | 'FORBIDDEN' | 'RATE' | 'NOT_FOUND';

export type ServerMessage =
  | { type: 'state'; v: number; serverNow: number; room: RoomView; you: YouView }
  | { type: 'ok'; seq: number }
  | { type: 'err'; seq?: number; code: ErrorCode; message: string }
  | { type: 'closed'; reason: 'expired' | 'kicked' | 'replaced' };

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max = 64): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9]{8,32}$/.test(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const optId = (v: unknown) => v === undefined || isId(v);
const KINDS: readonly string[] = ['fold', 'check', 'call', 'raise'];

/** Strict structural validation. Unknown message types or malformed fields return null. */
export function parseClientMessage(raw: string): Envelope | null {
  let m: unknown;
  try {
    m = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(m) || typeof m.type !== 'string') return null;
  if (m.seq !== undefined && !isNum(m.seq)) return null;
  const seq = m.seq as number | undefined;
  const v = m.v;
  const out = (msg: ClientMessage): Envelope => (seq === undefined ? msg : { ...msg, seq });
  switch (m.type) {
    case 'hello':
      return typeof m.token === 'string' && /^[a-f0-9]{64}$/.test(m.token) ? out({ type: 'hello', token: m.token }) : null;
    case 'join':
      return isStr(m.name, 200) && (m.avatar === undefined || isStr(m.avatar, 4))
        ? out(m.avatar === undefined ? { type: 'join', name: m.name } : { type: 'join', name: m.name, avatar: m.avatar })
        : null;
    case 'addSeat':
      return isStr(m.name, 200) ? out({ type: 'addSeat', name: m.name }) : null;
    case 'claim':
      return isId(m.playerId) ? out({ type: 'claim', playerId: m.playerId }) : null;
    case 'cancelClaim':
    case 'cancelLeave':
    case 'takeHost':
      return out({ type: m.type });
    case 'requestLeave':
      return ['afterHand', 'now'].includes(String(m.mode))
        ? out({ type: 'requestLeave', mode: m.mode as 'afterHand' | 'now' })
        : null;
    case 'resolveClaim':
      return isId(m.claimId) && typeof m.allow === 'boolean'
        ? out({ type: 'resolveClaim', claimId: m.claimId, allow: m.allow })
        : null;
    case 'start':
    case 'next':
    case 'undo':
    case 'endGame':
    case 'cancelEndGame':
      return isNum(v) ? out({ type: m.type, v }) : null;
    case 'act': {
      if (!isNum(v) || typeof m.kind !== 'string' || !KINDS.includes(m.kind) || !optId(m.playerId)) return null;
      if (m.amount !== undefined && !isNum(m.amount)) return null;
      if (m.kind === 'raise' && m.amount === undefined) return null;
      const msg: ClientMessage = { type: 'act', v, kind: m.kind as ActionKind };
      if (m.amount !== undefined) msg.amount = m.amount as number;
      if (m.playerId !== undefined) msg.playerId = m.playerId as string;
      return out(msg);
    }
    case 'award': {
      if (!isNum(v) || !isObj(m.winners)) return null;
      const winners: Record<string, string[]> = {};
      const entries = Object.entries(m.winners);
      if (entries.length > MAX_PLAYERS) return null;
      for (const [potId, ids] of entries) {
        if (!/^\d{1,2}$/.test(potId) || !Array.isArray(ids) || ids.length > MAX_PLAYERS || !ids.every(isId)) return null;
        winners[potId] = ids as string[];
      }
      return out({ type: 'award', v, winners });
    }
    case 'takeBreak':
      return optId(m.playerId)
        ? out(m.playerId === undefined ? { type: 'takeBreak' } : { type: 'takeBreak', playerId: m.playerId as string })
        : null;
    case 'returnFromBreak':
      return ['now', 'post', 'wait'].includes(String(m.mode)) && optId(m.playerId)
        ? out(m.playerId === undefined
            ? { type: 'returnFromBreak', mode: m.mode as 'now' | 'post' | 'wait' }
            : { type: 'returnFromBreak', mode: m.mode as 'now' | 'post' | 'wait', playerId: m.playerId as string })
        : null;
    case 'requestRebuy':
      return isNum(m.amount) ? out({ type: 'requestRebuy', amount: m.amount }) : null;
    case 'cancelRebuy':
      return isId(m.requestId) ? out({ type: 'cancelRebuy', requestId: m.requestId }) : null;
    case 'resolveRebuy':
      return isNum(v) && isId(m.requestId) && typeof m.allow === 'boolean' &&
        (m.amount === undefined || isNum(m.amount)) && (!m.allow || m.amount !== undefined)
        ? out({
            type: 'resolveRebuy',
            v,
            requestId: m.requestId,
            allow: m.allow,
            ...(m.amount === undefined ? {} : { amount: m.amount as number }),
          })
        : null;
    case 'settings': {
      const s = m.settings;
      if (!isNum(v) || !isObj(s)) return null;
      if (![s.sb, s.bb, s.startingStack, s.buyInPrice].every(isNum)) return null;
      return out({
        type: 'settings',
        v,
        settings: {
          sb: s.sb as number,
          bb: s.bb as number,
          startingStack: s.startingStack as number,
          buyInPrice: s.buyInPrice as number,
        },
      });
    }
    case 'setStack':
      return isNum(v) && isId(m.playerId) && isNum(m.stack)
        ? out({ type: 'setStack', v, playerId: m.playerId, stack: m.stack })
        : null;
    case 'seatOrder':
      return isNum(v) && Array.isArray(m.ids) && m.ids.length <= MAX_PLAYERS && m.ids.every(isId)
        ? out({ type: 'seatOrder', v, ids: m.ids as string[] })
        : null;
    case 'kick':
    case 'transferHost':
    case 'transferController':
      return isId(m.playerId) ? out({ type: m.type, playerId: m.playerId }) : null;
    default:
      return null;
  }
}
