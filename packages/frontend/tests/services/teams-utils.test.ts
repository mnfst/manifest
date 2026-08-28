import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  avatarColor,
  budgetLabel,
  budgetState,
  BUDGET_WARN_RATIO,
  csvEscape,
  currentMonthLabel,
  downloadTextFile,
  formatMoney,
  initials,
  MAX_BUDGET_USD,
  parseBudgetInput,
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

describe('budgetState / budgetLabel', () => {
  it('returns none without a budget', () => {
    expect(budgetState(10, null)).toEqual({ tone: 'none', ratio: 0, left: null });
    expect(budgetState(10, 0)).toEqual({ tone: 'none', ratio: 0, left: null });
    expect(budgetLabel(10, undefined)).toBeNull();
  });
  it('is ok under the warn ratio, warn at the ratio, over past the cap', () => {
    expect(budgetState(50, 200).tone).toBe('ok');
    expect(budgetState(200 * BUDGET_WARN_RATIO, 200).tone).toBe('warn');
    const warn = budgetState(186.2, 200);
    expect(warn.tone).toBe('warn');
    expect(warn.left).toBe(13.8);
    expect(warn.ratio).toBeCloseTo(0.931, 3);
    expect(budgetState(58.4, 50)).toEqual({ tone: 'over', ratio: 1, left: -8.4 });
  });
  it('labels left and over amounts', () => {
    expect(budgetLabel(186.2, 200)).toBe('$13.80 left');
    expect(budgetLabel(58.4, 50)).toBe('$8.40 over');
    expect(budgetLabel(200, 200)).toBe('$0.00 left');
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

describe('parseBudgetInput', () => {
  it('maps empty to null, invalid to undefined, and rounds to cents', () => {
    expect(parseBudgetInput('')).toBeNull();
    expect(parseBudgetInput('  ')).toBeNull();
    expect(parseBudgetInput('abc')).toBeUndefined();
    expect(parseBudgetInput('-1')).toBeUndefined();
    expect(parseBudgetInput('0')).toBeUndefined();
    expect(parseBudgetInput('1e308')).toBeUndefined();
    expect(parseBudgetInput(String(MAX_BUDGET_USD + 1))).toBeUndefined();
    expect(parseBudgetInput('0.001')).toBeUndefined();
    expect(parseBudgetInput('200')).toBe(200);
    expect(parseBudgetInput('12.345')).toBe(12.35);
  });
});
