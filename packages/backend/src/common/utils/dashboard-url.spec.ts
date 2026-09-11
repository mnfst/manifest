import { getDashboardBaseUrl, getEmailAssetUrl } from './dashboard-url';

describe('dashboard URLs', () => {
  const originalUrl = process.env['BETTER_AUTH_URL'];

  beforeEach(() => delete process.env['BETTER_AUTH_URL']);
  afterEach(() => {
    if (originalUrl === undefined) delete process.env['BETTER_AUTH_URL'];
    else process.env['BETTER_AUTH_URL'] = originalUrl;
  });

  it('uses the gateway dashboard when no deployment URL is configured', () => {
    expect(getDashboardBaseUrl()).toBe('https://gateway.manifest.build');
    expect(getEmailAssetUrl('manifest-logo.png')).toBe(
      'https://gateway.manifest.build/manifest-logo.png',
    );
  });

  it('uses the configured deployment for absolute email images', () => {
    process.env['BETTER_AUTH_URL'] = ' https://selfhosted.example/manifest/// ';
    expect(getEmailAssetUrl('/manifest-logo.png')).toBe(
      'https://selfhosted.example/manifest/manifest-logo.png',
    );
  });

  it('keeps an explicitly supplied dashboard ahead of the deployment default', () => {
    process.env['BETTER_AUTH_URL'] = 'https://selfhosted.example';
    expect(getEmailAssetUrl('autofix-icon-email.png', 'https://dashboard.example/')).toBe(
      'https://dashboard.example/autofix-icon-email.png',
    );
  });
});
