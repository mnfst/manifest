import { Navigate } from '@solidjs/router';
import { createResource, Show, type Component } from 'solid-js';
import ProviderConnectionsPage from './ProviderConnectionsPage.jsx';
import { checkIsSelfHosted } from '../../services/setup-status.js';

/**
 * Local providers (Ollama, LM Studio) only exist on self-hosted installs — a
 * cloud backend can't reach the user's localhost. In cloud the route redirects
 * to BYOK instead of showing an unusable page. Nothing renders until the
 * self-hosted check resolves so the page never flashes before a redirect.
 */
const LocalProviders: Component = () => {
  const [selfHosted] = createResource(checkIsSelfHosted);
  return (
    <Show when={selfHosted() !== undefined}>
      <Show when={selfHosted()} fallback={<Navigate href="/providers/usage-based" />}>
        <ProviderConnectionsPage kind="local" />
      </Show>
    </Show>
  );
};

export default LocalProviders;
