import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@solidjs/testing-library';

const mockListAgents = vi.fn();
const mockCountSelection = vi.fn();
const mockBulkCopySettings = vi.fn();
vi.mock('../../src/services/api/teams.js', () => ({
  listAgents: (...args: unknown[]) => mockListAgents(...args),
  countSelection: (...args: unknown[]) => mockCountSelection(...args),
  bulkCopySettings: (...args: unknown[]) => mockBulkCopySettings(...args),
}));

const mockToast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock('../../src/services/toast-store.js', () => ({ toast: mockToast }));

import CopySettingsModal from '../../src/components/CopySettingsModal';
import type { BulkSelection } from '../../src/services/api/teams';

const selection: BulkSelection = {
  kind: 'query',
  query: { projects: ['p-support'] },
  expected_total: 12,
};

const agents = [
  {
    agent_name: 'claude-code',
    display_name: 'claude-code',
    agent_platform: 'claude-code',
    agent_category: 'coding',
    owner: { id: 'u-maya', name: 'Maya Okonkwo' },
    projects: [],
    models_enabled: 12,
    models_total: 40,
    spend_30d_usd: 1,
    request_count: 1,
    last_used_at: null,
    archived_at: null,
  },
  {
    agent_name: 'daily-report',
    display_name: 'daily-report',
    agent_platform: 'openai-sdk',
    agent_category: 'app',
    owner: null,
    projects: [],
    models_enabled: 2,
    models_total: 40,
    spend_30d_usd: 1,
    request_count: 1,
    last_used_at: null,
    archived_at: null,
  },
];

const renderOpen = (open = true) => {
  const onClose = vi.fn();
  const onApplied = vi.fn();
  const result = render(() => (
    <CopySettingsModal
      open={open}
      selection={selection}
      selectedCount={12}
      onClose={onClose}
      onApplied={onApplied}
    />
  ));
  return { ...result, onClose, onApplied };
};

const next = () => screen.getByText('Next') as HTMLButtonElement;

const pickSource = async () => {
  await vi.waitFor(() => expect(mockListAgents).toHaveBeenCalled());
  fireEvent.click(screen.getByLabelText('Source agent'));
  await vi.waitFor(() => expect(screen.queryByText('Maya Okonkwo')).not.toBeNull());
  fireEvent.click(screen.getByText('Maya Okonkwo'));
};

