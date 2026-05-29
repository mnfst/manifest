import { createSignal } from 'solid-js';
import {
  type SidebarBlockId,
  type SidebarItemId,
  SIDEBAR_BLOCK_IDS,
  SIDEBAR_BLOCKS,
  blockForItem,
} from './sidebar-nav.js';

const STORAGE_KEY = 'manifest.sidebar.visibility';

export interface SidebarVisibilityPrefs {
  blocks: Partial<Record<SidebarBlockId, boolean>>;
  items: Partial<Record<SidebarItemId, boolean>>;
}

function defaultPrefs(): SidebarVisibilityPrefs {
  return { blocks: {}, items: {} };
}

function readStoredPrefs(): SidebarVisibilityPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw) as SidebarVisibilityPrefs;
    if (!parsed || typeof parsed !== 'object') return defaultPrefs();
    return {
      blocks: parsed.blocks && typeof parsed.blocks === 'object' ? parsed.blocks : {},
      items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {},
    };
  } catch {
    return defaultPrefs();
  }
}

function writeStoredPrefs(prefs: SidebarVisibilityPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage may be unavailable; visibility prefs are best-effort.
  }
}

const [prefs, setPrefs] = createSignal<SidebarVisibilityPrefs>(readStoredPrefs());

function updatePrefs(updater: (current: SidebarVisibilityPrefs) => SidebarVisibilityPrefs): void {
  const next = updater(prefs());
  setPrefs(next);
  writeStoredPrefs(next);
}

export function isSidebarBlockVisible(blockId: SidebarBlockId): boolean {
  return prefs().blocks[blockId] !== false;
}

export function isSidebarItemPrefEnabled(itemId: SidebarItemId): boolean {
  return prefs().items[itemId] !== false;
}

export function isSidebarItemVisible(itemId: SidebarItemId): boolean {
  const blockId = blockForItem(itemId);
  if (!isSidebarBlockVisible(blockId)) return false;
  return isSidebarItemPrefEnabled(itemId);
}

export function isSidebarBlockShown(blockId: SidebarBlockId): boolean {
  if (!isSidebarBlockVisible(blockId)) return false;
  return SIDEBAR_BLOCKS[blockId].items.some((itemId) => isSidebarItemVisible(itemId));
}

export function setSidebarBlockVisible(blockId: SidebarBlockId, visible: boolean): void {
  updatePrefs((current) => ({
    ...current,
    blocks: { ...current.blocks, [blockId]: visible },
  }));
}

export function setSidebarItemVisible(itemId: SidebarItemId, visible: boolean): void {
  updatePrefs((current) => ({
    ...current,
    items: { ...current.items, [itemId]: visible },
  }));
}

export function resetSidebarVisibility(): void {
  const next = defaultPrefs();
  setPrefs(next);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
}

export function allSidebarBlocksVisible(): boolean {
  const current = prefs();
  for (const blockId of SIDEBAR_BLOCK_IDS) {
    if (current.blocks[blockId] === false) return false;
    for (const itemId of SIDEBAR_BLOCKS[blockId].items) {
      if (current.items[itemId] === false) return false;
    }
  }
  return true;
}

/** Test helper — replaces in-memory prefs without touching localStorage. */
export function __setSidebarVisibilityForTests(next: SidebarVisibilityPrefs): void {
  setPrefs(next);
}
