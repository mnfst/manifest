import { createSignal, createResource, Show, For, type Component } from 'solid-js';
import { useParams, useNavigate, useLocation } from '@solidjs/router';
import { Title, Meta } from '@solidjs/meta';
import ErrorState from '../components/ErrorState.jsx';
import SetupStepAddProvider from '../components/SetupStepAddProvider.jsx';
import { CopyButton } from '../components/SetupStepInstall.jsx';
import {
  getAgentKey,
  deleteAgent,
  renameAgent,
  rotateAgentKey,
  getRoutingStatus,
} from '../services/api.js';
import { toast } from '../services/toast-store.js';
import { markAgentCreated } from '../services/recent-agents.js';
import { isLocalMode } from '../services/local-mode.js';
import { agentDisplayName } from '../services/agent-display-name.js';

const Settings: Component = () => {
  const params = useParams<{ agentName: string }>();
  const navigate = useNavigate();
  const location = useLocation<{ newApiKey?: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

  const [name, setName] = createSignal(agentName());
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [deleteConfirmName, setDeleteConfirmName] = createSignal('');
  const [deleting, setDeleting] = createSignal(false);
  const [rotating, setRotating] = createSignal(false);
  const [rotatedKey, setRotatedKey] = createSignal<string | null>(
    (location.state as { newApiKey?: string } | undefined)?.newApiKey ?? null,
  );

  const [apiKeyData, { refetch: refetchKey }] = createResource(
    () => agentName(),
    (n) => getAgentKey(n),
  );

  const [routingStatus] = createResource(() => agentName(), getRoutingStatus);
  const routingEnabled = () => routingStatus()?.enabled ?? false;

  const baseUrl = () => {
    const custom = apiKeyData()?.pluginEndpoint;
    if (custom) return custom;
    const host = window.location.hostname;
    if (host === 'app.manifest.build') return 'https://app.manifest.build/v1';
    return `${window.location.origin}/v1`;
  };

  const handleSave = async () => {
    const newName = name().trim();
    if (!newName || newName === agentName()) return;

    setSaving(true);
    try {
      const result = await renameAgent(agentName(), newName);
      const slug = result?.name ?? newName;
      markAgentCreated(slug);
      navigate(`/agents/${encodeURIComponent(slug)}/settings`, {
        replace: true,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setName(agentName());
    } finally {
      setSaving(false);
    }
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      const result = await rotateAgentKey(agentName());
      setRotatedKey(result.apiKey);
      toast.success('API key rotated successfully');
      refetchKey();
    } catch {
      // error toast handled by fetchMutate
    } finally {
      setRotating(false);
    }
  };

  const TABS = () => ['General', 'Agent setup'] as const;
  type Tab = 'General' | 'Agent setup';
  const [tab, setTab] = createSignal<Tab>('General');

  return (
    <div class="container--sm">
      <Title>{agentDisplayName() ?? agentName()} Settings - Manifest</Title>
      <Meta
        name="description"
        content={`Configure settings for ${agentDisplayName() ?? agentName()}.`}
      />
      <div class="page-header">
        <div>
          <h1>Settings</h1>
          <span class="breadcrumb">
            {agentDisplayName() ?? agentName()} &rsaquo; Rename your agent, manage API keys, and
            view setup instructions
          </span>
        </div>
      </div>

      <Show when={TABS().length > 0}>
        <div class="panel__tabs" style="margin-bottom: var(--gap-xl);">
          <For each={TABS()}>
            {(t) => (
              <button
                class="panel__tab"
                classList={{ 'panel__tab--active': tab() === t }}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* -- Tab: General ----------------------------- */}
      <Show when={tab() === 'General'}>
        <div class="settings-card">
          <div class="settings-card__row">
            <div class="settings-card__label">
              <span class="settings-card__label-title">Agent name</span>
              <span class="settings-card__label-desc">
                The display name for this agent across the dashboard.
              </span>
            </div>
            <div class="settings-card__control">
              <input
                class="settings-card__input"
                type="text"
                aria-label="Agent name"
                value={name()}
                onInput={(e) => setName(e.currentTarget.value)}
              />
            </div>
          </div>
          <div class="settings-card__footer">
            <button
              class="btn btn--primary btn--sm"
              onClick={handleSave}
              disabled={saving() || name().trim() === agentName()}
            >
              <span aria-live="polite">
                {saved() ? (
                  'Saved'
                ) : saving() ? (
                  <>
                    <span class="spinner" />
                    <span class="sr-only">Saving…</span>
                  </>
                ) : (
                  'Save'
                )}
              </span>
            </button>
          </div>
        </div>

        <Show when={!isLocalMode() || agentName() !== 'local-agent'}>
          <h3 class="settings-section__title settings-section__title--danger">Danger zone</h3>

          <div class="settings-card settings-card--danger">
            <div class="settings-card__row">
              <div class="settings-card__label">
                <span class="settings-card__label-title">Delete this agent</span>
                <span class="settings-card__label-desc">
                  Permanently delete this agent, its API key, and all recorded messages and
                  analytics. This action cannot be undone.
                </span>
              </div>
              <div class="settings-card__control">
                <button
                  class="btn btn--danger btn--sm"
                  onClick={() => {
                    setShowDeleteModal(true);
                    setDeleteConfirmName('');
                  }}
                >
                  Delete agent
                </button>
              </div>
            </div>
          </div>
        </Show>
      </Show>

      {/* -- Tab: Agent setup ------------------------- */}
      <Show when={tab() === 'Agent setup'}>
        <h3 class="settings-section__title">API Key</h3>

        <div class="settings-card">
          <div class="settings-card__row">
            <div class="settings-card__label">
              <span class="settings-card__label-title">Agent API key</span>
              <span class="settings-card__label-desc">
                This key authenticates your agent's requests to Manifest. Rotating it generates a
                new key and immediately invalidates the current one.
              </span>
            </div>
            <div
              class="settings-card__control"
              style="display: flex; align-items: center; gap: 8px;"
            >
              <code style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));">
                {apiKeyData()?.keyPrefix ?? '...'}...
              </code>
              <button class="btn btn--outline btn--sm" onClick={handleRotate} disabled={rotating()}>
                {rotating() ? (
                  <>
                    <span class="spinner" />
                    <span class="sr-only">Rotating…</span>
                  </>
                ) : (
                  'Rotate key'
                )}
              </button>
            </div>
          </div>
          <Show when={rotatedKey()}>
            <div style="padding: 0 var(--gap-md) var(--gap-md);">
              <div style="background: hsl(var(--chart-5) / 0.1); border: 1px solid hsl(var(--chart-5) / 0.3); border-radius: var(--radius); padding: 10px 14px; margin-bottom: 12px; font-size: var(--font-size-sm); color: hsl(var(--foreground));">
                Save this key somewhere safe. You won't see it again.
              </div>
              <div style="display: flex; align-items: center; gap: 8px; background: hsl(var(--muted)); border-radius: var(--radius); padding: 10px 14px; font-family: var(--font-mono); font-size: var(--font-size-sm); word-break: break-all;">
                {rotatedKey()}
                <CopyButton text={rotatedKey()!} />
              </div>
            </div>
          </Show>
        </div>

        <h3 class="settings-section__title">Setup</h3>

        <Show
          when={!apiKeyData.loading}
          fallback={
            <div class="setup-steps">
              <div class="skeleton skeleton--rect" style="width: 100%; height: 200px;" />
            </div>
          }
        >
          <Show
            when={!apiKeyData.error}
            fallback={
              <ErrorState
                error={apiKeyData.error}
                title="Could not load API key"
                message="Failed to fetch your agent's API key. Please try again."
                onRetry={refetchKey}
              />
            }
          >
            <div class="settings-card" style="padding: var(--gap-lg);">
              <SetupStepAddProvider
                apiKey={rotatedKey() ?? null}
                keyPrefix={apiKeyData()?.keyPrefix ?? null}
                baseUrl={baseUrl()}
              />
              <Show when={!routingEnabled()}>
                <div style="margin-top: 0; padding-top: var(--gap-lg); border-top: 1px solid hsl(var(--border)); display: flex; align-items: center; justify-content: space-between;">
                  <p style="margin: 0; font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.5;">
                    Add at least one LLM provider so Manifest knows where to route requests.
                  </p>
                  <button
                    class="btn btn--primary btn--sm"
                    style="flex-shrink: 0; margin-left: 16px;"
                    onClick={() =>
                      navigate(`/agents/${encodeURIComponent(agentName())}/routing`, {
                        state: { openProviders: true },
                      })
                    }
                  >
                    Go to routing
                  </button>
                </div>
              </Show>
            </div>
          </Show>
        </Show>
      </Show>

      {/* -- Delete Agent Modal ----------------------- */}
      <Show when={showDeleteModal()}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteModal(false);
          }}
        >
          <div class="modal-card" style="max-width: 440px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
              <h3 style="margin: 0; font-size: var(--font-size-lg);">Delete {agentName()}</h3>
              <button
                style="background: none; border: none; cursor: pointer; color: hsl(var(--muted-foreground)); padding: 4px;"
                onClick={() => setShowDeleteModal(false)}
                aria-label="Close"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: var(--gap-md);">
              This will permanently delete the{' '}
              <strong style="color: hsl(var(--foreground));">{agentName()}</strong> agent and all
              its data. This action cannot be undone.
            </p>
            <label style="display: block; font-size: var(--font-size-sm); color: hsl(var(--foreground)); margin-bottom: var(--gap-sm);">
              To confirm, type <strong>"{agentName()}"</strong> in the box below
            </label>
            <input
              class="auth-form__input"
              type="text"
              value={deleteConfirmName()}
              onInput={(e) => setDeleteConfirmName(e.currentTarget.value)}
              placeholder={agentName()}
              style="width: 100%; margin-bottom: var(--gap-lg);"
            />
            <button
              class="btn btn--danger btn--sm"
              style="width: 100%;"
              disabled={deleteConfirmName() !== agentName() || deleting()}
              onClick={async () => {
                setDeleting(true);
                try {
                  await deleteAgent(agentName());
                  toast.success(`Agent "${agentName()}" deleted`);
                  navigate('/', { replace: true });
                } catch {
                  setDeleting(false);
                }
              }}
            >
              {deleting() ? (
                <>
                  <span class="spinner" />
                  <span class="sr-only">Deleting…</span>
                </>
              ) : (
                'Delete this agent'
              )}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default Settings;
