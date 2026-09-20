import { describe, expect, it } from 'vitest';
import { cleanName, sameName } from '../shared/names';
import { isRoomCode, normalizeCode, parseClientMessage } from '../shared/protocol';

const token = 'a'.repeat(64);
const parse = (m: unknown) => parseClientMessage(JSON.stringify(m));

describe('parseClientMessage', () => {
  it('accepts well formed messages and keeps seq', () => {
    expect(parse({ type: 'hello', token, seq: 1 })).toEqual({ type: 'hello', token, seq: 1 });
    expect(parse({ type: 'act', v: 3, kind: 'raise', amount: 60 })).toEqual({ type: 'act', v: 3, kind: 'raise', amount: 60 });
    expect(parse({ type: 'act', v: 3, kind: 'fold', playerId: 'abcdef0123456789' })).toMatchObject({ playerId: 'abcdef0123456789' });
    expect(parse({ type: 'award', v: 9, winners: { 0: ['abcdef01', 'abcdef02'] } })).toEqual({
      type: 'award',
      v: 9,
      winners: { 0: ['abcdef01', 'abcdef02'] },
    });
    expect(parse({ type: 'settings', v: 1, settings: { sb: 5, bb: 10, startingStack: 1000, buyInPrice: 2000 } })).toBeTruthy();
    expect(parse({ type: 'transferController', playerId: 'abcdef0123456789' })).toEqual({
      type: 'transferController',
      playerId: 'abcdef0123456789',
    });
    expect(parse({ type: 'endGame', v: 7 })).toEqual({ type: 'endGame', v: 7 });
    expect(parse({ type: 'cancelEndGame', v: 8 })).toEqual({ type: 'cancelEndGame', v: 8 });
    expect(parse({ type: 'undo', v: 8, mode: 'correct' })).toEqual({ type: 'undo', v: 8, mode: 'correct' });
    expect(parse({ type: 'pauseHand', v: 8 })).toEqual({ type: 'pauseHand', v: 8 });
    expect(parse({ type: 'resumeHand', v: 9 })).toEqual({ type: 'resumeHand', v: 9 });
    expect(parse({ type: 'previewVoid', v: 10, reason: 'Misdeal', advanceButton: false })).toEqual({
      type: 'previewVoid', v: 10, reason: 'Misdeal', advanceButton: false,
    });
    expect(parse({ type: 'cancelVoid', v: 11 })).toEqual({ type: 'cancelVoid', v: 11 });
    expect(parse({ type: 'confirmVoid', v: 12 })).toEqual({ type: 'confirmVoid', v: 12 });
    expect(parse({ type: 'chooseRunouts', v: 13, count: 2, agreed: true })).toEqual({ type: 'chooseRunouts', v: 13, count: 2, agreed: true });
    expect(parse({ type: 'completeRunout', v: 14 })).toEqual({ type: 'completeRunout', v: 14 });
    expect(parse({ type: 'requestRebuy', amount: 100 })).toEqual({ type: 'requestRebuy', amount: 100 });
    expect(parse({ type: 'cancelRebuy', requestId: 'abcdef0123456789' })).toEqual({
      type: 'cancelRebuy',
      requestId: 'abcdef0123456789',
    });
    expect(parse({ type: 'takeBreak' })).toEqual({ type: 'takeBreak' });
    expect(parse({ type: 'returnFromBreak', mode: 'post' })).toEqual({ type: 'returnFromBreak', mode: 'post' });
    expect(parse({ type: 'requestLeave', mode: 'afterHand' })).toEqual({ type: 'requestLeave', mode: 'afterHand' });
    expect(parse({ type: 'cancelLeave' })).toEqual({ type: 'cancelLeave' });
    expect(parse({ type: 'chooseLateArrival', mode: 'post' })).toEqual({ type: 'chooseLateArrival', mode: 'post' });
    expect(parse({ type: 'cancelLateArrival' })).toEqual({ type: 'cancelLateArrival' });
    expect(parse({ type: 'resolveLateArrival', v: 4, requestId: 'abcdef0123456789', allow: true, amount: 250 })).toEqual({
      type: 'resolveLateArrival', v: 4, requestId: 'abcdef0123456789', allow: true, amount: 250,
    });
    expect(parse({ type: 'resolveRebuy', v: 9, requestId: 'abcdef0123456789', allow: true, amount: 125 })).toEqual({
      type: 'resolveRebuy',
      v: 9,
      requestId: 'abcdef0123456789',
      allow: true,
      amount: 125,
    });
    expect(
      parse({
        type: 'award',
        v: 1,
        winners: Object.fromEntries(Array.from({ length: 15 }, (_, i) => [String(i), ['abcdef01']])),
      }),
    ).toBeTruthy();
  });

  it('rejects malformed input', () => {
    const bad = [
      'not json',
      { type: 'nope' },
      { type: 'hello', token: 'short' },
      { type: 'hello', token: 'Z'.repeat(64) },
      { type: 'act', v: 1, kind: 'allin' },
      { type: 'act', v: 1, kind: 'raise' },
      { type: 'act', v: -1, kind: 'check' },
      { type: 'act', v: 1, kind: 'raise', amount: 1.5 },
      { type: 'act', v: 1, kind: 'check', playerId: '<script>' },
      { type: 'resolveRebuy', v: 1, requestId: 'abcdef0123456789', allow: true },
      { type: 'resolveRebuy', v: 1, requestId: 'abcdef0123456789', allow: false, amount: '100' },
      { type: 'requestLeave', mode: 'eventually' },
      { type: 'undo', v: 1, mode: 'guess' },
      { type: 'previewVoid', v: 1, reason: '', advanceButton: false },
      { type: 'previewVoid', v: 1, reason: '   ', advanceButton: false },
      { type: 'previewVoid', v: 1, reason: 'Misdeal', advanceButton: 'no' },
      { type: 'chooseRunouts', v: 1, count: 5, agreed: true },
      { type: 'chooseRunouts', v: 1, count: 2, agreed: 'yes' },
      { type: 'chooseLateArrival', mode: 'later' },
      { type: 'resolveLateArrival', v: 1, requestId: 'abcdef0123456789', allow: true },
      { type: 'award', v: 1, winners: { x: ['abcdef01'] } },
      { type: 'award', v: 1, winners: [] },
      { type: 'settings', v: 1, settings: { sb: '5', bb: 10, startingStack: 1000, buyInPrice: 0 } },
      { type: 'seatOrder', v: 1, ids: Array.from({ length: 16 }, (_, i) => `abcdef${i.toString().padStart(2, '0')}`) },
      { type: 'join', name: 42 },
      { type: 'start', seq: 'x', v: 1 },
      [1, 2, 3],
      null,
    ];
    for (const m of bad) {
      expect(typeof m === 'string' ? parseClientMessage(m) : parse(m)).toBeNull();
    }
  });
});

