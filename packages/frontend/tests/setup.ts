import { beforeEach } from 'vitest';
import { invalidateAll } from '../src/services/api/cache';

// The SWR GET cache (src/services/api/cache.ts) is a module-level singleton that
// persists across tests in the same file. Reset it before every test so a cached
// payload from one test never satisfies a GET in another (test isolation), the
// same way fetch mocks are reset between tests.
beforeEach(() => {
  invalidateAll();
});
