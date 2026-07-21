import { createEffect, createSignal, onMount, Show, type Component } from 'solid-js';
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
import { t } from '../i18n/index.js';

export interface ProviderSelectContentProps {
  agentName: string;
  providers: RoutingProvider[];
  customProviders?: CustomProviderData[];
  customProviderPrefill?: CustomProviderPrefill | null;
  providerDeepLink?: ProviderDeepLink | null;
  initialTab?: 'subscription' | 'api_key' | 'local';
  onUpdate: () => void | Promise<void>;
  onPollProviders?: () => void | Promise<void>;
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
  // A `custom:<id>` deep link can't resolve to a standard PROVIDERS entry; it
  // targets a custom provider whose editor we open directly (see onMount below).
  const deepLinkCustomId = deepLink?.providerId.startsWith('custom:')
    ? deepLink.providerId.slice('custom:'.length)
    : null;

  const [activeTab, setActiveTab] = createSignal<'subscription' | 'api_key' | 'local'>(
    deepLink?.authType ?? props.initialTab ?? 'subscription',
  );
  const [isSelfHosted, setIsSelfHosted] = createSignal(false);
  onMount(async () => {
    setIsSelfHosted(await checkIsSelfHosted());
  });
  // Custom-provider deep link: open the custom editor for the matching id
  // instead of leaving the modal on the provider list (which can't resolve a
  // `custom:` id). An effect (not onMount) covers custom providers that load
  // asynchronously after the modal opens; the guard fires it at most once.
  let customDeepLinkOpened = false;
  if (deepLinkCustomId) {
    createEffect(() => {
      if (customDeepLinkOpened) return;
      const cp = (props.customProviders ?? []).find((c) => c.id === deepLinkCustomId);
      if (cp) {
        customDeepLinkOpened = true;
        openEditCustom(cp);
      }
    });
  }
  const [selectedProvider, setSelectedProvider] = createSignal<string | null>(
    deepLinkProv ? deepLinkProv.id : null,
  );
  const [selectedAuthType, setSelectedAuthType] = createSignal<AuthType>(
    deepLink?.authType ?? (deepLinkProv?.subscriptionOnly ? 'subscription' : 'api_key'),
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
  const [addKeyIntent, setAddKeyIntent] = createSignal(false);
  const subscriptionProviders = () => PROVIDERS.filter((p) => p.supportsSubscription);
  const apiKeyProviders = () => PROVIDERS.filter((p) => !p.subscriptionOnly && !p.localOnly);
  const localProviders = () => PROVIDERS.filter((p) => p.localOnly);

  const getProviderByAuth = (provId: string, authType: AuthType) =>
    props.providers.find((p) => p.provider === provId && p.auth_type === authType);

  const getActiveProviderKeys = (provId: string, authType: AuthType) =>
    props.providers
      .filter(
        (p) => p.provider === provId && p.auth_type === authType && p.is_active && p.has_api_key,
      )
      .slice()
      .sort((a, b) => a.priority - b.priority);

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
    // When opened via deep-link (from a provider list page), there is no
    // "list view" to go back to. Close the modal instead.
    if (deepLink) {
      closeHandler()();
      return;
    }
    setDirection('back');
    resetToList();
  };

  // Kept as an alias of goBack so callers that finish a flow (create /
  // delete / connect) don't have to know how back-nav works.
  const completeToList = () => {
    setDirection('back');
    resetToList();
  };

  const openDetail = (provId: string, authType: AuthType, addKey?: boolean) => {
    setDirection('forward');
    setAddKeyIntent(false);
    setSelectedProvider(provId);
    setSelectedAuthType(authType);
    setKeyInput('');
    setEditing(false);
    setValidationError(null);
    if (addKey) queueMicrotask(() => setAddKeyIntent(true));
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
    // The Local tab's toggle-off action deactivates the tenant_providers row
    // without touching the custom_providers row (for LM Studio): the user
    // can flip it back on via the same tile, and the backend cleans up
    // dangling tier overrides as part of disconnect.
    setBusy(true);
    try {
      const result = await disconnectProvider(props.agentName, providerKey, 'local');
      if (result?.notifications?.length) {
        for (const msg of result.notifications) toast.error(msg);
      }
      toast.success(t('provider.disconnected'));
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
        toast.success(t('provider.subscriptionDisconnected', { provider: provDef.name }));
      } else {
        await connectProvider(props.agentName, {
          provider: provId,
          authType: 'subscription',
        });
        toast.success(t('provider.subscriptionConnected', { provider: provDef.name }));
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
            onOpenCustomForm={() => {
              setLocalServerProvider(null);
              openCustomForm();
            }}
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

      {/* List view with tabs removed. Connection now happens via deep-link
           from the Subscriptions / Usage-based / Local pages directly. */}

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
            activeKeys={getActiveProviderKeys(selectedProvider()!, 'subscription')}
            onBack={goBack}
            onConnected={async () => {
              await props.onUpdate();
              goBack();
            }}
            onUpdated={props.onUpdate}
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
            onPollProviders={props.onPollProviders}
            onClose={closeHandler()}
            initialAddKey={addKeyIntent()}
          />
        </div>
      </Show>
    </>
  );
};

export default ProviderSelectContent;
