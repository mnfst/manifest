import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { VersionCheckService } from './version-check.service';

@Controller('api/v1')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(
    private readonly versionCheck: VersionCheckService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get('health')
  getHealth() {
    const isLocal = this.configService.get<string>('app.manifestMode') === 'local';
    const isDev = this.configService.get<string>('app.nodeEnv') !== 'production';
    return {
      status: 'healthy',
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      ...(isLocal ? { version: this.versionCheck.getCurrentVersion() } : {}),
      mode: isLocal ? 'local' : 'cloud',
      devMode: isDev,
      ...this.versionCheck.getUpdateInfo(),
    };
  }
}
