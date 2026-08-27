import { A, useParams } from '@solidjs/router';
import {
  createContext,
  createEffect,
  createResource,
  onCleanup,
  Show,
  useContext,
  type ParentComponent,
  type Resource,
} from 'solid-js';
import { Title } from '@solidjs/meta';
import EntityTabs from '../components/EntityTabs.jsx';
import {
  getProject,
  getProjectOverview,
  type Project,
  type ProjectOverview,
} from '../services/api/teams.js';
import { clearBreadcrumb, setBreadcrumb } from '../services/breadcrumb-store.js';
import { projectPath } from '../services/routing.js';
import { formatTimeAgo } from '../services/formatters.js';
import { downloadTextFile, toCsv } from '../services/teams-utils.js';
import { analyticsPing } from '../services/sse.js';
import { useLocation } from '@solidjs/router';

export interface ProjectDetailContext {
  projectId: () => string;
  project: Resource<Project | null>;
  overview: Resource<ProjectOverview | null>;
  refetchProject: () => void;
  refetchOverview: () => void;
}

const Ctx = createContext<ProjectDetailContext>();

export function useProjectDetail(): ProjectDetailContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProjectDetail must be used inside ProjectDetail');
  return ctx;
}

/**
 * Nested-route shell for a project: header, tabs, and the shared project +
 * overview resources the tab pages read through `useProjectDetail()`.
 */
const ProjectDetail: ParentComponent = (props) => {
  const params = useParams<{ projectId: string }>();
  const location = useLocation();
  const projectId = () => decodeURIComponent(params.projectId);

  const [project, { refetch: refetchProject }] = createResource(
    () => projectId(),
    (id) => getProject(id),
  );
  const [overview, { refetch: refetchOverview }] = createResource(
    () => ({ id: projectId(), _p: analyticsPing() }),
    async ({ id }): Promise<ProjectOverview | null> => {
      try {
        return await getProjectOverview(id);
      } catch {
        return null;
      }
    },
  );

  createEffect(() => {
    const p = project();
    if (p) setBreadcrumb([{ label: 'Projects', href: '/projects' }], { label: p.name });
  });
  onCleanup(() => clearBreadcrumb());

  const path = (sub: string) => projectPath(params.projectId, sub);
  const isActive = (sub: string) => {
    if (sub === '') {
      return location.pathname === path('') || location.pathname === path('/overview');
    }
    return location.pathname.startsWith(path(sub));
  };

  const exportCsv = () => {
    const p = project();
    const o = overview();
    if (!p || !o) return;
    const csv = toCsv(
      ['Agent', 'Owner', 'Requests', 'Spend 30d', 'Last used'],
      o.agents.map((a) => [
        a.display_name,
        a.owner?.name ?? 'No owner',
        a.request_count,
        a.spend_30d_usd.toFixed(2),
        a.last_used_at ?? '',
      ]),
    );
    downloadTextFile(`project-${p.name}-${new Date().toISOString().slice(0, 7)}.csv`, csv);
  };

  const ctx: ProjectDetailContext = {
    projectId,
    project,
    overview,
    refetchProject: () => void refetchProject(),
    refetchOverview: () => void refetchOverview(),
  };

  return (
    <div class="container--lg">
      <Title>{project()?.name ?? 'Project'} | Manifest</Title>
      <Show
        when={project.loading || project()}
        fallback={
          <div class="empty-state">
            <div class="empty-state__title">Project not found</div>
            <p>It may have been deleted, or the link is out of date.</p>
            <A
              href="/projects"
              class="btn btn--primary btn--sm"
              style="margin-top: var(--gap-md); text-decoration: none;"
            >
              Back to Projects
            </A>
          </div>
        }
      >
        <Show when={project()}>
          <div class="entity-header">
            <h1 class="page-header__title entity-header__title">{project()!.name}</h1>
            <div class="entity-header__chips">
              <Show when={project()!.archived_at}>
                <span class="status-badge status-badge--neutral">Archived</span>
              </Show>
              <Show when={project()!.description}>
                <span class="chip">{project()!.description}</span>
              </Show>
              <Show when={overview()}>
                <span class="chip">
                  {overview()!.agents.length} agent{overview()!.agents.length === 1 ? '' : 's'} ·{' '}
                  {overview()!.users.length} user{overview()!.users.length === 1 ? '' : 's'}
                </span>
              </Show>
              <button
                type="button"
                class="btn btn--outline btn--sm"
                onClick={exportCsv}
                disabled={!overview()}
              >
                Export CSV
              </button>
            </div>
          </div>
          <EntityTabs
            tabs={[
              { label: 'Overview', href: path(''), active: isActive('') },
              { label: 'Agents', href: path('/agents'), active: isActive('/agents') },
              { label: 'Users', href: path('/users'), active: isActive('/users') },
              { label: 'Settings', href: path('/settings'), active: isActive('/settings') },
            ]}
          />
          <Ctx.Provider value={ctx}>{props.children}</Ctx.Provider>
        </Show>
      </Show>
    </div>
  );
};

/** Compact "last used" for tab tables; kept here so the tabs share one rule. */
export function lastUsedLabel(ts: string | null): string {
  return formatTimeAgo(ts) ?? 'Never';
}

export default ProjectDetail;
