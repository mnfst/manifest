export function rangeToInterval(range: string): string {
  switch (range) {
    case '1h': return '1 hour';
    case '6h': return '6 hours';
    case '24h': return '24 hours';
    case '7d': return '7 days';
    case '30d': return '30 days';
    default: return '24 hours';
  }
}

export function rangeToPreviousInterval(range: string): string {
  switch (range) {
    case '1h': return '2 hours';
    case '6h': return '12 hours';
    case '24h': return '48 hours';
    case '7d': return '14 days';
    case '30d': return '60 days';
    default: return '48 hours';
  }
}

export function isHourlyRange(range: string): boolean {
  return ['1h', '6h', '24h'].includes(range);
}
