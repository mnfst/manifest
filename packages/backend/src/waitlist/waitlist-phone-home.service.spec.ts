import { WaitlistPhoneHomeService } from './waitlist-phone-home.service';

jest.mock('../common/utils/detect-self-hosted', () => ({
  isSelfHosted: jest.fn(),
}));

import { isSelfHosted } from '../common/utils/detect-self-hosted';

const mockIsSelfHosted = isSelfHosted as jest.MockedFunction<typeof isSelfHosted>;

describe('WaitlistPhoneHomeService', () => {
  let service: WaitlistPhoneHomeService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new WaitlistPhoneHomeService();
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true } as Response);
    mockIsSelfHosted.mockReturnValue(true);
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('sends the email to the cloud signup endpoint when self-hosted', async () => {
    await service.reportSignup('user@example.com');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://app.manifest.build/api/v1/waitlist/autofix/claim',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'user@example.com' }),
      }),
    );
  });

  it('skips when not self-hosted', async () => {
    mockIsSelfHosted.mockReturnValue(false);
    await service.reportSignup('user@example.com');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('skips when email is empty', async () => {
    await service.reportSignup('');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not throw on non-2xx response', async () => {
    fetchSpy.mockResolvedValue({ ok: false, status: 500 } as Response);
    await expect(service.reportSignup('user@example.com')).resolves.toBeUndefined();
  });

  it('does not throw on network error', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));
    await expect(service.reportSignup('user@example.com')).resolves.toBeUndefined();
  });
});
