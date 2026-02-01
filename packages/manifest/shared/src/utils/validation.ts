/**
 * Validate email address format using a linear-time safe algorithm.
 * Avoids ReDoS by not using complex regex patterns.
 * Returns true if the email format is valid.
 */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;

  const atIndex = email.indexOf('@');
  if (atIndex < 1 || atIndex !== email.lastIndexOf('@')) return false;

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (local.length < 1 || local.length > 64) return false;
  if (domain.length < 1 || domain.length > 253) return false;
  if (domain.indexOf('.') < 1) return false;
  if (/\s/.test(email)) return false;

  return true;
}

/**
 * Normalize an email address to lowercase and trimmed.
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
