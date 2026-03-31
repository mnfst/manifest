import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SetNotificationEmailDto } from './set-notification-email.dto';

describe('SetNotificationEmailDto', () => {
  function create(data: Record<string, unknown>): SetNotificationEmailDto {
    return plainToInstance(SetNotificationEmailDto, data);
  }

  it('should accept a valid email', async () => {
    const dto = create({ email: 'user@example.com' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid email', async () => {
    const dto = create({ email: 'not-an-email' });
    const errors = await validate(dto);
    const emailError = errors.find((e) => e.property === 'email');
    expect(emailError).toBeDefined();
  });

  it('should reject a missing email', async () => {
    const dto = create({});
    const errors = await validate(dto);
    const emailError = errors.find((e) => e.property === 'email');
    expect(emailError).toBeDefined();
  });

  it('should reject an empty string email', async () => {
    const dto = create({ email: '' });
    const errors = await validate(dto);
    const emailError = errors.find((e) => e.property === 'email');
    expect(emailError).toBeDefined();
  });

  it('should trim and lowercase the email via Transform', () => {
    const dto = create({ email: '  User@Example.COM  ' });
    expect(dto.email).toBe('user@example.com');
  });

  it('should pass through non-string email without transforming', () => {
    const dto = create({ email: 42 });
    expect(dto.email).toBe(42);
  });
});
