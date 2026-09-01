import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@solidjs/testing-library';

const mockUpdate = vi.fn();
const mockApply = vi.fn();
const mockListAgents = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  updateAgentModelAccess: (...args: unknown[]) => mockUpdate(...args),
  applyModelAccessToAgents: (...args: unknown[]) => mockApply(...args),
  listAgents: (...args: unknown[]) => mockListAgents(...args),
}));

vi.mock('../../src/services/providers.js', () => ({
  PROVIDERS: [{ id: 'anthropic', name: 'Anthropic' }],
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

import ModelAccessModal from '../../src/components/ModelAccessModal';
import type { ProviderModelAccess } from '../../src/services/api/teams';

const access = (): ProviderModelAccess => ({
  user_provider_id: 'up-1',
  provider: 'anthropic',
  auth_type: 'subscription',
  label: 'Max',
  provider_enabled: true,
  all_models: false,
  models: [
    { id: 'fable', name: 'Claude Fable 5', enabled: true, in_routing: false },
    { id: 'sonnet', name: 'Claude Sonnet 5', enabled: true, in_routing: false },
    { id: 'opus', name: 'Claude Opus 5', enabled: true, in_routing: true },
    { id: 'opus41', name: 'Claude Opus 4.1', enabled: false, in_routing: false },
  ],
  enabled_count: 3,
  total_count: 4,
});

const sw = (name: string) => screen.getByLabelText(name) as HTMLButtonElement;

describe('ModelAccessModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockImplementation(async (_a, _p, change) => ({
      ...access(),
      all_models: change.all_models,
    }));
    mockApply.mockResolvedValue({ applied: ['b'], failed: [] });
    mockListAgents.mockResolvedValue({
      agents: [
        { agent_name: 'a', display_name: 'A', owner: null },
        { agent_name: 'b', display_name: 'B', owner: { id: 'u', name: 'Maya' } },
      ],
      total: 2,
    });
  });

  it('renders nothing when closed', () => {
    const { container } = render(() => (
      <ModelAccessModal
        open={false}
        agentName="a"
        access={access()}
        onClose={() => {}}
        onSaved={() => {}}
      />
    ));
    expect(container.textContent).toBe('');
  });

  it('lists one switch per model with the count, and locks a model used by routing', async () => {
    render(() => (
      <ModelAccessModal
        open
        agentName="a"
        access={access()}
        onClose={() => {}}
        onSaved={() => {}}
      />
    ));
    expect(screen.getByText('Anthropic models')).toBeDefined();
    expect(screen.getByText('3 of 4 enabled')).toBeDefined();
    expect(sw('All Anthropic models').getAttribute('aria-checked')).toBe('false');
    expect(sw('Claude Opus 5').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText('in routing')).toBeDefined();
    // Clicking the locked model changes nothing.
    fireEvent.click(sw('Claude Opus 5'));
    expect(sw('Claude Opus 5').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('3 of 4 enabled')).toBeDefined();
  });

  it('toggles individual models and saves the partial selection', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(() => (
      <ModelAccessModal open agentName="a" access={access()} onClose={onClose} onSaved={onSaved} />
    ));
    fireEvent.click(sw('Claude Fable 5'));
    fireEvent.click(sw('Claude Opus 4.1'));
    expect(sw('Claude Fable 5').getAttribute('aria-checked')).toBe('false');
    expect(sw('Claude Opus 4.1').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('3 of 4 enabled')).toBeDefined();
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('a', 'up-1', {
        all_models: false,
        enabled_model_ids: ['sonnet', 'opus', 'opus41'],
      });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(onSaved).toHaveBeenCalled();
    expect(mockToast.success).toHaveBeenCalledWith('Anthropic model access saved');
  });

  it('the master switch is its own state: on allows everything, turning a model off leaves it', async () => {
    render(() => (
      <ModelAccessModal
        open
        agentName="a"
        access={access()}
        onClose={() => {}}
        onSaved={() => {}}
      />
    ));
    fireEvent.click(sw('All Anthropic models'));
    expect(sw('All Anthropic models').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('4 of 4 enabled')).toBeDefined();
    // Turning one model off materializes a partial selection of the rest.
    fireEvent.click(sw('Claude Sonnet 5'));
    expect(sw('All Anthropic models').getAttribute('aria-checked')).toBe('false');
    expect(sw('Claude Sonnet 5').getAttribute('aria-checked')).toBe('false');
    expect(sw('Claude Opus 4.1').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('3 of 4 enabled')).toBeDefined();
    // Master back on, then off: only routed models stay on.
    fireEvent.click(sw('All Anthropic models'));
    fireEvent.click(sw('All Anthropic models'));
    expect(sw('Claude Opus 5').getAttribute('aria-checked')).toBe('true');
    expect(sw('Claude Fable 5').getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('1 of 4 enabled')).toBeDefined();
    fireEvent.click(sw('All Anthropic models'));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('a', 'up-1', {
        all_models: true,
        enabled_model_ids: [],
      });
    });
  });

  it('shows an error and stays open when saving fails', async () => {
    mockUpdate.mockRejectedValue(new Error('boom'));
    const onClose = vi.fn();
    render(() => (
      <ModelAccessModal open agentName="a" access={access()} onClose={onClose} onSaved={() => {}} />
    ));
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining("Couldn't save"));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies the selection to other agents after saving it', async () => {
    render(() => (
      <ModelAccessModal
        open
        agentName="a"
        access={access()}
        onClose={() => {}}
        onSaved={() => {}}
      />
    ));
    fireEvent.click(screen.getByText('Apply to other agents'));
    await waitFor(() => {
      expect(screen.getByText('B')).toBeDefined();
    });
    // The source agent itself is never offered.
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.getByText('Maya')).toBeDefined();
    const apply = () => screen.getByText(/Apply to \d+ agents?/) as HTMLButtonElement;
    expect(apply().disabled).toBe(true);
    fireEvent.click(screen.getByText('Select all'));
    expect(apply().textContent).toBe('Apply to 1 agent');
    fireEvent.click(apply());
    await waitFor(() => {
      expect(mockApply).toHaveBeenCalledWith('a', 'up-1', ['b']);
    });
    await waitFor(() => {
      expect(screen.getByText(/Model access: applied to 1 agent/)).toBeDefined();
    });
    fireEvent.click(screen.getByText('Dismiss'));
    expect(screen.queryByText(/Model access: applied/)).toBeNull();
    // Toggle a target off and on again by hand.
    fireEvent.click(screen.getByText('B').closest('label')!.querySelector('input')!);
    expect(apply().disabled).toBe(true);
    fireEvent.click(screen.getByText('B').closest('label')!.querySelector('input')!);
    expect(apply().disabled).toBe(false);
    // Collapse the section again.
    fireEvent.click(screen.getByRole('button', { name: 'Apply to other agents' }));
    expect(screen.queryByText('Select all')).toBeNull();
  });

  it('uses the caller-provided targets and reports apply failures', async () => {
    mockApply.mockRejectedValue(new Error('boom'));
    render(() => (
      <ModelAccessModal
        open
        agentName="a"
        access={access()}
        onClose={() => {}}
        onSaved={() => {}}
        applyTargets={[
          { agent_name: 'a', display_name: 'A' } as any,
          { agent_name: 'c', display_name: 'C' } as any,
        ]}
      />
    ));
    fireEvent.click(screen.getByText('Apply to other agents'));
    await waitFor(() => {
      expect(screen.getByText('C')).toBeDefined();
    });
    expect(mockListAgents).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Select all'));
    fireEvent.click(screen.getByText('Apply to 1 agent'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining("Couldn't apply"));
    });
  });

  it('does not apply when the save that precedes it fails', async () => {
    mockUpdate.mockRejectedValue(new Error('boom'));
    render(() => (
      <ModelAccessModal
        open
        agentName="a"
        access={access()}
        onClose={() => {}}
        onSaved={() => {}}
        applyTargets={[{ agent_name: 'c', display_name: 'C' } as any]}
      />
    ));
    fireEvent.click(screen.getByText('Apply to other agents'));
    await waitFor(() => screen.getByText('C'));
    fireEvent.click(screen.getByText('Select all'));
    fireEvent.click(screen.getByText('Apply to 1 agent'));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
    expect(mockApply).not.toHaveBeenCalled();
  });

  it('shows the empty hints: no other agents, and no models discovered', async () => {
    mockListAgents.mockRejectedValue(new Error('boom'));
    const empty = { ...access(), models: [], enabled_count: 0, total_count: 0 };
    render(() => (
      <ModelAccessModal open agentName="a" access={empty} onClose={() => {}} onSaved={() => {}} />
    ));
    expect(screen.getByText(/No models discovered/)).toBeDefined();
    fireEvent.click(screen.getByText('Apply to other agents'));
    await waitFor(() => {
      expect(screen.getByText('No other agents to apply this to.')).toBeDefined();
    });
  });

  it('closes on overlay click and Escape, and via Cancel', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <ModelAccessModal open agentName="a" access={access()} onClose={onClose} onSaved={() => {}} />
    ));
    fireEvent.click(container.querySelector('.modal-overlay')!);
    fireEvent.keyDown(container.querySelector('.modal-overlay')!, { key: 'Escape' });
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(3);
    // A click inside the card does not close.
    fireEvent.click(container.querySelector('.modal-card')!);
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
