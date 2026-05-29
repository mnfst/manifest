import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';

vi.mock('@solidjs/router', () => ({
  A: (props: { href: string; class?: string; children: unknown }) => (
    <a href={props.href} class={props.class}>
      {props.children as string}
    </a>
  ),
}));

import PlaygroundEmptyState from '../../src/components/playground/PlaygroundEmptyState';

describe('PlaygroundEmptyState', () => {
  it('renders the no-providers copy and links to the providers page', () => {
    const { container } = render(() => (
      <PlaygroundEmptyState providersPath="/agents/demo/providers" />
    ));

    expect(container.textContent).toContain('No providers connected');
    expect(container.textContent).toContain('run your models side by side');

    const link = container.querySelector('a.btn--primary') as HTMLAnchorElement | null;
    expect(link?.textContent?.trim()).toBe('Connect provider');
    expect(link?.getAttribute('href')).toBe('/agents/demo/providers');
  });
});
