import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SetEmailProviderDto, TestEmailProviderDto } from './set-email-provider.dto';

describe('SetEmailProviderDto', () => {
  function create(data: Record<string, unknown>): SetEmailProviderDto {
    return plainToInstance(SetEmailProviderDto, data);
  }

  describe('provider', () => {
    it('should accept resend', async () => {
      const dto = create({ provider: 'resend' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept mailgun with domain', async () => {
      const dto = create({ provider: 'mailgun', domain: 'mg.example.com' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept sendgrid', async () => {
      const dto = create({ provider: 'sendgrid' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject an invalid provider', async () => {
      const dto = create({ provider: 'smtp' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const providerError = errors.find((e) => e.property === 'provider');
      expect(providerError).toBeDefined();
    });

    it('should reject missing provider', async () => {
      const dto = create({});
      const errors = await validate(dto);
      const providerError = errors.find((e) => e.property === 'provider');
      expect(providerError).toBeDefined();
    });

    it('should reject non-string provider', async () => {
      const dto = create({ provider: 123 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('apiKey', () => {
    it('should accept when omitted', async () => {
      const dto = create({ provider: 'resend' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept a valid api key', async () => {
      const dto = create({ provider: 'resend', apiKey: 'my-secret-key-12345' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject an api key shorter than 8 characters', async () => {
      const dto = create({ provider: 'resend', apiKey: 'short' });
      const errors = await validate(dto);
      const apiKeyError = errors.find((e) => e.property === 'apiKey');
      expect(apiKeyError).toBeDefined();
    });

    it('should trim the api key via Transform', () => {
      const dto = create({ provider: 'resend', apiKey: '  my-secret-key  ' });
      expect(dto.apiKey).toBe('my-secret-key');
    });

    it('should pass through non-string apiKey without trimming', () => {
      const dto = create({ provider: 'resend', apiKey: 12345678 });
      expect(dto.apiKey).toBe(12345678);
    });
  });

  describe('domain', () => {
    it('should be required when provider is mailgun', async () => {
      const dto = create({ provider: 'mailgun' });
      const errors = await validate(dto);
      const domainError = errors.find((e) => e.property === 'domain');
      expect(domainError).toBeDefined();
    });

    it('should accept a valid domain for mailgun', async () => {
      const dto = create({ provider: 'mailgun', domain: 'mg.example.com' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should not be required for resend', async () => {
      const dto = create({ provider: 'resend' });
      const errors = await validate(dto);
      const domainError = errors.find((e) => e.property === 'domain');
      expect(domainError).toBeUndefined();
    });

    it('should not be required for sendgrid', async () => {
      const dto = create({ provider: 'sendgrid' });
      const errors = await validate(dto);
      const domainError = errors.find((e) => e.property === 'domain');
      expect(domainError).toBeUndefined();
    });

    it('should trim and lowercase the domain via Transform', () => {
      const dto = create({ provider: 'mailgun', domain: '  MG.Example.COM  ' });
      expect(dto.domain).toBe('mg.example.com');
    });

    it('should pass through non-string domain without transforming', () => {
      const dto = create({ provider: 'mailgun', domain: 999 });
      expect(dto.domain).toBe(999);
    });

    it('should reject empty string domain for mailgun', async () => {
      const dto = create({ provider: 'mailgun', domain: '' });
      const errors = await validate(dto);
      const domainError = errors.find((e) => e.property === 'domain');
      expect(domainError).toBeDefined();
    });
  });

  describe('notificationEmail', () => {
    it('should accept when omitted', async () => {
      const dto = create({ provider: 'resend' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept a valid email', async () => {
      const dto = create({
        provider: 'resend',
        notificationEmail: 'user@example.com',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject an invalid email', async () => {
      const dto = create({
        provider: 'resend',
        notificationEmail: 'not-an-email',
      });
      const errors = await validate(dto);
      const emailError = errors.find(
        (e) => e.property === 'notificationEmail',
      );
      expect(emailError).toBeDefined();
    });

    it('should trim and lowercase the email via Transform', () => {
      const dto = create({
        provider: 'resend',
        notificationEmail: '  User@Example.COM  ',
      });
      expect(dto.notificationEmail).toBe('user@example.com');
    });

    it('should pass through non-string notificationEmail without transforming', () => {
      const dto = create({ provider: 'resend', notificationEmail: 42 });
      expect(dto.notificationEmail).toBe(42);
    });
  });

  describe('full valid payloads', () => {
    it('should validate with all fields populated', async () => {
      const dto = create({
        provider: 'mailgun',
        apiKey: 'a-long-enough-key',
        domain: 'mg.example.com',
        notificationEmail: 'alerts@example.com',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with only required fields for resend', async () => {
      const dto = create({ provider: 'resend' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});

describe('TestEmailProviderDto', () => {
  function create(data: Record<string, unknown>): TestEmailProviderDto {
    return plainToInstance(TestEmailProviderDto, data);
  }

  describe('provider', () => {
    it('should accept resend', async () => {
      const dto = create({
        provider: 'resend',
        apiKey: 'valid-api-key-123',
        to: 'user@example.com',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept mailgun with domain', async () => {
      const dto = create({
        provider: 'mailgun',
        apiKey: 'valid-api-key-123',
        domain: 'mg.example.com',
        to: 'user@example.com',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept sendgrid', async () => {
      const dto = create({
        provider: 'sendgrid',
        apiKey: 'valid-api-key-123',
        to: 'user@example.com',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject an invalid provider', async () => {
      const dto = create({
        provider: 'postmark',
        apiKey: 'valid-api-key-123',
        to: 'user@example.com',
      });
      const errors = await validate(dto);
      const providerError = errors.find((e) => e.property === 'provider');
      expect(providerError).toBeDefined();
    });

    it('should reject missing provider', async () => {
      const dto = create({
        apiKey: 'valid-api-key-123',
        to: 'user@example.com',
      });
      const errors = await validate(dto);
      const providerError = errors.find((e) => e.property === 'provider');
      expect(providerError).toBeDefined();
    });
  });

  describe('apiKey', () => {
    it('should reject missing apiKey', async () => {
      const dto = create({
        provider: 'resend',
        to: 'user@example.com',
      });
      const errors = await validate(dto);
      const apiKeyError = errors.find((e) => e.property === 'apiKey');
      expect(apiKeyError).toBeDefined();
    });

    it('should reject apiKey shorter than 8 characters', async () => {
      const dto = create({
        provider: 'resend',
        apiKey: 'short',
        to: 'user@example.com',
      });
      const errors = await validate(dto);
      const apiKeyError = errors.find((e) => e.property === 'apiKey');
      expect(apiKeyError).toBeDefined();
    });

    it('should accept a valid apiKey', async () => {
      const dto = create({
        provider: 'resend',
        apiKey: 'long-enough-key',
        to: 'user@example.com',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should trim the apiKey via Transform', () => {
      const dto = create({
        provider: 'resend',
        apiKey: '  my-secret-key  ',
        to: 'user@example.com',
      });
      expect(dto.apiKey).toBe('my-secret-key');
    });

    it('should pass through non-string apiKey without trimming', () => {
      const dto = create({
        provider: 'resend',
        apiKey: 12345678,
        to: 'user@example.com',
      });
      expect(dto.apiKey).toBe(12345678);
    });
  });

  describe('domain', () => {
    it('should be required when provider is mailgun', async () => {
      const dto = create({
        provider: 'mailgun',
        apiKey: 'valid-api-key-123',
        to: 'user@example.com',
      });
      const errors = await validate(dto);
      const domainError = errors.find((e) => e.property === 'domain');
      expect(domainError).toBeDefined();
    });

    it('should not be required for resend', async () => {
      const dto = create({
        provider: 'resend',
        apiKey: 'valid-api-key-123',
        to: 'user@example.com',
      });
      const errors = await validate(dto);
      const domainError = errors.find((e) => e.property === 'domain');
      expect(domainError).toBeUndefined();
    });

    it('should not be required for sendgrid', async () => {
      const dto = create({
        provider: 'sendgrid',
        apiKey: 'valid-api-key-123',
        to: 'user@example.com',
      });
      const errors = await validate(dto);
      const domainError = errors.find((e) => e.property === 'domain');
      expect(domainError).toBeUndefined();
    });

    it('should trim and lowercase the domain via Transform', () => {
      const dto = create({
        provider: 'mailgun',
        apiKey: 'valid-api-key-123',
        domain: '  MG.Example.COM  ',
        to: 'user@example.com',
      });
      expect(dto.domain).toBe('mg.example.com');
    });

    it('should pass through non-string domain without transforming', () => {
      const dto = create({
        provider: 'mailgun',
        apiKey: 'valid-api-key-123',
        domain: 999,
        to: 'user@example.com',
      });
      expect(dto.domain).toBe(999);
    });

    it('should reject empty string domain for mailgun', async () => {
      const dto = create({
        provider: 'mailgun',
        apiKey: 'valid-api-key-123',
        domain: '',
        to: 'user@example.com',
      });
      const errors = await validate(dto);
      const domainError = errors.find((e) => e.property === 'domain');
      expect(domainError).toBeDefined();
    });
  });

  describe('to', () => {
    it('should reject missing to', async () => {
      const dto = create({
        provider: 'resend',
        apiKey: 'valid-api-key-123',
      });
      const errors = await validate(dto);
      const toError = errors.find((e) => e.property === 'to');
      expect(toError).toBeDefined();
    });

    it('should accept a valid to string', async () => {
      const dto = create({
        provider: 'resend',
        apiKey: 'valid-api-key-123',
        to: 'test@example.com',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('full valid payloads', () => {
    it('should validate with all fields for mailgun', async () => {
      const dto = create({
        provider: 'mailgun',
        apiKey: 'a-long-enough-key',
        domain: 'mg.example.com',
        to: 'recipient@example.com',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should validate with minimum fields for sendgrid', async () => {
      const dto = create({
        provider: 'sendgrid',
        apiKey: 'a-long-enough-key',
        to: 'recipient@example.com',
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });
  });
});
