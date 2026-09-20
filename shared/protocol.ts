import { MAX_PLAYERS, type ActionKind, type Departed, type Game, type Legal, type Player, type Settings } from './engine';
import { CHIP_VALUES, type ChipCount, type ChipValue } from './chips';

/** Bounded above the largest legal 15-player multi-pot award envelope. */
export const MAX_MESSAGE_BYTES = 8192;
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 4;
export const PING = 'ping';
export const PONG = 'pong';
/** A socket silent (no ping) for longer than this counts as away. */
export const AWAY_AFTER_MS = 30_000;
export const HOST_DISCONNECT_GRACE_MS = 60_000;
export const HOST_TRANSFER_RESPONSE_MS = 30_000;

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
  | { type: 'start'; v: number; allowUnconfirmed?: boolean }
  | { type: 'act'; v: number; kind: ActionKind; amount?: number; playerId?: string; chips?: ChipCount[] }
  | { type: 'changeChip'; v: number; value: ChipValue; playerId?: string }
  | { type: 'award'; v: number; winners: Record<string, string[]> }
  | { type: 'confirmAward'; v: number }
  | { type: 'disputeAward'; v: number }
  | { type: 'cancelAward'; v: number }
  | { type: 'proposeOverride'; v: number; reason: string; allocations: Record<string, number> }
  | { type: 'approveOverride'; v: number }
  | { type: 'cancelOverride'; v: number }
  | { type: 'confirmOverride'; v: number }
  | { type: 'reviewSettlement'; v: number; status: 'correct' | 'issue'; reason?: string }
  | { type: 'setTransferSettled'; v: number; transferIndex: number; settled: boolean }
  | { type: 'setMyTransfersSettled'; v: number; settled: boolean }
  | { type: 'finalizeSettlement'; v: number; withIssues: boolean; recordToken: string }
  | { type: 'next'; v: number }
  | { type: 'undo'; v: number; mode?: 'return' | 'correct' }
  | { type: 'pauseHand'; v: number }
  | { type: 'resumeHand'; v: number }
  | { type: 'previewVoid'; v: number; reason: string; advanceButton: boolean }
  | { type: 'cancelVoid'; v: number }
  | { type: 'confirmVoid'; v: number }
  | { type: 'chooseRunouts'; v: number; count: number; agreed: boolean }
  | { type: 'completeRunout'; v: number }
  | { type: 'endGame'; v: number }
  | { type: 'cancelEndGame'; v: number }
  | { type: 'takeBreak'; playerId?: string }
  | { type: 'returnFromBreak'; mode: 'now' | 'post' | 'wait'; playerId?: string }
  | { type: 'requestRebuy'; amount: number }
  | { type: 'cancelRebuy'; requestId: string }
  | { type: 'resolveRebuy'; v: number; requestId: string; allow: boolean; amount?: number }
  | { type: 'cancelLateArrival' }
  | { type: 'resolveLateArrival'; v: number; requestId: string; allow: boolean; amount?: number; noEntryBlind?: boolean }
  | { type: 'chooseLateArrival'; mode: 'post' | 'wait' }
  | { type: 'requestLeave'; mode: 'afterHand' | 'now' }
  | { type: 'cancelLeave' }
  | { type: 'settings'; v: number; settings: Settings }
  | { type: 'setStack'; v: number; playerId: string; stack: number }
  | { type: 'seatOrder'; v: number; ids: string[] }
  | { type: 'setDealerButton'; v: number; playerId: string }
  | { type: 'confirmSeat'; v: number; matches: boolean }
  | { type: 'kick'; playerId: string }
  | { type: 'transferHost'; playerId: string }
  | { type: 'cancelHostTransfer' }
  | { type: 'respondHostTransfer'; allow: boolean }
  | { type: 'setBackupHost'; playerId?: string }
  | { type: 'transferController'; playerId: string }
  /** Backwards-compatible accept action; valid only for the currently nominated recovery target. */
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

export interface HostTransferView {
  kind: 'planned' | 'recovery';
  fromId: string | null;
  targetId: string;
  requestedAt: number;
  expiresAt: number;
}

export interface SeatConfirmationView {
  playerId: string;
  status: 'confirmed' | 'issue';
  confirmedAt: number;
}

export interface LateArrivalView {
  id: string;
  playerId: string;
  amount: number;
  status: 'pending' | 'choosing' | 'ready' | 'waiting';
  mode: 'post' | 'wait' | 'free' | null;
  requestedAt: number;
}

export interface VoidProposalView {
  reason: string;
  advanceButton: boolean;
  returnAmount: number;
  proposedAt: number;
}

export interface RunoutPlanView {
  count: number;
  current: number;
  phase: 'dealing' | 'awarding';
  fromStreet: number;
  potIds: number[];
}

export interface AwardProposalView {
  winners: Record<string, string[]>;
  potIds: number[];
  proposedBy: string;
  proposedAt: number;
  disputedBy: string | null;
}

export interface OverrideProposalView {
  reason: string;
  allocations: Record<string, number>;
  approvals: string[];
  proposedBy: string;
  proposedAt: number;
  total: number;
}

