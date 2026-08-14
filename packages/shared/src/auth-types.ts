export const AUTH_TYPES = ['api_key', 'subscription', 'local'] as const;
export type AuthType = (typeof AUTH_TYPES)[number];
