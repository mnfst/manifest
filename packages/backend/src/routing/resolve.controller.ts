import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
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
import { TIERS } from './scorer/types';

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

export interface RoutingSummaryProvider {
  provider: string;
  auth_type: 'api_key' | 'subscription';
}

export interface RoutingSummaryTier {
  tier: string;
  model: string | null;
  source: 'auto' | 'override';
  fallback_models: string[];
}

export interface RoutingSummaryResponse {
  agentName: string;
  providers: RoutingSummaryProvider[];
  tiers: RoutingSummaryTier[];
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

  @Get('summary')
  async getSummary(
    @Req() req: Request & { ingestionContext: IngestionContext },
  ): Promise<RoutingSummaryResponse> {
    const { agentId, agentName } = req.ingestionContext;
    const [providers, tiers] = await Promise.all([
      this.routingService.getProviders(agentId),
      this.routingService.getTiers(agentId),
    ]);

    const activeProviders = providers
      .filter((provider) => provider.is_active)
      .sort(
        (a, b) => a.provider.localeCompare(b.provider) || a.auth_type.localeCompare(b.auth_type),
      )
      .map((provider) => ({
        provider: provider.provider,
        auth_type: provider.auth_type ?? 'api_key',
      }));

    const tiersByName = new Map(tiers.map((tier) => [tier.tier, tier]));
    const tierSummaries = await Promise.all(
      TIERS.map(async (tier) => {
        const assignment = tiersByName.get(tier);
        if (!assignment) {
          return {
            tier,
            model: null,
            source: 'auto' as const,
            fallback_models: [],
          };
        }

        const effectiveModel = await this.routingService.getEffectiveModel(agentId, assignment);
        return {
          tier,
          model: effectiveModel,
          source:
            assignment.override_model !== null && assignment.override_model === effectiveModel
              ? ('override' as const)
              : ('auto' as const),
          fallback_models: assignment.fallback_models ?? [],
        };
      }),
    );

    return {
      agentName,
      providers: activeProviders,
      tiers: tierSummaries,
    };
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
      await this.routingService.upsertProvider(
        agentId,
        userId,
        item.provider,
        undefined,
        'subscription',
      );
      registered++;
    }

    return { registered };
  }
}