export interface SettlementReviewView {
  playerId: string;
  status: 'correct' | 'issue';
  reason: string | null;
  reviewedAt: number;
}

export interface SettlementEntryView {
  id: string;
  playerId: string;
  kind: 'initial' | 'rebuy' | 'adjustment';
  amount: number;
  at: number;
}

export interface SettlementStateView {
  reviews: SettlementReviewView[];
  entries: SettlementEntryView[];
  settledTransfers: number[];
  finalizedAt: number | null;
  finalizedWithIssues: boolean;
}

export type LogKind = 'action' | 'hand' | 'win' | 'undo' | 'table';

export interface LogEntry {
  id: number;
  at: number;
  kind: LogKind;
  text: string;
}

export interface SettlementRecordPlayer {
  id: string;
  name: string;
  totalEntered: number;
  finalBalance: number;
  net: number;
  leftEarly: boolean;
}

export interface SettlementRecordTransfer {
  from: string;
  to: string;
  amount: number;
  settled: boolean;
}

/** Compact, private post-game record. It intentionally excludes device data and live game state. */
export interface SettlementRecord {
  code: string;
  createdAt: number;
  endedAt: number;
  finalizedAt: number;
  expiresAt: number;
  currency: CurrencyCode;
  handCount: number;
  settings: Settings;
  players: SettlementRecordPlayer[];
  transfers: SettlementRecordTransfer[];
  reviews: SettlementReviewView[];
  finalizedWithIssues: boolean;
  history: LogEntry[];
}

export interface SettlementRecordResponse {
  record: SettlementRecord;
  canDelete: boolean;
}

export interface PlayerView extends Player {
  /** Private chip totals are replaced before this state is serialized. */
  chipState: 'visible' | 'private';
  /** Public zero-balance status without exposing the balance itself. */
  busted: boolean;
}

export interface DepartedView extends Departed {
  chipState: 'visible' | 'private';
}

export interface GameView extends Omit<Game, 'players' | 'departed'> {
  players: PlayerView[];
  departed: DepartedView[];
}

