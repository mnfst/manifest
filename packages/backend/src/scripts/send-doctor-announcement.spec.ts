import { parseArgs, parseMailingList } from './send-doctor-announcement';

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
  });
});
