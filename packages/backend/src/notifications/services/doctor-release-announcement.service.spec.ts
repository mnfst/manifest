import { DoctorReleaseAnnouncementService } from './doctor-release-announcement.service';

jest.mock('./email-providers/send-email', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));
jest.mock('@react-email/render', () => ({
  render: jest.fn().mockResolvedValue('<html>rendered</html>'),
}));

import { sendEmail } from './email-providers/send-email';

describe('DoctorReleaseAnnouncementService', () => {
  const query = jest.fn();
  let service: DoctorReleaseAnnouncementService;
  const env = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env };
    delete process.env['ANNOUNCE_DOCTOR_RELEASE'];
    delete process.env['ANNOUNCE_DRY_RUN'];
    delete process.env['ANNOUNCE_TEST_RECIPIENT'];
    service = new DoctorReleaseAnnouncementService({ query } as never);
  });

  afterAll(() => {
    process.env = env;
  });

  it('stays inert unless the release flag is armed', () => {
    const spy = jest.spyOn(service, 'run');
    service.onApplicationBootstrap();
    expect(spy).not.toHaveBeenCalled();
  });

  it('unions and dedupes cloud waitlist tenants with self-hosted signups', async () => {
    query.mockResolvedValueOnce([{ email: 'a@x.com' }, { email: 'b@x.com' }, { email: 'a@x.com' }]);
    await expect(service.resolveRecipients()).resolves.toEqual(['a@x.com', 'b@x.com']);
    expect(query.mock.calls[0][0]).toContain('autofix_waitlist_at IS NOT NULL');
    expect(query.mock.calls[0][0]).toContain('autofix_waitlist_signups');
  });

  it('sends once per address and records the ledger', async () => {
    query
      .mockResolvedValueOnce([{ email: 'new@x.com' }, { email: 'seen@x.com' }]) // audience
      .mockResolvedValueOnce([]) // new@x.com not in ledger
      .mockResolvedValueOnce(undefined) // mark new@x.com
      .mockResolvedValueOnce([1]); // seen@x.com already in ledger

    const out = await service.run();
    expect(out).toEqual({ sent: 1, skipped: 1, dryRun: false });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@x.com',
        subject: 'Auto-fix is live on your account',
      }),
    );
    // The ledger insert never double-sends across redeploys.
    const insert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO'));
    expect(String(insert?.[0])).toContain('ON CONFLICT (announcement, email) DO NOTHING');
  });

  it('dry run lists the audience and sends nothing', async () => {
    process.env['ANNOUNCE_DRY_RUN'] = 'true';
    query.mockResolvedValueOnce([{ email: 'a@x.com' }]);
    const out = await service.run();
    expect(out).toEqual({ sent: 0, skipped: 1, dryRun: true });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('test recipient replaces the audience and skips the ledger', async () => {
    process.env['ANNOUNCE_TEST_RECIPIENT'] = 'Seb@Test.com';
    const out = await service.run();
    expect(out.sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'seb@test.com' }));
    // No audience query, no ledger read/write: rerunnable rehearsals.
    expect(query).not.toHaveBeenCalled();
  });
});
