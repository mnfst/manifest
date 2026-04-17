import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller('api/v1')
export class HealthController {
  private readonly startTime = Date.now();

  @Public()
  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
