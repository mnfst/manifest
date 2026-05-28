import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@solidjs/testing-library';

const togglePlaygroundRunStarMock = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  togglePlaygroundRunStar: (...a: unknown[]) => togglePlaygroundRunStarMock(...a),
}));

import PlaygroundRecentSidebar from '../../src/components/playground/PlaygroundHistoryDrawer';
import type { PlaygroundHistoryRunSummary } from '../../src/services/api';

function run(overrides: Partial<PlaygroundHistoryRunSummary>): PlaygroundHistoryRunSummary {
  return {
    id: 'r-1',
    prompt: 'what is the capital of France?',
    createdAt: new Date().toISOString(),
    modelCount: 2,
    models: ['GPT-4o', 'Claude'],
    starred: false,
    bestColumnId: null,
    ...overrides,
  };
}

const noop = () => {};

describe('PlaygroundRecentSidebar (history)', () => {
  beforeEach(() => {
    togglePlaygroundRunStarMock.mockReset();
  });

  it('shows an empty-state message when there are no past runs', () => {
    const { container } = render(() => (
      <PlaygroundRecentSidebar
        open
        loading={false}
        runs={[]}
        activeRunId={null}
        onToggle={noop}
        onSelect={noop}
      />
    ));
    expect(container.textContent).toContain(
      'No runs yet. Send a prompt to see your history here.',
    );
  });

  it('shows a "Loading…" indicator while loading is true', () => {
    const { container } = render(() => (
      <PlaygroundRecentSidebar
        open
        loading
        runs={[]}
        activeRunId={null}
        onToggle={noop}
        onSelect={noop}
      />
    ));
    expect(container.textContent).toContain('Loading');
  });

  it('groups runs into Today / Previous 7 days / Older in order', () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const twoDaysAgo = new Date(startOfToday - 2 * 86_400_000).toISOString();
    const lastMonth = new Date(startOfToday - 30 * 86_400_000).toISOString();
    const today = new Date().toISOString();

    const { container } = render(() => (
      <PlaygroundRecentSidebar
        open
        loading={false}
        runs={[
          run({ id: 'r-today', createdAt: today, prompt: 'today-q' }),
          run({ id: 'r-week', createdAt: twoDaysAgo, prompt: 'week-q' }),
          run({ id: 'r-old', createdAt: lastMonth, prompt: 'old-q' }),
        ]}
        activeRunId={null}
        onToggle={noop}
        onSelect={noop}
      />
    ));
    const text = container.textContent ?? '';
    expect(text).toContain('Today');
    expect(text).toContain('Previous 7 days');
    expect(text).toContain('Older');
    expect(text.indexOf('Today')).toBeLessThan(text.indexOf('Previous 7 days'));
    expect(text.indexOf('Previous 7 days')).toBeLessThan(text.indexOf('Older'));
  });

  it('fires onSelect with the run id when a history item is clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(() => (
      <PlaygroundRecentSidebar
        open
        loading={false}
        runs={[run({ id: 'r-42' })]}
        activeRunId={null}
        onToggle={noop}
        onSelect={onSelect}
      />
    ));
    const button = container.querySelector('.playground-recent__item');
    expect(button).toBeDefined();
    fireEvent.click(button!);
    expect(onSelect).toHaveBeenCalledWith('r-42');
  });

  it('truncates long prompts with an ellipsis', () => {
    const { container } = render(() => (
      <PlaygroundRecentSidebar
        open
        loading={false}
        runs={[run({ id: 'r-long', prompt: 'q'.repeat(100) })]}
        activeRunId={null}
        onToggle={noop}
        onSelect={noop}
      />
    ));
    expect(container.textContent).toContain('…');
  });

  it('highlights the active run id with the --active class', () => {
    const { container } = render(() => (
      <PlaygroundRecentSidebar
        open
        loading={false}
        runs={[run({ id: 'r-1' }), run({ id: 'r-2', prompt: 'two' })]}
        activeRunId="r-2"
        onToggle={noop}
        onSelect={noop}
      />
    ));
    const active = container.querySelector('.playground-recent__item--active');
    expect(active).toBeDefined();
    expect(active?.textContent).toContain('two');
  });

  it('renders only the collapsed toggle when closed and fires onToggle to expand', () => {
    const onToggle = vi.fn();
    const { container } = render(() => (
      <PlaygroundRecentSidebar
        open={false}
        loading={false}
        runs={[run({})]}
        activeRunId={null}
        onToggle={onToggle}
        onSelect={noop}
      />
    ));
    expect(container.querySelector('.playground-recent')).toBeNull();
    const toggle = container.querySelector('[aria-label="Show recent runs"]') as HTMLElement;
    expect(toggle).toBeDefined();
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalled();
  });

  it('fires onToggle when the collapse button is clicked while open', () => {
    const onToggle = vi.fn();
    const { container } = render(() => (
      <PlaygroundRecentSidebar
        open
        loading={false}
        runs={[]}
        activeRunId={null}
        onToggle={onToggle}
        onSelect={noop}
      />
    ));
    fireEvent.click(container.querySelector('[aria-label="Hide runs"]') as HTMLElement);
    expect(onToggle).toHaveBeenCalled();
  });

  it('fires onNewPlayground when the "New run" button is clicked', () => {
    const onNewPlayground = vi.fn();
    const { getByText } = render(() => (
      <PlaygroundRecentSidebar
        open
        loading={false}
        runs={[]}
        activeRunId={null}
        onToggle={noop}
        onSelect={noop}
        onNewPlayground={onNewPlayground}
      />
    ));
    fireEvent.click(getByText('New run'));
    expect(onNewPlayground).toHaveBeenCalled();
  });

  it('does not throw when "New run" is clicked with no onNewPlayground handler', () => {
    const { getByText } = render(() => (
      <PlaygroundRecentSidebar
        open
        loading={false}
        runs={[]}
        activeRunId={null}
        onToggle={noop}
        onSelect={noop}
      />
    ));
    expect(() => fireEvent.click(getByText('New run'))).not.toThrow();
  });

  describe('starred runs', () => {
    it('renders a Starred section for starred runs', () => {
      const { container } = render(() => (
        <PlaygroundRecentSidebar
          open
          loading={false}
          runs={[run({ id: 's1', prompt: 'fav', starred: true })]}
          activeRunId={null}
          onToggle={noop}
          onSelect={noop}
        />
      ));
      expect(container.textContent).toContain('Starred');
    });

    it('wires onStarToggle through a run rendered in the Starred section', async () => {
      togglePlaygroundRunStarMock.mockResolvedValue(false);
      const onStarToggle = vi.fn();
      const { container, getByText } = render(() => (
        <PlaygroundRecentSidebar
          open
          loading={false}
          runs={[run({ id: 's-on', prompt: 'fav', starred: true })]}
          activeRunId={null}
          onToggle={noop}
          onSelect={noop}
          onStarToggle={onStarToggle}
        />
      ));
      fireEvent.click(container.querySelector('[aria-label="Options"]') as HTMLElement);
      fireEvent.click(getByText('Unstar'));
      await waitFor(() => expect(togglePlaygroundRunStarMock).toHaveBeenCalledWith('s-on'));
      await waitFor(() => expect(onStarToggle).toHaveBeenCalledWith('s-on', false));
    });

    it('opens the per-run menu and toggles star, calling the API and onStarToggle', async () => {
      togglePlaygroundRunStarMock.mockResolvedValue(true);
      const onStarToggle = vi.fn();
      const { container, getByText } = render(() => (
        <PlaygroundRecentSidebar
          open
          loading={false}
          runs={[run({ id: 'r-x', starred: false })]}
          activeRunId={null}
          onToggle={noop}
          onSelect={noop}
          onStarToggle={onStarToggle}
        />
      ));
      fireEvent.click(container.querySelector('[aria-label="Options"]') as HTMLElement);
      fireEvent.click(getByText('Star'));
      await waitFor(() => expect(togglePlaygroundRunStarMock).toHaveBeenCalledWith('r-x'));
      await waitFor(() => expect(onStarToggle).toHaveBeenCalledWith('r-x', true));
    });

    it('shows "Unstar" in the menu for an already-starred run', () => {
      const { container, getByText } = render(() => (
        <PlaygroundRecentSidebar
          open
          loading={false}
          runs={[run({ id: 'r-s', starred: true })]}
          activeRunId={null}
          onToggle={noop}
          onSelect={noop}
        />
      ));
      fireEvent.click(container.querySelector('[aria-label="Options"]') as HTMLElement);
      expect(getByText('Unstar')).toBeDefined();
    });

    it('swallows a star-toggle API failure silently', async () => {
      togglePlaygroundRunStarMock.mockRejectedValue(new Error('network'));
      const onStarToggle = vi.fn();
      const { container, getByText } = render(() => (
        <PlaygroundRecentSidebar
          open
          loading={false}
          runs={[run({ id: 'r-f' })]}
          activeRunId={null}
          onToggle={noop}
          onSelect={noop}
          onStarToggle={onStarToggle}
        />
      ));
      fireEvent.click(container.querySelector('[aria-label="Options"]') as HTMLElement);
      fireEvent.click(getByText('Star'));
      await waitFor(() => expect(togglePlaygroundRunStarMock).toHaveBeenCalled());
      // Failure path is silent — no onStarToggle, no throw.
      expect(onStarToggle).not.toHaveBeenCalled();
    });

    it('closes the menu when its backdrop is clicked', () => {
      const { container } = render(() => (
        <PlaygroundRecentSidebar
          open
          loading={false}
          runs={[run({ id: 'r-m' })]}
          activeRunId={null}
          onToggle={noop}
          onSelect={noop}
        />
      ));
      fireEvent.click(container.querySelector('[aria-label="Options"]') as HTMLElement);
      expect(container.querySelector('.playground-recent__menu')).not.toBeNull();
      fireEvent.click(container.querySelector('.playground-recent__menu-backdrop') as HTMLElement);
      expect(container.querySelector('.playground-recent__menu')).toBeNull();
    });
  });

  it('shows the singular "model" wording context — a single-model run still renders its prompt', () => {
    const { container } = render(() => (
      <PlaygroundRecentSidebar
        open
        loading={false}
        runs={[run({ id: 'r-1', prompt: 'solo', modelCount: 1, models: ['One'] })]}
        activeRunId={null}
        onToggle={noop}
        onSelect={noop}
      />
    ));
    expect(container.textContent).toContain('solo');
  });
});