export interface RoomView {
  code: string;
  createdAt: number;
  hostId: string | null;
  hostTakeoverAt: number | null;
  backupHostId: string | null;
  hostTransfer: HostTransferView | null;
  hostRecoveryAt: number | null;
  seatConfirmations: SeatConfirmationView[];
  dealerButtonId: string | null;
  controllerId: string | null;
  currency: CurrencyCode;
  members: MemberView[];
  game: GameView;
  potTotal: number;
  claims: ClaimView[];
  rebuyRequests: RebuyRequestView[];
  breaks: BreakView[];
  leaveRequests: LeaveRequestView[];
  lateArrivals: LateArrivalView[];
  paused: boolean;
  voidProposal: VoidProposalView | null;
  correctionForId: string | null;
  runoutPlan: RunoutPlanView | null;
  awardProposal: AwardProposalView | null;
  overrideProposal: OverrideProposalView | null;
  settlement: SettlementStateView | null;
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
  chipInventory: ChipCount[] | null;
  chipInventoryPlayerId: string | null;
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
const isChipValue = (v: unknown): v is ChipValue => typeof v === 'number' && CHIP_VALUES.includes(v as ChipValue);
const parseChips = (v: unknown): ChipCount[] | null => {
  if (!Array.isArray(v) || v.length > CHIP_VALUES.length) return null;
  const seen = new Set<number>();
  const chips: ChipCount[] = [];
  for (const row of v) {
    if (!isObj(row) || !isChipValue(row.value) || !isNum(row.count) || seen.has(row.value)) return null;
    seen.add(row.value);
    chips.push({ value: row.value, count: row.count });
  }
  return chips;
};

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
    case 'cancelLateArrival':
    case 'cancelHostTransfer':
    case 'takeHost':
      return out({ type: m.type });
    case 'respondHostTransfer':
      return typeof m.allow === 'boolean' ? out({ type: 'respondHostTransfer', allow: m.allow }) : null;
    case 'setBackupHost':
      return optId(m.playerId)
        ? out(m.playerId === undefined ? { type: 'setBackupHost' } : { type: 'setBackupHost', playerId: m.playerId as string })
        : null;
    case 'requestLeave':
      return ['afterHand', 'now'].includes(String(m.mode))
        ? out({ type: 'requestLeave', mode: m.mode as 'afterHand' | 'now' })
        : null;
    case 'chooseLateArrival':
      return ['post', 'wait'].includes(String(m.mode))
        ? out({ type: 'chooseLateArrival', mode: m.mode as 'post' | 'wait' })
        : null;
    case 'resolveClaim':
      return isId(m.claimId) && typeof m.allow === 'boolean'
        ? out({ type: 'resolveClaim', claimId: m.claimId, allow: m.allow })
        : null;
    case 'start':
      return isNum(v) && (m.allowUnconfirmed === undefined || typeof m.allowUnconfirmed === 'boolean')
        ? out(m.allowUnconfirmed === undefined ? { type: 'start', v } : { type: 'start', v, allowUnconfirmed: m.allowUnconfirmed })
        : null;
    case 'next':
    case 'endGame':
    case 'cancelEndGame':
      return isNum(v) ? out({ type: m.type, v }) : null;
    case 'setDealerButton':
      return isNum(v) && isId(m.playerId) ? out({ type: 'setDealerButton', v, playerId: m.playerId }) : null;
    case 'confirmSeat':
      return isNum(v) && typeof m.matches === 'boolean' ? out({ type: 'confirmSeat', v, matches: m.matches }) : null;
    case 'undo':
      return isNum(v) && (m.mode === undefined || ['return', 'correct'].includes(String(m.mode)))
        ? out(m.mode === undefined ? { type: 'undo', v } : { type: 'undo', v, mode: m.mode as 'return' | 'correct' })
        : null;
    case 'pauseHand':
    case 'resumeHand':
    case 'cancelVoid':
    case 'confirmVoid':
    case 'completeRunout':
    case 'confirmAward':
    case 'disputeAward':
    case 'cancelAward':
    case 'approveOverride':
    case 'cancelOverride':
    case 'confirmOverride':
      return isNum(v) ? out({ type: m.type, v }) : null;
    case 'reviewSettlement':
      return isNum(v) && ['correct', 'issue'].includes(String(m.status)) &&
        (m.status === 'correct' ? m.reason === undefined : isStr(m.reason, 160) && m.reason.trim().length > 0)
        ? out(m.status === 'correct'
            ? { type: 'reviewSettlement', v, status: 'correct' }
            : { type: 'reviewSettlement', v, status: 'issue', reason: (m.reason as string).trim() })
        : null;
    case 'setTransferSettled':
      return isNum(v) && isNum(m.transferIndex) && typeof m.settled === 'boolean'
        ? out({ type: 'setTransferSettled', v, transferIndex: m.transferIndex, settled: m.settled })
        : null;
    case 'setMyTransfersSettled':
      return isNum(v) && typeof m.settled === 'boolean'
        ? out({ type: 'setMyTransfersSettled', v, settled: m.settled })
        : null;
    case 'finalizeSettlement':
      return isNum(v) && typeof m.withIssues === 'boolean' && typeof m.recordToken === 'string' && /^[a-f0-9]{64}$/.test(m.recordToken)
        ? out({ type: 'finalizeSettlement', v, withIssues: m.withIssues, recordToken: m.recordToken })
        : null;
    case 'chooseRunouts':
      return isNum(v) && isNum(m.count) && m.count >= 1 && m.count <= 4 && typeof m.agreed === 'boolean'
        ? out({ type: 'chooseRunouts', v, count: m.count, agreed: m.agreed })
        : null;
    case 'proposeOverride': {
      if (!isNum(v) || !isStr(m.reason, 80) || m.reason.trim().length === 0 || !isObj(m.allocations)) return null;
      const entries = Object.entries(m.allocations);
      if (entries.length === 0 || entries.length > MAX_PLAYERS || entries.some(([id, amount]) => !isId(id) || !isNum(amount))) return null;
      return out({ type: 'proposeOverride', v, reason: m.reason, allocations: Object.fromEntries(entries) as Record<string, number> });
    }
    case 'previewVoid':
      return isNum(v) && isStr(m.reason, 80) && m.reason.trim().length > 0 && typeof m.advanceButton === 'boolean'
        ? out({ type: 'previewVoid', v, reason: m.reason, advanceButton: m.advanceButton })
        : null;
    case 'act': {
      if (!isNum(v) || typeof m.kind !== 'string' || !KINDS.includes(m.kind) || !optId(m.playerId)) return null;
      if (m.amount !== undefined && !isNum(m.amount)) return null;
      if (m.kind === 'raise' && m.amount === undefined) return null;
      const chips = m.chips === undefined ? undefined : parseChips(m.chips);
      if (m.chips !== undefined && !chips) return null;
      const msg: ClientMessage = { type: 'act', v, kind: m.kind as ActionKind };
      if (m.amount !== undefined) msg.amount = m.amount as number;
      if (m.playerId !== undefined) msg.playerId = m.playerId as string;
      if (chips) msg.chips = chips;
      return out(msg);
    }
    case 'changeChip':
      return isNum(v) && isChipValue(m.value) && optId(m.playerId)
        ? out(m.playerId === undefined
            ? { type: 'changeChip', v, value: m.value }
            : { type: 'changeChip', v, value: m.value, playerId: m.playerId as string })
        : null;
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
    case 'resolveLateArrival':
      return isNum(v) && isId(m.requestId) && typeof m.allow === 'boolean' &&
        (m.amount === undefined || isNum(m.amount)) &&
        (m.noEntryBlind === undefined || typeof m.noEntryBlind === 'boolean') &&
        (!m.allow || m.amount !== undefined)
        ? out({
            type: 'resolveLateArrival',
            v,
            requestId: m.requestId,
            allow: m.allow,
            ...(m.amount === undefined ? {} : { amount: m.amount as number }),
            ...(m.noEntryBlind === undefined ? {} : { noEntryBlind: m.noEntryBlind }),
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
