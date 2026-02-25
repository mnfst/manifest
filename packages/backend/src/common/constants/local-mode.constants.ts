/** Shared constants for local mode — used by LocalAuthGuard, LocalBootstrapService, OtlpAuthGuard, and manifest-server */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomBytes } from 'crypto';

export const LOCAL_USER_ID = 'local-user-001';
export const LOCAL_EMAIL = 'local@manifest.local';
export const LOCAL_DEFAULT_PORT = 2099;
export const LOCAL_TENANT_ID = 'local-tenant-001';
export const LOCAL_AGENT_ID = 'local-agent-001';
export const LOCAL_AGENT_NAME = 'local-agent';

const CONFIG_DIR = join(homedir(), '.openclaw', 'manifest');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

import type { EmailProviderConfig, EmailProviderType } from '../../notifications/services/email-providers/email-provider.interface';

interface LocalConfigFile {
  apiKey?: string;
  authSecret?: string;
  localPassword?: string;
  notificationEmail?: string;
  emailProvider?: EmailProviderType;
  emailApiKey?: string;
  emailDomain?: string;
  emailFromAddress?: string;
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

/** Reads email provider config from the local config file. Returns null if not configured. */
export function readLocalEmailConfig(): EmailProviderConfig | null {
  const config = readConfig();
  if (!config.emailProvider || !config.emailApiKey) return null;
  return {
    provider: config.emailProvider,
    apiKey: config.emailApiKey,
    domain: config.emailDomain,
    fromEmail: config.emailFromAddress,
  };
}

/** Writes email provider config to the local config file. */
export function writeLocalEmailConfig(emailConfig: EmailProviderConfig): void {
  const config = readConfig();
  config.emailProvider = emailConfig.provider;
  config.emailApiKey = emailConfig.apiKey;
  config.emailDomain = emailConfig.domain;
  config.emailFromAddress = emailConfig.fromEmail;
  writeConfig(config);
}

/** Clears email provider config from the local config file. */
export function clearLocalEmailConfig(): void {
  const config = readConfig();
  delete config.emailProvider;
  delete config.emailApiKey;
  delete config.emailDomain;
  delete config.emailFromAddress;
  writeConfig(config);
}

/** Reads the API key from the local config file. Returns null if not set. */
export function readLocalApiKey(): string | null {
  const config = readConfig();
  return typeof config.apiKey === 'string' ? config.apiKey : null;
}

/** Reads the notification email from the local config file. Returns null if not set. */
export function readLocalNotificationEmail(): string | null {
  const config = readConfig();
  return config.notificationEmail ?? null;
}

/** Writes a notification email to the local config file. */
export function writeLocalNotificationEmail(email: string): void {
  const config = readConfig();
  config.notificationEmail = email;
  writeConfig(config);
}
