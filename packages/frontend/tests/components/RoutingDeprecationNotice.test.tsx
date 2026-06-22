import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import RoutingDeprecationNotice from '../../src/components/RoutingDeprecationNotice';

describe('RoutingDeprecationNotice', () => {
  it('renders the title and body', () => {
    render(() => (
      <RoutingDeprecationNotice title="Complexity routing is going away.">
        Some explanatory body text.
      </RoutingDeprecationNotice>
    ));
    expect(screen.getByText('Complexity routing is going away.')).toBeDefined();
    expect(screen.getByText('Some explanatory body text.')).toBeDefined();
  });

  it('exposes a note role for assistive technology', () => {
    render(() => <RoutingDeprecationNotice title="T">B</RoutingDeprecationNotice>);
    expect(screen.getByRole('note')).toBeDefined();
  });
});
