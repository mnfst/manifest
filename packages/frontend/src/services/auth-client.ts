import { createAuthClient } from 'better-auth/solid';

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: window.location.origin,
  basePath: '/api/auth',
});
