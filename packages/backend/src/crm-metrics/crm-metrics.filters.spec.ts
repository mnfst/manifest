import {
  domainOf,
  isConsumerEmail,
  isCorporateSignupEmail,
  isExcludedEmail,
  isSignupCluster,
} from './crm-metrics.filters';

describe('isExcludedEmail', () => {
  it('keeps an ordinary user address', () => {
    expect(isExcludedEmail('matheus@example.com')).toBe(false);
    expect(isExcludedEmail('someone@gmail.com')).toBe(false);
  });

  it('excludes our own domains', () => {
    expect(isExcludedEmail('bruno@buddyweb.fr')).toBe(true);
    expect(isExcludedEmail('hello@manifest.build')).toBe(true);
    expect(isExcludedEmail('x@mnfstinc.com')).toBe(true);
  });

  it('excludes team members signed up on a personal address', () => {
    expect(isExcludedEmail('sebastien.conejo@gmail.com')).toBe(true);
  });

  it('excludes disposable and alias providers', () => {
    expect(isExcludedEmail('improving_poison241@dralias.com')).toBe(true);
    expect(isExcludedEmail('app.manifest.build@cryptidcloud.org')).toBe(true);
    expect(isExcludedEmail('a@slmail.me')).toBe(true);
  });

  it('excludes shared role inboxes', () => {
    expect(isExcludedEmail('info@realcompany.com')).toBe(true);
    expect(isExcludedEmail('no-reply@realcompany.com')).toBe(true);
    expect(isExcludedEmail('test@realcompany.com')).toBe(true);
  });

  it('matches a role inbox on the whole local part, not as a prefix', () => {
    expect(isExcludedEmail('information@realcompany.com')).toBe(false);
    expect(isExcludedEmail('admin.jones@realcompany.com')).toBe(false);
    expect(isExcludedEmail('contact-us@realcompany.com')).toBe(false);
  });

  it('treats subdomains of a junk domain as junk', () => {
    expect(isExcludedEmail('a@mail.dralias.com')).toBe(true);
  });

  it('does not match a domain that merely ends with the same letters', () => {
    expect(isExcludedEmail('a@notdralias.com')).toBe(false);
    expect(isExcludedEmail('a@notmanifest.build')).toBe(false);
  });

  it('normalises case and surrounding whitespace before matching', () => {
    expect(isExcludedEmail('  Bruno@BuddyWeb.FR  ')).toBe(true);
    expect(isExcludedEmail('INFO@Example.com')).toBe(true);
  });

  it('excludes anything that is not a routable address', () => {
    expect(isExcludedEmail('no-at-sign')).toBe(true);
    expect(isExcludedEmail('@nolocalpart.com')).toBe(true);
    expect(isExcludedEmail('nodomain@')).toBe(true);
    expect(isExcludedEmail('')).toBe(true);
  });

  it('uses the last @ so a quoted local part cannot smuggle a domain in', () => {
    expect(isExcludedEmail('user@notjunk@dralias.com')).toBe(true);
  });
});

describe('domainOf', () => {
  it('returns the lowercased domain part', () => {
    expect(domainOf('  Ada@Example.COM ')).toBe('example.com');
  });

  it('returns empty for an unroutable address', () => {
    expect(domainOf('no-at-sign')).toBe('');
    expect(domainOf('@leading.com')).toBe('');
    expect(domainOf('trailing@')).toBe('');
  });
});

describe('isConsumerEmail', () => {
  it('flags mainstream consumer mailboxes', () => {
    expect(isConsumerEmail('ada@gmail.com')).toBe(true);
    expect(isConsumerEmail('ada@YAHOO.co.uk')).toBe(true);
    expect(isConsumerEmail('ada@qq.com')).toBe(true);
  });

  it('flags privacy relays that read as custom domains', () => {
    expect(isConsumerEmail('ada@duck.com')).toBe(true);
    expect(isConsumerEmail('ada@pm.me')).toBe(true);
    expect(isConsumerEmail('ada@simplelogin.io')).toBe(true);
  });

  it('treats subdomains of a consumer domain as consumer', () => {
    expect(isConsumerEmail('ada@mail.duck.com')).toBe(true);
  });

  it('does not flag a domain that merely ends with the same letters', () => {
    expect(isConsumerEmail('ada@notgmail.com')).toBe(false);
  });

  it('flags an unroutable address', () => {
    expect(isConsumerEmail('nonsense')).toBe(true);
  });

  it('leaves real company domains alone', () => {
    expect(isConsumerEmail('ada@stripe.com')).toBe(false);
  });
});

describe('isCorporateSignupEmail', () => {
  it('admits a company address', () => {
    expect(isCorporateSignupEmail('ada@stripe.com')).toBe(true);
  });

  it('rejects consumer mail', () => {
    expect(isCorporateSignupEmail('ada@gmail.com')).toBe(false);
  });

  it('rejects addresses the shared exclusion list already covers', () => {
    expect(isCorporateSignupEmail('support@stripe.com')).toBe(false);
    expect(isCorporateSignupEmail('ada@manifest.build')).toBe(false);
    expect(isCorporateSignupEmail('ada@atomicmail.io')).toBe(false);
  });
});

describe('isSignupCluster', () => {
  const at = (iso: string, has_traffic = false) => ({ signed_up_at: iso, has_traffic });

  it('flags three trafficless signups inside a month', () => {
    expect(
      isSignupCluster([
        at('2026-03-01T00:00:00.000Z'),
        at('2026-03-10T00:00:00.000Z'),
        at('2026-03-18T00:00:00.000Z'),
      ]),
    ).toBe(true);
  });

  it('spares a domain below the signup threshold', () => {
    expect(isSignupCluster([at('2026-03-01T00:00:00.000Z'), at('2026-03-02T00:00:00.000Z')])).toBe(
      false,
    );
  });

  it('spares a domain where anyone ever sent a request', () => {
    expect(
      isSignupCluster([
        at('2026-03-01T00:00:00.000Z'),
        at('2026-03-10T00:00:00.000Z'),
        at('2026-03-18T00:00:00.000Z', true),
      ]),
    ).toBe(false);
  });

  it('spares a team that trickled in over more than a month', () => {
    expect(
      isSignupCluster([
        at('2026-01-01T00:00:00.000Z'),
        at('2026-03-10T00:00:00.000Z'),
        at('2026-06-18T00:00:00.000Z'),
      ]),
    ).toBe(false);
  });

  it('judges the span regardless of row order', () => {
    expect(
      isSignupCluster([
        at('2026-06-18T00:00:00.000Z'),
        at('2026-01-01T00:00:00.000Z'),
        at('2026-03-10T00:00:00.000Z'),
      ]),
    ).toBe(false);
  });
});
