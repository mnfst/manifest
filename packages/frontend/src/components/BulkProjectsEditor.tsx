import { createResource, createSignal, For, Show, type Component } from 'solid-js';
import {
  bulkUpdateProjects,
  getProjects,
  getSelectionProjects,
  type BulkResult,
  type BulkSelection,
  type Project,
} from '../services/api/teams.js';
import { toast } from '../services/toast-store.js';
import ErrorState from './ErrorState.jsx';
import TriStateCheckbox, { type TriState } from './TriStateCheckbox.jsx';

interface BulkProjectsEditorProps {
  open: boolean;
  selection: BulkSelection;
  selectedCount: number;
  onClose: () => void;
  onApplied: (result: BulkResult) => void;
}

/**
 * One editor that adds and removes projects at the same time. Per project:
 * ticked (every selected agent carries it), dash (some do), empty (none do).
 * Ticking a dash applies the project to all selected agents, unticking
 * removes it from all, and a dash left alone changes nothing.
 */
const BulkProjectsEditor: Component<BulkProjectsEditorProps> = (props) => {
  const [add, setAdd] = createSignal<Set<string>>(new Set<string>());
  const [remove, setRemove] = createSignal<Set<string>>(new Set<string>());
  const [applying, setApplying] = createSignal(false);

  // Archived projects are included so an association a selected agent still
  // carries can be shown and removed; they never appear as new choices.
  const [data, { refetch }] = createResource(
    () => (props.open ? props.selection : null),
    async (selection) => {
      setAdd(new Set<string>());
      setRemove(new Set<string>());
      const [projects, counts] = await Promise.all([
        getProjects({ include_archived: true }).then((r) => r.projects),
        getSelectionProjects(selection),
      ]);
      return { projects, counts };
    },
  );
  const loaded = () => (data.error ? undefined : data());

  const originalState = (project: Project): TriState => {
    const count = loaded()?.counts[project.id] ?? 0;
    if (count <= 0) return 'none';
    return count >= props.selectedCount ? 'all' : 'some';
  };

  const currentState = (project: Project): TriState => {
    if (add().has(project.id)) return 'all';
    if (remove().has(project.id)) return 'none';
    return originalState(project);
  };

  const toggle = (project: Project) => {
    const original = originalState(project);
    const current = currentState(project);
    const nextAdd = new Set(add());
    const nextRemove = new Set(remove());
    nextAdd.delete(project.id);
    nextRemove.delete(project.id);
    // Ticking from empty or dash → add to all; unticking from ticked → remove
    // from all. A change that lands back on the original state is a no-op.
    const target: TriState = current === 'all' ? 'none' : 'all';
    if (target !== original) {
      if (target === 'all') nextAdd.add(project.id);
      else nextRemove.add(project.id);
    }
    setAdd(nextAdd);
    setRemove(nextRemove);
  };

  const carried = () => (loaded()?.projects ?? []).filter((p) => originalState(p) !== 'none');
  const untouched = () =>
    (loaded()?.projects ?? []).filter((p) => originalState(p) === 'none' && !p.archived_at);
  const dirty = () => add().size + remove().size > 0;

  const apply = async () => {
    setApplying(true);
    try {
      const result = await bulkUpdateProjects(props.selection, {
        add: [...add()],
        remove: [...remove()],
      });
      props.onApplied(result);
    } catch {
      toast.error("Couldn't update the projects on the selected agents.");
    } finally {
      setApplying(false);
    }
  };

  const row = (project: Project) => (
    <label class="tri-list__row">
      <TriStateCheckbox
        state={currentState(project)}
        onToggle={() => toggle(project)}
        label={project.name}
      />
      {project.name}
      <Show when={project.archived_at}>
        <span class="status-badge status-badge--neutral">Archived</span>
      </Show>
      <Show when={originalState(project) !== 'none'}>
        <span class="tri-list__count">
          {loaded()?.counts[project.id] ?? 0} of {props.selectedCount}
        </span>
      </Show>
    </label>
  );

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
          style="max-width: 420px;"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-projects-title"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 class="modal-card__title" id="bulk-projects-title">
            Projects
          </h2>
          <p class="modal-card__desc">
            {props.selectedCount} agent{props.selectedCount === 1 ? '' : 's'} selected. A tick
            applies the project to all of them, an empty box removes it from all of them, and a dash
            left alone changes nothing.
          </p>

          <Show
            when={!data.error}
            fallback={
              <ErrorState
                title="Couldn't load the projects"
                message="The project list or the selection summary did not load."
                onRetry={() => void refetch()}
              />
            }
          >
            <Show
              when={loaded()}
              fallback={<div class="skeleton skeleton--rect" style="width: 100%; height: 120px;" />}
            >
              <Show
                when={carried().length + untouched().length > 0}
                fallback={
                  <p class="field__hint">No projects yet. Create one on the Projects page.</p>
                }
              >
                <div class="tri-list">
                  <For each={carried()}>{row}</For>
                  <Show when={carried().length > 0 && untouched().length > 0}>
                    <hr class="custom-select__separator" />
                  </Show>
                  <For each={untouched()}>{row}</For>
                </div>
              </Show>
            </Show>
          </Show>

          <div class="modal-card__footer">
            <button type="button" class="btn btn--ghost btn--sm" onClick={props.onClose}>
              Cancel
            </button>
            <button
              type="button"
              class="btn btn--primary btn--sm"
              disabled={!dirty() || applying()}
              onClick={() => void apply()}
            >
              {applying() ? (
                <span class="spinner" />
              ) : (
                `Apply to ${props.selectedCount} agent${props.selectedCount === 1 ? '' : 's'}`
              )}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default BulkProjectsEditor;
