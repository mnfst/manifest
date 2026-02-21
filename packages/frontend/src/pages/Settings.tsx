import { createSignal, createResource, Show, For, type Component } from "solid-js";
import { A, useParams, useNavigate, useLocation } from "@solidjs/router";
import { Title, Meta } from "@solidjs/meta";
import ErrorState from "../components/ErrorState.jsx";
import SetupStepInstall from "../components/SetupStepInstall.jsx";
import SetupStepConfigure from "../components/SetupStepConfigure.jsx";
import SetupStepVerify from "../components/SetupStepVerify.jsx";
import { CopyButton } from "../components/SetupStepInstall.jsx";
import {
  getAgentKey,
  deleteAgent,
  rotateAgentKey,
  getProviders,
  connectProvider,
  disconnectProvider,
} from "../services/api.js";
import { toast } from "../services/toast-store.js";
import { PROVIDERS, type ProviderDef } from "../services/providers.js";
import { providerIcon } from "../components/ProviderIcon.js";
import { agentPath } from "../services/routing.js";

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

  // LLM Providers state (backend-backed)
  const [providerList, { refetch: refetchProviders }] = createResource(getProviders);
  const [providerModal, setProviderModal] = createSignal<ProviderDef | null>(null);
  const [providerInput, setProviderInput] = createSignal("");

  const isActive = (provId: string): boolean => {
    const list = providerList();
    if (!list) return false;
    return list.some((p) => p.provider === provId && p.is_active);
  };

  const activeCount = () => providerList()?.filter((p) => p.is_active).length ?? 0;

  const openProviderModal = (prov: ProviderDef) => {
    setProviderModal(prov);
    setProviderInput("");
  };

  const closeProviderModal = () => setProviderModal(null);

  const handleProviderSave = async () => {
    const prov = providerModal();
    if (!prov) return;
    const input = providerInput().trim();
    if (!input) return;

    try {
      await connectProvider({ provider: prov.id, apiKey: input });
      await refetchProviders();
      closeProviderModal();
      toast.success(`${prov.name} connected`);
    } catch {
      // error toast from fetchMutate
    }
  };

  const handleProviderRemove = async () => {
    const prov = providerModal();
    if (!prov) return;

    try {
      const result = await disconnectProvider(prov.id);
      await refetchProviders();
      closeProviderModal();

      if (result?.notifications?.length) {
        for (const msg of result.notifications) {
          toast.error(msg);
        }
      }
      toast.success(`${prov.name} disconnected`);
    } catch {
      // error toast from fetchMutate
    }
  };

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

  const TABS = ["General", "LLM Providers", "Integration"] as const;
  type Tab = (typeof TABS)[number];
  const [tab, setTab] = createSignal<Tab>("General");

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

      <div class="panel__tabs" style="margin-bottom: var(--gap-xl);">
        <For each={TABS}>
          {(t) => (
            <button
              class="panel__tab"
              classList={{ "panel__tab--active": tab() === t }}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          )}
        </For>
      </div>

      {/* ── Tab: General ─────────────────────────── */}
      <Show when={tab() === "General"}>
        <h3 class="settings-section__title">Agent name</h3>

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
              class="btn btn--primary"
              style="font-size: var(--font-size-sm);"
              onClick={handleSave}
              disabled={saving() || name().trim() === agentName()}
            >
              <span aria-live="polite">{saved() ? "Saved" : saving() ? "Saving..." : "Save"}</span>
            </button>
          </div>
        </div>

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
      </Show>

      {/* ── Tab: LLM Providers ───────────────────── */}
      <Show when={tab() === "LLM Providers"}>
        <div class="provider-list">
          <For each={PROVIDERS}>
            {(prov) => {
              const active = () => isActive(prov.id);
              return (
                <div class="provider-card" classList={{ "provider-card--active": active() }}>
                  <span class="provider-card__logo">
                    {providerIcon(prov.id, 20) ?? (
                      <span class="provider-card__logo-letter" style={{ background: prov.color }}>{prov.initial}</span>
                    )}
                  </span>
                  <span class="provider-card__name">
                    {prov.name}
                    <Show when={active()}>
                      <span class="provider-card__check">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                      </span>
                    </Show>
                  </span>
                  <button class="provider-card__action" onClick={() => openProviderModal(prov)}>
                    {active() ? "Edit" : `Add ${prov.inputLabel}`}
                  </button>
                </div>
              );
            }}
          </For>
        </div>

        <Show when={activeCount() >= 1}>
          <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-top: var(--gap-sm);">
            Models are automatically assigned to tiers. Customize in{" "}
            <A href={agentPath(agentName(), "/routing")} style="color: hsl(var(--foreground)); font-weight: 600; text-decoration: underline;">Routing</A>.
          </p>
        </Show>
      </Show>

      {/* ── Tab: Integration ─────────────────────── */}
      <Show when={tab() === "Integration"}>
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

        <h3 class="settings-section__title">Setup</h3>

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

      {/* ── Provider API Key Modal (shared) ───────── */}
      <Show when={providerModal()}>
        {(prov) => (
          <div class="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeProviderModal(); }}>
            <div class="modal-card" style="max-width: 440px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--gap-lg);">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="display: flex; align-items: center; justify-content: center; width: 54px; height: 54px; background: hsl(var(--muted)); border: 1px solid hsl(var(--border)); border-radius: 5px; flex-shrink: 0;">
                    {providerIcon(prov().id, 22) ?? (
                      <span class="provider-card__logo-letter" style={{ background: prov().color, width: "28px", height: "28px" }}>{prov().initial}</span>
                    )}
                  </span>
                  <div style="display: flex; flex-direction: column; justify-content: center; gap: 1px;">
                    <h3 style="margin: 0; font-size: var(--font-size-lg); line-height: 1.2;">
                      {isActive(prov().id) ? `Edit ${prov().name}` : `Connect ${prov().name}`}
                    </h3>
                    <span style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); line-height: 1.2;">
                      {prov().subtitle}
                    </span>
                  </div>
                </div>
                <button
                  style="background: none; border: none; cursor: pointer; color: hsl(var(--muted-foreground)); padding: 4px;"
                  onClick={closeProviderModal}
                  aria-label="Close"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <label class="modal-card__field-label">{prov().inputLabel}</label>
              <input
                class="modal-card__input"
                style="margin-bottom: 6px;"
                type={prov().inputType === "apiKey" ? "password" : "text"}
                placeholder={prov().placeholder}
                value={providerInput()}
                onInput={(e) => setProviderInput(e.currentTarget.value)}
              />
              <Show when={prov().inputType === "apiKey"}>
                <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-top: 6px; margin-bottom: 0;">
                  Need an API key?{" "}
                  <a
                    href={prov().docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style="color: hsl(var(--foreground)); text-decoration: underline; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;"
                  >
                    Get one here
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                </p>
              </Show>

              <div style="display: flex; gap: 8px; margin-top: var(--gap-lg);">
                <Show when={isActive(prov().id)}>
                  <button class="btn btn--outline" style="color: hsl(var(--destructive));" onClick={handleProviderRemove}>
                    Remove
                  </button>
                </Show>
                <div style="flex: 1;" />
                <button class="btn btn--outline" onClick={closeProviderModal}>Cancel</button>
                <button class="btn btn--primary" onClick={handleProviderSave} disabled={!providerInput().trim()}>
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </Show>

      {/* ── Delete Agent Modal (shared) ───────────── */}
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
    </div>
  );
};

export default Settings;
