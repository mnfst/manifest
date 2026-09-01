import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

const mockGetProjects = vi.fn();
const mockGetSelectionProjects = vi.fn();
const mockBulkUpdateProjects = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  getProjects: (...args: unknown[]) => mockGetProjects(...args),
  getSelectionProjects: (...args: unknown[]) => mockGetSelectionProjects(...args),
  bulkUpdateProjects: (...args: unknown[]) => mockBulkUpdateProjects(...args),
}));

const mockToast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

import BulkProjectsEditor from '../../src/components/BulkProjectsEditor';
import type { BulkSelection } from '../../src/services/api/teams';

const selection: BulkSelection = { kind: 'names', agent_names: ['a', 'b', 'c'] };
const projects = [
  { id: 'p-atlas', name: 'Atlas', description: null, archived_at: null, created_at: '' },
  { id: 'p-support', name: 'Support desk', description: null, archived_at: null, created_at: '' },
  { id: 'p-hsbc', name: 'HSBC', description: null, archived_at: null, created_at: '' },
  { id: 'p-north', name: 'Northwind', description: null, archived_at: null, created_at: '' },
];

const renderOpen = (open = true) => {
  const onClose = vi.fn();
  const onApplied = vi.fn();
  const result = render(() => (
    <BulkProjectsEditor
      open={open}
      selection={selection}
      selectedCount={3}
      onClose={onClose}
      onApplied={onApplied}
    />
  ));
  return { ...result, onClose, onApplied };
};

const checkbox = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const applyButton = () => screen.getByText('Apply to 3 agents') as HTMLButtonElement;

describe('BulkProjectsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProjects.mockResolvedValue({ projects, total: projects.length });
    mockGetSelectionProjects.mockResolvedValue({ 'p-atlas': 3, 'p-support': 1 });
    mockBulkUpdateProjects.mockResolvedValue({ applied: ['a', 'b', 'c'], failed: [] });
  });

  it('renders nothing when closed', () => {
    const { container } = renderOpen(false);
    expect(container.querySelector('.modal-card')).toBeNull();
    expect(mockGetProjects).not.toHaveBeenCalled();
  });

  it('shows a skeleton, then carried projects first with counts, a separator, then the rest', async () => {
    const { container } = renderOpen();
    expect(container.querySelector('.skeleton')).not.toBeNull();
    await vi.waitFor(() => expect(container.querySelector('.tri-list')).not.toBeNull());
    const rows = [...container.querySelectorAll('.tri-list__row')].map((r) => r.textContent);
    expect(rows[0]).toContain('Atlas');
    expect(rows[0]).toContain('3 of 3');
    expect(rows[1]).toContain('Support desk');
    expect(rows[1]).toContain('1 of 3');
    expect(rows[2]).toContain('HSBC');
    expect(rows[2]).not.toContain('of 3');
    expect(container.querySelector('.custom-select__separator')).not.toBeNull();
    expect(checkbox('Atlas').checked).toBe(true);
    expect(checkbox('Atlas').getAttribute('aria-checked')).toBe('true');
    expect(checkbox('Support desk').indeterminate).toBe(true);
    expect(checkbox('Support desk').getAttribute('aria-checked')).toBe('mixed');
    expect(checkbox('HSBC').checked).toBe(false);
    expect(applyButton().disabled).toBe(true);
    expect(mockGetSelectionProjects).toHaveBeenCalledWith(selection);
  });

  it('ticking an empty box adds to all, unticking a ticked box removes from all, ticking a dash adds to all', async () => {
    const { onApplied } = renderOpen();
    await vi.waitFor(() => expect(screen.queryByLabelText('HSBC')).not.toBeNull());
    fireEvent.click(checkbox('HSBC'));
    fireEvent.click(checkbox('Atlas'));
    fireEvent.click(checkbox('Support desk'));
    expect(checkbox('HSBC').checked).toBe(true);
    expect(checkbox('Atlas').checked).toBe(false);
    expect(checkbox('Support desk').checked).toBe(true);
    expect(checkbox('Support desk').indeterminate).toBe(false);
    expect(applyButton().disabled).toBe(false);
    fireEvent.click(applyButton());
    await vi.waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(mockBulkUpdateProjects).toHaveBeenCalledWith(selection, {
      add: ['p-hsbc', 'p-support'],
      remove: ['p-atlas'],
    });
    expect(onApplied).toHaveBeenCalledWith({ applied: ['a', 'b', 'c'], failed: [] });
  });

  it('a toggle back to the original state is a no-op, and a dash unticked then reticked returns to add', async () => {
    renderOpen();
    await vi.waitFor(() => expect(screen.queryByLabelText('HSBC')).not.toBeNull());
    fireEvent.click(checkbox('HSBC'));
    fireEvent.click(checkbox('HSBC'));
    expect(checkbox('HSBC').checked).toBe(false);
    expect(applyButton().disabled).toBe(true);
    // Dash → ticked (add) → empty (remove): the second click on a now-ticked
    // row means "remove from all".
    fireEvent.click(checkbox('Support desk'));
    fireEvent.click(checkbox('Support desk'));
    expect(checkbox('Support desk').checked).toBe(false);
    expect(applyButton().disabled).toBe(false);
    fireEvent.click(applyButton());
    await vi.waitFor(() => expect(mockBulkUpdateProjects).toHaveBeenCalled());
    expect(mockBulkUpdateProjects).toHaveBeenCalledWith(selection, {
      add: [],
      remove: ['p-support'],
    });
  });

  it('shows a spinner while applying and toasts when the bulk update fails', async () => {
    let reject: (e: Error) => void = () => {};
    mockBulkUpdateProjects.mockReturnValue(new Promise((_, r) => (reject = r)));
    const { container, onApplied } = renderOpen();
    await vi.waitFor(() => expect(screen.queryByLabelText('HSBC')).not.toBeNull());
    fireEvent.click(checkbox('HSBC'));
    fireEvent.click(applyButton());
    await vi.waitFor(() => expect(container.querySelector('.spinner')).not.toBeNull());
    reject(new Error('boom'));
    await vi.waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(onApplied).not.toHaveBeenCalled();
    expect(container.querySelector('.spinner')).toBeNull();
  });

  it('explains there are no projects yet when none exist', async () => {
    mockGetProjects.mockResolvedValue({ projects: [], total: 0 });
    mockGetSelectionProjects.mockResolvedValue({});
    const { container } = renderOpen();
    await vi.waitFor(() => expect(container.textContent).toContain('No projects yet'));
    expect(container.querySelector('.custom-select__separator')).toBeNull();
  });

  it('omits the separator when every project is carried', async () => {
    mockGetSelectionProjects.mockResolvedValue({
      'p-atlas': 3,
      'p-support': 1,
      'p-hsbc': 2,
      'p-north': 3,
    });
    const { container } = renderOpen();
    await vi.waitFor(() => expect(container.querySelector('.tri-list')).not.toBeNull());
    expect(container.querySelector('.custom-select__separator')).toBeNull();
  });

  it('closes on Cancel, overlay click and Escape, not on a click inside the card', async () => {
    const { container, onClose } = renderOpen();
    await vi.waitFor(() => expect(container.querySelector('.tri-list')).not.toBeNull());
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.modal-card')!);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.modal-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(container.querySelector('.modal-overlay')!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('uses the singular when one agent is selected', async () => {
    const { container } = render(() => (
      <BulkProjectsEditor
        open={true}
        selection={{ kind: 'names', agent_names: ['a'] }}
        selectedCount={1}
        onClose={vi.fn()}
        onApplied={vi.fn()}
      />
    ));
    await vi.waitFor(() => expect(container.textContent).toContain('1 agent selected'));
    expect(screen.getByText('Apply to 1 agent')).toBeTruthy();
  });
});

