import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { readFileSync } from 'fs';
import { join } from 'path';
import { VersionCheckService } from './version-check.service';

const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')) as { version: string };

@Controller('api/v1')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly versionCheck: VersionCheckService) {}

  @Public()
  @Get('health')
  getHealth() {
    const optOut = process.env['MANIFEST_TELEMETRY_OPTOUT'];
    return {
      status: 'healthy',
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      version: pkg.version,
      mode: process.env['MANIFEST_MODE'] === 'local' ? 'local' : 'cloud',
      telemetryOptOut: optOut === '1' || optOut === 'true',
      ...this.versionCheck.getUpdateInfo(),
    };
  }
}
