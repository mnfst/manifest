import { beforeAll, beforeEach } from 'vitest';
import { initializeI18n } from '../src/i18n/index.js';
import { invalidateAll } from '../src/services/api/cache';
import { ensureLocalStorage } from './i18n/storage.js';

beforeAll(async () => {
  ensureLocalStorage();
  await initializeI18n({ storage: null, languages: ['en-US'] });
});

// The SWR GET cache (src/services/api/cache.ts) is a module-level singleton that
// persists across tests in the same file. Reset it before every test so a cached
// payload from one test never satisfies a GET in another (test isolation), the
// same way fetch mocks are reset between tests.
beforeEach(() => {
  ensureLocalStorage();
  invalidateAll();
});
