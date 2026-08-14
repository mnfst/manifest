import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/v1/waitlist')
export class WaitlistController {
  /**
   * Compatibility endpoint for self-hosted versions that predate Autofix GA.
   * Keep returning 200 during the deprecation window, but do not retain new
   * waitlist claims now that every tenant has access.
   */
  @Public()
  @Post('autofix/claim')
  @HttpCode(HttpStatus.OK)
  receiveClaim(): { ok: boolean } {
    return { ok: true };
  }
}
