import { Injectable, Logger } from '@nestjs/common';
import { isSelfHosted } from '../common/utils/detect-self-hosted';

const CLOUD_CLAIM_URL = 'https://app.manifest.build/api/v1/waitlist/autofix/claim';

@Injectable()
export class WaitlistSyncService {
  private readonly logger = new Logger(WaitlistSyncService.name);

  async syncClaim(email: string): Promise<void> {
    if (!isSelfHosted()) return;
    if (!email) return;
    try {
      const res = await fetch(CLOUD_CLAIM_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        this.logger.warn(`Waitlist sync returned ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(`Waitlist sync failed: ${err}`);
    }
  }
}
