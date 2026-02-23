jest.mock('../../../common/constants/local-mode.constants', () => ({
  readLocalEmailConfig: jest.fn(),
}));

jest.mock('./resolve-provider', () => ({
  createProvider: jest.fn(),
}));

import { sendEmail } from './send-email';
import { readLocalEmailConfig } from '../../../common/constants/local-mode.constants';
import { createProvider } from './resolve-provider';

describe('sendEmail', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses Mailgun env vars in cloud mode', async () => {
    process.env['MANIFEST_MODE'] = 'cloud';
    process.env['MAILGUN_API_KEY'] = 'mg-key';
    process.env['MAILGUN_DOMAIN'] = 'mg.test.com';
    const mockSend = jest.fn().mockResolvedValue(true);
    (createProvider as jest.Mock).mockReturnValue({ send: mockSend });

    const result = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>Hello</p>' });

    expect(result).toBe(true);
    expect(createProvider).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'mailgun', apiKey: 'mg-key', domain: 'mg.test.com' }),
    );
  });

  it('returns false when cloud mode has no Mailgun config', async () => {
    process.env['MANIFEST_MODE'] = 'cloud';
    delete process.env['MAILGUN_API_KEY'];
    delete process.env['MAILGUN_DOMAIN'];

    const result = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>Hello</p>' });

    expect(result).toBe(false);
    expect(createProvider).not.toHaveBeenCalled();
  });

  it('reads local config in local mode', async () => {
    process.env['MANIFEST_MODE'] = 'local';
    (readLocalEmailConfig as jest.Mock).mockReturnValue({
      provider: 'resend',
      apiKey: 're_key',
    });
    const mockSend = jest.fn().mockResolvedValue(true);
    (createProvider as jest.Mock).mockReturnValue({ send: mockSend });

    const result = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>Hello</p>' });

    expect(result).toBe(true);
    expect(readLocalEmailConfig).toHaveBeenCalled();
    expect(createProvider).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'resend', apiKey: 're_key' }),
    );
  });

  it('returns false when local mode has no config', async () => {
    process.env['MANIFEST_MODE'] = 'local';
    (readLocalEmailConfig as jest.Mock).mockReturnValue(null);

    const result = await sendEmail({ to: 'a@b.com', subject: 'Hi', html: '<p>Hello</p>' });

    expect(result).toBe(false);
    expect(createProvider).not.toHaveBeenCalled();
  });
});
