/**
 * Sanitizes a mock value to prevent SSRF through URL injection.
 * Blocks values that could be used to manipulate the target URL.
 */
export function sanitizeMockValue(value: unknown): string {
  const str = String(value);

  // Block values that look like full URLs (could override the base URL)
  // This prevents injection of http://, https://, file://, etc.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(str)) {
    return '[blocked-url]';
  }

  // Block protocol-relative URLs (//example.com)
  if (str.startsWith('//')) {
    return '[blocked-url]';
  }

  return str;
}
