import { join } from 'path';

// Save original env and modules
const originalEnv = { ...process.env };

// Mock fs.existsSync
jest.mock('fs', () => ({
  existsSync: jest.fn(),
}));

// We need to control require() calls inside start(), so we use a manual approach
const mockRequire = jest.fn();

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = originalEnv;
});

describe('start() pre-flight checks', () => {
  it('throws when backend dist does not exist', async () => {
    const fs = require('fs');
    fs.existsSync.mockReturnValue(false);

    const { start } = require('./index');

    await expect(start({ quiet: true })).rejects.toThrow('Backend not found');
    await expect(start({ quiet: true })).rejects.toThrow('corrupt');
  });

  it('throws with actionable message when better-sqlite3 fails to load', async () => {
    const fs = require('fs');
    // First call: backend dist exists; second call: whatever else
    fs.existsSync.mockReturnValue(true);

    // Mock require to fail for better-sqlite3
    jest.mock('better-sqlite3', () => {
      throw new Error('Could not locate the bindings file');
    });

    const { start } = require('./index');

    await expect(start({ quiet: true })).rejects.toThrow(
      'better-sqlite3 native module failed to load',
    );
    await expect(start({ quiet: true })).rejects.toThrow('xcode-select --install');
    await expect(start({ quiet: true })).rejects.toThrow('npm rebuild better-sqlite3');
  });

  it('sets environment variables before importing backend', async () => {
    const fs = require('fs');
    fs.existsSync.mockReturnValue(true);

    // Mock better-sqlite3 to succeed
    jest.mock('better-sqlite3', () => ({}));

    const { start } = require('./index');

    // The start function will fail when trying to import the backend,
    // but we can verify env vars were set
    try {
      await start({ port: 3000, host: '0.0.0.0', quiet: true });
    } catch {
      // Expected to fail when importing backend
    }

    expect(process.env['MANIFEST_MODE']).toBe('local');
    expect(process.env['MANIFEST_EMBEDDED']).toBe('1');
    expect(process.env['PORT']).toBe('3000');
    expect(process.env['BIND_ADDRESS']).toBe('0.0.0.0');
  });
});
