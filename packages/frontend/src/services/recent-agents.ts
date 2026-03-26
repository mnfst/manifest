const recentlyCreated = new Set<string>();

export function markAgentCreated(slug: string): void {
  recentlyCreated.add(slug);
}

export function isRecentlyCreated(slug: string): boolean {
  return recentlyCreated.has(slug);
}

export function clearRecentAgent(slug: string): void {
  recentlyCreated.delete(slug);
}
