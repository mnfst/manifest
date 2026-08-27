import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';

const mockGetProjects = vi.fn();
const mockSetAgentProjects = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  getProjects: (...args: unknown[]) => mockGetProjects(...args),
  setAgentProjects: (...args: unknown[]) => mockSetAgentProjects(...args),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

import AgentProjectsEditor from '../../src/components/AgentProjectsEditor';

describe('AgentProjectsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProjects.mockResolvedValue({
      projects: [
        { id: 'p-atlas', name: 'Atlas' },
        { id: 'p-hsbc', name: 'HSBC' },
      ],
      total: 2,
    });
    mockSetAgentProjects.mockResolvedValue(undefined);
  });

  it('opens on click, fetches the projects and ticks the ones the agent carries', async () => {
    render(() => (
      <AgentProjectsEditor
        agentName="a"
        projects={[{ id: 'p-atlas', name: 'Atlas' }]}
        onChange={() => {}}
      />
    ));
    expect(mockGetProjects).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('+ Project'));
    await waitFor(() => {
      expect(screen.getByText('HSBC')).toBeDefined();
    });
    const boxes = Array.from(
      document.querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[];
    expect(boxes.map((b) => b.checked)).toEqual([true, false]);
    expect(screen.getByText('+ Project').getAttribute('aria-expanded')).toBe('true');
  });

  it('adds and removes a project, saving through setAgentProjects', async () => {
    const onChange = vi.fn();
    const [projects, setProjects] = [
      { current: [{ id: 'p-atlas', name: 'Atlas' }] },
      (next: any) => {
        projects.current = next;
      },
    ];
    onChange.mockImplementation(setProjects);
    render(() => (
      <AgentProjectsEditor agentName="a" projects={projects.current} onChange={onChange} />
    ));
    fireEvent.click(screen.getByText('+ Project'));
    await waitFor(() => screen.getByText('HSBC'));
    const boxes = () =>
      Array.from(document.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    fireEvent.click(boxes()[1]!);
    await waitFor(() => {
      expect(mockSetAgentProjects).toHaveBeenCalledWith('a', ['p-atlas', 'p-hsbc']);
    });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        { id: 'p-atlas', name: 'Atlas' },
        { id: 'p-hsbc', name: 'HSBC' },
      ]);
    });
    fireEvent.click(boxes()[0]!);
    await waitFor(() => {
      expect(mockSetAgentProjects).toHaveBeenLastCalledWith('a', ['p-hsbc']);
    });
  });

  it('reports a failed save and keeps the previous projects', async () => {
    mockSetAgentProjects.mockRejectedValue(new Error('boom'));
    const onChange = vi.fn();
    render(() => <AgentProjectsEditor agentName="a" projects={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText('+ Project'));
    await waitFor(() => screen.getByText('Atlas'));
    fireEvent.click(document.querySelector('input[type="checkbox"]')!);
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows a hint without projects and tolerates a failed fetch', async () => {
    mockGetProjects.mockRejectedValue(new Error('boom'));
    render(() => <AgentProjectsEditor agentName="a" projects={[]} onChange={() => {}} />);
    fireEvent.click(screen.getByText('+ Project'));
    await waitFor(() => {
      expect(screen.getByText(/No projects yet/)).toBeDefined();
    });
  });

  it('closes on outside click and on Escape', async () => {
    render(() => <AgentProjectsEditor agentName="a" projects={[]} onChange={() => {}} />);
    fireEvent.click(screen.getByText('+ Project'));
    await waitFor(() => screen.getByText('Atlas'));
    fireEvent.click(document.body);
    expect(screen.queryByText('Atlas')).toBeNull();
    fireEvent.click(screen.getByText('+ Project'));
    await waitFor(() => screen.getByText('Atlas'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByText('Atlas')).toBeNull();
  });

  it('ignores a second toggle while a save is in flight', async () => {
    let resolveSave!: () => void;
    mockSetAgentProjects.mockReturnValueOnce(new Promise<void>((res) => (resolveSave = res)));
    render(() => <AgentProjectsEditor agentName="a" projects={[]} onChange={() => {}} />);
    fireEvent.click(screen.getByText('+ Project'));
    await waitFor(() => screen.getByText('HSBC'));
    const boxes = Array.from(
      document.querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[];
    fireEvent.click(boxes[0]!);
    fireEvent.click(boxes[1]!);
    expect(mockSetAgentProjects).toHaveBeenCalledTimes(1);
    resolveSave();
  });
});
