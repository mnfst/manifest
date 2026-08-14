import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const logger = new Logger('HttpErrors');

/** Paths from old OTLP clients that are expected 410s — don't log them. */
const SUPPRESSED_PREFIXES = ['/otlp/', '/api/v1/otlp/'];
const SUPPRESSED_EXACT = ['/v1/metrics', '/v1/traces', '/v1/logs'];

function isSuppressed(url: string, status: number): boolean {
  if (status !== 410 && status !== 404) return false;
  for (const prefix of SUPPRESSED_PREFIXES) {
    if (url.startsWith(prefix)) return true;
  }
  for (const path of SUPPRESSED_EXACT) {
    if (url === path) return true;
  }
  return false;
}

function stripControlChars(str: string): string {
  return str.replace(/[\x00-\x1f\x7f]/g, '');
}

export function httpErrorLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    if (res.statusCode < 400) return;
    if (isSuppressed(req.originalUrl, res.statusCode)) return;

    const elapsed = Date.now() - start;
    const ua = stripControlChars((req.headers['user-agent'] ?? '').slice(0, 120));
    const ip = req.headers['x-forwarded-for'] ?? req.ip ?? '';
    const forwardedIp = stripControlChars(Array.isArray(ip) ? ip[0] : ip);

    logger.warn(
      `${res.statusCode} ${req.method} ${req.originalUrl} ${elapsed}ms ip=${forwardedIp} ua=${ua}`,
    );
  });

  next();
}
