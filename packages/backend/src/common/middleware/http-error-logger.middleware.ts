import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

const logger = new Logger('HttpErrors');

export function httpErrorLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    if (res.statusCode < 400) return;

    const elapsed = Date.now() - start;
    const ua = (req.headers['user-agent'] ?? '').slice(0, 120);
    const ip = req.headers['x-forwarded-for'] ?? req.ip ?? '';
    const forwardedIp = Array.isArray(ip) ? ip[0] : ip;

    logger.warn(
      `${res.statusCode} ${req.method} ${req.originalUrl} ${elapsed}ms ip=${forwardedIp} ua=${ua}`,
    );
  });

  next();
}
