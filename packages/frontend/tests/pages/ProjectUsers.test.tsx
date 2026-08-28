import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';

vi.mock('@solidjs/router', () => ({
  A: (props: any) => (
    <a href={props.href} class={props.class}>
      {props.children}
    </a>
  ),
}));

type Ctx = ReturnType<(typeof import('../../src/pages/ProjectDetail'))['useProjectDetail']>;
let mockCtx: Ctx;
vi.mock('../../src/pages/ProjectDetail.jsx', () => ({
  useProjectDetail: () => mockCtx,
}));

import ProjectUsers from '../../src/pages/ProjectUsers';

const resource = <T,>(value: T, extra: { loading?: boolean; error?: unknown } = {}) =>
  Object.assign(() => value, { loading: false, error: undefined, state: 'ready', ...extra });

const users = [
  {
    id: 'u1',
    name: 'Maya Okonkwo',
    email: null,
    role: 'Engineering',
    monthly_budget_usd: 200,
    archived_at: null,
    created_at: '',
    agent_count: 4,
    spend_month_usd: 186.2,
    last_active_at: null,
  },
  {
    id: 'u2',
    name: 'Deniz Kaya',
    email: null,
    role: null,
    monthly_budget_usd: null,
    archived_at: null,
    created_at: '',
    agent_count: 1,
    spend_month_usd: -1,
    last_active_at: null,
  },
];

const agents = [
  { agent_name: 'a', owner: { id: 'u1', name: 'Maya Okonkwo' } },
  { agent_name: 'b', owner: { id: 'u1', name: 'Maya Okonkwo' } },
  { agent_name: 'c', owner: null },
];

const makeCtx = (ov: unknown, extra: { loading?: boolean; error?: unknown } = {}): Ctx =>
  ({
    projectId: () => 'p-1',
    project: resource(null),
    overview: resource(ov, extra),
    refetchProject: vi.fn(),
    refetchOverview: vi.fn(),
  }) as unknown as Ctx;

describe('ProjectUsers', () => {
  beforeEach(() => {
    mockCtx = makeCtx({ users, agents });
  });

  it('lists users with agent counts, spend and budget meters', () => {
    const { container } = render(() => <ProjectUsers />);
    expect(container.querySelector('a[href="/users/u1"]')?.textContent).toContain('Maya Okonkwo');
    expect(container.textContent).toContain('Engineering');
    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0]!.querySelectorAll('td')[1]!.textContent).toBe('2');
    expect(rows[1]!.querySelectorAll('td')[1]!.textContent).toBe('0');
    expect(container.textContent).toContain('$186.20');
    expect(container.textContent).toContain('$13.80 left');
    expect(container.textContent).toContain('No budget');
    expect(rows[1]!.querySelectorAll('td')[2]!.textContent).toBe('-');
  });

  it('shows the empty state and the loading skeleton', () => {
    mockCtx = makeCtx({ users: [], agents: [] });
    const empty = render(() => <ProjectUsers />);
    expect(empty.container.textContent).toContain('No users on this project');
    empty.unmount();
    mockCtx = makeCtx(undefined, { loading: true });
    const { container } = render(() => <ProjectUsers />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
  });

  it('shows an unavailable state with retry once loading ends without data', () => {
    mockCtx = makeCtx(undefined);
    const { container, getByText } = render(() => <ProjectUsers />);
    expect(container.querySelector('.skeleton')).toBeNull();
    expect(container.textContent).toContain('Overview unavailable');
    fireEvent.click(getByText('Try again'));
    expect(mockCtx.refetchOverview).toHaveBeenCalled();
  });

  it('shows an error state with retry when the overview failed', () => {
    mockCtx = makeCtx(undefined, { error: new Error('boom') });
    const { container, getByText } = render(() => <ProjectUsers />);
    expect(container.textContent).toContain("Couldn't load this project's users");
    fireEvent.click(getByText('Try again'));
    expect(mockCtx.refetchOverview).toHaveBeenCalled();
  });
});
