import type { RoomConfig, SettlementRecordResponse } from '../../shared/protocol';
import { deviceToken } from './device';

export interface RoomInfo {
  code: string;
  phase: string;
  playerCount: number;
}

export async function createRoom(config?: RoomConfig): Promise<string> {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: deviceToken(), ...config }),
  });
  const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
  if (!res.ok || !body.code) throw new Error(body.error ?? 'Could not start a table. Try again.');
  return body.code;
}

export async function roomInfo(code: string): Promise<RoomInfo | null> {
  const res = await fetch(`/api/rooms/${code}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Could not reach the table');
  return (await res.json()) as RoomInfo;
}

export async function settlementRecord(code: string, token: string): Promise<SettlementRecordResponse | null> {
  const res = await fetch(`/api/records/${code}`, {
    headers: {
      'x-device-token': deviceToken(),
      'x-record-token': token,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Could not load this record');
  return (await res.json()) as SettlementRecordResponse;
}

export async function deleteSettlementRecord(code: string, token: string) {
  const res = await fetch(`/api/records/${code}`, {
    method: 'DELETE',
    headers: {
      'x-device-token': deviceToken(),
      'x-record-token': token,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Could not delete this record');
  }
}
