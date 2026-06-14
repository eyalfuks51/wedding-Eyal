import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTimeout } from './auth-utils';

describe('withTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the wrapped promise value before the timeout', async () => {
    await expect(withTimeout(Promise.resolve('ready'), 1000, 'timed out')).resolves.toBe('ready');
  });

  it('rejects when the wrapped promise never settles', async () => {
    vi.useFakeTimers();
    const pending = new Promise<string>(() => {});
    const result = withTimeout(pending, 1000, 'auth timed out');
    const expectation = expect(result).rejects.toThrow('auth timed out');

    await vi.advanceTimersByTimeAsync(1000);

    await expectation;
  });
});
