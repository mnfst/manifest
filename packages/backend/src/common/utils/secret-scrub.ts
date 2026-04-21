// Best-effort redaction of provider credentials that may appear in upstream
// error bodies before we persist them to agent_messages.error_message. Some
// providers (notably Anthropic 401s) echo the offending Authorization or
// x-api-key header back in the error body; without scrubbing, a single 401
// can pin a user's API key to our database.
//
// This is not a defense-in-depth security boundary — it's a reduction-of-
// blast-radius control. Key hygiene still relies on upstream correctness.

type Pattern = { re: RegExp; replacement: string };

// Ordered: header-style matches and Bearer run FIRST so the whole
// "<header>: <value>" or "Bearer <token>" span is collapsed before vendor
// regexes get a chance to try (and before any raw-key regex can leave a
// dangling prefix for the header regex to double-redact). Vendor-specific
// patterns then catch bare keys that weren't wrapped in a header.
const PATTERNS: Pattern[] = [
  // Matches "x-api-key": "value" (JSON), X-API-Key: rest-of-line, etc.
  // Group 1: optional surrounding quote for the header name (JSON form).
  // Group 4: optional surrounding quote for the value. The value char class
  // permits spaces so multi-word auth schemes (e.g. "Basic dXNlcjpwYXNz") are
  // captured in full, stopping only at quotes, commas, braces, or EOL.
  {
    re: /(["']?)(x-api-key|authorization|api-key)\1(\s*[:=]\s*)(["']?)[^"',}\r\n]+\4/gi,
    replacement: '$1$2$1$3$4[REDACTED]$4',
  },
  { re: /Bearer\s+[A-Za-z0-9_\-.=+/]{8,}/gi, replacement: 'Bearer [REDACTED]' },
  { re: /([?&])key=[^&\s"']+/g, replacement: '$1key=[REDACTED]' },
  { re: /\bsk-ant-[A-Za-z0-9_\-]{10,}/g, replacement: '[REDACTED]' },
  { re: /\bsk-proj-[A-Za-z0-9_\-]{10,}/g, replacement: '[REDACTED]' },
  { re: /\bsk-[A-Za-z0-9_\-]{10,}/g, replacement: '[REDACTED]' },
  { re: /\bgsk_[A-Za-z0-9_\-]{10,}/g, replacement: '[REDACTED]' },
  { re: /\bxai-[A-Za-z0-9_\-]{10,}/g, replacement: '[REDACTED]' },
  { re: /\bmnfst_[A-Za-z0-9_\-]{10,}/g, replacement: '[REDACTED]' },
  { re: /\bAIza[A-Za-z0-9_\-]{10,}/g, replacement: '[REDACTED]' },
];

export function scrubSecrets(text: string | null | undefined): string {
  if (text == null) return '';
  let out = text;
  for (const { re, replacement } of PATTERNS) {
    out = out.replace(re, replacement);
  }
  return out;
}
