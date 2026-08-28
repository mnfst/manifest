import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@solidjs/testing-library';

vi.mock('@solidjs/router', () => ({
  A: (props: any) => (
    <a
      href={props.href}
      role={props.role}
      aria-selected={props['aria-selected']}
      class={[
        props.class,
        ...Object.entries(props.classList ?? {})
          .filter(([, on]) => on)
          .map(([name]) => name),
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {props.children}
    </a>
  ),
}));

import Avatar from '../../src/components/Avatar';
import AvatarStack from '../../src/components/AvatarStack';
import FilterCheckbox from '../../src/components/FilterCheckbox';
import SortableTh from '../../src/components/SortableTh';
import StatCards from '../../src/components/StatCards';
import EntityTabs from '../../src/components/EntityTabs';
import TriStateCheckbox from '../../src/components/TriStateCheckbox';
import BulkResultNotice from '../../src/components/BulkResultNotice';

describe('Avatar', () => {
  it('renders coloured initials with the name as title', () => {
    const { container } = render(() => <Avatar name="Maya Okonkwo" />);
    const el = container.querySelector('.avatar') as HTMLElement;
    expect(el.textContent).toBe('MO');
    expect(el.getAttribute('title')).toBe('Maya Okonkwo');
    expect(el.style.background).not.toBe('');
    expect(el.classList.contains('avatar--sm')).toBe(false);
  });
  it('supports sizes and a custom title', () => {
    const { container } = render(() => (
      <>
        <Avatar name="Tom Reyes" size="sm" title="" />
        <Avatar name="Tom Reyes" size="lg" />
      </>
    ));
    const [small, large] = Array.from(container.querySelectorAll('.avatar'));
    expect(small!.classList.contains('avatar--sm')).toBe(true);
    expect(small!.getAttribute('title')).toBe('');
    expect(large!.classList.contains('avatar--lg')).toBe(true);
  });
});

describe('AvatarStack', () => {
  const users = [
    { id: '1', name: 'Maya Okonkwo' },
    { id: '2', name: 'Tom Reyes' },
    { id: '3', name: 'Sara Lindqvist' },
    { id: '4', name: 'Deniz Kaya' },
    { id: '5', name: 'Ana Ruiz' },
  ];
  it('shows up to three avatars and collapses the rest into +n', () => {
    const { container } = render(() => <AvatarStack users={users} />);
    expect(container.querySelectorAll('.avatar').length).toBe(3);
    const more = container.querySelector('.avatar-stack__more');
    expect(more?.textContent).toBe('+2');
    expect(more?.getAttribute('title')).toBe('Deniz Kaya, Ana Ruiz');
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain(
      'Maya Okonkwo, Tom Reyes',
    );
  });
  it('respects a custom max and shows no +n when everyone fits', () => {
    const { container } = render(() => <AvatarStack users={users.slice(0, 2)} max={2} />);
    expect(container.querySelectorAll('.avatar').length).toBe(2);
    expect(container.querySelector('.avatar-stack__more')).toBeNull();
  });
  it('renders an empty label without users', () => {
    const { container } = render(() => <AvatarStack users={[]} />);
    expect(container.textContent).toBe('No users');
  });
});

describe('FilterCheckbox', () => {
  it('renders a chip checkbox and reports changes', () => {
    const onChange = vi.fn();
    const { container } = render(() => (
      <FilterCheckbox label="Include archived" checked={false} onChange={onChange} />
    ));
    const label = container.querySelector('label.filter-checkbox')!;
    expect(label.textContent).toContain('Include archived');
    expect(label.classList.contains('filter-checkbox--on')).toBe(false);
    fireEvent.click(container.querySelector('input')!);
    expect(onChange).toHaveBeenCalledWith(true);
  });
  it('shows the on state', () => {
    const { container } = render(() => (
      <FilterCheckbox label="Include archived" checked onChange={() => {}} />
    ));
    expect(container.querySelector('label.filter-checkbox--on')).not.toBeNull();
  });
});

describe('SortableTh', () => {
  it('starts with the default direction, then flips when active', () => {
    const onSort = vi.fn();
    const { container } = render(() => (
      <table>
        <thead>
          <tr>
            <SortableTh
              label="Spend"
              sortKey="spend"
              activeKey={null}
              dir="asc"
              onSort={onSort}
              defaultDir="desc"
            />
          </tr>
        </thead>
      </table>
    ));
    const th = container.querySelector('th')!;
    expect(th.getAttribute('aria-sort')).toBe('none');
    expect(th.textContent).toContain('↕');
    fireEvent.click(container.querySelector('button')!);
    expect(onSort).toHaveBeenCalledWith('spend', 'desc');
  });
  it('shows the active direction and toggles it', () => {
    const onSort = vi.fn();
    const asc = render(() => (
      <table>
        <thead>
          <tr>
            <SortableTh label="Agent" sortKey="agent" activeKey="agent" dir="asc" onSort={onSort} />
          </tr>
        </thead>
      </table>
    ));
    expect(asc.container.querySelector('th')?.getAttribute('aria-sort')).toBe('ascending');
    expect(asc.container.textContent).toContain('▲');
    fireEvent.click(asc.container.querySelector('button')!);
    expect(onSort).toHaveBeenCalledWith('agent', 'desc');
    asc.unmount();
    const desc = render(() => (
      <table>
        <thead>
          <tr>
            <SortableTh
              label="Agent"
              sortKey="agent"
              activeKey="agent"
              dir="desc"
              onSort={onSort}
            />
          </tr>
        </thead>
      </table>
    ));
    expect(desc.container.querySelector('th')?.getAttribute('aria-sort')).toBe('descending');
    expect(desc.container.textContent).toContain('▼');
    fireEvent.click(desc.container.querySelector('button')!);
    expect(onSort).toHaveBeenLastCalledWith('agent', 'asc');
  });
  it('defaults to ascending for an inactive column without defaultDir', () => {
    const onSort = vi.fn();
    const { container } = render(() => (
      <table>
        <thead>
          <tr>
            <SortableTh
              label="Owner"
              sortKey="owner"
              activeKey="agent"
              dir="desc"
              onSort={onSort}
            />
          </tr>
        </thead>
      </table>
    ));
    fireEvent.click(container.querySelector('button')!);
    expect(onSort).toHaveBeenCalledWith('owner', 'asc');
  });
});

describe('StatCards', () => {
  it('renders labels, values, tones and trends', () => {
    const { container } = render(() => (
      <StatCards
        items={[
          { label: 'Cost this month', value: '$186.20', trendPct: 22.4 },
          { label: 'Cost (365d)', value: '$13.80' },
          { label: 'Over', value: '$8.40', trendPct: -1500 },
          { label: 'Requests', value: '21,406', trendPct: 0.2 },
        ]}
      />
    ));
    const cards = container.querySelectorAll('.overview-stat-card');
    expect(cards.length).toBe(4);
    expect(cards[0]!.textContent).toContain('Cost this month');
    expect(cards[0]!.querySelector('.trend')?.textContent).toBe('+22%');
    expect(cards[1]!.querySelector('.trend')).toBeNull();
    expect(cards[2]!.querySelector('.trend')?.textContent).toBe('-999%');
    // A rounded-to-zero trend is not shown.
    expect(cards[3]!.querySelector('.trend')).toBeNull();
  });
});

describe('EntityTabs', () => {
  it('renders a tablist with the active tab flagged', () => {
    const { container } = render(() => (
      <EntityTabs
        tabs={[
          { label: 'Overview', href: '/users/u1', active: true },
          { label: 'Agents', href: '/users/u1/agents', active: false },
        ]}
      />
    ));
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]!.classList.contains('panel__tab--active')).toBe(true);
    expect(tabs[1]!.getAttribute('href')).toBe('/users/u1/agents');
    expect(tabs[1]!.classList.contains('panel__tab--active')).toBe(false);
  });
});

