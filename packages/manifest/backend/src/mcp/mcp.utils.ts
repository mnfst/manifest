import type { Request } from 'express';
import * as crypto from 'crypto';
import type { ThemeVariables } from '@manifest/shared';

export function generateUserFingerprint(req: Request): string {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const userAgent = req.get('user-agent') || 'unknown';
  return crypto
    .createHash('sha256')
    .update(`${ip}:${userAgent}`)
    .digest('hex')
    .substring(0, 16);
}

export function themeToCss(themeVariables: ThemeVariables): string {
  return Object.entries(themeVariables)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n      ');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}
