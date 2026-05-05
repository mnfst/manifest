import {
  formatManifestError,
  MANIFEST_ERRORS,
  MANIFEST_ERRORS_DOCS_BASE,
  ManifestErrorCode,
} from '../error-codes';

describe('MANIFEST_ERRORS registry', () => {
  it('exposes the public docs base URL', () => {
    expect(MANIFEST_ERRORS_DOCS_BASE).toBe('https://manifest.build/docs/errors');
  });

  it('every code has a non-empty title and template', () => {
    for (const [code, entry] of Object.entries(MANIFEST_ERRORS)) {
      expect(entry.title).toBeTruthy();
      expect(entry.template).toBeTruthy();
      expect(code).toMatch(/^M\d{3}$/);
    }
  });

  it('every code is unique', () => {
    const codes = Object.keys(MANIFEST_ERRORS);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('formatManifestError', () => {
  it('wraps a static template with the peacock prefix and docs URL', () => {
    const out = formatManifestError('M001');
    expect(out).toContain('[🦚 Manifest M001]');
    expect(out).toContain('Missing the Authorization header');
    expect(out).toContain('https://manifest.build/docs/errors/M001');
  });

  it('interpolates {var} placeholders from the vars object', () => {
    const out = formatManifestError('M100', {
      provider: 'anthropic',
      dashboardUrl: 'https://dash.example/x',
    });
    expect(out).toContain('No anthropic API key yet');
    expect(out).toContain('https://dash.example/x');
    expect(out).not.toContain('{provider}');
    expect(out).not.toContain('{dashboardUrl}');
  });

  it('coerces numeric vars to strings', () => {
    const out = formatManifestError('M301', { max: 1000 });
    expect(out).toContain('exceeds maximum length of 1000');
  });

  it('leaves placeholders untouched when a var is missing', () => {
    const out = formatManifestError('M100', { provider: 'openai' });
    expect(out).toContain('No openai API key yet');
    expect(out).toContain('{dashboardUrl}');
  });

  it('appends the docs URL exactly once', () => {
    const out = formatManifestError('M500');
    const matches = out.match(/https:\/\/manifest\.build\/docs\/errors\/M500/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('produces a stable output for every registered code', () => {
    for (const code of Object.keys(MANIFEST_ERRORS) as ManifestErrorCode[]) {
      const out = formatManifestError(code);
      expect(out.startsWith(`[🦚 Manifest ${code}]`)).toBe(true);
      expect(out.endsWith(`See ${MANIFEST_ERRORS_DOCS_BASE}/${code}`)).toBe(true);
    }
  });
});
