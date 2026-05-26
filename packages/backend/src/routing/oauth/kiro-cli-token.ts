import { execFile as execFileCb } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

export const KIRO_CLI_LOGIN_COMMAND = 'kiro-cli login --use-device-flow';
export const KIRO_CLI_CACHE_ENV = 'KIRO_CLI_TOKEN_CACHE';
export const KIRO_CLI_BIN_ENV = 'KIRO_CLI_BIN';

const DEFAULT_REFRESH_BUFFER_MS = 60_000;
const KIRO_CLI_TIMEOUT_MS = 30_000;
const KIRO_CLI_MAX_BUFFER = 1024 * 1024;

export interface KiroCliTokenBlob {
  source: 'kiro-cli';
  t: string;
  r?: string;
  e: number;
  authMethod?: string;
  provider?: string;
  profileArn?: string;
}

interface KiroCliCacheFile {
  accessToken?: unknown;
  refreshToken?: unknown;
  expiresAt?: unknown;
  authMethod?: unknown;
  provider?: unknown;
  profileArn?: unknown;
}

export interface KiroCliTokenOptions {
  cachePath?: string;
  cliBin?: string;
  refreshBufferMs?: number;
  now?: () => number;
}

export function getKiroCliTokenCachePath(): string {
  return (
    process.env[KIRO_CLI_CACHE_ENV] ??
    path.join(homedir(), '.aws', 'sso', 'cache', 'kiro-auth-token-cli.json')
  );
}

export function isKiroCliTokenBlob(value: unknown): value is KiroCliTokenBlob {
  if (!value || typeof value !== 'object') return false;
  const blob = value as Partial<KiroCliTokenBlob>;
  return (
    blob.source === 'kiro-cli' &&
    typeof blob.t === 'string' &&
    blob.t.length > 0 &&
    typeof blob.e === 'number' &&
    Number.isFinite(blob.e)
  );
}

export function parseKiroCliTokenBlob(rawValue: string): KiroCliTokenBlob | null {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return isKiroCliTokenBlob(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeKiroCliTokenBlob(blob: KiroCliTokenBlob): string {
  return JSON.stringify(blob);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function parseExpiry(value: unknown): number {
  if (typeof value !== 'string') throw new Error('Kiro CLI token cache is missing expiresAt');
  const expiresAt = Date.parse(value);
  if (!Number.isFinite(expiresAt)) throw new Error('Kiro CLI token cache has invalid expiresAt');
  return expiresAt;
}

function toBlob(cache: KiroCliCacheFile): KiroCliTokenBlob {
  const accessToken = readOptionalString(cache.accessToken);
  const refreshToken = readOptionalString(cache.refreshToken);
  const authMethod = readOptionalString(cache.authMethod);
  const provider = readOptionalString(cache.provider);
  const profileArn = readOptionalString(cache.profileArn);
  if (!accessToken) throw new Error('Kiro CLI token cache is missing accessToken');
  return {
    source: 'kiro-cli',
    t: accessToken,
    ...(refreshToken ? { r: refreshToken } : {}),
    e: parseExpiry(cache.expiresAt),
    ...(authMethod ? { authMethod } : {}),
    ...(provider ? { provider } : {}),
    ...(profileArn ? { profileArn } : {}),
  };
}

export async function readKiroCliTokenCache(
  options: KiroCliTokenOptions = {},
): Promise<KiroCliTokenBlob> {
  const cachePath = options.cachePath ?? getKiroCliTokenCachePath();
  let raw: string;
  try {
    raw = await fs.readFile(cachePath, 'utf8');
  } catch {
    throw new Error(`Kiro CLI token cache not found. Run \`${KIRO_CLI_LOGIN_COMMAND}\`.`);
  }
  try {
    return toBlob(JSON.parse(raw) as KiroCliCacheFile);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Kiro CLI token cache is invalid';
    throw new Error(message);
  }
}

async function refreshKiroCliTokenCache(
  options: KiroCliTokenOptions = {},
): Promise<KiroCliTokenBlob> {
  const cliBin = options.cliBin ?? process.env[KIRO_CLI_BIN_ENV] ?? 'kiro-cli';
  try {
    await execFile(cliBin, ['chat', '--list-models', '--format', 'json'], {
      timeout: KIRO_CLI_TIMEOUT_MS,
      maxBuffer: KIRO_CLI_MAX_BUFFER,
      env: {
        ...process.env,
        NO_COLOR: '1',
        TERM: 'dumb',
      },
    });
  } catch {
    throw new Error(`Kiro CLI is not logged in. Run \`${KIRO_CLI_LOGIN_COMMAND}\`.`);
  }
  return readKiroCliTokenCache(options);
}

export async function getFreshKiroCliToken(
  options: KiroCliTokenOptions = {},
): Promise<KiroCliTokenBlob> {
  const now = options.now?.() ?? Date.now();
  const refreshBufferMs = options.refreshBufferMs ?? DEFAULT_REFRESH_BUFFER_MS;
  const cached = await readKiroCliTokenCache(options);
  if (cached.e > now + refreshBufferMs) return cached;
  return refreshKiroCliTokenCache(options);
}