describe('CopySettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListAgents.mockResolvedValue({
      agents,
      total: 2,
      unowned_total: 1,
      page: 1,
      page_size: 1000,
    });
    mockCountSelection.mockResolvedValue(12);
    mockBulkCopySettings.mockResolvedValue({
      applied: ['a'],
      failed: [{ agent_name: 'b', reason: 'x' }],
    });
  });

  it('renders nothing when closed', () => {
    const { container } = renderOpen(false);
    expect(container.querySelector('.modal-card')).toBeNull();
  });

  it('walks the three steps and applies with the count stated in the button', async () => {
    const { container, onApplied } = renderOpen();
    expect(container.textContent).toContain('Step 1 of 3 · Source');
    expect(container.textContent).toContain('12 selected agents');
    expect(next().disabled).toBe(true);
    await pickSource();
    expect(next().disabled).toBe(false);
    fireEvent.click(next());
    expect(container.textContent).toContain('Step 2 of 3 · What to copy');
    // Providers and models is on by default; add Limits, leave Routing off.
    fireEvent.click(screen.getByLabelText(/Limits/));
    fireEvent.click(next());
    expect(container.textContent).toContain('Step 3 of 3 · Confirm');
    expect(container.textContent).toContain("Apply claude-code's setup");
    expect(container.textContent).toContain('Counting agents');
    await vi.waitFor(() => expect(container.textContent).toContain('12 agents will change.'));
    expect(container.textContent).toContain(
      'Their current providers and models, limits settings will be replaced.',
    );
    expect(container.textContent).toContain('Routing left untouched.');
    expect(mockCountSelection).toHaveBeenCalledWith(selection);
    const apply = screen.getByText('Apply to 12 agents');
    fireEvent.click(apply);
    await vi.waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(mockBulkCopySettings).toHaveBeenCalledWith(selection, 'claude-code', {
      providers_and_models: true,
      routing: false,
      limits: true,
    });
    expect(onApplied).toHaveBeenCalledWith({
      applied: ['a'],
      failed: [{ agent_name: 'b', reason: 'x' }],
    });
  });

  it('requires at least one thing to copy and supports Back', async () => {
    const { container } = renderOpen();
    await pickSource();
    fireEvent.click(next());
    fireEvent.click(screen.getByLabelText(/Providers and models/));
    expect(container.textContent).toContain('Choose at least one thing to copy.');
    expect(next().disabled).toBe(true);
    fireEvent.click(screen.getByText('Back'));
    expect(container.textContent).toContain('Step 1 of 3');
    expect(screen.queryByText('Back')).toBeNull();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('omits the untouched sentence when everything is copied and uses the singular for one agent', async () => {
    mockCountSelection.mockResolvedValue(1);
    const { container } = renderOpen();
    await pickSource();
    fireEvent.click(next());
    fireEvent.click(screen.getByLabelText(/Routing/));
    fireEvent.click(screen.getByLabelText(/Limits/));
    fireEvent.click(next());
    await vi.waitFor(() => expect(container.textContent).toContain('1 agent will change.'));
    expect(container.textContent).not.toContain('left untouched');
    expect(screen.getByText('Apply to 1 agent')).toBeTruthy();
  });

  it('offers no source when the agent list fails to load', async () => {
    mockListAgents.mockRejectedValue(new Error('boom'));
    renderOpen();
    await vi.waitFor(() => expect(mockListAgents).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText('Source agent'));
    expect(screen.queryByText('Maya Okonkwo')).toBeNull();
    expect(next().disabled).toBe(true);
  });

  it('falls back to the selected count when counting fails and shows the owner-less source', async () => {
    mockCountSelection.mockRejectedValue(new Error('boom'));
    const { container } = renderOpen();
    await vi.waitFor(() => expect(mockListAgents).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText('Source agent'));
    await vi.waitFor(() => expect(screen.queryByText('No owner')).not.toBeNull());
    fireEvent.click(screen.getByText('daily-report'));
    fireEvent.click(next());
    fireEvent.click(next());
    await vi.waitFor(() => expect(container.textContent).toContain('12 agents will change.'));
    expect(container.textContent).toContain("Apply daily-report's setup");
  });

  it('does not load agents while closed', () => {
    renderOpen(false);
    expect(mockListAgents).not.toHaveBeenCalled();
  });

  it('shows a spinner while applying and toasts when the copy fails', async () => {
    let reject: (e: Error) => void = () => {};
    mockBulkCopySettings.mockReturnValue(new Promise((_, r) => (reject = r)));
    const { container, onApplied } = renderOpen();
    await pickSource();
    fireEvent.click(next());
    fireEvent.click(next());
    await vi.waitFor(() => expect(container.textContent).toContain('will change'));
    fireEvent.click(screen.getByText('Apply to 12 agents'));
    await vi.waitFor(() =>
      expect(container.querySelector('.modal-card__footer .spinner')).not.toBeNull(),
    );
    expect((screen.getByText('Back') as HTMLButtonElement).disabled).toBe(true);
    reject(new Error('boom'));
    await vi.waitFor(() => expect(mockToast.error).toHaveBeenCalled());
    expect(onApplied).not.toHaveBeenCalled();
  });

  it('closes on Cancel, overlay click and Escape, not on a click inside the card', () => {
    const { container, onClose } = renderOpen();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.modal-card')!);
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.modal-overlay')!);
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(container.querySelector('.modal-overlay')!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('resets to step 1 when reopened', async () => {
    const [open, setOpen] = (await import('solid-js')).createSignal(true);
    const { container } = render(() => (
      <CopySettingsModal
        open={open()}
        selection={selection}
        selectedCount={12}
        onClose={vi.fn()}
        onApplied={vi.fn()}
      />
    ));
    await pickSource();
    fireEvent.click(next());
    expect(container.textContent).toContain('Step 2 of 3');
    setOpen(false);
    setOpen(true);
    expect(container.textContent).toContain('Step 1 of 3');
    expect(next().disabled).toBe(true);
  });
});
