import {
  buildClaudeCodeSubscriptionHeaders,
  claudeCodeStainlessArch,
  claudeCodeStainlessOs,
} from './subscription-clients';

describe('claudeCodeStainlessArch', () => {
  it.each([
    ['arm64', 'arm64'],
    ['x64', 'x64'],
    ['mips', 'Other:mips'],
  ])('maps %s to %s', (arch, expected) => {
    expect(claudeCodeStainlessArch(arch as NodeJS.Architecture)).toBe(expected);
  });
});

describe('claudeCodeStainlessOs', () => {
  it.each([
    ['darwin', 'MacOS'],
    ['linux', 'Linux'],
    ['win32', 'Windows'],
    ['freebsd', 'FreeBSD'],
    ['sunos', 'Other:sunos'],
  ])('maps %s to %s', (platform, expected) => {
    expect(claudeCodeStainlessOs(platform as NodeJS.Platform)).toBe(expected);
  });
});

describe('buildClaudeCodeSubscriptionHeaders', () => {
  it('sets the bearer token and stainless metadata headers', () => {
    const headers = buildClaudeCodeSubscriptionHeaders('key-123');
    expect(headers.Authorization).toBe('Bearer key-123');
    expect(headers['x-app']).toBe('cli');
    expect(headers['x-stainless-arch']).toBeDefined();
    expect(headers['x-stainless-os']).toBeDefined();
  });
});
