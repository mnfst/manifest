import { existsSync, readFileSync } from 'fs';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function loadJsonFile(path: string): Record<string, any> {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[manifest] Failed to read JSON file ${path}: ${msg}`);
    return {};
  }
}
