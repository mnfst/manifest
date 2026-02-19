import {
  rangeToInterval,
  rangeToPreviousInterval,
  isHourlyRange,
} from './range.util';

describe('rangeToInterval', () => {
  it('maps 1h to 1 hour', () => {
    expect(rangeToInterval('1h')).toBe('1 hour');
  });

  it('maps 6h to 6 hours', () => {
    expect(rangeToInterval('6h')).toBe('6 hours');
  });

  it('maps 24h to 24 hours', () => {
    expect(rangeToInterval('24h')).toBe('24 hours');
  });

  it('maps 7d to 7 days', () => {
    expect(rangeToInterval('7d')).toBe('7 days');
  });

  it('maps 30d to 30 days', () => {
    expect(rangeToInterval('30d')).toBe('30 days');
  });

  it('defaults to 24 hours for unknown range', () => {
    expect(rangeToInterval('unknown')).toBe('24 hours');
    expect(rangeToInterval('')).toBe('24 hours');
    expect(rangeToInterval('365d')).toBe('24 hours');
  });
});

describe('rangeToPreviousInterval', () => {
  it('maps 1h to 2 hours (double the range)', () => {
    expect(rangeToPreviousInterval('1h')).toBe('2 hours');
  });

  it('maps 6h to 12 hours', () => {
    expect(rangeToPreviousInterval('6h')).toBe('12 hours');
  });

  it('maps 24h to 48 hours', () => {
    expect(rangeToPreviousInterval('24h')).toBe('48 hours');
  });

  it('maps 7d to 14 days', () => {
    expect(rangeToPreviousInterval('7d')).toBe('14 days');
  });

  it('maps 30d to 60 days', () => {
    expect(rangeToPreviousInterval('30d')).toBe('60 days');
  });

  it('defaults to 48 hours for unknown range', () => {
    expect(rangeToPreviousInterval('unknown')).toBe('48 hours');
    expect(rangeToPreviousInterval('')).toBe('48 hours');
  });
});

describe('isHourlyRange', () => {
  it('returns true for hourly ranges', () => {
    expect(isHourlyRange('1h')).toBe(true);
    expect(isHourlyRange('6h')).toBe(true);
    expect(isHourlyRange('24h')).toBe(true);
  });

  it('returns false for daily ranges', () => {
    expect(isHourlyRange('7d')).toBe(false);
    expect(isHourlyRange('30d')).toBe(false);
  });

  it('returns false for unknown ranges', () => {
    expect(isHourlyRange('unknown')).toBe(false);
    expect(isHourlyRange('')).toBe(false);
  });
});
