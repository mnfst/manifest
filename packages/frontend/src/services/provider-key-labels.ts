export function suggestNextProviderKeyLabel(existing: string[]): string {
  const lower = new Set(existing.map((label) => label.toLowerCase()));
  for (let n = existing.length + 1; n < 100; n++) {
    const candidate = `Key ${n}`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
  return `Key ${existing.length + 1}`;
}
