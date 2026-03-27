import { readFileSync, existsSync } from 'fs';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function loadJsonFile(path: string): any {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
