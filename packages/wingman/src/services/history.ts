const KEY = 'wingman:history';
const MAX_ENTRIES = 50;

export interface HistoryEntry {
  id: string;
  timestamp: number;
  profileId: string;
  profileLabel: string;
  baseUrl: string;
  model: string;
  systemPrompt: string;
  userMessage: string;
  lang: string;
  headers: Record<string, string>;
  status: number;
  statusText: string;
  ok: boolean;
  durationMs: number;
  assistantText: string | null;
  requestBody: string;
  requestHeaders: Record<string, string>;
  responseBody: string;
  responseHeaders: Record<string, string>;
  responseJson: unknown | null;
  errorMessage?: string;
}

export type NewHistoryEntry = Omit<HistoryEntry, 'id' | 'timestamp'>;

function safeRead(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // localStorage full or unavailable — fail silently rather than disrupt the
    // request flow. The user's last request still went through; only the
    // historical record is lost.
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `hist_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listHistory(): HistoryEntry[] {
  return safeRead();
}

export function appendHistory(entry: NewHistoryEntry): HistoryEntry {
  const full: HistoryEntry = {
    ...entry,
    id: generateId(),
    timestamp: Date.now(),
  };
  const existing = safeRead();
  const next = [full, ...existing].slice(0, MAX_ENTRIES);
  safeWrite(next);
  return full;
}

export function deleteHistory(id: string): void {
  safeWrite(safeRead().filter((e) => e.id !== id));
}

export function clearHistory(): void {
  safeWrite([]);
}

export function formatRelativeTime(ts: number, now: number = Date.now()): string {
  const delta = Math.max(0, now - ts);
  const sec = Math.floor(delta / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 4) return `${week}w ago`;
  const month = Math.floor(day / 30);
  return `${month}mo ago`;
}
