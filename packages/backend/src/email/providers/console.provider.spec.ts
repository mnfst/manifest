import { ConsoleProvider } from './console.provider';

describe('ConsoleProvider', () => {
  let provider: ConsoleProvider;

  beforeEach(() => {
    provider = new ConsoleProvider();
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('isConfigured', () => {
    it('should always return true', () => {
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('getName', () => {
    it('should return "console"', () => {
      expect(provider.getName()).toBe('console');
    });
  });

  describe('send', () => {
    it('should successfully send (log) an email', async () => {
      const message = {
        to: 'user@example.com',
        from: 'sender@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test text',
      };

      const result = await provider.send(message);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageId).toContain('console-');
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should include message ID in result', async () => {
      const message = {
        to: 'user@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      };

      const result = await provider.send(message);

      expect(result.messageId).toMatch(/^console-\d+-[a-z0-9]+$/);
    });

    it('should handle messages without text fallback', async () => {
      const message = {
        to: 'user@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      };

      const result = await provider.send(message);

      expect(result.success).toBe(true);
    });

    it('should handle messages with replyTo', async () => {
      const message = {
        to: 'user@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
        replyTo: 'reply@example.com',
      };

      const result = await provider.send(message);

      expect(result.success).toBe(true);
    });

    it('should generate unique message IDs', async () => {
      const message = {
        to: 'user@example.com',
        from: 'sender@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      };

      const result1 = await provider.send(message);
      const result2 = await provider.send(message);

      expect(result1.messageId).not.toBe(result2.messageId);
    });
  });
});
