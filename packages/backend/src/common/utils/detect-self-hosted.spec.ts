import { isSelfHosted } from './detect-self-hosted';
import * as fs from 'fs';

jest.mock('fs');

const mockedExistsSync = jest.mocked(fs.existsSync);

describe('isSelfHosted', () => {
  const originalEnv = process.env['MANIFEST_MODE'];

  afterEach(() => {
    if (originalEnv === undefined) delete process.env['MANIFEST_MODE'];
    else process.env['MANIFEST_MODE'] = originalEnv;
    mockedExistsSync.mockReset();
  });

  it('returns true when MANIFEST_MODE is "selfhosted"', () => {
    process.env['MANIFEST_MODE'] = 'selfhosted';
    expect(isSelfHosted()).toBe(true);
  });

  it('returns true when MANIFEST_MODE is legacy "local"', () => {
    process.env['MANIFEST_MODE'] = 'local';
    expect(isSelfHosted()).toBe(true);
  });

  it('returns false when MANIFEST_MODE is "cloud"', () => {
    process.env['MANIFEST_MODE'] = 'cloud';
    expect(isSelfHosted()).toBe(false);
  });

  it('returns false when MANIFEST_MODE is "cloud" even inside Docker', () => {
    process.env['MANIFEST_MODE'] = 'cloud';
    mockedExistsSync.mockReturnValue(true);
    expect(isSelfHosted()).toBe(false);
  });

  it('auto-detects Docker via /.dockerenv when MANIFEST_MODE is not set', () => {
    delete process.env['MANIFEST_MODE'];
    mockedExistsSync.mockReturnValue(true);
    expect(isSelfHosted()).toBe(true);
    expect(mockedExistsSync).toHaveBeenCalledWith('/.dockerenv');
  });

  it('returns false when not in Docker and MANIFEST_MODE is not set', () => {
    delete process.env['MANIFEST_MODE'];
    mockedExistsSync.mockReturnValue(false);
    expect(isSelfHosted()).toBe(false);
  });

  it('returns false when existsSync throws', () => {
    delete process.env['MANIFEST_MODE'];
    mockedExistsSync.mockImplementation(() => {
      throw new Error('permission denied');
    });
    expect(isSelfHosted()).toBe(false);
  });
});
