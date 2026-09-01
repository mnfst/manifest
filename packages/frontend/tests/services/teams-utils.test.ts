import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  avatarColor,
  csvEscape,
  currentMonthLabel,
  downloadTextFile,
  formatMoney,
  initials,
  toCsv,
} from '../../src/services/teams-utils';

describe('initials', () => {
  it('takes the first and last word initials', () => {
    expect(initials('Maya Okonkwo')).toBe('MO');
    expect(initials('Sara  Lindqvist ')).toBe('SL');
    expect(initials('Jean-Luc Picard')).toBe('JP');
  });
  it('takes a single initial for one word and a placeholder for nothing', () => {
    expect(initials('claude-code')).toBe('CC');
    expect(initials('daily')).toBe('D');
    expect(initials('   ')).toBe('?');
  });
});

describe('avatarColor', () => {
  it('is deterministic and comes from the shared palette', () => {
    expect(avatarColor('Maya')).toBe(avatarColor('Maya'));
    expect(avatarColor('Maya')).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('formatMoney / currentMonthLabel', () => {
  it('formats with separators and two decimals', () => {
    expect(formatMoney(1204.8)).toBe('$1,204.80');
    expect(formatMoney(0)).toBe('$0.00');
  });
  it('labels the month', () => {
    expect(currentMonthLabel(new Date(2026, 7, 28))).toBe('August 2026');
    expect(typeof currentMonthLabel()).toBe('string');
  });
});

describe('csv helpers', () => {
  it('escapes quotes, commas and newlines and tolerates nulls', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape('x\ny')).toBe('"x\ny"');
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
    expect(csvEscape(3)).toBe('3');
    // Formula-like cells are neutralised so a hostile name cannot run in a spreadsheet.
    expect(csvEscape('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvEscape('+1')).toBe("'+1");
    expect(csvEscape('-x')).toBe("'-x");
    expect(csvEscape('@cmd, x')).toBe('"\'@cmd, x"');
    expect(csvEscape(-3)).toBe('-3');
  });
  it('joins headers and rows', () => {
    expect(
      toCsv(
        ['a', 'b'],
        [
          [1, 'x,y'],
          [null, 'z'],
        ],
      ),
    ).toBe('a,b\n1,"x,y"\n,z');
  });
});

describe('downloadTextFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('creates an anchor, clicks it and revokes the object URL', () => {
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadTextFile('a.csv', 'x,y');
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download="a.csv"]')).toBeNull();
  });
  it('is a no-op when object URLs are unavailable', () => {
    const original = URL.createObjectURL;
    // @ts-expect-error simulate an environment without object URLs
    URL.createObjectURL = undefined;
    try {
      expect(() => downloadTextFile('a.csv', 'x')).not.toThrow();
    } finally {
      URL.createObjectURL = original;
    }
  });
});
