// Single source of truth for the dev-mode CORS allow-list and the CSP
// `frame-src` directive. The Wingman drawer is a dev-only affordance —
// the component is dead-code-eliminated from production bundles, so
// neither directive needs Wingman in production.

export const HOSTED_WINGMAN_ORIGIN = 'https://wingman.manifest.build';

export interface DevOriginBuilderOptions {
  configuredOrigin: string;
  wingmanPort: number;
}

export interface FrameSrcOptions {
  isDev: boolean;
  wingmanPort: number;
}

export function buildDevAllowedOrigins({
  configuredOrigin,
  wingmanPort,
}: DevOriginBuilderOptions): string[] {
  return Array.from(
    new Set([
      configuredOrigin,
      `http://localhost:${wingmanPort}`,
      `http://127.0.0.1:${wingmanPort}`,
      'http://localhost:3002',
      HOSTED_WINGMAN_ORIGIN,
    ]),
  );
}

export function buildFrameSrc({ isDev, wingmanPort }: FrameSrcOptions): string[] {
  if (!isDev) {
    return ["'self'"];
  }
  return [
    "'self'",
    `http://localhost:${wingmanPort}`,
    `http://127.0.0.1:${wingmanPort}`,
    HOSTED_WINGMAN_ORIGIN,
  ];
}

export type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;
export type CorsOriginHandler = (origin: string | undefined, callback: CorsOriginCallback) => void;

export function createCorsOriginHandler(allowedOrigins: string[]): CorsOriginHandler {
  return (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}
