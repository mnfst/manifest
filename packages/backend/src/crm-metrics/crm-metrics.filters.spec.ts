import { isExcludedEmail } from './crm-metrics.filters';

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
