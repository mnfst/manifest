import { Meta, Title } from '@solidjs/meta';
import { useLocation, useNavigate, useParams } from '@solidjs/router';
import { createResource, createSignal, ErrorBoundary, Show, type Component } from 'solid-js';
import CopyButton from '../components/CopyButton.jsx';
import ErrorState from '../components/ErrorState.jsx';
import AgentTypePicker from '../components/AgentTypePicker.jsx';
import SetupStepAddProvider from '../components/SetupStepAddProvider.jsx';
import { agentDisplayName } from '../services/agent-display-name.js';
import {
  deleteAgent,
  getAgentInfo,
  getAgentKey,
  renameAgent,
  rotateAgentKey,
  updateAgent,
} from '../services/api.js';
import { isLocalMode } from '../services/local-mode.js';
import { markAgentCreated } from '../services/recent-agents.js';
import { toast } from '../services/toast-store.js';
import type { AgentCategory, AgentPlatform } from 'manifest-shared';

const Settings: Component = () => {
  const params = useParams<{ agentName: string }>();
  const navigate = useNavigate();
  const location = useLocation<{ newApiKey?: string }>();
  const agentName = () => decodeURIComponent(params.agentName);

  const [name, setName] = createSignal(agentName());
  const [saving, setSaving] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [deleteConfirmName, setDeleteConfirmName] = createSignal('');
  const [deleting, setDeleting] = createSignal(false);
  const [rotating, setRotating] = createSignal(false);
  const [rotatedKey, setRotatedKey] = createSignal<string | null>(
    (location.state as { newApiKey?: string } | undefined)?.newApiKey ?? null,
  );
  const [savingType, setSavingType] = createSignal(false);

  const [agentInfo, { refetch: refetchInfo }] = createResource(() => agentName(), getAgentInfo);
  const [apiKeyData, { refetch: refetchKey }] = createResource(() => agentName(), getAgentKey);

  const [category, setCategory] = createSignal<AgentCategory | null>(null);
  const [platform, setPlatform] = createSignal<AgentPlatform | null>(null);
  const [typeInitialized, setTypeInitialized] = createSignal(false);

  // Sync category/platform from fetched data once
  const initType = () => {
    if (!typeInitialized() && agentInfo()) {
      setCategory((agentInfo()?.agent_category as AgentCategory) ?? null);
      setPlatform((agentInfo()?.agent_platform as AgentPlatform) ?? null);
      setTypeInitialized(true);
    }
    return true;
  };

  const [keyRevealed, setKeyRevealed] = createSignal(false);
  const keyData = () => (apiKeyData.error ? undefined : apiKeyData());
  const fullKey = () => rotatedKey() ?? keyData()?.apiKey ?? null;
  const displayedKey = () => {
    const key = fullKey();
    if (!key) return `${keyData()?.keyPrefix ?? '...'}...`;
    return keyRevealed() ? key : `${keyData()?.keyPrefix ?? '...'}...`;
  };

  const baseUrl = () => {
    const custom = keyData()?.pluginEndpoint;
    if (custom) return custom;
    const host = window.location.hostname;
    if (host === 'app.manifest.build') return 'https://app.manifest.build/v1';
    return `${window.location.origin}/v1`;
  };

  const origCategory = () => (agentInfo()?.agent_category as AgentCategory) ?? null;
  const origPlatform = () => (agentInfo()?.agent_platform as AgentPlatform) ?? null;
  const nameChanged = () => name().trim() !== agentName() && name().trim() !== '';
  const typeChanged = () => category() !== origCategory() || platform() !== origPlatform();
  const hasChanges = () => nameChanged() || typeChanged();

  const handleSaveAll = async () => {
    setSaving(true);
    setSavingType(true);
    try {
      if (typeChanged() && category() && platform()) {
        await updateAgent(agentName(), {
          agent_category: category()!,
          agent_platform: platform()!,
        });
        refetchInfo();
      }
      if (nameChanged()) {
        const result = await renameAgent(agentName(), name().trim());
        const slug = (result?.name as string) ?? name().trim();
        markAgentCreated(slug);
        window.location.replace(`/agents/${encodeURIComponent(slug)}/settings`);
        return;
      }
      if (typeChanged()) toast.success('Agent type updated');
    } catch {
      setName(agentName());
    } finally {
      setSaving(false);
      setSavingType(false);
    }
  };

  const scrollToTypeSection = () => {
    document.getElementById('agent-type-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      const result = await rotateAgentKey(agentName());
      setRotatedKey(result.apiKey);
      setKeyRevealed(true);
      toast.success('API key rotated successfully');
      refetchKey();
    } catch {
      // error toast handled by fetchMutate
    } finally {
      setRotating(false);
    }
  };

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

      {/* -- Agent Name + Type ---------------------- */}
      <div class="settings-card" id="agent-type-section">
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

        <Show when={initType()}>
          <div style="padding: 0 var(--gap-lg) var(--gap-md);">
            <span class="settings-card__label-title" style="display: block; margin-bottom: 8px;">
              Agent type
            </span>
            <AgentTypePicker
              category={category()}
              platform={platform()}
              onCategoryChange={(c) => {
                setCategory(c);
                setPlatform(null);
              }}
              onPlatformChange={setPlatform}
              disabled={savingType()}
            />
          </div>
        </Show>

        <div class="settings-card__footer">
          <button
            class="btn btn--primary btn--sm"
            onClick={handleSaveAll}
            disabled={saving() || savingType() || !hasChanges()}
          >
            {saving() || savingType() ? (
              <>
                <span class="spinner" />
                <span class="sr-only">Saving...</span>
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>

      {/* -- API Key ----------------------------------- */}
      <ErrorBoundary
        fallback={(err, reset) => (
          <ErrorState
            error={err}
            title="Something went wrong"
            message="An error occurred."
            onRetry={reset}
          />
        )}
      >
        <h3 class="settings-section__title">API Key</h3>
        <div class="settings-card">
          <div class="settings-card__body">
            <span class="settings-card__label-title">Agent API key</span>
            <span class="settings-card__label-desc" style="font-size: 14px;">
              This key authenticates your agent's requests to Manifest. Rotating it generates a new
              key and immediately invalidates the current one.
            </span>
            <div class="settings-card__key-row">
              <code class="settings-card__key-value">{displayedKey()}</code>
              <div class="settings-card__key-actions">
                <Show when={fullKey()}>
                  <button
                    class="btn btn--ghost btn--sm"
                    onClick={() => setKeyRevealed(!keyRevealed())}
                    aria-label={keyRevealed() ? 'Hide API key' : 'Reveal API key'}
                    title={keyRevealed() ? 'Hide' : 'Reveal'}
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
                      aria-hidden="true"
                    >
                      <Show
                        when={keyRevealed()}
                        fallback={
                          <>
                            <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        }
                      >
                        <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
                        <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
                        <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
                        <path d="m2 2 20 20" />
                      </Show>
                    </svg>
                  </button>
                </Show>
                <Show when={fullKey()}>
                  <CopyButton text={fullKey()!} />
                </Show>
              </div>
            </div>
          </div>
          <div class="settings-card__footer">
            <button class="btn btn--outline btn--sm" onClick={handleRotate} disabled={rotating()}>
              {rotating() ? (
                <>
                  <span class="spinner" />
                  <span class="sr-only">Rotating...</span>
                </>
              ) : (
                'Rotate key'
              )}
            </button>
          </div>
        </div>

        {/* -- Setup Instructions ---------------------- */}
        <h3 class="settings-section__title">Setup</h3>
        <Show
          when={!apiKeyData.loading}
          fallback={<div class="skeleton skeleton--rect" style="width: 100%; height: 200px;" />}
        >
          <Show when={apiKeyData.error}>
            <div style="background: hsl(var(--chart-5) / 0.1); border: 1px solid hsl(var(--chart-5) / 0.3); border-radius: var(--radius); padding: 10px 14px; margin-bottom: var(--gap-md); font-size: var(--font-size-sm);">
              Could not load your API key. Use <strong>Rotate key</strong> above to generate a new
              one.
            </div>
          </Show>
          <div class="settings-card" style="padding: var(--gap-lg);">
            <SetupStepAddProvider
              apiKey={rotatedKey() ?? keyData()?.apiKey ?? null}
              keyPrefix={keyData()?.keyPrefix ?? null}
              baseUrl={baseUrl()}
              hideFullKey
              platform={platform()}
              onChangeType={scrollToTypeSection}
            />
          </div>
        </Show>
      </ErrorBoundary>

      {/* -- Danger Zone -------------------------------- */}
      <Show when={!isLocalMode() || agentName() !== 'local-agent'}>
        <h3 class="settings-section__title settings-section__title--danger">Danger zone</h3>
        <div class="settings-card settings-card--danger">
          <div class="settings-card__row">
            <div class="settings-card__label">
              <span class="settings-card__label-title">Delete this agent</span>
              <span class="settings-card__label-desc">
                Permanently delete this agent, its API key, and all recorded messages and analytics.
                This action cannot be undone.
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

      {/* -- Delete Modal ------------------------------ */}
      <Show when={showDeleteModal()}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteModal(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setShowDeleteModal(false);
          }}
        >
          <div
            class="modal-card"
            style="max-width: 440px;"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-agent-modal-title"
          >
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
              <h3 id="delete-agent-modal-title" style="margin: 0; font-size: var(--font-size-lg);">
                Delete {agentName()}
              </h3>
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
                  aria-hidden="true"
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
            <label
              for="delete-confirm-input"
              style="display: block; font-size: var(--font-size-sm); color: hsl(var(--foreground)); margin-bottom: var(--gap-sm);"
            >
              To confirm, type <strong>"{agentName()}"</strong> in the box below
            </label>
            <input
              id="delete-confirm-input"
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
                  <span class="sr-only">Deleting...</span>
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
