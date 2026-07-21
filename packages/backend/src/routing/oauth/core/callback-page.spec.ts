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

  it('renders Russian copy and a matching document language', () => {
    const html = oauthDoneHtml(true, undefined, 'Login', 'ru');
    expect(html).toContain('<html lang="ru">');
    expect(html).toContain('Вход выполнен успешно');
    expect(html).toContain('Это окно можно закрыть');
    expect(html).toContain('manifest-oauth-success');
  });

  it('renders Russian failure guidance from the same locale catalogue', () => {
    const html = oauthDoneHtml(false, undefined, 'Login', 'ru');
    expect(html).toContain('Не удалось войти');
    expect(html).toContain('повторите попытку');
    expect(html).toContain('manifest-oauth-error');
  });

  it('localizes the Login suffix without translating provider brands', () => {
    expect(oauthDoneHtml(true, undefined, 'xAI Login', 'ru')).toContain('Manifest — xAI — вход');
  });
});
