import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { OtlpAuthGuard } from '../otlp/guards/otlp-auth.guard';
import { IngestionContext } from '../otlp/interfaces/ingestion-context.interface';
import { ResolveService } from './resolve.service';
import { RoutingService } from './routing.service';
import { ResolveRequestDto } from './dto/resolve-request.dto';
import { ResolveResponse } from './dto/resolve-response';

export class SubscriptionProviderItem {
  @IsString()
  @IsNotEmpty()
  provider!: string;
}

export class RegisterSubscriptionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionProviderItem)
  providers!: SubscriptionProviderItem[];
}

@Controller('api/v1/routing')
@Public()
@UseGuards(OtlpAuthGuard)
export class ResolveController {
  constructor(
    private readonly resolveService: ResolveService,
    private readonly routingService: RoutingService,
  ) {}

  @Post('resolve')
  @HttpCode(200)
  async resolve(
    @Body() body: ResolveRequestDto,
    @Req() req: Request & { ingestionContext: IngestionContext },
  ): Promise<ResolveResponse> {
    const { agentId } = req.ingestionContext;
    return this.resolveService.resolve(
      agentId,
      body.messages as { role: string; content?: unknown; [k: string]: unknown }[],
      body.tools,
      body.tool_choice,
      body.max_tokens,
      body.recentTiers,
    );
  }

  @Post('subscription-providers')
  @HttpCode(200)
  async registerSubscriptions(
    @Body() body: RegisterSubscriptionsDto,
    @Req() req: Request & { ingestionContext: IngestionContext },
  ): Promise<{ registered: number }> {
    const { agentId, userId } = req.ingestionContext;
    let registered = 0;

    for (const item of body.providers) {
      const { isNew } = await this.routingService.registerSubscriptionProvider(
        agentId,
        userId,
        item.provider,
      );
      if (isNew) {
        registered++;
      }
    }

    return { registered };
  }
}
