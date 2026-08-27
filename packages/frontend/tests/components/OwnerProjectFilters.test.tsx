import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';

const mockGetUsers = vi.fn();
const mockGetProjects = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  NO_OWNER: 'none',
  getUsers: (...args: unknown[]) => mockGetUsers(...args),
  getProjects: (...args: unknown[]) => mockGetProjects(...args),
}));

import OwnerProjectFilters from '../../src/components/OwnerProjectFilters';

describe('OwnerProjectFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUsers.mockResolvedValue({
      users: [
        { id: 'u-maya', name: 'Maya Okonkwo', archived_at: null },
        { id: 'u-old', name: 'Old Timer', archived_at: '2026-01-01T00:00:00Z' },
      ],
    });
    mockGetProjects.mockResolvedValue({
      projects: [
        { id: 'p-hsbc', name: 'HSBC', archived_at: null },
        { id: 'p-gone', name: 'Gone', archived_at: '2026-01-01T00:00:00Z' },
      ],
    });
  });

  it('lists users (archived included) with "Without an owner" under a separator', async () => {
    const onOwners = vi.fn();
    render(() => (
      <OwnerProjectFilters
        owners={[]}
        projects={[]}
        onOwnersChange={onOwners}
        onProjectsChange={() => {}}
      />
    ));
    expect(mockGetUsers).toHaveBeenCalledWith({ include_archived: true });
    expect(mockGetProjects).toHaveBeenCalledWith({ include_archived: true });
    fireEvent.click(screen.getByLabelText('Owner filter'));
    await waitFor(() => {
      expect(screen.getByText('Maya Okonkwo')).toBeDefined();
    });
    expect(screen.getByText('Old Timer')).toBeDefined();
    expect(screen.getAllByText('Archived').length).toBe(1);
    const listbox = document.querySelector('[role="listbox"]')!;
    expect(listbox.querySelector('hr.custom-select__separator')).not.toBeNull();
    const options = Array.from(listbox.querySelectorAll('[role="option"]')).map(
      (o) => o.textContent,
    );
    expect(options[options.length - 1]).toContain('Without an owner');
    fireEvent.click(screen.getByText('Without an owner'));
    expect(onOwners).toHaveBeenCalledWith(['none']);
  });

  it('keeps a deleted user or project selectable so old reports still resolve', async () => {
    render(() => (
      <OwnerProjectFilters
        owners={['u-deleted', 'none']}
        projects={['p-deleted']}
        onOwnersChange={() => {}}
        onProjectsChange={() => {}}
      />
    ));
    fireEvent.click(screen.getByLabelText('Owner filter'));
    await waitFor(() => {
      expect(screen.getByText('Deleted user (u-deleted)')).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText('Project filter'));
    await waitFor(() => {
      expect(screen.getAllByText('Deleted project (p-deleted)').length).toBe(2);
    });
    expect(screen.getByText('HSBC')).toBeDefined();
  });

  it('reports project selections and survives failed lookups', async () => {
    mockGetUsers.mockRejectedValue(new Error('boom'));
    mockGetProjects.mockRejectedValue(new Error('boom'));
    const onProjects = vi.fn();
    render(() => (
      <OwnerProjectFilters
        owners={[]}
        projects={['p-x']}
        onOwnersChange={() => {}}
        onProjectsChange={onProjects}
      />
    ));
    fireEvent.click(screen.getByLabelText('Project filter'));
    await waitFor(() => {
      expect(screen.getAllByText('Deleted project (p-x)').length).toBe(2);
    });
    fireEvent.click(screen.getByText('All projects', { selector: '[role="option"] span' }));
    expect(onProjects).toHaveBeenCalledWith([]);
  });
});