describe('room codes', () => {
  it('validates and normalizes', () => {
    expect(isRoomCode('ABCD')).toBe(true);
    expect(isRoomCode('ABCI')).toBe(false);
    expect(isRoomCode('abcd')).toBe(false);
    expect(normalizeCode(' ab-cd9e ')).toBe('ABCD');
  });
});

describe('cleanName', () => {
  it('strips control, bidi and zero width characters and collapses spaces', () => {
    expect(cleanName('  Sam​‮  Lee\n ')).toBe('Sam Lee');
    expect(cleanName('<script>alert(1)</script>')).toBe('<script>alert(1)');
  });

  it('normalizes compatibility forms and caps at 16 graphemes', () => {
    expect(cleanName('Ｓａｍ')).toBe('Sam');
    expect(cleanName('abcdefghijklmnopqrstuvwxyz')).toBe('abcdefghijklmnop');
    expect(cleanName('👩‍👩‍👧‍👦'.repeat(20))).toBe('👩‍👩‍👧‍👦'.repeat(2));
  });

  it('rejects empty or non string names', () => {
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('​')).toBeNull();
    expect(cleanName('‍‍')).toBeNull();
    expect(cleanName(12)).toBeNull();
  });

  it('compares names case and accent insensitively', () => {
    expect(sameName('José', 'jose')).toBe(true);
    expect(sameName('Sam', 'Sammy')).toBe(false);
  });
});
