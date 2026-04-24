import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { buildPipelineHelp } from '../../src/components/RoutingPipelineCard';

function renderHelp(specificity: boolean, custom: boolean) {
  const content = buildPipelineHelp(specificity, custom);
  render(() => <div>{content}</div>);
  return true;
}

describe('buildPipelineHelp', () => {
  it('always shows Complexity and Default steps even when no opt-in layers are enabled', () => {
    renderHelp(false, false);
    expect(screen.getByText('Complexity routing')).toBeDefined();
    expect(screen.getByText('Default routing')).toBeDefined();
    expect(screen.queryByText('Task-specific routing')).toBeNull();
    expect(screen.queryByText('Custom routing')).toBeNull();
  });

  it('shows all four steps when every opt-in layer is enabled', () => {
    renderHelp(true, true);
    expect(screen.getByText('Custom routing')).toBeDefined();
    expect(screen.getByText('Task-specific routing')).toBeDefined();
    expect(screen.getByText('Complexity routing')).toBeDefined();
    expect(screen.getByText('Default routing')).toBeDefined();
  });

  it('shows Task-specific + Complexity + Default when only specificity is enabled', () => {
    renderHelp(true, false);
    expect(screen.getByText('Task-specific routing')).toBeDefined();
    expect(screen.getByText('Complexity routing')).toBeDefined();
    expect(screen.getByText('Default routing')).toBeDefined();
    expect(screen.queryByText('Custom routing')).toBeNull();
  });

  it('shows Custom + Complexity + Default when only custom is enabled', () => {
    renderHelp(false, true);
    expect(screen.getByText('Custom routing')).toBeDefined();
    expect(screen.getByText('Complexity routing')).toBeDefined();
    expect(screen.getByText('Default routing')).toBeDefined();
  });

  it('numbers steps sequentially', () => {
    renderHelp(true, true);
    const nums = screen.getAllByText(/^[1-4]$/);
    expect(nums.length).toBe(4);
    expect(nums[0].textContent).toBe('1');
    expect(nums[1].textContent).toBe('2');
    expect(nums[2].textContent).toBe('3');
    expect(nums[3].textContent).toBe('4');
  });

  it('describes Default as the catch-all tier', () => {
    renderHelp(false, false);
    expect(screen.getByText(/Catch-all for any query that has no matching tier assignment/)).toBeDefined();
  });

  it('shows the summary line', () => {
    renderHelp(false, false);
    expect(screen.getByText(/intercept queries on the fly/i)).toBeDefined();
    expect(screen.getByText(/current configuration looks like/i)).toBeDefined();
  });
});
