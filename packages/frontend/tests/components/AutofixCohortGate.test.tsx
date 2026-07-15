import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@solidjs/testing-library';

const mockGetAutofixCohort = vi.fn();
vi.mock('../../src/services/api.js', () => ({
  getAutofixCohort: (...args: unknown[]) => mockGetAutofixCohort(...args),
}));

import AutofixCohortGate from '../../src/components/AutofixCohortGate';

function renderGate() {
  return render(() => (
    <AutofixCohortGate fallback={<div data-testid="existing">existing UI</div>}>
      <div data-testid="beta">new UI</div>
    </AutofixCohortGate>
  ));
}

describe('AutofixCohortGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    cleanup();
  });

  it('renders the new UI for an eligible tenant', async () => {
    mockGetAutofixCohort.mockResolvedValue({ eligible: true });
    renderGate();

    await waitFor(() => expect(screen.getByTestId('beta')).toBeDefined());
    // The existing UI is swapped out, not layered underneath.
    expect(screen.queryByTestId('existing')).toBeNull();
  });

  it('keeps the existing UI for a default tenant outside the cohort', async () => {
    mockGetAutofixCohort.mockResolvedValue({ eligible: false });
    renderGate();

    await waitFor(() => expect(mockGetAutofixCohort).toHaveBeenCalled());
    expect(screen.getByTestId('existing')).toBeDefined();
    expect(screen.queryByTestId('beta')).toBeNull();
  });

  it('shows the existing UI while the eligibility check is still loading', () => {
    // A never-resolving promise keeps the resource pending indefinitely.
    mockGetAutofixCohort.mockReturnValue(new Promise(() => {}));
    renderGate();

    expect(screen.getByTestId('existing')).toBeDefined();
    expect(screen.queryByTestId('beta')).toBeNull();
  });

  it('falls back to the existing UI when the eligibility check errors', async () => {
    mockGetAutofixCohort.mockRejectedValue(new Error('network'));
    renderGate();

    await waitFor(() => expect(mockGetAutofixCohort).toHaveBeenCalled());
    // A failed check must never reveal the beta UI, nor blank the page.
    expect(screen.getByTestId('existing')).toBeDefined();
    expect(screen.queryByTestId('beta')).toBeNull();
  });
});
