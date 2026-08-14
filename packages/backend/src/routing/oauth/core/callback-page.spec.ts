import { oauthDoneHtml } from './callback-page';

describe('oauthDoneHtml', () => {
  it('emits a success message and a default Login title', () => {
    const html = oauthDoneHtml(true);
    expect(html).toContain('Login successful');
    expect(html).toContain('manifest-oauth-success');
    expect(html).toContain('Manifest — Login');
  });

  it('emits a failure message with retry guidance', () => {
    const html = oauthDoneHtml(false);
    expect(html).toContain('Login failed');
    expect(html).toContain('manifest-oauth-error');
  });

  it('respects a custom provider label in the page title', () => {
    expect(oauthDoneHtml(true, undefined, 'OpenAI Login')).toContain('Manifest — OpenAI Login');
  });

  it('threads a CSP nonce into the inline script tag', () => {
    expect(oauthDoneHtml(true, 'abc123')).toContain('<script nonce="abc123">');
  });

  it('omits the nonce attribute when none is provided', () => {
    expect(oauthDoneHtml(true)).toContain('<script>');
    expect(oauthDoneHtml(true)).not.toContain('nonce=');
  });
});