describe('BulkProjectsEditor — errors and archived projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProjects.mockResolvedValue({ projects, total: projects.length });
    mockGetSelectionProjects.mockResolvedValue({ 'p-atlas': 3, 'p-support': 1 });
    mockBulkUpdateProjects.mockResolvedValue({ applied: ['a', 'b', 'c'], failed: [] });
  });

  it('asks for archived projects too', async () => {
    const { container } = renderOpen();
    await vi.waitFor(() => expect(container.querySelector('.tri-list')).not.toBeNull());
    expect(mockGetProjects).toHaveBeenCalledWith({ include_archived: true });
  });

  it('shows a carried archived project with a badge, removable, but never offers it as a new choice', async () => {
    const archived = {
      id: 'p-old',
      name: 'Old client',
      description: null,
      archived_at: '2026-07-01T00:00:00Z',
      created_at: '',
    };
    const unrelatedArchived = { ...archived, id: 'p-gone', name: 'Gone' };
    mockGetProjects.mockResolvedValue({
      projects: [...projects, archived, unrelatedArchived],
      total: 6,
    });
    mockGetSelectionProjects.mockResolvedValue({ 'p-atlas': 3, 'p-old': 2 });
    const { container, onApplied } = renderOpen();
    await vi.waitFor(() => expect(container.querySelector('.tri-list')).not.toBeNull());
    const rows = [...container.querySelectorAll('.tri-list__row')].map((r) => r.textContent);
    expect(rows.some((r) => r?.includes('Old client') && r.includes('Archived'))).toBe(true);
    expect(rows.some((r) => r?.includes('Gone'))).toBe(false);
    expect(checkbox('Old client').indeterminate).toBe(true);
    fireEvent.click(checkbox('Old client'));
    expect(checkbox('Old client').checked).toBe(true);
    fireEvent.click(checkbox('Old client'));
    expect(checkbox('Old client').checked).toBe(false);
    fireEvent.click(applyButton());
    await vi.waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(mockBulkUpdateProjects).toHaveBeenCalledWith(selection, {
      add: [],
      remove: ['p-old'],
    });
  });

  it('shows an error state with retry when a lookup fails, then loads on retry', async () => {
    mockGetSelectionProjects
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ 'p-atlas': 3 });
    const { container } = renderOpen();
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
    expect(container.textContent).toContain("Couldn't load the projects");
    expect(container.querySelector('.tri-list')).toBeNull();
    expect(applyButton().disabled).toBe(true);
    fireEvent.click(screen.getByText('Try again'));
    await vi.waitFor(() => expect(container.querySelector('.tri-list')).not.toBeNull());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(mockGetSelectionProjects).toHaveBeenCalledTimes(2);
    expect(checkbox('Atlas').checked).toBe(true);
  });

  it('shows the error state when the project list itself fails', async () => {
    mockGetProjects.mockRejectedValue(new Error('nope'));
    const { container } = renderOpen();
    await vi.waitFor(() => expect(container.querySelector('[role="alert"]')).not.toBeNull());
  });
});
