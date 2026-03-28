export interface PluginLogger {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
}

/**
 * Subset of OpenClaw's ProviderAuthContext used by the auth onboarding flow.
 * Kept in sync with `openclaw/plugin-sdk` ProviderAuthContext.
 */
export interface ProviderAuthContext {
  config: Record<string, unknown>;
  agentDir?: string;
  workspaceDir?: string;
  prompter: WizardPrompter;
  runtime: Record<string, unknown>;
  isRemote: boolean;
  openUrl: (url: string) => Promise<void>;
}

export interface WizardPrompter {
  intro: (title: string) => Promise<void>;
  outro: (message: string) => Promise<void>;
  note: (message: string, title?: string) => Promise<void>;
  select: <T>(params: { message: string; options: Array<{ value: T; label: string; hint?: string }>; initialValue?: T }) => Promise<T>;
  text: (params: { message: string; initialValue?: string; placeholder?: string; validate?: (value: string) => string | undefined }) => Promise<string>;
  confirm: (params: { message: string; initialValue?: boolean }) => Promise<boolean>;
  progress: (label: string) => { update: (msg: string) => void; stop: (msg?: string) => void };
}

export interface ProviderAuthResult {
  profiles: Array<{
    profileId: string;
    credential: { type: string; provider: string; key?: string; token?: string };
  }>;
  configPatch?: Record<string, unknown>;
  defaultModel?: string;
  notes?: string[];
}
