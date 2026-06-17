import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { DuplicateAgentDto } from './duplicate-agent.dto';

/**
 * DuplicateAgentDto guards the POST body for the duplicate-agent endpoint.
 * Validators (read off the source): @IsString, @IsNotEmpty, @MinLength(1),
 * @MaxLength(100), @Matches(/^[a-zA-Z0-9 _-]+$/). The regex deliberately allows
 * spaces — rejecting whitespace-only names is the controller's slug guard, NOT
 * the DTO. The final test pins that two-layer contract so a future "tighten the
 * regex to also forbid blank names" change can't silently move responsibility.
 */
describe('DuplicateAgentDto', () => {
  const buildErrors = (name: unknown) => validate(plainToInstance(DuplicateAgentDto, { name }));

  it('accepts valid agent names', async () => {
    for (const name of ['my-agent', 'agent_1', 'TestBot', 'a', 'Bot Copy', 'a'.repeat(100)]) {
      const errors = await buildErrors(name);
      expect(errors).toHaveLength(0);
    }
  });

  it('rejects an empty string', async () => {
    const errors = await buildErrors('');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing name (required field)', async () => {
    const errors = await validate(plainToInstance(DuplicateAgentDto, {}));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects names longer than 100 characters', async () => {
    const errors = await buildErrors('a'.repeat(101));
    expect(errors.some((e) => e.constraints?.['maxLength'])).toBe(true);
  });

  it('rejects names containing a slash (regex-disallowed)', async () => {
    const errors = await buildErrors('bot/copy');
    expect(errors.some((e) => e.constraints?.['matches'])).toBe(true);
  });

  it('rejects names with other special characters', async () => {
    for (const name of ['agent@home', 'bot!', 'a:b', 'name.with.dots']) {
      const errors = await buildErrors(name);
      expect(errors.some((e) => e.constraints?.['matches'])).toBe(true);
    }
  });

  it('rejects non-ASCII letters (regex is ASCII-only)', async () => {
    const errors = await buildErrors('café');
    expect(errors.some((e) => e.constraints?.['matches'])).toBe(true);
  });

  it('rejects a non-string name', async () => {
    const errors = await buildErrors(123);
    expect(errors.some((e) => e.constraints?.['isString'])).toBe(true);
  });

  // Two-layer contract pin: the @Matches regex allows spaces, so a whitespace-
  // only string is a VALID DTO. The controller's slug guard (slugify → empty →
  // BadRequestException) is what rejects it, not the DTO. If someone tightens the
  // regex to forbid blanks here, this assertion flips and forces a conscious
  // decision about where the guard lives.
  it('PASSES a whitespace-only name (rejection is the controller slug guard, not the DTO)', async () => {
    const errors = await buildErrors('   ');
    expect(errors).toHaveLength(0);
  });
});
