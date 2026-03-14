import { join } from 'path';
import { existsSync } from 'fs';

// __dirname in compiled output is dist/common/utils
const monorepoIndex = join(__dirname, '..', '..', '..', '..', 'frontend', 'dist', 'index.html');
const embeddedIndex = join(__dirname, '..', '..', '..', '..', 'public', 'index.html');

describe('resolveFrontendDir', () => {
  const originalEnv = process.env;
  let mockExistsSync: jest.MockedFunction<typeof existsSync>;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    mockExistsSync = jest.fn().mockReturnValue(false);
    jest.mock('fs', () => ({
      ...jest.requireActual('fs'),
      existsSync: mockExistsSync,
    }));
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function loadModule() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./frontend-path') as typeof import('./frontend-path');
  }

  it('returns env var path when MANIFEST_FRONTEND_DIR is set and valid', () => {
    process.env['MANIFEST_FRONTEND_DIR'] = '/custom/frontend';
    mockExistsSync.mockImplementation((p) => p === join('/custom/frontend', 'index.html'));
    const { resolveFrontendDir } = loadModule();
    expect(resolveFrontendDir()).toBe('/custom/frontend');
  });

  it('skips env var when directory has no index.html', () => {
    process.env['MANIFEST_FRONTEND_DIR'] = '/bad/path';
    mockExistsSync.mockImplementation((p) => p === monorepoIndex);
    const { resolveFrontendDir } = loadModule();
    expect(resolveFrontendDir()).toBe(join(__dirname, '..', '..', '..', '..', 'frontend', 'dist'));
  });

  it('returns monorepo path when env var is absent', () => {
    delete process.env['MANIFEST_FRONTEND_DIR'];
    mockExistsSync.mockImplementation((p) => p === monorepoIndex);
    const { resolveFrontendDir } = loadModule();
    expect(resolveFrontendDir()).toBe(join(__dirname, '..', '..', '..', '..', 'frontend', 'dist'));
  });

  it('returns embedded path when monorepo path fails', () => {
    delete process.env['MANIFEST_FRONTEND_DIR'];
    mockExistsSync.mockImplementation((p) => p === embeddedIndex);
    const { resolveFrontendDir } = loadModule();
    expect(resolveFrontendDir()).toBe(join(__dirname, '..', '..', '..', '..', 'public'));
  });

  it('returns null when nothing matches', () => {
    delete process.env['MANIFEST_FRONTEND_DIR'];
    const { resolveFrontendDir } = loadModule();
    expect(resolveFrontendDir()).toBeNull();
  });
});
