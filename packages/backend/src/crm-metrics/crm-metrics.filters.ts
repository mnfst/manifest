/**
 * Deliverability filtering for the CRM feed.
 *
 * These run here rather than in the CRM so every consumer inherits them: an
 * address excluded once is excluded everywhere, and the rules stay under test.
 *
 * The known bot-signup cluster (gibberish names on scraped corporate domains)
 * deliberately has no rule. It never produced a successful heal, so the cohort
 * predicate already excludes it — a domain list would be dead code that rots.
 */

/** Our own addresses. Emailing ourselves about our own launch is noise. */
const INTERNAL_DOMAINS = ['manifest.build', 'buddyweb.fr', 'mnfstinc.com'];

/** Team members signed up on a personal address, so the domain rule misses them. */
const INTERNAL_EMAILS = ['sebastien.conejo@gmail.com'];

/**
 * Disposable/alias providers. Mirrors the list the CRM outreach function
 * already carries, so both sides agree on what counts as junk.
 */
const JUNK_DOMAINS = [
  'slmail.me',
  'atomicmail.io',
  'paytrust.cc',
  'rapplo.com',
  'joystill.com',
  'abrdns.com',
  'cryptidcloud.org',
  'dralias.com',
  'mail.cfw.262019.xyz',
];

/** Shared inboxes: nobody in particular reads these, and they skew reply rates. */
const ROLE_LOCAL_PARTS = [
  'info',
  'admin',
  'contact',
  'support',
  'sales',
  'marketing',
  'office',
  'team',
  'noreply',
  'no-reply',
  'test',
];

/**
 * True when we should not email this address.
 *
 * Subdomains of a junk domain count as junk (`x.dralias.com`), but a domain
 * that merely ends with the same letters does not (`notdralias.com`).
 */
export function isExcludedEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  // No '@' at all, or an empty local part / domain: not a routable address.
  if (at <= 0 || at === normalized.length - 1) return true;

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);

  if (INTERNAL_EMAILS.includes(normalized)) return true;
  if (matchesDomain(domain, INTERNAL_DOMAINS)) return true;
  if (matchesDomain(domain, JUNK_DOMAINS)) return true;
  return ROLE_LOCAL_PARTS.includes(local);
}

function matchesDomain(domain: string, list: string[]): boolean {
  return list.some((entry) => domain === entry || domain.endsWith(`.${entry}`));
}
