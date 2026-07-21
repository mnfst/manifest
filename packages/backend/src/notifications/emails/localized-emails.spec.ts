import { renderToStaticMarkup } from 'react-dom/server';
import { ResetPasswordEmail } from './reset-password';
import { TestEmail } from './test-email';
import { VerifyEmailEmail } from './verify-email';

describe('localized transactional emails', () => {
  it('renders the Russian password reset catalogue', () => {
    const html = renderToStaticMarkup(
      ResetPasswordEmail({
        userName: 'Анна',
        resetUrl: 'https://app.manifest.build/reset',
        locale: 'ru',
      }),
    );
    expect(html).toContain('lang="ru"');
    expect(html).toContain('Сброс пароля');
    expect(html).toContain('Здравствуйте, Анна!');
    expect(html).toContain('Сбросить пароль');
  });

  it('renders the Russian verification catalogue', () => {
    const html = renderToStaticMarkup(
      VerifyEmailEmail({
        userName: 'Иван',
        verificationUrl: 'https://app.manifest.build/verify',
        locale: 'ru',
      }),
    );
    expect(html).toContain('lang="ru"');
    expect(html).toContain('Подтвердите адрес электронной почты');
    expect(html).toContain('Здравствуйте, Иван!');
  });

  it('renders the Russian provider test catalogue', () => {
    const html = renderToStaticMarkup(TestEmail({ locale: 'ru' }));
    expect(html).toContain('lang="ru"');
    expect(html).toContain('Настройки проверены');
    expect(html).toContain('Электронная почта работает');
  });
});
