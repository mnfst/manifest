import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { WaitlistSignupDto } from './waitlist-signup.dto';

describe('WaitlistSignupDto', () => {
  it('accepts a valid email', async () => {
    const dto = plainToInstance(WaitlistSignupDto, { email: 'user@example.com' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects an invalid email', async () => {
    const dto = plainToInstance(WaitlistSignupDto, { email: 'not-an-email' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('email');
  });

  it('rejects a missing email', async () => {
    const dto = plainToInstance(WaitlistSignupDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
