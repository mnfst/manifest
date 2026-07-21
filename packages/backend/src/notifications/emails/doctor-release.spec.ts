import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import { DoctorReleaseEmail } from './doctor-release';

// Same approach as threshold-alert.spec: react-email's `render` uses dynamic
// imports that fight Jest's CJS transform, so we render the React tree to
// static markup, which is the layer carrying the content we assert on.
function renderEmail(props: Parameters<typeof DoctorReleaseEmail>[0]): string {
  return renderToStaticMarkup(React.createElement(DoctorReleaseEmail, props));
}

describe('DoctorReleaseEmail', () => {
  it('defaults to English and renders both CTAs and the waitlist footer', () => {
    const html = renderEmail({
      appUrl: 'https://app.manifest.build',
      tutorialUrl: 'https://manifest.build/blog/auto-fix',
    });
    expect(html).toContain('lang="en"');
    expect(html).toContain('Auto-fix is live on your account');
    expect(html).toContain('already running on your account');
    expect(html).toContain('https://app.manifest.build');
    expect(html).toContain('Open your dashboard');
    expect(html).toContain('How Auto-fix works');
    expect(html).toContain('https://manifest.build/blog/auto-fix');
    expect(html).toContain('because you joined the Auto-fix');
    // The header reads "New: <icon> Auto-fix", not the old green badge.
    expect(html).toContain('New:');
    expect(html).toContain('autofix-icon-email.png');
    // House copy rules: no em dashes in user-facing sentences.
    expect(html).not.toContain('\u2014');
  });

  it('renders complete Russian copy, language metadata, and localized CTAs', () => {
    const html = renderEmail({
      appUrl: 'https://app.manifest.build',
      tutorialUrl: 'https://manifest.build/ru/blog/auto-fix',
      locale: 'ru',
    });

    expect(html).toContain('lang="ru"');
    expect(html).toContain('Manifest может автоматически исправлять ошибки в запросах');
    expect(html).toContain('Auto-fix уже работает в вашем аккаунте');
    expect(html).toContain('Ничего дополнительно включать не нужно');
    expect(html).toContain('ошибку, исправление и повторную попытку');
    expect(html).toContain('каждую неделю функция сможет восстанавливать всё больше запросов');
    expect(html).toContain('Открыть панель управления');
    expect(html).toContain('Как работает Auto-fix');
    expect(html).toContain('https://app.manifest.build');
    expect(html).toContain('https://manifest.build/ru/blog/auto-fix');
    expect(html).toContain('потому что записались в список ожидания Auto-fix');
    expect(html).not.toContain('Open your dashboard');
    expect(html).not.toContain('\u2014');
  });

  it('omits the tutorial button until the article URL exists', () => {
    const html = renderEmail({ appUrl: 'https://app.manifest.build' });
    expect(html).not.toContain('How Auto-fix works');
    expect(html).toContain('Open your dashboard');
  });
});
