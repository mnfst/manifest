/**
 * Parses and validates a URL for SSRF vulnerabilities.
 * Returns either a validated URL string (safe to fetch) or an error.
 * This function acts as a security barrier - the returned URL is explicitly
 * validated against SSRF attacks.
 */
export function parseAndValidateUrl(urlString: string): { valid: true; url: string } | { valid: false; error: string } {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, error: `Invalid URL format: ${urlString}` };
  }

  const ssrfError = checkSsrfVulnerability(url);
  if (ssrfError) {
    return { valid: false, error: ssrfError };
  }

  // Return a freshly constructed URL string from validated components
  // This ensures only safe URLs pass through this security barrier
  return { valid: true, url: url.href };
}

/**
 * Checks a URL for SSRF vulnerabilities.
 * Returns an error message if the URL is unsafe, or null if it's allowed.
 */
export function checkSsrfVulnerability(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();

  // Block non-HTTP(S) protocols
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `Protocol "${url.protocol}" is not allowed. Use HTTP or HTTPS.`;
  }

  // Block localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
    return 'Requests to localhost are not allowed.';
  }

  // Block cloud metadata endpoints
  if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
    return 'Requests to cloud metadata endpoints are not allowed.';
  }

  // Check for private/internal IP ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    const octet1 = octets[0];
    const octet2 = octets[1];

    // 10.0.0.0/8 - Private
    if (octet1 === 10) {
      return 'Requests to private IP addresses (10.x.x.x) are not allowed.';
    }
    // 172.16.0.0/12 - Private
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) {
      return 'Requests to private IP addresses (172.16-31.x.x) are not allowed.';
    }
    // 192.168.0.0/16 - Private
    if (octet1 === 192 && octet2 === 168) {
      return 'Requests to private IP addresses (192.168.x.x) are not allowed.';
    }
    // 169.254.0.0/16 - Link-local
    if (octet1 === 169 && octet2 === 254) {
      return 'Requests to link-local addresses (169.254.x.x) are not allowed.';
    }
    // 127.0.0.0/8 - Loopback
    if (octet1 === 127) {
      return 'Requests to loopback addresses (127.x.x.x) are not allowed.';
    }
    // 0.0.0.0/8 - Current network
    if (octet1 === 0) {
      return 'Requests to 0.x.x.x addresses are not allowed.';
    }
  }

  return null;
}
