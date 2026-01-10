import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER } from './providers/email-provider.interface';
import { ConsoleProvider } from './providers/console.provider';
import { MailgunProvider } from './providers/mailgun.provider';
import { TEMPLATE_ENGINE } from './templates/engine/template-engine.interface';
import { ReactEmailEngine } from './templates/engine/react-email.engine';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';

@Module({
  imports: [ConfigModule],
  controllers: [EmailController],
  providers: [
    EmailService,
    // Template engine provider
    {
      provide: TEMPLATE_ENGINE,
      useClass: ReactEmailEngine,
    },
    // Email provider factory - switches based on configuration
    {
      provide: EMAIL_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('EMAIL_PROVIDER', 'console');

        switch (provider.toLowerCase()) {
          case 'mailgun':
            return new MailgunProvider(configService);
          case 'console':
          default:
            return new ConsoleProvider();
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
