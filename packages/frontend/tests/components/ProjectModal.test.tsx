import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

const mockCreateProject = vi.fn();
const mockUpdateProject = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
  updateProject: (...args: unknown[]) => mockUpdateProject(...args),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

import ProjectModal from '../../src/components/ProjectModal';

const project = {
  id: 'p-1',
  name: 'HSBC',
  description: 'Client engagement',
  archived_at: null,
  created_at: '2026-08-01T00:00:00Z',
};

describe('ProjectModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => (
      <ProjectModal open={false} onClose={() => {}} onSaved={() => {}} />
    ));
    expect(container.querySelector('.modal-card')).toBeNull();
  });

  it('creates a project and reports it', async () => {
    mockCreateProject.mockResolvedValue({ ...project, id: 'p-new' });
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const { getByLabelText, getByText } = render(() => (
      <ProjectModal open onClose={onClose} onSaved={onSaved} />
    ));
    expect(getByText('New project')).toBeTruthy();
    const create = getByText('Create project') as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.input(getByLabelText('Name'), { target: { value: '  HSBC ' } });
    fireEvent.input(getByLabelText(/Description/), { target: { value: 'Client engagement' } });
    expect(create.disabled).toBe(false);
    fireEvent.click(create);
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mockCreateProject).toHaveBeenCalledWith({
      name: 'HSBC',
      description: 'Client engagement',
    });
    expect(mockToast.success).toHaveBeenCalledWith('Project "HSBC" created');
    expect(onClose).toHaveBeenCalled();
  });

  it('sends a null description when the field is blank', async () => {
    mockCreateProject.mockResolvedValue({ ...project, description: null });
    const { getByLabelText, getByText } = render(() => (
      <ProjectModal open onClose={() => {}} onSaved={() => {}} />
    ));
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Atlas' } });
    fireEvent.click(getByText('Create project'));
    await vi.waitFor(() =>
      expect(mockCreateProject).toHaveBeenCalledWith({ name: 'Atlas', description: null }),
    );
  });

  it('edits an existing project, prefilled, and submits on Enter', async () => {
    mockUpdateProject.mockResolvedValue({ ...project, name: 'HSBC UK' });
    const onSaved = vi.fn();
    const { getByLabelText, getByText } = render(() => (
      <ProjectModal open project={project} onClose={() => {}} onSaved={onSaved} />
    ));
    expect(getByText('Edit project')).toBeTruthy();
    const name = getByLabelText('Name') as HTMLInputElement;
    expect(name.value).toBe('HSBC');
    expect((getByLabelText(/Description/) as HTMLInputElement).value).toBe('Client engagement');
    fireEvent.input(name, { target: { value: 'HSBC UK' } });
    fireEvent.keyDown(name, { key: 'Enter' });
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mockUpdateProject).toHaveBeenCalledWith('p-1', {
      name: 'HSBC UK',
      description: 'Client engagement',
    });
    expect(mockToast.success).toHaveBeenCalledWith('Project "HSBC UK" saved');
    expect(getByText('Save')).toBeTruthy();
  });

  it('shows an error toast when saving fails and stays open', async () => {
    mockCreateProject.mockRejectedValue(new Error('nope'));
    const onClose = vi.fn();
    const { getByLabelText, getByText } = render(() => (
      <ProjectModal open onClose={onClose} onSaved={() => {}} />
    ));
    fireEvent.input(getByLabelText('Name'), { target: { value: 'X' } });
    fireEvent.click(getByText('Create project'));
    await vi.waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores a submit while one is already in flight or with a blank name', async () => {
    let resolve!: (v: unknown) => void;
    mockCreateProject.mockReturnValue(new Promise((r) => (resolve = r)));
    const { getByLabelText, getByText, container } = render(() => (
      <ProjectModal open onClose={() => {}} onSaved={() => {}} />
    ));
    const name = getByLabelText('Name') as HTMLInputElement;
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(mockCreateProject).not.toHaveBeenCalled();
    fireEvent.input(name, { target: { value: 'Y' } });
    fireEvent.click(getByText('Create project'));
    fireEvent.keyDown(name, { key: 'Enter' });
    expect(mockCreateProject).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.spinner')).not.toBeNull();
    resolve({ ...project });
  });

  it('closes on Escape, overlay click and Cancel, not on card click', () => {
    const onClose = vi.fn();
    const { container, getByText } = render(() => (
      <ProjectModal open onClose={onClose} onSaved={() => {}} />
    ));
    const card = container.querySelector('.modal-card') as HTMLElement;
    fireEvent.click(card);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(card, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.modal-overlay') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.click(getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
