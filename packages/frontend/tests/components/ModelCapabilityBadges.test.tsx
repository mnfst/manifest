import { render, screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';

import ModelCapabilityBadges from '../../src/components/ModelCapabilityBadges';

describe('ModelCapabilityBadges', () => {
  it('labels supported capabilities as read-only model metadata', () => {
    render(() => <ModelCapabilityBadges capabilities={['text', 'stream', 'tools', 'image']} />);

    expect(screen.queryByText('Supports:')).toBeNull();
    expect(screen.getByText('Stream')).toBeTruthy();
    expect(screen.getByText('Tools')).toBeTruthy();
    expect(screen.getByText('Image')).toBeTruthy();
    expect(screen.queryByText('Text')).toBeNull();
    expect(screen.getByLabelText('Capabilities: Stream, Tools, Image')).toBeTruthy();
  });

  it('shows text-only metadata without rendering unchecked capabilities', () => {
    render(() => <ModelCapabilityBadges capabilities={['text']} />);

    expect(screen.getByLabelText('Text only')).toBeTruthy();
    expect(screen.queryByText('Stream')).toBeNull();
  });

  it('shows unknown state when no capability metadata is present', () => {
    const { container } = render(() => <ModelCapabilityBadges />);

    expect(screen.getByLabelText('Capabilities unknown')).toBeTruthy();
    expect(container.querySelector('.model-capability-badge--unknown')).toBeTruthy();
  });
});
