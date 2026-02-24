import { createSignal, createResource, Show, type Component } from "solid-js";
import { useParams, useNavigate, useLocation } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import ErrorState from "../components/ErrorState.jsx";
import SetupStepInstall from "../components/SetupStepInstall.jsx";
import SetupStepConfigure from "../components/SetupStepConfigure.jsx";
import SetupStepVerify from "../components/SetupStepVerify.jsx";
import { CopyButton } from "../components/SetupStepInstall.jsx";
import { getAgentKey, deleteAgent, rotateAgentKey } from "../services/api.js";
import { toast } from "../services/toast-store.js";
import { isLocalMode } from "../services/local-mode.js";

const Settings: Component = () => {
  const params = useParams<{ agentName: string }>();
  const navigate = useNavigate();
  const location = useLocation<{ newApiKey?: string }>();
  const agentName = () => decodeURIComponent(params.agentName);
  const [name, setName] = createSignal(agentName());
  const [saving, setSaving] = createSignal(false);
  const [saved, setSaved] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [deleteConfirmName, setDeleteConfirmName] = createSignal("");
  const [deleting, setDeleting] = createSignal(false);
  const [rotating, setRotating] = createSignal(false);
  const [rotatedKey, setRotatedKey] = createSignal<string | null>(
    (location.state as { newApiKey?: string } | undefined)?.newApiKey ?? null,
  );

  const [apiKeyData, { refetch: refetchKey }] = createResource(
    () => agentName(),
    (n) => getAgentKey(n),
  );

  const endpoint = () => {
    const custom = apiKeyData()?.pluginEndpoint;
    if (custom) return custom;
    const host = window.location.hostname;
    if (host === "app.manifest.build") return null;
    return `${window.location.origin}/otlp`;
  };

  const handleSave = async () => {
    const newName = name().trim();
    if (!newName || newName === agentName()) return;

    setSaving(true);
    navigate(`/agents/${encodeURIComponent(newName)}/settings`, { replace: true });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      const result = await rotateAgentKey(agentName());
      setRotatedKey(result.apiKey);
      toast.success("API key rotated successfully");
      refetchKey();
    } catch {
      // error toast handled by fetchMutate
    } finally {
      setRotating(false);
    }
  };

  return (
    <div class="container--sm">
      <Title>{agentName()} - Settings | Manifest</Title>
      <Meta name="description" content={`Configure settings for ${agentName()}.`} />
      <div class="page-header">
        <div>
          <h1>Settings</h1>
          <span class="breadcrumb">{agentName()} &rsaquo; Configure your agent and connect it to Manifest</span>
        </div>
      </div>

      <h3 class="settings-section__title">General</h3>

      <div class="settings-card">
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Agent name</span>
            <span class="settings-card__label-desc">The display name for this agent across the dashboard.</span>
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
            class="btn btn--outline"
            style="font-size: var(--font-size-sm);"
            onClick={handleSave}
            disabled={saving() || name().trim() === agentName()}
          >
            <span aria-live="polite">{saved() ? "Saved" : saving() ? "Saving..." : "Save"}</span>
          </button>
        </div>
      </div>

      <Show when={!isLocalMode()}>
        <h3 class="settings-section__title">API Key</h3>

        <div class="settings-card">
          <div class="settings-card__row">
            <div class="settings-card__label">
              <span class="settings-card__label-title">OTLP ingest key</span>
              <span class="settings-card__label-desc">Used by your agent to send telemetry data. Rotating creates a new key and invalidates the old one.</span>
            </div>
            <div class="settings-card__control" style="display: flex; align-items: center; gap: 8px;">
              <code style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground));">
                {apiKeyData()?.keyPrefix ?? "..."}...
              </code>
              <button
                class="btn btn--outline"
                style="font-size: var(--font-size-sm);"
                onClick={handleRotate}
                disabled={rotating()}
              >
                {rotating() ? "Rotating..." : "Rotate key"}
              </button>
            </div>
          </div>
          <Show when={rotatedKey()}>
            <div style="padding: 0 var(--gap-md) var(--gap-md);">
              <div style="background: hsl(var(--chart-5) / 0.1); border: 1px solid hsl(var(--chart-5) / 0.3); border-radius: var(--radius); padding: 10px 14px; margin-bottom: 12px; font-size: var(--font-size-sm); color: hsl(var(--foreground));">
                Copy your new API key now — it won't be shown again.
              </div>
              <div style="display: flex; align-items: center; gap: 8px; background: hsl(var(--muted)); border-radius: var(--radius); padding: 10px 14px; font-family: var(--font-mono); font-size: var(--font-size-sm); word-break: break-all;">
                {rotatedKey()}
                <CopyButton text={rotatedKey()!} />
              </div>
            </div>
          </Show>
        </div>

        <h3 class="settings-section__title">Agent setup</h3>

        <Show when={!apiKeyData.loading} fallback={
          <div class="setup-steps">
            <div class="skeleton skeleton--rect" style="width: 100%; height: 200px;" />
          </div>
        }>
          <Show when={!apiKeyData.error} fallback={
            <ErrorState
              error={apiKeyData.error}
              title="Could not load API key"
              message="Failed to fetch your agent's API key. Please try again."
              onRetry={refetchKey}
            />
          }>
            <div class="settings-card" style="padding: var(--gap-lg);">
              <SetupStepInstall stepNumber={1} />
              <SetupStepConfigure
                stepNumber={2}
                apiKey={rotatedKey()}
                keyPrefix={apiKeyData()?.keyPrefix ?? null}
                agentName={agentName()}
                endpoint={endpoint()}
              />
              <SetupStepVerify stepNumber={3} />
            </div>
          </Show>
        </Show>
      </Show>

      <Show when={!isLocalMode()}>
        <h3 class="settings-section__title settings-section__title--danger">Danger zone</h3>

        <div class="settings-card settings-card--danger">
          <div class="settings-card__row">
            <div class="settings-card__label">
              <span class="settings-card__label-title">Delete this agent</span>
              <span class="settings-card__label-desc">Permanently remove this agent and all its activity data. This action cannot be undone.</span>
            </div>
            <div class="settings-card__control">
              <button
                class="btn btn--danger"
                style="font-size: var(--font-size-sm);"
                onClick={() => { setShowDeleteModal(true); setDeleteConfirmName(""); }}
              >
                Delete agent
              </button>
            </div>
          </div>
        </div>

        <Show when={showDeleteModal()}>
          <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteModal(false); }}>
            <div class="modal-card" style="max-width: 440px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--gap-lg);">
                <h3 style="margin: 0; font-size: var(--font-size-lg);">Delete {agentName()}</h3>
                <button
                  style="background: none; border: none; cursor: pointer; color: hsl(var(--muted-foreground)); padding: 4px;"
                  onClick={() => setShowDeleteModal(false)}
                  aria-label="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>
              <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: var(--gap-md);">
                This will permanently delete the <strong style="color: hsl(var(--foreground));">{agentName()}</strong> agent and all its telemetry data. This action cannot be undone.
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
                class="btn btn--danger"
                style="width: 100%; font-size: var(--font-size-sm);"
                disabled={deleteConfirmName() !== agentName() || deleting()}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await deleteAgent(agentName());
                    toast.success(`Agent "${agentName()}" deleted`);
                    navigate("/", { replace: true });
                  } catch {
                    setDeleting(false);
                  }
                }}
              >
                {deleting() ? "Deleting..." : "Delete this agent"}
              </button>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
};

export default Settings;
