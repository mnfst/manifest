/** Shared constants for local mode — used by LocalAuthGuard, LocalBootstrapService, and manifest-server */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';

export const LOCAL_USER_ID = 'local-user-001';
export const LOCAL_EMAIL = 'local@manifest.local';
export const LOCAL_DEFAULT_PORT = 2099;

const CONFIG_DIR = join(homedir(), '.openclaw', 'manifest');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface LocalConfigFile {
  apiKey?: string;
  authSecret?: string;
  localPassword?: string;
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

function readConfig(): LocalConfigFile {
  ensureConfigDir();
  if (!existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as LocalConfigFile;
  } catch {
    return {};
  }
}

function writeConfig(config: LocalConfigFile): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

/** Returns a persistent random secret for Better Auth (generated on first call, stored in config). */
export function getLocalAuthSecret(): string {
  const config = readConfig();
  if (config.authSecret && config.authSecret.length >= 32) {
    return config.authSecret;
  }
  const secret = randomBytes(32).toString('hex');
  writeConfig({ ...config, authSecret: secret });
  return secret;
}

/** Returns a persistent random password for the local user (generated on first call, stored in config). */
export function getLocalPassword(): string {
  const config = readConfig();
  if (config.localPassword && config.localPassword.length >= 16) {
    return config.localPassword;
  }
  const password = randomBytes(24).toString('base64url');
  writeConfig({ ...config, localPassword: password });
  return password;
}
