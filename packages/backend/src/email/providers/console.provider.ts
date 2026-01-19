import { Injectable, Logger } from '@nestjs/common';
import { EmailMessage, EmailSendResult } from '@manifest/shared';
import { EmailProvider } from './email-provider.interface';

/**
 * Console email provider for development and testing.
 * Logs emails to the console instead of actually sending them.
 */
@Injectable()
export class ConsoleProvider implements EmailProvider {
  private readonly logger = new Logger(ConsoleProvider.name);

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const messageId = `console-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    this.logger.log('========================================');
    this.logger.log('📧 EMAIL SENT (Console Provider)');
    this.logger.log('========================================');
    this.logger.log(`To: ${message.to}`);
    this.logger.log(`From: ${message.from}`);
    this.logger.log(`Subject: ${message.subject}`);
    if (message.replyTo) {
      this.logger.log(`Reply-To: ${message.replyTo}`);
    }
    this.logger.log('----------------------------------------');
    this.logger.log('HTML Preview (first 500 chars):');
    this.logger.log(message.html.substring(0, 500) + (message.html.length > 500 ? '...' : ''));
    this.logger.log('----------------------------------------');
    if (message.text) {
      this.logger.log('Plain Text:');
      this.logger.log(message.text);
    }
    this.logger.log('========================================');
    this.logger.log(`Message ID: ${messageId}`);
    this.logger.log('========================================');

    return {
      success: true,
      messageId,
      timestamp: new Date(),
    };
  }

  isConfigured(): boolean {
    // Console provider is always configured
    return true;
  }

  getName(): string {
    return 'console';
  }
}
