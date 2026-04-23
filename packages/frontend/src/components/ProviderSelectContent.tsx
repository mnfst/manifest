import { createSignal, Show, type Component } from 'solid-js';
import { PROVIDERS } from '../services/providers.js';
import {
  connectProvider,
  disconnectProvider,
  type AuthType,
  type CustomProviderData,
  type RoutingProvider,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import type { CustomProviderPrefill, ProviderDeepLink } from '../services/routing-params.js';
import CustomProviderForm from './CustomProviderForm.js';
import CopilotDeviceLogin from './CopilotDeviceLogin.js';
import ProviderDetailView from './ProviderDetailView.js';
import ProviderApiKeyTab from './ProviderApiKeyTab.js';
import ProviderSubscriptionTab from './ProviderSubscriptionTab.js';

export interface ProviderSelectContentProps {
  agentName: string;
  providers: RoutingProvider[];
  customProviders?: CustomProviderData[];
  customProviderPrefill?: CustomProviderPrefill | null;
  providerDeepLink?: ProviderDeepLink | null;
  onUpdate: () => void | Promise<void>;
  onClose?: () => void;
  showHeader?: boolean;
  showFooter?: boolean;
}

const noop = () => {};

const ProviderSelectContent: Component<ProviderSelectContentProps> = (props) => {
  const showHeader = () => props.showHeader !== false;
  const showFooter = () => props.showFooter !== false;
  const closeHandler = () => props.onClose ?? noop;

  const deepLink = props.providerDeepLink;
  const deepLinkProv = deepLink ? PROVIDERS.find((p) => p.id === deepLink.providerId) : null;

  const [activeTab, setActiveTab] = createSignal<'subscription' | 'api_key'>('subscription');
  const [selectedProvider, setSelectedProvider] = createSignal<string | null>(
    deepLinkProv ? deepLinkProv.id : null,
  );
  const [selectedAuthType, setSelectedAuthType] = createSignal<AuthType>(
    deepLinkProv?.subscriptionOnly ? 'subscription' : 'api_key',
  );
  const [showCustomForm, setShowCustomForm] = createSignal(!!props.customProviderPrefill);
  const [editingCustomProvider, setEditingCustomProvider] = createSignal<CustomProviderData | null>(
    null,
  );
  const [busy, setBusy] = createSignal(false);
  const [keyInput, setKeyInput] = createSignal('');
  const [editing, setEditing] = createSignal(false);
  const [validationError, setValidationError] = createSignal<string | null>(null);
  const [direction, setDirection] = createSignal<'forward' | 'back' | null>(null);
  const subscriptionProviders = () => PROVIDERS.filter((p) => p.supportsSubscription);
  const apiKeyProviders = () => {
    const filtered = PROVIDERS.filter((p) => !p.subscriptionOnly);
    return [...filtered].sort((a, b) => (a.localOnly ? 1 : 0) - (b.localOnly ? 1 : 0));
  };

  const getProviderByAuth = (provId: string, authType: AuthType) =>
    props.providers.find((p) => p.provider === provId && p.auth_type === authType);

  const isConnected = (provId: string): boolean => {
    const p = getProviderByAuth(provId, 'api_key');
    return !!p && p.is_active && p.has_api_key;
  };

  const isSubscriptionConnected = (provId: string): boolean => {
    const p = getProviderByAuth(provId, 'subscription');
    return !!p && p.is_active;
  };

  const isSubscriptionWithToken = (provId: string): boolean => {
    const p = getProviderByAuth(provId, 'subscription');
    return !!p && p.is_active && p.has_api_key;
  };

  const isNoKeyConnected = (provId: string): boolean => {
    const p = getProviderByAuth(provId, 'api_key');
    const provDef = PROVIDERS.find((pr) => pr.id === provId);
    return !!p && p.is_active && !!provDef?.noKeyRequired;
  };

  const openDetail = (provId: string, authType: AuthType) => {
    setDirection('forward');
    setSelectedProvider(provId);
    setSelectedAuthType(authType);
    setKeyInput('');
    setEditing(false);
    setValidationError(null);
  };

  const goBack = () => {
    setDirection('back');
    setSelectedProvider(null);
    setShowCustomForm(false);
    setEditingCustomProvider(null);
    setKeyInput('');
    setEditing(false);
    setValidationError(null);
  };

  const openCustomForm = () => {
    setDirection('forward');
    setShowCustomForm(true);
  };

  const openEditCustom = (cp: CustomProviderData) => {
    setDirection('forward');
    setEditingCustomProvider(cp);
  };

  const handleSubscriptionToggle = async (provId: string) => {
    const provDef = PROVIDERS.find((p) => p.id === provId);
    if (!provDef) return;

    if (provDef.deviceLogin && !isSubscriptionConnected(provId)) {
      openDetail(provId, 'subscription');
      return;
    }

    const connected = isSubscriptionConnected(provId);

    setBusy(true);
    try {
      if (connected) {
        const result = await disconnectProvider(props.agentName, provId, 'subscription');
        if (result?.notifications?.length) {
          for (const msg of result.notifications) toast.error(msg);
        }
        toast.success(`${provDef.name} subscription disconnected`);
      } else {
        await connectProvider(props.agentName, {
          provider: provId,
          authType: 'subscription',
        });
        toast.success(`${provDef.name} subscription connected`);
      }
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* -- Custom Provider Form View (create or edit) -- */}
      <Show when={showCustomForm() || editingCustomProvider()}>
        <div class="provider-modal__view provider-modal__view--from-right">
          <CustomProviderForm
            agentName={props.agentName}
            initialData={editingCustomProvider() ?? undefined}
            prefill={
              !editingCustomProvider() ? (props.customProviderPrefill ?? undefined) : undefined
            }
            onCreated={() => {
              goBack();
              props.onUpdate();
            }}
            onBack={goBack}
            onDeleted={() => {
              goBack();
              props.onUpdate();
            }}
          />
        </div>
      </Show>

      {/* -- List View -- */}
      <Show when={selectedProvider() === null && !showCustomForm() && !editingCustomProvider()}>
        <div
          class="provider-modal__view"
          classList={{ 'provider-modal__view--from-left': direction() === 'back' }}
        >
          <Show when={showHeader()}>
            <div class="routing-modal__header">
              <div>
                <div class="routing-modal__title" id="provider-modal-title">
                  Connect providers
                </div>
                <div class="routing-modal__subtitle">
                  Use your subscriptions or API keys to enable routing
                </div>
              </div>
              <button class="modal__close" onClick={closeHandler()} aria-label="Close">
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
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </Show>

          {/* -- Tabs -- */}
          <div class="provider-modal__tabs-wrapper">
            <div class="panel__tabs" role="tablist">
              <button
                role="tab"
                aria-selected={activeTab() === 'subscription'}
                class="panel__tab"
                classList={{ 'panel__tab--active': activeTab() === 'subscription' }}
                onClick={() => setActiveTab('subscription')}
              >
                <svg
                  class="provider-modal__tab-icon"
                  width="14"
                  height="14"
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
                Subscription
              </button>
              <button
                role="tab"
                aria-selected={activeTab() === 'api_key'}
                class="panel__tab"
                classList={{ 'panel__tab--active': activeTab() === 'api_key' }}
                onClick={() => setActiveTab('api_key')}
              >
                <svg
                  class="provider-modal__tab-icon"
                  width="14"
                  height="14"
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
                API Keys
              </button>
            </div>
          </div>

          {/* -- Subscription Tab -- */}
          <Show when={activeTab() === 'subscription'}>
            <ProviderSubscriptionTab
              subscriptionProviders={subscriptionProviders()}
              busy={busy}
              isSubscriptionConnected={isSubscriptionConnected}
              isSubscriptionWithToken={isSubscriptionWithToken}
              onOpenDetail={openDetail}
              onToggle={handleSubscriptionToggle}
            />
          </Show>

          {/* -- API Keys Tab -- */}
          <Show when={activeTab() === 'api_key'}>
            <ProviderApiKeyTab
              apiKeyProviders={apiKeyProviders()}
              customProviders={props.customProviders ?? []}
              isConnected={isConnected}
              isNoKeyConnected={isNoKeyConnected}
              onOpenDetail={openDetail}
              onOpenCustomForm={openCustomForm}
              onEditCustom={openEditCustom}
            />
          </Show>

          <Show when={showFooter()}>
            <div class="provider-modal__footer">
              <button class="btn btn--primary btn--sm" onClick={closeHandler()}>
                Done
              </button>
            </div>
          </Show>
        </div>
      </Show>

      {/* -- Device Login Detail View (Copilot) -- */}
      <Show
        when={
          selectedProvider() !== null &&
          !showCustomForm() &&
          !editingCustomProvider() &&
          PROVIDERS.find((p) => p.id === selectedProvider())?.deviceLogin
        }
      >
        <div class="provider-modal__view provider-modal__view--from-right">
          <CopilotDeviceLogin
            agentName={props.agentName}
            connected={isSubscriptionWithToken(selectedProvider()!)}
            onBack={goBack}
            onConnected={async () => {
              await props.onUpdate();
              goBack();
            }}
            onDisconnected={() => {
              goBack();
              props.onUpdate();
            }}
          />
        </div>
      </Show>

      {/* -- Detail View (API Key / Token) -- */}
      <Show
        when={
          selectedProvider() !== null &&
          !showCustomForm() &&
          !editingCustomProvider() &&
          !PROVIDERS.find((p) => p.id === selectedProvider())?.deviceLogin
        }
      >
        <div class="provider-modal__view provider-modal__view--from-right">
          <ProviderDetailView
            provId={selectedProvider()!}
            agentName={props.agentName}
            providers={props.providers}
            selectedAuthType={selectedAuthType}
            busy={busy}
            setBusy={setBusy}
            keyInput={keyInput}
            setKeyInput={setKeyInput}
            editing={editing}
            setEditing={setEditing}
            validationError={validationError}
            setValidationError={setValidationError}
            onBack={goBack}
            onUpdate={props.onUpdate}
            onClose={closeHandler()}
          />
        </div>
      </Show>
    </>
  );
};

export default ProviderSelectContent;
