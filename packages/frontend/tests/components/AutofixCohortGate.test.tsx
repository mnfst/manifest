import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@solidjs/testing-library';
import { onMount, type Accessor, type Component } from 'solid-js';

const mockGetAutofixCohort = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  getAutofixCohort: (...args: unknown[]) => mockGetAutofixCohort(...args),
}));

import AutofixCohortGate from '../../src/components/AutofixCohortGate';

/** Renders the tenant's eligibility onto a data attribute, and counts how many
 *  times it mounts — the gate must mount this exactly once, never remounting
 *  when the async cohort check resolves. */
const Probe: Component<{ eligible: Accessor<boolean>; onMount: () => void }> = (props) => {
  onMount(() => props.onMount());
  return <div data-testid="child" data-eligible={String(props.eligible())} />;
};

function renderGate() {
  let mounts = 0;
  render(() => (
    <AutofixCohortGate>
      {(eligible) => <Probe eligible={eligible} onMount={() => (mounts += 1)} />}
    </AutofixCohortGate>
  ));
  return { getMounts: () => mounts };
}

describe('AutofixCohortGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('reports eligible for a tenant in the cohort, mounting the child only once', async () => {
    mockGetAutofixCohort.mockResolvedValue({ eligible: true });
    const { getMounts } = renderGate();

    // Starts not-eligible (check pending), then flips to eligible in place.
    expect(screen.getByTestId('child').getAttribute('data-eligible')).toBe('false');
    await waitFor(() =>
      expect(screen.getByTestId('child').getAttribute('data-eligible')).toBe('true'),
    );
    // The subtree resolved without a remount — no local state would be lost.
    expect(getMounts()).toBe(1);
  });

  it('reports not eligible for a default tenant outside the cohort', async () => {
    mockGetAutofixCohort.mockResolvedValue({ eligible: false });
    renderGate();

    await waitFor(() => expect(mockGetAutofixCohort).toHaveBeenCalled());
    expect(screen.getByTestId('child').getAttribute('data-eligible')).toBe('false');
  });

  it('reports not eligible while the check is still loading', () => {
    // A never-resolving promise keeps the resource pending indefinitely.
    mockGetAutofixCohort.mockReturnValue(new Promise(() => {}));
    renderGate();

    expect(screen.getByTestId('child').getAttribute('data-eligible')).toBe('false');
  });

  it('reports not eligible when the check errors (reading it must not throw)', async () => {
    mockGetAutofixCohort.mockRejectedValue(new Error('network'));
    renderGate();

    await waitFor(() => expect(mockGetAutofixCohort).toHaveBeenCalled());
    expect(screen.getByTestId('child').getAttribute('data-eligible')).toBe('false');
  });
});
