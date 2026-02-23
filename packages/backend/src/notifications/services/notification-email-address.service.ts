import { Injectable, BadRequestException } from '@nestjs/common';
import {
  readLocalNotificationEmail,
  writeLocalNotificationEmail,
} from '../../common/constants/local-mode.constants';

@Injectable()
export class NotificationEmailAddressService {
  private readonly isLocal = process.env['MANIFEST_MODE'] === 'local';

  getNotificationEmail(): { email: string | null; isDefault: boolean } {
    if (!this.isLocal) {
      throw new BadRequestException('Notification email is managed via Better Auth in cloud mode');
    }
    const email = readLocalNotificationEmail();
    return { email, isDefault: !email };
  }

  saveNotificationEmail(email: string): void {
    if (!this.isLocal) {
      throw new BadRequestException('Notification email is managed via Better Auth in cloud mode');
    }
    writeLocalNotificationEmail(email);
  }
}
