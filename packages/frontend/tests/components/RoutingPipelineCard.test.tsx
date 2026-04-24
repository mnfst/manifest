import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { buildPipelineHelp } from '../../src/components/RoutingPipelineCard';

function renderHelp(complexity: boolean, specificity: boolean, custom: boolean) {
  const content = buildPipelineHelp(complexity, specificity, custom);
  render(() => <div>{content}</div>);
  return true;
}

describe('buildPipelineHelp', () => {
  it('shows only the Default step when all layers are disabled', () => {
    renderHelp(false, false, false);
    expect(screen.getByText('Default routing')).toBeDefined();
    expect(screen.queryByText('Complexity routing')).toBeNull();
    expect(screen.queryByText('Task-specific routing')).toBeNull();
    expect(screen.queryByText('Custom routing')).toBeNull();
  });

  it('shows Complexity and Default steps when only complexity is enabled', () => {
    renderHelp(true, false, false);
    expect(screen.getByText('Complexity routing')).toBeDefined();
    expect(screen.getByText('Default routing')).toBeDefined();
    expect(screen.getByText(/scores its complexity/)).toBeDefined();
  });

  it('shows all four steps when everything is enabled', () => {
    renderHelp(true, true, true);
    expect(screen.getByText('Custom routing')).toBeDefined();
    expect(screen.getByText('Task-specific routing')).toBeDefined();
    expect(screen.getByText('Complexity routing')).toBeDefined();
    expect(screen.getByText('Default routing')).toBeDefined();
  });

  it('shows Task-specific and Default when only specificity', () => {
    renderHelp(false, true, false);
    expect(screen.getByText('Task-specific routing')).toBeDefined();
    expect(screen.getByText('Default routing')).toBeDefined();
    expect(screen.queryByText('Complexity routing')).toBeNull();
  });

  it('shows Custom and Default when only custom', () => {
    renderHelp(false, false, true);
    expect(screen.getByText('Custom routing')).toBeDefined();
    expect(screen.getByText('Default routing')).toBeDefined();
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

  it('shows the same Default description regardless of complexity state', () => {
    renderHelp(true, false, false);
    expect(screen.getByText(/Default model and fallbacks for all queries/)).toBeDefined();
  });

  it('shows Default description when complexity is off', () => {
    renderHelp(false, true, false);
    expect(screen.getByText(/Default model and fallbacks for all queries/)).toBeDefined();
  });

  it('shows the summary line', () => {
    renderHelp(true, false, false);
    expect(screen.getByText(/intercept queries on the fly/i)).toBeDefined();
    expect(screen.getByText(/current configuration looks like/i)).toBeDefined();
  });
});
