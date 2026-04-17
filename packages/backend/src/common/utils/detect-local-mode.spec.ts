import { isLocalMode } from './detect-local-mode';
import * as fs from 'fs';

jest.mock('fs');

const mockedExistsSync = jest.mocked(fs.existsSync);

describe('isLocalMode', () => {
  const originalEnv = process.env['MANIFEST_MODE'];

  afterEach(() => {
    if (originalEnv === undefined) delete process.env['MANIFEST_MODE'];
    else process.env['MANIFEST_MODE'] = originalEnv;
    mockedExistsSync.mockReset();
  });

  it('returns true when MANIFEST_MODE is "local"', () => {
    process.env['MANIFEST_MODE'] = 'local';
    expect(isLocalMode()).toBe(true);
  });

  it('returns false when MANIFEST_MODE is "cloud"', () => {
    process.env['MANIFEST_MODE'] = 'cloud';
    expect(isLocalMode()).toBe(false);
  });

  it('returns false when MANIFEST_MODE is "cloud" even inside Docker', () => {
    process.env['MANIFEST_MODE'] = 'cloud';
    mockedExistsSync.mockReturnValue(true);
    expect(isLocalMode()).toBe(false);
  });

  it('auto-detects Docker via /.dockerenv when MANIFEST_MODE is not set', () => {
    delete process.env['MANIFEST_MODE'];
    mockedExistsSync.mockReturnValue(true);
    expect(isLocalMode()).toBe(true);
    expect(mockedExistsSync).toHaveBeenCalledWith('/.dockerenv');
  });

  it('returns false when not in Docker and MANIFEST_MODE is not set', () => {
    delete process.env['MANIFEST_MODE'];
    mockedExistsSync.mockReturnValue(false);
    expect(isLocalMode()).toBe(false);
  });

  it('returns false when existsSync throws', () => {
    delete process.env['MANIFEST_MODE'];
    mockedExistsSync.mockImplementation(() => {
      throw new Error('permission denied');
    });
    expect(isLocalMode()).toBe(false);
  });
});
