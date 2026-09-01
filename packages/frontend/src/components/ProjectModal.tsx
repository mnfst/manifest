import { createEffect, createSignal, Show, type Component } from 'solid-js';
import { createProject, updateProject, type Project } from '../services/api/teams.js';
import { toast } from '../services/toast-store.js';

interface ProjectModalProps {
  open: boolean;
  /** When set, the modal edits this project instead of creating one. */
  project?: Project | null;
  onClose: () => void;
  onSaved: (project: Project) => void;
}

/** Create or edit a project: a name, and an optional description. */
const ProjectModal: Component<ProjectModalProps> = (props) => {
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [saving, setSaving] = createSignal(false);

  createEffect(() => {
    if (!props.open) return;
    setName(props.project?.name ?? '');
    setDescription(props.project?.description ?? '');
    setSaving(false);
  });

  const isEdit = () => !!props.project;

  const handleSave = async () => {
    const trimmed = name().trim();
    if (!trimmed || saving()) return;
    setSaving(true);
    try {
      const saved = isEdit()
        ? await updateProject(props.project!.id, {
            name: trimmed,
            description: description().trim() || null,
          })
        : await createProject({ name: trimmed, description: description().trim() || null });
      toast.success(isEdit() ? `Project "${saved.name}" saved` : `Project "${saved.name}" created`);
      props.onSaved(saved);
      props.onClose();
    } catch {
      toast.error("Couldn't save this project. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLInputElement) void handleSave();
    if (e.key === 'Escape') props.onClose();
  };

  return (
    <Show when={props.open}>
      <div
        class="modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.onClose();
        }}
      >
        <div
          class="modal-card"
          style="max-width: 480px;"
          role="dialog"
          aria-modal="true"
          aria-labelledby="project-modal-title"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          <h2 class="modal-card__title" id="project-modal-title">
            {isEdit() ? 'Edit project' : 'New project'}
          </h2>
          <p class="modal-card__desc">
            A project is a tag an agent carries, so a client or a workstream can be costed.
          </p>

          <div class="field">
            <label class="modal-card__field-label" for="project-name">
              Name
            </label>
            <input
              id="project-name"
              class="modal-card__input modal-card__input--lg"
              type="text"
              placeholder="e.g. HSBC"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              disabled={saving()}
            />
          </div>
          <div class="field">
            <label class="modal-card__field-label" for="project-description">
              Description <span class="field__hint">(optional)</span>
            </label>
            <input
              id="project-description"
              class="modal-card__input modal-card__input--lg"
              type="text"
              placeholder="e.g. Client engagement"
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
              disabled={saving()}
            />
          </div>

          <div class="modal-card__footer">
            <button type="button" class="btn btn--ghost btn--sm" onClick={props.onClose}>
              Cancel
            </button>
            <button
              type="button"
              class="btn btn--primary btn--sm"
              disabled={!name().trim() || saving()}
              onClick={() => void handleSave()}
            >
              {saving() ? <span class="spinner" /> : isEdit() ? 'Save' : 'Create project'}
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default ProjectModal;
