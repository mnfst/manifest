import { createEffect, createResource, createSignal, For, Show, type Component } from 'solid-js';
import {
  applyModelAccessToAgents,
  listAgents,
  updateAgentModelAccess,
  type AgentRow,
  type BulkResult,
  type ProviderModelAccess,
} from '../services/api/teams.js';
import { PROVIDERS } from '../services/providers.js';
import { toast } from '../services/toast-store.js';
import BulkResultNotice from './BulkResultNotice.jsx';

export interface ModelAccessModalProps {
  open: boolean;
  /** The agent whose access is being edited. */
  agentName: string;
  access: ProviderModelAccess;
  onClose: () => void;
  onSaved: (updated: ProviderModelAccess) => void;
  /**
   * Agents offered by "Apply to other agents". Defaults to every live agent in
   * the tenant; a user page passes that user's agents instead.
   */
  applyTargets?: AgentRow[];
}

const providerLabel = (id: string) => PROVIDERS.find((p) => p.id === id)?.name ?? id;

/**
 * One switch per model plus an "All <Provider> models" master switch that is
 * its own state: while it is on, a model the provider publishes later is
 * allowed automatically; once a partial selection is in effect, a new model
 * arrives off. A model used by routing cannot be turned off.
 */
const ModelAccessModal: Component<ModelAccessModalProps> = (props) => {
  const [allModels, setAllModels] = createSignal(props.access.all_models);
  const [enabled, setEnabled] = createSignal<Set<string>>(new Set());
  const [saving, setSaving] = createSignal(false);
  const [applying, setApplying] = createSignal(false);
  const [applyOpen, setApplyOpen] = createSignal(false);
  const [targets, setTargets] = createSignal<Set<string>>(new Set());
  const [applyResult, setApplyResult] = createSignal<BulkResult | null>(null);

  // Reset from the incoming access every time the modal opens.
  createEffect(() => {
    if (!props.open) return;
    setAllModels(props.access.all_models);
    setEnabled(new Set(props.access.models.filter((m) => m.enabled).map((m) => m.id)));
    setApplyOpen(false);
    setTargets(new Set<string>());
    setApplyResult(null);
  });

  const [candidates] = createResource(
    () => (props.open && applyOpen() ? props.agentName : null),
    async (source): Promise<AgentRow[]> => {
      if (props.applyTargets) return props.applyTargets.filter((a) => a.agent_name !== source);
      try {
        const res = await listAgents({ page_size: 1000 });
        return res.agents.filter((a) => a.agent_name !== source);
      } catch {
        return [];
      }
    },
  );

  const isOn = (id: string) => allModels() || enabled().has(id);
  const enabledCount = () => props.access.models.filter((m) => isOn(m.id)).length;

  const toggleModel = (id: string, inRouting: boolean) => {
    if (inRouting && isOn(id)) return;
    if (allModels()) {
      // Leaving the "all models" state: materialize the current selection,
      // minus the one being turned off, as a partial selection.
      const next = new Set(props.access.models.map((m) => m.id));
      next.delete(id);
      setAllModels(false);
      setEnabled(next);
      return;
    }
    const next = new Set(enabled());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEnabled(next);
  };

  const toggleAll = () => {
    if (allModels()) {
      setAllModels(false);
      setEnabled(new Set(props.access.models.filter((m) => m.in_routing).map((m) => m.id)));
    } else {
      setAllModels(true);
    }
  };

  const save = async (): Promise<ProviderModelAccess | null> => {
    setSaving(true);
    try {
      const updated = await updateAgentModelAccess(props.agentName, props.access.user_provider_id, {
        all_models: allModels(),
        enabled_model_ids: allModels() ? [] : [...enabled()],
      });
      props.onSaved(updated);
      return updated;
    } catch {
      toast.error("Couldn't save model access. Please try again.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const updated = await save();
    if (updated) {
      toast.success(`${providerLabel(props.access.provider)} model access saved`);
      props.onClose();
    }
  };

  const toggleTarget = (name: string) => {
    const next = new Set(targets());
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setTargets(next);
  };

  const handleApply = async () => {
    const names = [...targets()];
    if (names.length === 0) return;
    setApplying(true);
    try {
      const saved = await save();
      if (!saved) return;
      const result = await applyModelAccessToAgents(
        props.agentName,
        props.access.user_provider_id,
        names,
      );
      setApplyResult(result);
    } catch {
      toast.error("Couldn't apply model access to the other agents.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Show when={props.open}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') props.onClose();
        }}
      >
        <div
          class="modal-card"
          style="max-width: 520px;"
          role="dialog"
          aria-modal="true"
          aria-labelledby="model-access-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="modal-card__title" id="model-access-title">
            {providerLabel(props.access.provider)} models
          </h2>
          <p class="modal-card__desc">
            Choose which models this agent may call. A model used by routing cannot be turned off.
          </p>

          <div class="model-access__provider">
            <span class="model-access__grow">
              <span class="model-access__title">
                All {providerLabel(props.access.provider)} models
              </span>
              <span class="model-access__count">
                {enabledCount()} of {props.access.models.length} enabled
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={allModels()}
              aria-label={`All ${providerLabel(props.access.provider)} models`}
              class="settings-switch"
              classList={{ 'settings-switch--on': allModels() }}
              disabled={saving()}
              onClick={toggleAll}
            >
              <span class="settings-switch__track">
                <span class="settings-switch__thumb" />
              </span>
            </button>
          </div>

          <Show
            when={props.access.models.length > 0}
            fallback={
              <p class="field__hint" style="margin-bottom: var(--gap-md);">
                No models discovered for this connection yet. Refresh models on the Routing page.
              </p>
            }
          >
            <div class="model-access__list">
              <For each={props.access.models}>
                {(model) => (
                  <div
                    class="model-access__row"
                    classList={{ 'model-access__row--off': !isOn(model.id) }}
                  >
                    <span class="model-access__grow">
                      {model.name}
                      <Show when={model.in_routing}>
                        {' '}
                        <span class="project-tag project-tag--muted">in routing</span>
                      </Show>
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isOn(model.id)}
                      aria-label={model.name}
                      aria-disabled={model.in_routing && isOn(model.id)}
                      class="settings-switch"
                      classList={{ 'settings-switch--on': isOn(model.id) }}
                      disabled={saving()}
                      onClick={() => toggleModel(model.id, model.in_routing)}
                    >
                      <span class="settings-switch__track">
                        <span class="settings-switch__thumb" />
                      </span>
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={applyOpen()}>
            <div class="duplicate-agent__section" style="margin-top: var(--gap-md);">
              <div class="duplicate-agent__section-header">Apply to other agents</div>
              <Show when={applyResult()}>
                <BulkResultNotice
                  result={applyResult()!}
                  action="Model access"
                  onDismiss={() => setApplyResult(null)}
                />
              </Show>
              <Show
                when={(candidates() ?? []).length > 0}
                fallback={<p class="field__hint">No other agents to apply this to.</p>}
              >
                <div class="tri-list" style="max-height: 200px; overflow-y: auto;">
                  <For each={candidates() ?? []}>
                    {(agent) => (
                      <label class="tri-list__row">
                        <input
                          type="checkbox"
                          checked={targets().has(agent.agent_name)}
                          onChange={() => toggleTarget(agent.agent_name)}
                        />
                        {agent.display_name}
                        <Show when={agent.owner}>
                          <span class="tri-list__count">{agent.owner!.name}</span>
                        </Show>
                      </label>
                    )}
                  </For>
                </div>
                <div class="inline-edit__actions" style="margin-top: var(--gap-sm);">
                  <button
                    type="button"
                    class="btn btn--ghost btn--sm"
                    onClick={() =>
                      setTargets(new Set((candidates() ?? []).map((a) => a.agent_name)))
                    }
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    class="btn btn--outline btn--sm"
                    disabled={targets().size === 0 || applying() || saving()}
                    onClick={() => void handleApply()}
                  >
                    {applying() ? (
                      <span class="spinner" />
                    ) : (
                      `Apply to ${targets().size} agent${targets().size === 1 ? '' : 's'}`
                    )}
                  </button>
                </div>
              </Show>
            </div>
          </Show>

          <div class="model-access__footer">
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              onClick={() => setApplyOpen(!applyOpen())}
              aria-expanded={applyOpen()}
            >
              Apply to other agents
            </button>
            <div style="display: flex; gap: var(--gap-sm);">
              <button type="button" class="btn btn--ghost btn--sm" onClick={props.onClose}>
                Cancel
              </button>
              <button
                type="button"
                class="btn btn--primary btn--sm"
                disabled={saving()}
                onClick={() => void handleSave()}
              >
                {saving() ? <span class="spinner" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ModelAccessModal;
