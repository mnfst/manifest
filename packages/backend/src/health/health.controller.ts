import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { readFileSync } from 'fs';
import { join } from 'path';

const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')) as { version: string };

@Controller('api/v1')
export class HealthController {
  private readonly startTime = Date.now();

  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      version: pkg.version,
    };
  }
}