describe('TriStateCheckbox', () => {
  it('reflects all / some / none and toggles', () => {
    const onToggle = vi.fn();
    const all = render(() => <TriStateCheckbox state="all" onToggle={onToggle} label="Atlas" />);
    const input = all.container.querySelector('input')!;
    expect(input.checked).toBe(true);
    expect(input.indeterminate).toBe(false);
    expect(input.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(input);
    expect(onToggle).toHaveBeenCalledTimes(1);
    all.unmount();
    const some = render(() => <TriStateCheckbox state="some" onToggle={onToggle} label="HSBC" />);
    const mid = some.container.querySelector('input')!;
    expect(mid.indeterminate).toBe(true);
    expect(mid.getAttribute('aria-checked')).toBe('mixed');
    expect(mid.getAttribute('aria-label')).toBe('HSBC');
    some.unmount();
    const none = render(() => <TriStateCheckbox state="none" onToggle={onToggle} label="X" />);
    expect(none.container.querySelector('input')!.checked).toBe(false);
    expect(none.container.querySelector('input')!.getAttribute('aria-checked')).toBe('false');
  });
});

describe('BulkResultNotice', () => {
  it('reports what applied and what did not, with reasons', () => {
    const onDismiss = vi.fn();
    const { container } = render(() => (
      <BulkResultNotice
        action="Project changes"
        result={{
          applied: ['a', 'b'],
          failed: [{ agent_name: 'c', reason: 'Agent is archived' }],
        }}
        onDismiss={onDismiss}
      />
    ));
    expect(container.textContent).toContain('Project changes: applied to 2 agents');
    expect(container.textContent).toContain('1 did not apply');
    expect(container.textContent).toContain('c: Agent is archived');
    expect(container.querySelector('.bulk-result--failed')).not.toBeNull();
    fireEvent.click(container.querySelector('button')!);
    expect(onDismiss).toHaveBeenCalled();
  });
  it('uses the singular and hides the failure list when everything applied', () => {
    const { container } = render(() => (
      <BulkResultNotice
        action="Copy settings"
        result={{ applied: ['a'], failed: [] }}
        onDismiss={() => {}}
      />
    ));
    expect(container.textContent).toContain('applied to 1 agent');
    expect(container.textContent).not.toContain('did not apply');
    expect(container.querySelector('.bulk-result--failed')).toBeNull();
    expect(container.querySelector('ul')).toBeNull();
  });
});
