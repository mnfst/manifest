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

/**
 * Consumer mail and privacy-relay providers.
 *
 * Separate from JUNK_DOMAINS because these addresses are perfectly real — the
 * healed-user feed emails plenty of them. They are excluded from the *signup*
 * feed only, where the whole premise is "a corporate domain implies a team
 * behind it". A gmail.com signup carries no such signal.
 *
 * The relay entries matter more than the obvious freemail ones: duck.com,
 * pm.me and simplelogin addresses read as custom domains to a naive
 * `not freemail` check, and were the largest "corporate" domains in the
 * database by signup count until they were listed here.
 */
const CONSUMER_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'outlook.fr',
  'hotmail.com',
  'hotmail.fr',
  'hotmail.co.uk',
  'live.com',
  'live.fr',
  'msn.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.fr',
  'ymail.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'pm.me',
  'duck.com',
  'simplelogin.com',
  'simplelogin.io',
  'anonaddy.com',
  'posteo.de',
  'gmx.com',
  'gmx.de',
  'gmx.net',
  'web.de',
  't-online.de',
  'free.fr',
  'orange.fr',
  'wanadoo.fr',
  'laposte.net',
  'sfr.fr',
  'comcast.net',
  'qq.com',
  '163.com',
  '126.com',
  'foxmail.com',
  'sina.com',
  'naver.com',
  'daum.net',
  'yandex.ru',
  'yandex.com',
  'mail.ru',
  'rambler.ru',
  'seznam.cz',
  'zoho.com',
  'fastmail.com',
  'hey.com',
  'example.com',
  'test.com',
];

/** Signups on one domain inside this span, with no traffic, look scripted. */
const CLUSTER_WINDOW_MS = 30 * 86_400_000;

/** Fewer than this on a domain is a small team, not a cluster. */
const CLUSTER_MIN_SIGNUPS = 3;

/** The domain part of an address, lowercased; empty when unroutable. */
export function domainOf(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) return '';
  return normalized.slice(at + 1);
}

/**
 * True when the address belongs to a consumer mailbox or a privacy relay,
 * rather than to an organisation.
 *
 * Subdomains count (`mail.duck.com`), matching `isExcludedEmail`.
 */
export function isConsumerEmail(email: string): boolean {
  const domain = domainOf(email);
  if (!domain) return true;
  return matchesDomain(domain, CONSUMER_DOMAINS);
}

/**
 * The signup feed's admission rule: a routable address, on a domain that looks
 * like an organisation, that we are not already excluding for other reasons.
 */
export function isCorporateSignupEmail(email: string): boolean {
  return !isExcludedEmail(email) && !isConsumerEmail(email);
}

/** One signup, reduced to what the cluster rule needs to judge a domain. */
export interface ClusterCandidate {
  signed_up_at: string;
  has_traffic: boolean;
}

/**
 * True when a domain's signups look automated rather than like a real team.
 *
 * Three or more accounts, created inside a month, none of which ever sent a
 * request. A genuine team trickles in over quarters and at least one of them
 * points something at the gateway; the scraped-address clusters we have seen
 * arrive in a burst and never call the API.
 *
 * Any traffic at all clears the whole domain: a real user among them means the
 * burst was a launch, not a script.
 */
export function isSignupCluster(signups: ClusterCandidate[]): boolean {
  if (signups.length < CLUSTER_MIN_SIGNUPS) return false;
  if (signups.some((signup) => signup.has_traffic)) return false;

  const times = signups
    .map((signup) => new Date(signup.signed_up_at).getTime())
    .sort((a, b) => a - b);
  return times[times.length - 1] - times[0] <= CLUSTER_WINDOW_MS;
}
