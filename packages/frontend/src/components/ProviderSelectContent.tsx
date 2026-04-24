import { createSignal, onMount, Show, type Component } from 'solid-js';
import { normalizeProviderName } from 'manifest-shared';
import { PROVIDERS, type ProviderDef } from '../services/providers.js';
import {
  connectProvider,
  disconnectProvider,
  type AuthType,
  type CustomProviderData,
  type RoutingProvider,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import type { CustomProviderPrefill, ProviderDeepLink } from '../services/routing-params.js';
import { checkIsSelfHosted } from '../services/setup-status.js';
import CustomProviderForm from './CustomProviderForm.js';
import CopilotDeviceLogin from './CopilotDeviceLogin.js';
import LocalServerDetailView from './LocalServerDetailView.js';
import ProviderDetailView from './ProviderDetailView.js';
import ProviderApiKeyTab from './ProviderApiKeyTab.js';
import ProviderLocalTab from './ProviderLocalTab.js';
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

  const [activeTab, setActiveTab] = createSignal<'subscription' | 'api_key' | 'local'>(
    'subscription',
  );
  const [isSelfHosted, setIsSelfHosted] = createSignal(false);
  onMount(async () => {
    setIsSelfHosted(await checkIsSelfHosted());
  });
  const [selectedProvider, setSelectedProvider] = createSignal<string | null>(
    deepLinkProv ? deepLinkProv.id : null,
  );
  const [selectedAuthType, setSelectedAuthType] = createSignal<AuthType>(
    deepLinkProv?.subscriptionOnly ? 'subscription' : 'api_key',
  );
  const [showCustomForm, setShowCustomForm] = createSignal(!!props.customProviderPrefill);
  const [tilePrefill, setTilePrefill] = createSignal<CustomProviderPrefill | null>(null);
  const [editingCustomProvider, setEditingCustomProvider] = createSignal<CustomProviderData | null>(
    null,
  );
  const [localServerProvider, setLocalServerProvider] = createSignal<ProviderDef | null>(null);
  const [localServerEditData, setLocalServerEditData] = createSignal<
    CustomProviderData | undefined
  >(undefined);
  const [busy, setBusy] = createSignal(false);
  const [keyInput, setKeyInput] = createSignal('');
  const [editing, setEditing] = createSignal(false);
  const [validationError, setValidationError] = createSignal<string | null>(null);
  const [direction, setDirection] = createSignal<'forward' | 'back' | null>(null);
  const subscriptionProviders = () => PROVIDERS.filter((p) => p.supportsSubscription);
  const apiKeyProviders = () => PROVIDERS.filter((p) => !p.subscriptionOnly && !p.localOnly);
  const localProviders = () => PROVIDERS.filter((p) => p.localOnly);

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

  // Local-tab connection check: Ollama / LM Studio rows carry
  // `auth_type: 'local'` after the backfill migrations. Ignoring that would
  // leave the Local tab's toggles permanently off even once the user
  // connects the provider (its counterpart auth_type='api_key' row no
  // longer exists).
  const isLocalConnected = (provId: string): boolean => {
    const p = getProviderByAuth(provId, 'local');
    return !!p && p.is_active;
  };

  const resetToList = () => {
    setSelectedProvider(null);
    setShowCustomForm(false);
    setTilePrefill(null);
    setEditingCustomProvider(null);
    setLocalServerProvider(null);
    setLocalServerEditData(undefined);
    setKeyInput('');
    setEditing(false);
    setValidationError(null);
  };

  const goBack = () => {
    setDirection('back');
    resetToList();
  };

  // Kept as an alias of goBack so callers that finish a flow (create /
  // delete / connect) don't have to know how back-nav works.
  const completeToList = () => {
    setDirection('back');
    resetToList();
  };

  const openDetail = (provId: string, authType: AuthType) => {
    setDirection('forward');
    setSelectedProvider(provId);
    setSelectedAuthType(authType);
    setKeyInput('');
    setEditing(false);
    setValidationError(null);
  };

  const openCustomForm = (prefill?: CustomProviderPrefill) => {
    setDirection('forward');
    setTilePrefill(prefill ?? null);
    setShowCustomForm(true);
  };

  const openEditCustom = (cp: CustomProviderData) => {
    const normalized = normalizeProviderName(cp.name);
    const localProv = PROVIDERS.find(
      (p) => p.defaultLocalPort && normalizeProviderName(p.name) === normalized,
    );
    if (localProv) {
      setDirection('forward');
      setLocalServerProvider(localProv);
      setLocalServerEditData(cp);
      return;
    }
    setDirection('forward');
    setEditingCustomProvider(cp);
  };

  const openLocalServer = (prov: ProviderDef) => {
    setDirection('forward');
    setLocalServerProvider(prov);
  };

  const handleLocalToggle = async (providerKey: string) => {
    // The Local tab's toggle-off action deactivates the user_providers row
    // without touching the custom_providers row (for LM Studio): the user
    // can flip it back on via the same tile, and the backend cleans up
    // dangling tier overrides as part of disconnect.
    setBusy(true);
    try {
      const result = await disconnectProvider(props.agentName, providerKey, 'local');
      if (result?.notifications?.length) {
        for (const msg of result.notifications) toast.error(msg);
      }
      toast.success('Provider disconnected');
      props.onUpdate();
    } catch {
      // error toast from fetchMutate
    } finally {
      setBusy(false);
    }
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
      {/* -- Local Server Detail View (LM Studio) -- */}
      <Show when={localServerProvider() && !showCustomForm() && !editingCustomProvider()}>
        <div class="provider-modal__view provider-modal__view--from-right">
          <LocalServerDetailView
            agentName={props.agentName}
            provider={localServerProvider()!}
            editData={localServerEditData()}
            onConnected={() => {
              completeToList();
              props.onUpdate();
            }}
            onBack={goBack}
          />
        </div>
      </Show>

      {/* -- Custom Provider Form View (create or edit) -- */}
      <Show when={(showCustomForm() || editingCustomProvider()) && !localServerProvider()}>
        <div class="provider-modal__view provider-modal__view--from-right">
          <CustomProviderForm
            agentName={props.agentName}
            initialData={editingCustomProvider() ?? undefined}
            prefill={
              !editingCustomProvider()
                ? (tilePrefill() ?? props.customProviderPrefill ?? undefined)
                : undefined
            }
            onCreated={() => {
              completeToList();
              props.onUpdate();
            }}
            onBack={goBack}
            onDeleted={() => {
              completeToList();
              props.onUpdate();
            }}
          />
        </div>
      </Show>

      {/* -- List View -- */}
      <Show
        when={
          selectedProvider() === null &&
          !showCustomForm() &&
          !editingCustomProvider() &&
          !localServerProvider()
        }
      >
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
              <Show when={isSelfHosted()}>
                <button
                  role="tab"
                  aria-selected={activeTab() === 'local'}
                  class="panel__tab"
                  classList={{ 'panel__tab--active': activeTab() === 'local' }}
                  onClick={() => setActiveTab('local')}
                >
                  <svg
                    class="provider-modal__tab-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    style="color: #F72585"
                  >
                    <path d="m13.18 6.75 2.66-4.22-1.69-1.07L12 4.87 9.85 1.46 8.16 2.53l2.66 4.22-8.67 13.72A1.006 1.006 0 0 0 3 22.01h18c.36 0 .7-.2.88-.52s.16-.71-.03-1.02zM10.24 20 12 16.98 13.76 20zm5.83 0-3.21-5.5c-.36-.62-1.37-.62-1.73 0L7.92 20H4.81L12 8.62 19.19 20h-3.11Z" />
                  </svg>
                  Local
                </button>
              </Show>
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

          {/* -- Local Tab (self-hosted only) -- */}
          <Show when={activeTab() === 'local' && isSelfHosted()}>
            <ProviderLocalTab
              localProviders={localProviders()}
              customProviders={props.customProviders ?? []}
              isConnected={isLocalConnected}
              onToggle={handleLocalToggle}
              busy={busy}
              onOpenDetail={openDetail}
              onEditCustom={openEditCustom}
              onOpenLocalServer={openLocalServer}
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
