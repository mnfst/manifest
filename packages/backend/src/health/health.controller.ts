import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { VersionCheckService } from './version-check.service';

@Controller('api/v1')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly versionCheck: VersionCheckService) {}

  @Public()
  @Get('health')
  getHealth() {
    const isLocal = process.env['MANIFEST_MODE'] === 'local';
    const optOut = process.env['MANIFEST_TELEMETRY_OPTOUT'];
    return {
      status: 'healthy',
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      ...(isLocal ? { version: this.versionCheck.getCurrentVersion() } : {}),
      mode: isLocal ? 'local' : 'cloud',
      telemetryOptOut: optOut === '1' || optOut === 'true',
      ...this.versionCheck.getUpdateInfo(),
    };
  }
}
