import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { OtlpAuthGuard } from '../otlp/guards/otlp-auth.guard';
import { IngestionContext } from '../otlp/interfaces/ingestion-context.interface';
import { ResolveService } from './resolve.service';
import { ResolveRequestDto } from './dto/resolve-request.dto';
import { ResolveResponse } from './dto/resolve-response';

@Controller('api/v1/routing')
@Public()
@UseGuards(OtlpAuthGuard)
export class ResolveController {
  constructor(private readonly resolveService: ResolveService) {}

  @Post('resolve')
  @HttpCode(200)
  async resolve(
    @Body() body: ResolveRequestDto,
    @Req() req: Request & { ingestionContext: IngestionContext },
  ): Promise<ResolveResponse> {
    const { userId } = req.ingestionContext;
    return this.resolveService.resolve(
      userId,
      body.messages as { role: string; content?: unknown; [k: string]: unknown }[],
      body.tools,
      body.tool_choice,
      body.max_tokens,
      body.recentTiers,
    );
  }
}
