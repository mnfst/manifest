import { existsSync, readFileSync } from 'fs';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function loadJsonFile(path: string): Record<string, any> {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }

    console.warn(`[manifest] Invalid JSON object in ${path}; expected a top-level object`);
    return {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[manifest] Failed to read JSON file ${path}: ${msg}`);
    return {};
  }
}
