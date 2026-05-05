export type AuthMethod = 'email' | 'google' | 'github' | 'discord';

const STORAGE_KEY = 'manifest:last-auth-method';
const VALID: ReadonlySet<AuthMethod> = new Set(['email', 'google', 'github', 'discord']);

export const getLastAuthMethod = (): AuthMethod | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value && VALID.has(value as AuthMethod) ? (value as AuthMethod) : null;
  } catch {
    return null;
  }
};

export const setLastAuthMethod = (method: AuthMethod): void => {
  try {
    localStorage.setItem(STORAGE_KEY, method);
  } catch {
    // localStorage may be unavailable (private mode, disabled storage); the hint is best-effort.
  }
};
