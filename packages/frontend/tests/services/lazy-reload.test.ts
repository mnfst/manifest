import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('solid-js', () => ({
  lazy: (factory: () => Promise<unknown>) => factory,
}));

import {
  lazyReload,
  clearReloadFlag,
  loadWithChunkReload,
} from '../../src/services/lazy-reload.js';

const scopeKey = (scope: string) => `manifest:chunk-reload:${scope}`;
const ROUTE_SCOPE = 'test-route';

describe('lazyReload', () => {
  const reloadMock = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
      configurable: true,
    });
    reloadMock.mockReset();
  });

  it('passes through on successful import', async () => {
    const mod = { default: (() => null) as unknown as import('solid-js').Component };
    const factory = lazyReload(() => Promise.resolve(mod), ROUTE_SCOPE);
    const result = await (factory as unknown as () => Promise<typeof mod>)();
    expect(result).toBe(mod);
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('clears the retry marker only after a chunk succeeds', async () => {
    sessionStorage.setItem(scopeKey(ROUTE_SCOPE), '1');

    await expect(loadWithChunkReload(async () => 'loaded', ROUTE_SCOPE)).resolves.toBe('loaded');

    expect(sessionStorage.getItem(scopeKey(ROUTE_SCOPE))).toBeNull();
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('does not clear a failed route marker when a different scope succeeds', async () => {
    sessionStorage.setItem(scopeKey('missing-route'), '1');

    await expect(
      loadWithChunkReload(async () => 'catalogue loaded', 'i18n-bootstrap'),
    ).resolves.toBe('catalogue loaded');

    expect(sessionStorage.getItem(scopeKey('missing-route'))).toBe('1');
  });

  it('reloads on first import failure', async () => {
    const factory = lazyReload(() => Promise.reject(new Error('chunk fail')), ROUTE_SCOPE);
    const promise = (factory as unknown as () => Promise<unknown>)();

    // The promise should never resolve (page is "reloading")
    const settled = await Promise.race([
      promise.then(() => 'resolved').catch(() => 'rejected'),
      new Promise<string>((r) => setTimeout(() => r('pending'), 50)),
    ]);

    expect(settled).toBe('pending');
    expect(reloadMock).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(scopeKey(ROUTE_SCOPE))).toBe('1');
  });

  it('propagates error on second failure and clears flag', async () => {
    sessionStorage.setItem(scopeKey(ROUTE_SCOPE), '1');
    const factory = lazyReload(() => Promise.reject(new Error('still broken')), ROUTE_SCOPE);

    await expect((factory as unknown as () => Promise<unknown>)()).rejects.toThrow('still broken');

    expect(reloadMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(scopeKey(ROUTE_SCOPE))).toBeNull();
  });
});

describe('clearReloadFlag', () => {
  it('removes the reload key', () => {
    sessionStorage.setItem(scopeKey(ROUTE_SCOPE), '1');
    clearReloadFlag(ROUTE_SCOPE);
    expect(sessionStorage.getItem(scopeKey(ROUTE_SCOPE))).toBeNull();
  });

  it('is a no-op when key is absent', () => {
    clearReloadFlag(ROUTE_SCOPE);
    expect(sessionStorage.getItem(scopeKey(ROUTE_SCOPE))).toBeNull();
  });
});
