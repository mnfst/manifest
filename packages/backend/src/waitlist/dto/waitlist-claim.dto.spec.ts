import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { WaitlistClaimDto } from './waitlist-claim.dto';

describe('WaitlistClaimDto', () => {
  it('accepts a valid email', async () => {
    const dto = plainToInstance(WaitlistClaimDto, { email: 'user@example.com' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(WaitlistClaimDto, { email: 'not-an-email' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
  });

  it('rejects a missing email', async () => {
    const dto = plainToInstance(WaitlistClaimDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
