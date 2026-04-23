import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

const { api } = vi.hoisted(() => ({
  api: { getMessages: vi.fn() },
}));
vi.mock('../../src/services/api.js', () => api);

vi.mock('../../src/services/formatters.js', () => ({
  formatCost: (v: number) => `$${v.toFixed(3)}`,
  formatNumber: (v: number) => String(v),
  formatDuration: (ms: number) => `${ms}ms`,
  formatRelativeTime: () => 'rel-time',
}));

vi.mock('../../src/services/model-display.js', () => ({
  getModelDisplayName: (slug: string) => slug.toUpperCase(),
}));

import ReplayPickerDrawer from '../../src/components/benchmark/ReplayPickerDrawer';

async function flush() {
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  api.getMessages.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ReplayPickerDrawer', () => {
  it('renders nothing when closed', () => {
    const { container } = render(() => (
      <ReplayPickerDrawer open={false} agentName="demo" onClose={() => {}} onSelect={() => {}} />
    ));
    expect(container.querySelector('.benchmark-replay')).toBeNull();
  });

  it('calls getMessages with the recorded filter when opened', async () => {
    api.getMessages.mockResolvedValue({ items: [] });
    render(() => (
      <ReplayPickerDrawer open={true} agentName="demo-agent" onClose={() => {}} onSelect={() => {}} />
    ));
    await flush();
    expect(api.getMessages).toHaveBeenCalledWith({
      recorded: 'true',
      agent_name: 'demo-agent',
      limit: '50',
    });
  });

  it('shows the empty-state copy when there are no recorded messages', async () => {
    api.getMessages.mockResolvedValue({ items: [] });
    const { container } = render(() => (
      <ReplayPickerDrawer open={true} agentName="demo" onClose={() => {}} onSelect={() => {}} />
    ));
    await flush();
    await flush();
    expect(container.textContent).toContain('No recorded messages yet');
  });

  it('renders one item per recorded message and fires onSelect with its id', async () => {
    api.getMessages.mockResolvedValue({
      items: [
        {
          id: 'msg-a',
          timestamp: '2026-04-23T10:00:00Z',
          model: 'openai/gpt-4o',
          status: 'ok',
          input_tokens: 5,
          output_tokens: 3,
          total_tokens: 8,
          cost: 0.001,
          duration_ms: 120,
          agent_name: 'demo',
        },
        {
          id: 'msg-b',
          timestamp: '2026-04-23T09:00:00Z',
          model: 'anthropic/claude-sonnet-4',
          status: 'ok',
          input_tokens: 7,
          output_tokens: 4,
          total_tokens: 11,
          cost: 0.002,
          duration_ms: 180,
          agent_name: 'demo',
        },
      ],
    });
    const onSelect = vi.fn();
    const { container } = render(() => (
      <ReplayPickerDrawer open={true} agentName="demo" onClose={() => {}} onSelect={onSelect} />
    ));
    await flush();
    await flush();
    const items = container.querySelectorAll('.benchmark-replay__item');
    expect(items.length).toBe(2);
    fireEvent.click(items[0]!);
    expect(onSelect).toHaveBeenCalledWith('msg-a');
  });

  it('filters the list by model name when the user types in the search box', async () => {
    api.getMessages.mockResolvedValue({
      items: [
        {
          id: 'msg-a',
          timestamp: '',
          model: 'openai/gpt-4o',
          status: 'ok',
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
          cost: 0.001,
          duration_ms: 10,
          agent_name: 'demo',
        },
        {
          id: 'msg-b',
          timestamp: '',
          model: 'anthropic/claude-sonnet-4',
          status: 'ok',
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
          cost: 0.002,
          duration_ms: 20,
          agent_name: 'demo',
        },
      ],
    });
    const { container } = render(() => (
      <ReplayPickerDrawer open={true} agentName="demo" onClose={() => {}} onSelect={() => {}} />
    ));
    await flush();
    await flush();
    expect(container.querySelectorAll('.benchmark-replay__item').length).toBe(2);
    const input = container.querySelector(
      '.benchmark-replay__search-input',
    ) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'claude' } });
    expect(container.querySelectorAll('.benchmark-replay__item').length).toBe(1);
  });

  it('fires onClose when the backdrop is clicked', async () => {
    api.getMessages.mockResolvedValue({ items: [] });
    const onClose = vi.fn();
    const { container } = render(() => (
      <ReplayPickerDrawer open={true} agentName="demo" onClose={onClose} onSelect={() => {}} />
    ));
    await flush();
    fireEvent.click(container.querySelector('.benchmark-replay__backdrop')!);
    expect(onClose).toHaveBeenCalled();
  });
});
