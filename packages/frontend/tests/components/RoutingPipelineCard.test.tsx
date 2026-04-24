import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { buildPipelineHelp } from '../../src/components/RoutingPipelineCard';

function renderHelp(complexity: boolean, specificity: boolean, custom: boolean) {
  const content = buildPipelineHelp(complexity, specificity, custom);
  if (!content) return null;
  render(() => <div>{content}</div>);
  return true;
}

describe('buildPipelineHelp', () => {
  it('returns null when all layers are disabled', () => {
    expect(buildPipelineHelp(false, false, false)).toBeNull();
  });

  it('shows Complexity and Default steps when only complexity is enabled', () => {
    renderHelp(true, false, false);
    expect(screen.getByText('Complexity')).toBeDefined();
    expect(screen.getByText('Default')).toBeDefined();
    expect(screen.getByText(/scored and routed/)).toBeDefined();
  });

  it('shows all four steps when everything is enabled', () => {
    renderHelp(true, true, true);
    expect(screen.getByText('Custom')).toBeDefined();
    expect(screen.getByText('Task-specific')).toBeDefined();
    expect(screen.getByText('Complexity')).toBeDefined();
    expect(screen.getByText('Default')).toBeDefined();
  });

  it('shows Task-specific and Default when only specificity', () => {
    renderHelp(false, true, false);
    expect(screen.getByText('Task-specific')).toBeDefined();
    expect(screen.getByText('Default')).toBeDefined();
    expect(screen.queryByText('Complexity')).toBeNull();
  });

  it('shows Custom and Default when only custom', () => {
    renderHelp(false, false, true);
    expect(screen.getByText('Custom')).toBeDefined();
    expect(screen.getByText('Default')).toBeDefined();
  });

  it('numbers steps sequentially', () => {
    renderHelp(true, true, true);
    const nums = screen.getAllByText(/^[1-4]$/);
    expect(nums.length).toBe(4);
    expect(nums[0].textContent).toBe('1');
    expect(nums[1].textContent).toBe('2');
    expect(nums[2].textContent).toBe('3');
    expect(nums[3].textContent).toBe('4');
  });

  it('shows safety net description for Default when complexity is on', () => {
    renderHelp(true, false, false);
    expect(screen.getByText(/couldn\u2019t handle/)).toBeDefined();
  });

  it('shows generic description for Default when complexity is off', () => {
    renderHelp(false, true, false);
    expect(screen.getByText(/didn\u2019t match an earlier rule/)).toBeDefined();
  });

  it('shows the summary line', () => {
    renderHelp(true, false, false);
    expect(screen.getByText(/first match/i)).toBeDefined();
  });
});
