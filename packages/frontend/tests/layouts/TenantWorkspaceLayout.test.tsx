import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@solidjs/testing-library';

let mockPathname = '/';

vi.mock('@solidjs/router', () => ({
  A: (props: any) => {
    const classes = [props.class || ''];
    if (props.classList) {
      for (const [key, value] of Object.entries(props.classList)) {
        if (value) classes.push(key);
      }
    }
    return (
      <a href={props.href} class={classes.join(' ').trim()} aria-current={props['aria-current']}>
        {props.children}
      </a>
    );
  },
  useLocation: () => ({ pathname: mockPathname }),
}));

import TenantWorkspaceLayout from '../../src/layouts/TenantWorkspaceLayout';

describe('TenantWorkspaceLayout', () => {
  it('renders the workspace navigation links', () => {
    render(() => (
      <TenantWorkspaceLayout>
        <div>Workspace content</div>
      </TenantWorkspaceLayout>
    ));

    expect(screen.getByRole('navigation', { name: 'Workspace navigation' })).toBeDefined();
    expect(screen.getByText('My Agents')).toBeDefined();
    expect(screen.getByText('Providers')).toBeDefined();
    expect(screen.getByText('Subscriptions')).toBeDefined();
    expect(screen.getByText('Bring Your Own Key')).toBeDefined();
    expect(screen.getByText('Local')).toBeDefined();
    expect(screen.getByText('Workspace content')).toBeDefined();
  });

  it('marks My Agents active on the workspace root', () => {
    mockPathname = '/';
    const { container } = render(() => <TenantWorkspaceLayout />);

    expect(container.querySelector('a[href="/"]')?.getAttribute('aria-current')).toBe('page');
    expect(
      container.querySelector('a[href="/providers/subscriptions"]')?.getAttribute('aria-current'),
    ).toBeNull();
  });

  it('marks Subscriptions active on the providers index', () => {
    mockPathname = '/providers';
    const { container } = render(() => <TenantWorkspaceLayout />);

    expect(container.querySelector('a[href="/"]')?.getAttribute('aria-current')).toBeNull();
    expect(
      container.querySelector('a[href="/providers/subscriptions"]')?.getAttribute('aria-current'),
    ).toBe('page');
  });

  it('marks BYOK active on the BYOK page', () => {
    mockPathname = '/providers/byok';
    const { container } = render(() => <TenantWorkspaceLayout />);

    expect(container.querySelector('a[href="/providers/byok"]')?.getAttribute('aria-current')).toBe(
      'page',
    );
  });
});
