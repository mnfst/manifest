import { A } from '@solidjs/router';
import { Title } from '@solidjs/meta';
import type { Component } from 'solid-js';
import { t } from '../i18n/index.js';

const NotFound: Component = () => {
  return (
    <>
      <Title>{t('pages.notFound.metaTitle')}</Title>
      <div class="not-found">
        <span class="not-found__code">404</span>
        <h1 class="not-found__title">{t('pages.notFound.title')}</h1>
        <p class="not-found__text">{t('pages.notFound.description')}</p>
        <A href="/" class="not-found__link">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          {t('pages.notFound.backToDashboard')}
        </A>
      </div>
    </>
  );
};

export default NotFound;
