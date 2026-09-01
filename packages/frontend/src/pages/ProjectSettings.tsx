import { useNavigate } from '@solidjs/router';
import { createEffect, createSignal, Show, type Component } from 'solid-js';
import {
  archiveProject,
  deleteProject,
  unarchiveProject,
  updateProject,
} from '../services/api/teams.js';
import { toast } from '../services/toast-store.js';
import { useProjectDetail } from './ProjectDetail.jsx';

/** Details, archive, and the delete confirmation for a project. */
const ProjectSettings: Component = () => {
  const { project, projectId, refetchProject } = useProjectDetail();
  const navigate = useNavigate();
  const [name, setName] = createSignal('');
  const [description, setDescription] = createSignal('');
  const [saving, setSaving] = createSignal(false);
  const [archiving, setArchiving] = createSignal(false);
  const [showDelete, setShowDelete] = createSignal(false);
  const [confirmName, setConfirmName] = createSignal('');
  const [deleting, setDeleting] = createSignal(false);

  createEffect(() => {
    const p = project();
    if (p) {
      setName(p.name);
      setDescription(p.description ?? '');
    }
  });

  const changed = () => {
    const p = project();
    if (!p) return false;
    return name().trim() !== p.name || (description().trim() || null) !== p.description;
  };

  const save = async () => {
    if (!name().trim() || saving()) return;
    setSaving(true);
    try {
      await updateProject(projectId(), {
        name: name().trim(),
        description: description().trim() || null,
      });
      toast.success('Project saved');
      refetchProject();
    } catch {
      toast.error("Couldn't save this project.");
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async () => {
    const p = project();
    if (!p || archiving()) return;
    setArchiving(true);
    try {
      if (p.archived_at) {
        await unarchiveProject(p.id);
        toast.success(`${p.name} restored`);
      } else {
        await archiveProject(p.id);
        toast.success(`${p.name} archived`);
      }
      refetchProject();
    } catch {
      toast.error("Couldn't update this project.");
    } finally {
      setArchiving(false);
    }
  };

  const closeDelete = () => {
    setShowDelete(false);
    setConfirmName('');
  };

  const handleDelete = async () => {
    const p = project();
    if (!p || confirmName() !== p.name || deleting()) return;
    setDeleting(true);
    try {
      await deleteProject(p.id);
      toast.success(`Project "${p.name}" deleted`);
      closeDelete();
      navigate('/projects', { replace: true });
    } catch {
      toast.error("Couldn't delete this project.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Show when={project()}>
      <div class="settings-card">
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Project name</span>
            <span class="settings-card__label-desc">
              Renaming keeps history under the new name.
            </span>
          </div>
          <div class="settings-card__control">
            <input
              class="settings-card__input"
              type="text"
              aria-label="Project name"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
            />
          </div>
        </div>
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Description</span>
            <span class="settings-card__label-desc">Optional, e.g. "Client engagement".</span>
          </div>
          <div class="settings-card__control">
            <input
              class="settings-card__input"
              type="text"
              aria-label="Project description"
              value={description()}
              onInput={(e) => setDescription(e.currentTarget.value)}
            />
          </div>
        </div>
        <div class="settings-card__footer">
          <button
            type="button"
            class="btn btn--primary btn--sm"
            onClick={() => void save()}
            disabled={saving() || !changed() || !name().trim()}
          >
            {saving() ? <span class="spinner" /> : 'Save'}
          </button>
        </div>
      </div>

      <h2 class="settings-section__title">Archive</h2>
      <div class="settings-card">
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">
              {project()!.archived_at ? 'Restore this project' : 'Archive this project'}
            </span>
            <span class="settings-card__label-desc">
              Archived projects are hidden everywhere by default. Nothing is lost; the Include
              archived checkbox brings them back.
            </span>
          </div>
          <div class="settings-card__control">
            <button
              type="button"
              class="btn btn--outline btn--sm"
              disabled={archiving()}
              onClick={() => void toggleArchive()}
            >
              {project()!.archived_at ? 'Restore' : 'Archive'}
            </button>
          </div>
        </div>
      </div>

      <h2 class="settings-section__title settings-section__title--danger">Danger zone</h2>
      <div class="settings-card settings-card--danger">
        <div class="settings-card__row">
          <div class="settings-card__label">
            <span class="settings-card__label-title">Delete this project</span>
            <span class="settings-card__label-desc">
              Deleting removes the tag from its agents. History stays attributed to the agents and
              their owners.
            </span>
          </div>
          <div class="settings-card__control">
            <button
              type="button"
              class="btn btn--danger btn--sm"
              onClick={() => {
                setShowDelete(true);
                setConfirmName('');
              }}
            >
              Delete project
            </button>
          </div>
        </div>
      </div>

      <Show when={showDelete()}>
        <div
          class="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDelete();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') closeDelete();
          }}
        >
          <div
            class="modal-card"
            style="max-width: 440px;"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="project-delete-title"
              style="margin: 0 0 var(--gap-md); font-size: var(--font-size-lg);"
            >
              Delete {project()!.name}
            </h3>
            <p style="font-size: var(--font-size-sm); color: hsl(var(--muted-foreground)); margin-bottom: var(--gap-md);">
              This removes the{' '}
              <strong style="color: hsl(var(--foreground));">{project()!.name}</strong> tag from
              every agent that carries it. Consider archiving instead: nothing is lost and the
              project can come back.
            </p>
            <label
              for="project-delete-confirm"
              style="display: block; font-size: var(--font-size-sm); color: hsl(var(--foreground)); margin-bottom: var(--gap-sm);"
            >
              To confirm, type <strong>"{project()!.name}"</strong> below
            </label>
            <input
              id="project-delete-confirm"
              class="modal-card__input modal-card__input--lg"
              type="text"
              value={confirmName()}
              onInput={(e) => setConfirmName(e.currentTarget.value)}
              placeholder={project()!.name}
              style="margin-bottom: var(--gap-lg);"
            />
            <div class="modal-card__footer">
              <button
                type="button"
                class="btn btn--ghost btn--sm"
                onClick={closeDelete}
                disabled={deleting()}
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn--danger btn--sm"
                onClick={() => void handleDelete()}
                disabled={confirmName() !== project()!.name || deleting()}
              >
                {deleting() ? <span class="spinner" /> : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </Show>
  );
};

export default ProjectSettings;
