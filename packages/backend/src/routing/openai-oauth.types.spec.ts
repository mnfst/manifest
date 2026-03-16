import { oauthDoneHtml } from './openai-oauth.types';

describe('oauthDoneHtml', () => {
  it('returns success HTML with manifest-oauth-success message', () => {
    const html = oauthDoneHtml(true);
    expect(html).toContain('manifest-oauth-success');
    expect(html).toContain('Login successful!');
    expect(html).toContain('BroadcastChannel');
    expect(html).toContain('window.location.origin');
  });

  it('returns error HTML with manifest-oauth-error message', () => {
    const html = oauthDoneHtml(false);
    expect(html).toContain('manifest-oauth-error');
    expect(html).toContain('Login failed');
    expect(html).toContain('BroadcastChannel');
    expect(html).toContain('window.location.origin');
  });
});
