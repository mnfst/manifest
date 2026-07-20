import { Client } from 'pg';
import { claimRecipient, parseArgs, parseMailingList } from './send-doctor-announcement';

describe('send-doctor-announcement CLI', () => {
  describe('parseMailingList', () => {
    it('accepts plain strings and {email} objects, lowercased and deduped', () => {
      expect(
        parseMailingList(['A@x.com', { email: 'b@x.com' }, 'a@x.com ', { email: 'B@X.COM' }]),
      ).toEqual(['a@x.com', 'b@x.com']);
    });

    it('rejects a non-array payload', () => {
      expect(() => parseMailingList({ emails: [] })).toThrow(/JSON array/);
    });

    it('rejects entries that are not email addresses', () => {
      expect(() => parseMailingList(['not-an-email'])).toThrow(/Not an email/);
      expect(() => parseMailingList([{ mail: 'a@x.com' }])).toThrow(/Not an email/);
    });
  });

  describe('parseArgs', () => {
    it('reads the file, the dry-run flag and the test recipient', () => {
      expect(parseArgs(['list.json', '--dry-run'])).toEqual({
        file: 'list.json',
        dryRun: true,
      });
      expect(parseArgs(['--test', 'Me@X.com'])).toEqual({
        dryRun: false,
        testRecipient: 'me@x.com',
      });
    });

    it('rejects unknown flags', () => {
      expect(() => parseArgs(['--force'])).toThrow(/Unknown argument/);
    });

    it('rejects a missing or option-looking --test recipient', () => {
      expect(() => parseArgs(['--test'])).toThrow('--test requires an email address');
      expect(() => parseArgs(['--test', '--dry-run'])).toThrow('--test requires an email address');
    });

    it('validates the --test recipient as an email address', () => {
      expect(() => parseArgs(['--test', 'not-an-email'])).toThrow(/Not an email/);
    });
  });

  describe('claimRecipient', () => {
    it('atomically claims an address and returns its unique claim id', async () => {
      const query = jest.fn(async (_sql: string, params: unknown[]) => ({
        rows: [{ claim_id: params[2] }],
      }));

      const claimId = await claimRecipient({ query } as unknown as Client, 'person@example.com');

      expect(claimId).toEqual(expect.any(String));
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (announcement, email) DO UPDATE'),
        expect.arrayContaining(['person@example.com', claimId, '1 hour']),
      );
    });

    it('skips an address already claimed by another live run', async () => {
      const query = jest.fn(async () => ({ rows: [] }));
      await expect(
        claimRecipient({ query } as unknown as Client, 'person@example.com'),
      ).resolves.toBeNull();
    });
  });
});
