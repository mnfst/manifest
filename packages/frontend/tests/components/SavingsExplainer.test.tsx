import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

import SavingsExplainer from '../../src/components/SavingsExplainer';

describe('SavingsExplainer', () => {
  it('renders the title', () => {
    render(() => <SavingsExplainer baselineModelName={null} onClose={() => {}} />);
    expect(screen.getByText('How savings are calculated')).toBeDefined();
  });

  it('renders back button', () => {
    render(() => <SavingsExplainer baselineModelName={null} onClose={() => {}} />);
    expect(screen.getByLabelText('Back to Overview')).toBeDefined();
  });

  it('calls onClose when back button clicked', () => {
    const onClose = vi.fn();
    render(() => <SavingsExplainer baselineModelName="Claude Haiku 4.5" onClose={onClose} />);
    screen.getByLabelText('Back to Overview').click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows current baseline name when provided', () => {
    render(() => <SavingsExplainer baselineModelName="Claude Haiku 4.5" onClose={() => {}} />);
    expect(screen.getByText('Claude Haiku 4.5')).toBeDefined();
  });

  it('does not show baseline name when null', () => {
    render(() => <SavingsExplainer baselineModelName={null} onClose={() => {}} />);
    expect(screen.queryByText('Current reference:')).toBeNull();
  });

  it('renders all section headings', () => {
    render(() => <SavingsExplainer baselineModelName={null} onClose={() => {}} />);
    expect(screen.getByText('How it works')).toBeDefined();
    expect(screen.getByText('Savings by access type')).toBeDefined();
    expect(screen.getByText('Examples')).toBeDefined();
    expect(screen.getByText('What is not included yet')).toBeDefined();
  });

  it('renders setup subsections', () => {
    render(() => <SavingsExplainer baselineModelName={null} onClose={() => {}} />);
    expect(screen.getByText('API key providers')).toBeDefined();
    expect(screen.getByText('Subscription providers')).toBeDefined();
    expect(screen.getByText('Local models')).toBeDefined();
  });

  it('renders examples', () => {
    render(() => <SavingsExplainer baselineModelName={null} onClose={() => {}} />);
    expect(screen.getByText('Routing picks a cheap API model')).toBeDefined();
    expect(screen.getByText('Routing picks a subscription model')).toBeDefined();
    expect(screen.getByText('Routing picks a local model')).toBeDefined();
  });

  it('renders baseline explanation', () => {
    const { container } = render(() => <SavingsExplainer baselineModelName={null} onClose={() => {}} />);
    expect(container.textContent).toContain('most expensive model');
  });
});
