import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

const mockNavigate = vi.fn();
vi.mock('@solidjs/router', () => ({
  useNavigate: () => mockNavigate,
}));

const mockUpdateProject = vi.fn();
const mockArchiveProject = vi.fn();
const mockUnarchiveProject = vi.fn();
const mockDeleteProject = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
  archiveProject: (...args: unknown[]) => mockArchiveProject(...args),
  unarchiveProject: (...args: unknown[]) => mockUnarchiveProject(...args),
  deleteProject: (...args: unknown[]) => mockDeleteProject(...args),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

type Ctx = ReturnType<(typeof import('../../src/pages/ProjectDetail'))['useProjectDetail']>;
let mockCtx: Ctx;
vi.mock('../../src/pages/ProjectDetail.jsx', () => ({
  useProjectDetail: () => mockCtx,
}));

import ProjectSettings from '../../src/pages/ProjectSettings';

const resource = <T,>(value: T) =>
  Object.assign(() => value, { loading: false, error: undefined, state: 'ready' });

const project = {
  id: 'p-1',
  name: 'HSBC',
  description: 'Client engagement',
  archived_at: null as string | null,
  created_at: '2026-08-01T00:00:00Z',
};

const makeCtx = (p: unknown): Ctx =>
  ({
    projectId: () => 'p-1',
    project: resource(p),
    overview: resource(null),
    refetchProject: vi.fn(),
    refetchOverview: vi.fn(),
  }) as unknown as Ctx;

describe('ProjectSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCtx = makeCtx(project);
  });

  it('renders nothing without a project', () => {
    mockCtx = makeCtx(null);
    const { container } = render(() => <ProjectSettings />);
    expect(container.querySelector('.settings-card')).toBeNull();
  });

  it('saves name and description once they change', async () => {
    mockUpdateProject.mockResolvedValue({});
    const { getByLabelText, getByText } = render(() => <ProjectSettings />);
    const name = getByLabelText('Project name') as HTMLInputElement;
    expect(name.value).toBe('HSBC');
    const save = getByText('Save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    fireEvent.input(name, { target: { value: 'HSBC UK ' } });
    fireEvent.input(getByLabelText('Project description'), { target: { value: '' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await vi.waitFor(() => expect(mockCtx.refetchProject).toHaveBeenCalled());
    expect(mockUpdateProject).toHaveBeenCalledWith('p-1', { name: 'HSBC UK', description: null });
    expect(mockToast.success).toHaveBeenCalledWith('Project saved');
  });

  it('keeps Save disabled for a blank name and reports a failed save', async () => {
    mockUpdateProject.mockRejectedValue(new Error('x'));
    const { getByLabelText, getByText } = render(() => <ProjectSettings />);
    const name = getByLabelText('Project name') as HTMLInputElement;
    fireEvent.input(name, { target: { value: '   ' } });
    expect((getByText('Save') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.input(name, { target: { value: 'New' } });
    fireEvent.click(getByText('Save'));
    await vi.waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Couldn't save this project."),
    );
  });

  it('does not double-submit while saving', async () => {
    let resolve!: (v: unknown) => void;
    mockUpdateProject.mockReturnValue(new Promise((r) => (resolve = r)));
    const { getByLabelText, getByText, container } = render(() => <ProjectSettings />);
    fireEvent.input(getByLabelText('Project name'), { target: { value: 'New' } });
    const save = getByText('Save');
    fireEvent.click(save);
    await vi.waitFor(() => expect(container.querySelector('.spinner')).not.toBeNull());
    fireEvent.click(container.querySelector('.settings-card__footer button') as HTMLElement);
    expect(mockUpdateProject).toHaveBeenCalledTimes(1);
    resolve({});
  });

  it('archives and restores', async () => {
    mockArchiveProject.mockResolvedValue({});
    const { getByText, getByRole } = render(() => <ProjectSettings />);
    expect(getByText('Archive this project')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Archive' }));
    await vi.waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('HSBC archived'));
    expect(mockArchiveProject).toHaveBeenCalledWith('p-1');
    expect(mockCtx.refetchProject).toHaveBeenCalled();
  });

  it('restores an archived project and reports errors', async () => {
    mockCtx = makeCtx({ ...project, archived_at: '2026-08-02T00:00:00Z' });
    mockUnarchiveProject.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({});
    const { getByText, getByRole } = render(() => <ProjectSettings />);
    expect(getByText('Restore this project')).toBeTruthy();
    fireEvent.click(getByText('Restore'));
    await vi.waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Couldn't update this project."),
    );
    fireEvent.click(getByText('Restore'));
    await vi.waitFor(() => expect(mockToast.success).toHaveBeenCalledWith('HSBC restored'));
  });

  it('ignores archive clicks while one is in flight', async () => {
    let resolve!: (v: unknown) => void;
    mockArchiveProject.mockReturnValue(new Promise((r) => (resolve = r)));
    const { getByRole, container } = render(() => <ProjectSettings />);
    fireEvent.click(getByRole('button', { name: 'Archive' }));
    const btn = container.querySelectorAll(
      '.settings-card__control button',
    )[0] as HTMLButtonElement;
    await vi.waitFor(() => expect(btn.disabled).toBe(true));
    fireEvent.click(btn);
    expect(mockArchiveProject).toHaveBeenCalledTimes(1);
    resolve({});
  });

  it('deletes after typing the name, then navigates away', async () => {
    mockDeleteProject.mockResolvedValue(undefined);
    const { getByText, container, getByLabelText } = render(() => <ProjectSettings />);
    fireEvent.click(getByText('Delete project'));
    const confirm = container.querySelector('.modal-card .btn--danger') as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(mockDeleteProject).not.toHaveBeenCalled();
    fireEvent.input(getByLabelText(/To confirm/), { target: { value: 'HSBC' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    await vi.waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/projects', { replace: true }),
    );
    expect(mockDeleteProject).toHaveBeenCalledWith('p-1');
    expect(mockToast.success).toHaveBeenCalledWith('Project "HSBC" deleted');
    expect(container.querySelector('.modal-card')).toBeNull();
  });

  it('reports a failed delete and keeps the modal open', async () => {
    mockDeleteProject.mockRejectedValue(new Error('x'));
    const { getByText, container, getByLabelText } = render(() => <ProjectSettings />);
    fireEvent.click(getByText('Delete project'));
    fireEvent.input(getByLabelText(/To confirm/), { target: { value: 'HSBC' } });
    fireEvent.click(container.querySelector('.modal-card .btn--danger') as HTMLElement);
    await vi.waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith("Couldn't delete this project."),
    );
    expect(container.querySelector('.modal-card')).not.toBeNull();
  });

  it('closes the delete modal on Cancel, Escape and overlay click', () => {
    const { getByText, container } = render(() => <ProjectSettings />);
    fireEvent.click(getByText('Delete project'));
    fireEvent.click(getByText('Cancel'));
    expect(container.querySelector('.modal-card')).toBeNull();
    fireEvent.click(getByText('Delete project'));
    fireEvent.keyDown(container.querySelector('.modal-overlay') as HTMLElement, { key: 'Escape' });
    expect(container.querySelector('.modal-card')).toBeNull();
    fireEvent.click(getByText('Delete project'));
    fireEvent.click(container.querySelector('.modal-card') as HTMLElement);
    expect(container.querySelector('.modal-card')).not.toBeNull();
    fireEvent.click(container.querySelector('.modal-overlay') as HTMLElement);
    expect(container.querySelector('.modal-card')).toBeNull();
  });
});
