import {
  announcementDelayMs,
  DoctorReleaseAnnouncementService,
} from './doctor-release-announcement.service';

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
    delete process.env['ANNOUNCE_DELAY_MS'];
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
    expect(query.mock.calls[0][0]).toContain('waitlist_claims');
  });

  it('claims each address atomically before sending', async () => {
    query
      .mockResolvedValueOnce([{ email: 'new@x.com' }, { email: 'seen@x.com' }]) // audience
      .mockResolvedValueOnce([{ '?column?': 1 }]) // new@x.com claimed
      .mockResolvedValueOnce(undefined) // mark new@x.com sent
      .mockResolvedValueOnce([]); // seen@x.com already claimed

    const out = await service.run();
    expect(out).toEqual({ sent: 1, skipped: 1, dryRun: false });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@x.com',
        subject: 'Auto-fix is live on your account',
      }),
    );
    // The claim insert is the concurrency boundary across replicas.
    const insert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO'));
    expect(String(insert?.[0])).toContain('ON CONFLICT (announcement, email) DO NOTHING');
    expect(String(insert?.[0])).toContain('RETURNING 1');
  });

  it('releases an unaccepted claim so a later run can retry', async () => {
    (sendEmail as jest.Mock).mockResolvedValueOnce(false);
    query
      .mockResolvedValueOnce([{ email: 'retry@x.com' }])
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce(undefined);

    await expect(service.run()).resolves.toEqual({ sent: 0, skipped: 0, dryRun: false });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('DELETE FROM'))).toBe(true);
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

  it.each([undefined, '', '0', '-1', '1.5', 'abc', '9007199254740992', '2147483648'])(
    'uses the safe default for ANNOUNCE_DELAY_MS=%p',
    (raw) => {
      expect(announcementDelayMs(raw)).toBe(600_000);
    },
  );

  it('accepts a positive integer delay within the Node timer range', () => {
    expect(announcementDelayMs('30000')).toBe(30_000);
  });
});
