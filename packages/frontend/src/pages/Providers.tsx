import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  Show,
  type Component,
} from 'solid-js';
import { useParams, useSearchParams } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import ProviderSelectContent from '../components/ProviderSelectContent.js';
import RoutingInstructionModal from '../components/RoutingInstructionModal.js';
import { agentDisplayName } from '../services/agent-display-name.js';
import { getProviders, getCustomProviders } from '../services/api.js';
import {
  clearProvidersUrlParams,
  parseCustomProviderParams,
  parseProviderDeepLink,
  parseProvidersTab,
  providersUrlIndicatesSubView,
  resolveProvidersSubViewLabel,
} from '../services/routing-params.js';

const Providers: Component = () => {
  const params = useParams<{ agentName: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const agentName = () => decodeURIComponent(params.agentName);

  const customProviderPrefill = () => parseCustomProviderParams(searchParams);
  const providerDeepLink = () => parseProviderDeepLink(searchParams);
  const inSubView = () => providersUrlIndicatesSubView(searchParams);

  const [connectedProviders, { refetch: refetchProviders }] = createResource(
    () => agentName(),
    getProviders,
  );
  const [customProviders, { refetch: refetchCustomProviders }] = createResource(
    () => agentName(),
    getCustomProviders,
  );

  const subViewLabel = createMemo(() =>
    resolveProvidersSubViewLabel(searchParams, customProviders() ?? []),
  );

  const [instructionModal, setInstructionModal] = createSignal<'enable' | 'disable' | null>(null);
  const [wasEnabledBefore, setWasEnabledBefore] = createSignal(false);
  const [hadProvidersBefore, setHadProvidersBefore] = createSignal(false);

  const isEnabled = () => connectedProviders()?.some((p) => p.is_active) ?? false;

  const captureBaseline = () => {
    setWasEnabledBefore(isEnabled());
    setHadProvidersBefore((connectedProviders()?.length ?? 0) > 0);
  };

  let baselineCaptured = false;
  createEffect(() => {
    if (connectedProviders.loading || baselineCaptured) return;
    baselineCaptured = true;
    captureBaseline();
  });

  const maybeShowInstructionAfterUpdate = () => {
    if (!wasEnabledBefore() && isEnabled() && hadProvidersBefore()) {
      setInstructionModal('enable');
    }
  };

  const handleBackToList = () => {
    const tab = parseProvidersTab(searchParams);
    setSearchParams({
      ...clearProvidersUrlParams(),
      ...(tab ? { tab } : {}),
    });
  };

  const handleProviderUpdate = async () => {
    await Promise.all([refetchProviders(), refetchCustomProviders()]);
    maybeShowInstructionAfterUpdate();
  };

  return (
    <div class="container--sm">
      <Title>{agentDisplayName() ?? agentName()} Providers - Manifest</Title>
      <Meta
        name="description"
        content={`Connect LLM providers for ${agentDisplayName() ?? agentName()}.`}
      />

      <div class="page-header">
        <div>
          <h1>Providers</h1>
          <span class="breadcrumb">
            {agentDisplayName() ?? agentName()} &rsaquo;{' '}
            <Show
              when={inSubView() && subViewLabel()}
              fallback={<>Connect subscriptions and API keys</>}
            >
              Providers &rsaquo; {subViewLabel()}
            </Show>
          </span>
        </div>
      </div>

      <Show when={inSubView() && !connectedProviders.loading}>
        <div class="providers-page__subview-bar">
          <button type="button" class="providers-page__back-link" onClick={handleBackToList}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5" />
              <path d="m12 19-7-7 7-7" />
            </svg>
            Providers
          </button>
        </div>
      </Show>

      <Show
        when={!connectedProviders.loading}
        fallback={
          <div class="providers-page__loading">
            <span class="spinner" role="status" aria-label="Loading providers" />
          </div>
        }
      >
        <ProviderSelectContent
          agentName={agentName()}
          providers={connectedProviders() ?? []}
          customProviders={customProviders() ?? []}
          customProviderPrefill={customProviderPrefill()}
          providerDeepLink={providerDeepLink()}
          onUpdate={handleProviderUpdate}
          layout="page"
          showHeader={false}
          showFooter={false}
          urlSync={{
            read: () => searchParams,
            write: (next) => setSearchParams(next),
          }}
        />
      </Show>

      <RoutingInstructionModal
        open={instructionModal() !== null}
        mode={instructionModal() ?? 'enable'}
        agentName={agentName()}
        onClose={() => setInstructionModal(null)}
      />
    </div>
  );
};

export default Providers;
