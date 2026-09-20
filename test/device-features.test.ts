import { afterEach, describe, expect, it, vi } from 'vitest';
import { hapticsEnabled, setHapticsEnabled, setSoundEnabled, soundEnabled } from '../src/lib/device';
import { turnAlert } from '../src/lib/device-features';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('device alert preferences', () => {
  it('persists sound and haptic choices independently', () => {
    vi.stubGlobal('localStorage', storage());
    expect(soundEnabled()).toBe(true);
    expect(hapticsEnabled()).toBe(true);

    setSoundEnabled(false);
    setHapticsEnabled(false);
    expect(soundEnabled()).toBe(false);
    expect(hapticsEnabled()).toBe(false);
  });

  it('does not vibrate when haptics are disabled', () => {
    vi.stubGlobal('localStorage', storage());
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });

    setHapticsEnabled(false);
    turnAlert();
    expect(vibrate).not.toHaveBeenCalled();

    setHapticsEnabled(true);
    turnAlert();
    expect(vibrate).toHaveBeenCalledWith([40, 70, 40]);
  });
});
