import { readFileSync, existsSync } from 'fs';

/* eslint-disable @typescript-eslint/no-explicit-any */

export function loadJsonFile(path: string): any {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return {};
  }
}
