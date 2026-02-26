export interface PeriodBoundaries {
  periodStart: string;
  periodEnd: string;
}

export function computePeriodBoundaries(period: string): PeriodBoundaries {
  const now = new Date();
  let start: Date;

  switch (period) {
    case 'hour':
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() - 1));
      break;
    case 'day':
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      break;
    case 'week': {
      const dayOfWeek = now.getUTCDay();
      const monday = now.getUTCDate() - ((dayOfWeek + 6) % 7);
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), monday));
      break;
    }
    case 'month':
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      break;
    default:
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() - 1));
  }

  const end = new Date(now.getTime());
  const fmt = (d: Date) => d.toISOString().replace('T', ' ').replace('Z', '').slice(0, 19);

  return { periodStart: fmt(start), periodEnd: fmt(end) };
}
