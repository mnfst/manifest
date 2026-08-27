import { createResource, createSignal, For, onCleanup, Show, type Component } from 'solid-js';
import { getProjects, setAgentProjects, type ProjectRef } from '../services/api/teams.js';
import { toast } from '../services/toast-store.js';

interface AgentProjectsEditorProps {
  agentName: string;
  projects: ProjectRef[];
  onChange: (projects: ProjectRef[]) => void;
}

/**
 * "+ Project" popover on an agent header: tick the projects this agent
 * carries. Each tick saves immediately through PUT /agents/:name/projects.
 */
const AgentProjectsEditor: Component<AgentProjectsEditorProps> = (props) => {
  const [open, setOpen] = createSignal(false);
  const [saving, setSaving] = createSignal(false);
  let ref: HTMLDivElement | undefined;

  const [all] = createResource(
    () => open(),
    async (isOpen) => {
      if (!isOpen) return [];
      try {
        return (await getProjects()).projects;
      } catch {
        return [];
      }
    },
  );

  const onClickOutside = (e: MouseEvent) => {
    if (ref && !ref.contains(e.target as Node)) setOpen(false);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
  };
  document.addEventListener('click', onClickOutside);
  document.addEventListener('keydown', onKeyDown);
  onCleanup(() => {
    document.removeEventListener('click', onClickOutside);
    document.removeEventListener('keydown', onKeyDown);
  });

  const has = (id: string) => props.projects.some((p) => p.id === id);

  const toggle = async (project: ProjectRef) => {
    if (saving()) return;
    const next = has(project.id)
      ? props.projects.filter((p) => p.id !== project.id)
      : [...props.projects, project];
    setSaving(true);
    try {
      await setAgentProjects(
        props.agentName,
        next.map((p) => p.id),
      );
      props.onChange(next);
    } catch {
      toast.error("Couldn't update this agent's projects.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div class="inline-edit" ref={ref}>
      <button
        type="button"
        class="chip chip--button"
        aria-haspopup="true"
        aria-expanded={open()}
        onClick={() => setOpen(!open())}
      >
        + Project
      </button>
      <Show when={open()}>
        <div class="inline-edit__popover" role="dialog" aria-label="Projects for this agent">
          <Show
            when={(all() ?? []).length > 0}
            fallback={
              <span class="field__hint">No projects yet. Create one on the Projects page.</span>
            }
          >
            <div class="tri-list">
              <For each={all() ?? []}>
                {(project) => (
                  <label class="tri-list__row">
                    <input
                      type="checkbox"
                      checked={has(project.id)}
                      disabled={saving()}
                      onChange={() => void toggle({ id: project.id, name: project.name })}
                    />
                    {project.name}
                  </label>
                )}
              </For>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default AgentProjectsEditor;
