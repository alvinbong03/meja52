const TOKEN_KEY = 'pp.token';
const NAME_KEY = 'pp.name';
const SOUND_KEY = 'pp.sound';
const HAPTICS_KEY = 'pp.haptics';

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private mode or storage disabled: the session still works, it just will not survive reloads
  }
}

let memoryToken: string | null = null;

export function deviceToken() {
  const existing = read(TOKEN_KEY) ?? memoryToken;
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
  memoryToken = token;
  write(TOKEN_KEY, token);
  return token;
}

export const savedName = () => read(NAME_KEY) ?? '';
export const saveName = (name: string) => write(NAME_KEY, name);
export const soundEnabled = () => read(SOUND_KEY) !== 'off';
export const setSoundEnabled = (on: boolean) => write(SOUND_KEY, on ? 'on' : 'off');
export const hapticsEnabled = () => read(HAPTICS_KEY) !== 'off';
export const setHapticsEnabled = (on: boolean) => write(HAPTICS_KEY, on ? 'on' : 'off');

const recordKey = (code: string) => `meja52.record.${code}`;
const memoryRecords = new Map<string, string>();

export function createRecordToken(code: string) {
  const existing = read(recordKey(code)) ?? memoryRecords.get(code);
  if (existing && /^[a-f0-9]{64}$/.test(existing)) return existing;
  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
  memoryRecords.set(code, token);
  write(recordKey(code), token);
  return token;
}

export function savedRecordToken(code: string) {
  const token = read(recordKey(code)) ?? memoryRecords.get(code);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
