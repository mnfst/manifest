import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CreateAdminDto } from './dto/create-admin.dto';
import { SetupService } from './setup.service';

@Controller('api/v1/setup')
export class SetupController {
  constructor(private readonly setupService: SetupService) {}

  @Public()
  @Get('status')
  async getStatus(): Promise<{
    needsSetup: boolean;
    socialProviders: string[];
    isLocalMode: boolean;
    ollamaAvailable: boolean;
  }> {
    const isLocal = this.setupService.isLocalMode();
    return {
      needsSetup: await this.setupService.needsSetup(),
      socialProviders: this.setupService.getEnabledSocialProviders(),
      isLocalMode: isLocal,
      ollamaAvailable: isLocal ? await this.setupService.isOllamaAvailable() : false,
    };
  }

  @Public()
  @Post('admin')
  @HttpCode(HttpStatus.CREATED)
  async createAdmin(@Body() dto: CreateAdminDto): Promise<{ ok: true }> {
    await this.setupService.createFirstAdmin(dto);
    return { ok: true };
  }
}
