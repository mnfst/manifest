import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import { buildPipelineHelp } from '../../src/components/RoutingPipelineCard';

function renderHelp(specificity: boolean, custom: boolean, complexity: boolean) {
  const content = buildPipelineHelp(specificity, custom, complexity);
  render(() => <div>{content}</div>);
  return true;
}

describe('buildPipelineHelp', () => {
  it('always shows Default routing even when no opt-in layers are enabled', () => {
    renderHelp(false, false, false);
    expect(screen.getByText('Default routing:')).toBeNull
    expect(screen.queryByText('Complexity routing')).toBeNull();
    expect(screen.queryByText('Task-specific routing')).toBeNull();
    expect(screen.queryByText('Custom routing')).toBeNull();
  });

  it('shows all four steps when every opt-in layer is enabled', () => {
    renderHelp(true, true, true);
    expect(screen.getByText('Custom routing')).toBeDefined();
    expect(screen.getByText('Task-specific routing')).toBeDefined();
    expect(screen.queryByText('Complexity routing')).toBeNull();
    expect(screen.queryByText('Default routing:')).toBeDefined();
  });

  it('shows Task-specific + Default when only specificity is enabled', () => {
    renderHelp(true, false, false);
    expect(screen.getByText('Task-specific routing')).toBeDefined();
    expect(screen.queryByText('Custom routing')).toBeNull();
    expect(screen.queryByText('Complexity routing')).toBeNull();
  });

  it('shows Custom + Default when only custom is enabled', () => {
    renderHelp(false, true, false);
    expect(screen.getByText('Custom routing')).toBeDefined();
    expect(screen.queryByText('Complexity routing')).toBeNull();
  });

  it('numbers steps sequentially for three steps (custom + specificity + default)', () => {
    renderHelp(true, true, true);
    const nums = screen.getAllByText(/^[1-3]$/);
    expect(nums.length).toBe(3);
    expect(nums[0].textContent).toBe('1');
    expect(nums[1].textContent).toBe('2');
    expect(nums[2].textContent).toBe('3');
  });

  it('numbers steps sequentially for two steps', () => {
    renderHelp(false, false, false);
    const nums = screen.getAllByText(/^[1-2]$/);
    expect(nums.length).toBe(1);
    expect(nums[0].textContent).toBe('1');
  });

  it('describes Default as catch-all when complexity=false', () => {
    renderHelp(false, false, false);
    expect(
      screen.getByText('All remaining requests go to the default model and its fallbacks.'),
    ).toBeDefined();
  });

  it('describes Default as complexity scoring when complexity=true', () => {
    renderHelp(false, false, true);
    expect(
      screen.getByText(
        /scores its complexity, and assigns it to a tier ranging from \u201csimple\u201d to \u201creasoning\u201d/,
      ),
    ).toBeDefined();
  });

  it('annotates default step name with "regular" when complexity=false', () => {
    renderHelp(false, false, false);
    expect(screen.getByText('regular')).toBeDefined();
  });

  it('annotates default step name with "complexity" when complexity=true', () => {
    renderHelp(false, false, true);
    expect(screen.getByText('complexity')).toBeDefined();
  });

  it('shows the summary line', () => {
    renderHelp(false, false, false);
    expect(screen.getByText(/intercept queries on the fly/i)).toBeDefined();
    expect(screen.getByText(/current configuration looks like/i)).toBeDefined();
  });
});
