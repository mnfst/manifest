import { A } from '@solidjs/router';
import type { Component } from 'solid-js';

const SubscriptionIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    style="color: #1cc4bf"
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ApiKeyIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    style="color: #e59d55"
  >
    <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);

const LocalIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
    style="color: #F72585"
  >
    <path d="m13.18 6.75 2.66-4.22-1.69-1.07L12 4.87 9.85 1.46 8.16 2.53l2.66 4.22-8.67 13.72A1.006 1.006 0 0 0 3 22.01h18c.36 0 .7-.2.88-.52s.16-.71-.03-1.02zM10.24 20 12 16.98 13.76 20zm5.83 0-3.21-5.5c-.36-.62-1.37-.62-1.73 0L7.92 20H4.81L12 8.62 19.19 20h-3.11Z" />
  </svg>
);

const CARDS = [
  {
    title: 'Subscriptions',
    href: '/providers/subscriptions',
    description: 'Use your existing paid plans. You can add several from the same provider.',
    icon: <SubscriptionIcon />,
  },
  {
    title: 'Usage-based',
    href: '/providers/usage-based',
    description: 'Connect providers you pay per token or per usage with your own API keys.',
    icon: <ApiKeyIcon />,
  },
  {
    title: 'Local',
    href: '/providers/local',
    description: 'Connect to LLM servers running on your machine.',
    icon: <LocalIcon />,
  },
];

const NoConnectionsPrompt: Component = () => (
  <div class="no-connections-prompt">
    <div class="no-connections-prompt__header">
      <span class="no-connections-prompt__title">No providers connected</span>
      <span class="no-connections-prompt__desc">
        Connect a provider to start routing your requests.
      </span>
    </div>
    <div class="no-connections-prompt__cards">
      {CARDS.map((card) => (
        <A href={card.href} class="no-connections-prompt__card" style="text-decoration: none;">
          <span class="no-connections-prompt__card-icon">{card.icon}</span>
          <span class="no-connections-prompt__card-title">{card.title}</span>
          <span class="no-connections-prompt__card-desc">{card.description}</span>
          <button class="btn btn--primary btn--sm" style="margin-top: auto; pointer-events: none;">
            Connect provider
          </button>
        </A>
      ))}
    </div>
  </div>
);

export default NoConnectionsPrompt;
