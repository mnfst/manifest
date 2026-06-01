import { render, screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';

import ModelCapabilityBadges, {
  ModelModalityBadges,
} from '../../src/components/ModelCapabilityBadges';

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

  it('labels input modalities separately from capabilities', () => {
    const { container } = render(() => (
      <ModelModalityBadges modalities={['text', 'image']} direction="input" iconOnly />
    ));

    expect(screen.getByLabelText('Input: Text, Image')).toBeTruthy();
    const tooltips = Array.from(container.querySelectorAll('.model-modality-badge')).map((badge) =>
      badge.getAttribute('data-tooltip'),
    );
    expect(tooltips).toEqual(['Text', 'Image']);
    expect(screen.queryByText('Stream')).toBeNull();
  });

  it('labels output modalities separately from capabilities', () => {
    render(() => <ModelModalityBadges modalities={['text']} direction="output" iconOnly />);

    expect(screen.getByLabelText('Output: Text')).toBeTruthy();
  });
});
