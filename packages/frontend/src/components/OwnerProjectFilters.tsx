import { createMemo, createResource, type Component } from 'solid-js';
import MultiSelect, { type MultiSelectOption } from './MultiSelect.jsx';
import { getProjects, getUsers, NO_OWNER } from '../services/api/teams.js';

interface OwnerProjectFiltersProps {
  owners: string[];
  projects: string[];
  onOwnersChange: (values: string[]) => void;
  onProjectsChange: (values: string[]) => void;
}

/**
 * The owner and project filters shared by Overview, Requests and Agents.
 *
 * The owner list includes archived users so an old report still resolves the
 * person it refers to, and carries "Without an owner" under a separator so
 * unowned agents can be included or excluded. A selected id that no longer
 * exists (deleted user or project) stays selectable as "Deleted …" instead of
 * silently dropping out of the filter.
 */
const OwnerProjectFilters: Component<OwnerProjectFiltersProps> = (props) => {
  const [users] = createResource(async () => {
    try {
      return (await getUsers({ include_archived: true })).users;
    } catch {
      return [];
    }
  });
  const [projects] = createResource(async () => {
    try {
      return (await getProjects({ include_archived: true })).projects;
    } catch {
      return [];
    }
  });

  const ownerOptions = createMemo<MultiSelectOption[]>(() => {
    const known = users() ?? [];
    const options: MultiSelectOption[] = known.map((u) => ({
      value: u.id,
      label: u.name,
      description: u.archived_at ? 'Archived' : undefined,
    }));
    for (const id of props.owners) {
      if (id !== NO_OWNER && !known.some((u) => u.id === id)) {
        options.push({ value: id, label: `Deleted user (${id})` });
      }
    }
    options.push({ value: NO_OWNER, label: 'Without an owner', separatorBefore: true });
    return options;
  });

  const projectOptions = createMemo<MultiSelectOption[]>(() => {
    const known = projects() ?? [];
    const options: MultiSelectOption[] = known.map((p) => ({
      value: p.id,
      label: p.name,
      description: p.archived_at ? 'Archived' : undefined,
    }));
    for (const id of props.projects) {
      if (!known.some((p) => p.id === id)) {
        options.push({ value: id, label: `Deleted project (${id})` });
      }
    }
    return options;
  });

  return (
    <>
      <MultiSelect
        values={props.owners}
        onChange={props.onOwnersChange}
        options={ownerOptions()}
        placeholder="All owners"
        label="Owner filter"
      />
      <MultiSelect
        values={props.projects}
        onChange={props.onProjectsChange}
        options={projectOptions()}
        placeholder="All projects"
        label="Project filter"
      />
    </>
  );
};

export default OwnerProjectFilters;
