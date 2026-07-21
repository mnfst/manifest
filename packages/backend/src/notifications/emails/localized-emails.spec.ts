import { renderToStaticMarkup } from 'react-dom/server';
import { ResetPasswordEmail, resetPasswordEmailSubject } from './reset-password';
import { TestEmail, testEmailSubject } from './test-email';
import { VerifyEmailEmail, verifyEmailSubject } from './verify-email';

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

  it('keeps test-email subjects in the same locale catalogue as the body', () => {
    expect(testEmailSubject('en')).toBe('Manifest — Test Email');
    expect(testEmailSubject('ru')).toBe('Manifest — тестовое письмо');
  });

  it('keeps authentication subjects in the same exhaustive locale catalogues as their bodies', () => {
    expect(resetPasswordEmailSubject('en')).toBe('Reset your password');
    expect(resetPasswordEmailSubject('ru')).toBe('Сброс пароля');
    expect(verifyEmailSubject('en')).toBe('Verify your email address');
    expect(verifyEmailSubject('ru')).toBe('Подтвердите адрес электронной почты');
  });
});
