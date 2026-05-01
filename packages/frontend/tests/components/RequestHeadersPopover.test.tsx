import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import RequestHeadersPopover, {
  blankEntry,
  isBlockedHeaderKey,
  toHeaderRecord,
  type HeaderEntry,
} from '../../src/components/benchmark/RequestHeadersPopover';

describe('isBlockedHeaderKey', () => {
  it('flags Manifest-managed and transport-layer headers case-insensitively', () => {
    expect(isBlockedHeaderKey('Authorization')).toBe(true);
    expect(isBlockedHeaderKey('cookie')).toBe(true);
    expect(isBlockedHeaderKey('Content-Type')).toBe(true);
    expect(isBlockedHeaderKey('X-Manifest-Trace')).toBe(true);
  });

  it('lets normal provider headers through', () => {
    expect(isBlockedHeaderKey('HTTP-Referer')).toBe(false);
    expect(isBlockedHeaderKey('X-Title')).toBe(false);
    expect(isBlockedHeaderKey('OpenAI-Organization')).toBe(false);
  });

  it('treats empty / whitespace as not blocked so the warning does not flash on new rows', () => {
    expect(isBlockedHeaderKey('')).toBe(false);
    expect(isBlockedHeaderKey('   ')).toBe(false);
  });
});

describe('toHeaderRecord', () => {
  it('drops blocked keys, empty keys, and empty values', () => {
    const record = toHeaderRecord([
      { id: '1', key: 'HTTP-Referer', value: 'https://x' },
      { id: '2', key: 'Authorization', value: 'Bearer' },
      { id: '3', key: '', value: 'orphan' },
      { id: '4', key: 'X-Empty', value: '' },
      { id: '5', key: ' X-Title ', value: 'Trimmed' },
    ]);
    expect(record).toEqual({
      'HTTP-Referer': 'https://x',
      'X-Title': 'Trimmed',
    });
  });
});

describe('RequestHeadersPopover', () => {
  it('renders nothing when closed', () => {
    const { container } = render(() => (
      <RequestHeadersPopover open={false} entries={[]} onChange={() => {}} onClose={() => {}} />
    ));
    expect(container.querySelector('.benchmark-headers')).toBeNull();
  });

  it('adds a new blank row when "Add header" is clicked', () => {
    const [entries, setEntries] = createSignal<HeaderEntry[]>([blankEntry()]);
    const { getByText } = render(() => (
      <RequestHeadersPopover
        open={true}
        entries={entries()}
        onChange={setEntries}
        onClose={() => {}}
      />
    ));
    expect(entries().length).toBe(1);
    fireEvent.click(getByText('Add header'));
    expect(entries().length).toBe(2);
  });

  it('shows an inline warning when the user types a Manifest-managed key', () => {
    const initial: HeaderEntry = { id: '1', key: 'Authorization', value: 'Bearer x' };
    const { container } = render(() => (
      <RequestHeadersPopover
        open={true}
        entries={[initial]}
        onChange={() => {}}
        onClose={() => {}}
      />
    ));
    expect(container.querySelector('.benchmark-headers__warning')?.textContent).toContain(
      'Authorization',
    );
    expect(
      container.querySelector('.benchmark-headers__row--blocked'),
    ).toBeDefined();
  });

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <RequestHeadersPopover
        open={true}
        entries={[]}
        onChange={() => {}}
        onClose={onClose}
      />
    ));
    const backdrop = container.querySelector('.benchmark-headers__backdrop');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });
});
