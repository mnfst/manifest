import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __setSidebarVisibilityForTests,
  allSidebarBlocksVisible,
  isSidebarBlockShown,
  isSidebarBlockVisible,
  isSidebarItemPrefEnabled,
  isSidebarItemVisible,
  resetSidebarVisibility,
  setSidebarBlockVisible,
  setSidebarItemVisible,
} from '../../src/services/sidebar-preferences.js';

describe('sidebar-preferences', () => {
  let lsStore: Record<string, string>;

  beforeEach(() => {
    lsStore = {};
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => lsStore[key] ?? null,
      setItem: (key: string, value: string) => {
        lsStore[key] = value;
      },
      removeItem: (key: string) => {
        delete lsStore[key];
      },
      clear: () => {
        lsStore = {};
      },
    });
    resetSidebarVisibility();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows all blocks and items by default', () => {
    expect(isSidebarBlockVisible('monitoring')).toBe(true);
    expect(isSidebarItemVisible('overview')).toBe(true);
    expect(allSidebarBlocksVisible()).toBe(true);
  });

  it('hides a block and its items', () => {
    setSidebarBlockVisible('manage', false);
    expect(isSidebarBlockVisible('manage')).toBe(false);
    expect(isSidebarItemVisible('routing')).toBe(false);
    expect(isSidebarBlockShown('manage')).toBe(false);
  });

  it('hides individual items while keeping the block label when another item remains', () => {
    setSidebarItemVisible('overview', false);
    expect(isSidebarItemPrefEnabled('overview')).toBe(false);
    expect(isSidebarItemVisible('overview')).toBe(false);
    expect(isSidebarItemVisible('messages')).toBe(true);
    expect(isSidebarBlockShown('monitoring')).toBe(true);
  });

  it('hides the block label when every item in the block is hidden', () => {
    setSidebarItemVisible('overview', false);
    setSidebarItemVisible('messages', false);
    expect(isSidebarBlockShown('monitoring')).toBe(false);
  });

  it('persists preferences to localStorage', () => {
    setSidebarItemVisible('playground', false);
    const stored = JSON.parse(lsStore['manifest.sidebar.visibility'] ?? '{}');
    expect(stored.items.playground).toBe(false);
  });

  it('loads stored preferences on init', () => {
    __setSidebarVisibilityForTests({
      blocks: { resources: false },
      items: {},
    });
    expect(isSidebarBlockVisible('resources')).toBe(false);
    expect(isSidebarItemVisible('help')).toBe(false);
  });

  it('reset restores defaults', () => {
    setSidebarBlockVisible('feedback', false);
    setSidebarItemVisible('limits', false);
    resetSidebarVisibility();
    expect(allSidebarBlocksVisible()).toBe(true);
    expect(isSidebarItemVisible('limits')).toBe(true);
  });
});
