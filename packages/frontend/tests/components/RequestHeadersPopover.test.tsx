import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import RequestHeadersPopover, {
  blankEntry,
  isBlockedHeaderKey,
  toHeaderRecord,
  type HeaderEntry,
} from '../../src/components/playground/RequestHeadersPopover';

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
    expect(container.querySelector('.playground-headers')).toBeNull();
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
    expect(container.querySelector('.playground-headers__warning')?.textContent).toContain(
      'Authorization',
    );
    expect(
      container.querySelector('.playground-headers__row--blocked'),
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
    const backdrop = container.querySelector('.playground-headers__backdrop');
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the dialog with aria-modal="true" so screen readers know focus is trapped', () => {
    const { container } = render(() => (
      <RequestHeadersPopover open={true} entries={[]} onChange={() => {}} onClose={() => {}} />
    ));
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).toBeDefined();
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
  });

  it('calls onClose when Escape is pressed at the window', () => {
    const onClose = vi.fn();
    render(() => (
      <RequestHeadersPopover open={true} entries={[]} onChange={() => {}} onClose={onClose} />
    ));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('removes a row when its trash button is clicked', () => {
    const [entries, setEntries] = createSignal<HeaderEntry[]>([
      { id: 'r1', key: 'X-Title', value: 'a' },
      { id: 'r2', key: 'HTTP-Referer', value: 'b' },
    ]);
    const { container } = render(() => (
      <RequestHeadersPopover
        open={true}
        entries={entries()}
        onChange={setEntries}
        onClose={() => {}}
      />
    ));
    const remove = container.querySelector('.playground-headers__remove') as HTMLElement;
    fireEvent.click(remove);
    expect(entries()).toHaveLength(1);
  });

  it('clears all entries via the Clear-all button', () => {
    const [entries, setEntries] = createSignal<HeaderEntry[]>([
      { id: 'r1', key: 'X-Title', value: 'a' },
    ]);
    const { container } = render(() => (
      <RequestHeadersPopover
        open={true}
        entries={entries()}
        onChange={setEntries}
        onClose={() => {}}
      />
    ));
    const clear = container.querySelector('.playground-headers__clear') as HTMLElement;
    fireEvent.click(clear);
    expect(entries()).toEqual([]);
  });

  it('forwards key edits via onChange and only mutates the matching row', () => {
    // Two rows; editing the FIRST row's key must leave the second untouched.
    const [entries, setEntries] = createSignal<HeaderEntry[]>([
      { id: 'r1', key: 'X-Title', value: 'a' },
      { id: 'r2', key: 'HTTP-Referer', value: 'b' },
    ]);
    const { container } = render(() => (
      <RequestHeadersPopover
        open={true}
        entries={entries()}
        onChange={setEntries}
        onClose={() => {}}
      />
    ));
    const keyInputs = container.querySelectorAll(
      '.playground-headers__input--key',
    ) as NodeListOf<HTMLInputElement>;
    fireEvent.input(keyInputs[0]!, { target: { value: 'X-Other' } });
    expect(entries()[0]!.key).toBe('X-Other');
    expect(entries()[1]!.key).toBe('HTTP-Referer');
  });

  it('forwards value edits via onChange', () => {
    const [entries, setEntries] = createSignal<HeaderEntry[]>([
      { id: 'r1', key: 'X-Title', value: 'a' },
    ]);
    const { container } = render(() => (
      <RequestHeadersPopover
        open={true}
        entries={entries()}
        onChange={setEntries}
        onClose={() => {}}
      />
    ));
    const valueInput = container.querySelector(
      '.playground-headers__input--value',
    ) as HTMLInputElement;
    fireEvent.input(valueInput, { target: { value: 'newval' } });
    expect(entries()[0]!.value).toBe('newval');
  });

  it('shows an "empty" hint when no entries are present', () => {
    const { container } = render(() => (
      <RequestHeadersPopover open={true} entries={[]} onChange={() => {}} onClose={() => {}} />
    ));
    expect(container.textContent).toContain('No headers yet');
  });

  it('fires onClose via the explicit close button as well', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <RequestHeadersPopover open={true} entries={[]} onChange={() => {}} onClose={onClose} />
    ));
    const close = container.querySelector('[aria-label="Close request headers"]') as HTMLElement;
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('blankEntry', () => {
  it('returns a fresh entry with empty key/value and a unique id', () => {
    const a = blankEntry();
    const b = blankEntry();
    expect(a.key).toBe('');
    expect(a.value).toBe('');
    expect(a.id).not.toBe(b.id);
  });
});
