import { Injectable, Logger } from '@nestjs/common';
import { isSelfHosted } from '../common/utils/detect-self-hosted';

const CLOUD_CLAIM_URL = 'https://app.manifest.build/api/v1/waitlist/autofix/claim';

@Injectable()
export class WaitlistPhoneHomeService {
  private readonly logger = new Logger(WaitlistPhoneHomeService.name);

  async reportSignup(email: string): Promise<void> {
    if (!isSelfHosted()) return;
    if (!email) return;
    try {
      const res = await fetch(CLOUD_CLAIM_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        this.logger.warn(`Waitlist phone-home returned ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(`Waitlist phone-home failed: ${err}`);
    }
  }
}
