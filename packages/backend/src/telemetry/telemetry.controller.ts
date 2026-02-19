import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { TelemetryService } from './telemetry.service';
import { CreateTelemetryDto } from './dto/create-telemetry.dto';

@Controller('api/v1')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post('telemetry')
  @HttpCode(202)
  async ingest(
    @Body() body: CreateTelemetryDto,
    @Req() req: Request & { apiKeyUserId?: string; user?: { id: string } },
  ) {
    const userId = req.user?.id ?? req.apiKeyUserId ?? '';
    const result = await this.telemetryService.ingest(body.events, userId);

    if (result.accepted === 0 && result.rejected > 0) {
      throw new BadRequestException({
        error: 'Bad Request',
        message: 'All events failed validation',
        details: result.errors,
      });
    }

    return result;
  }
}
