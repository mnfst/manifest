import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { AdminAiGuard } from '../guards/admin-ai.guard';
import { ProviderService } from '../../routing/routing-core/provider.service';
import { ProviderKeyService } from '../../routing/routing-core/provider-key.service';
import { CustomProviderService } from '../../routing/custom-provider/custom-provider.service';

class AttachProviderKeyDto {
  apiKey!: string;
  authType?: 'api_key' | 'subscription' | 'local';
  label?: string;
}

class VerifyProviderKeyDto {
  apiKey!: string;
}

/**
 * Provider-key administration under the admin surface.
 *
 * - Attach/update a provider key (custom providers route through
 *   CustomProviderService; standard providers through ProviderService.upsert,
 *   which now also writes key_hash).
 * - Match-verify a posted key against the stored one-way hash — the API never
 *   returns the raw secret (your locked decision).
 *
 * Read listing reuses the existing tenant_providers read path.
 */
@Controller('api/v1/admin/providers')
@UseGuards(AdminAiGuard)
export class AdminProviderController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly providerKeyService: ProviderKeyService,
    private readonly customProviderService: CustomProviderService,
  ) {}

  @Get()
  async list(@TenantCtx() ctx: TenantContext) {
    if (!ctx.tenantId) return { providers: [] };
    const providers = await this.providerService.getProviders(ctx.tenantId);
    return {
      providers: providers.map((p) => ({
        id: p.id,
        provider: p.provider,
        auth_type: p.auth_type,
        label: p.label,
        key_prefix: p.key_prefix,
        has_key: !!p.key_hash,
        priority: p.priority,
        is_active: p.is_active,
      })),
    };
  }

  @Post(':provider/keys')
  async attachKey(
    @TenantCtx() ctx: TenantContext,
    @Param('provider') provider: string,
    @Body() body: AttachProviderKeyDto,
  ) {
    if (!ctx.tenantId) throw new NotFoundException('No tenant context');
    if (!body?.apiKey) throw new BadRequestException('apiKey is required');
    if (CustomProviderService.isCustom(provider)) {
      const id = CustomProviderService.extractId(provider);
      const cp = await this.customProviderService.getById(id, ctx.tenantId);
      if (!cp) throw new NotFoundException(`Custom provider ${provider} not found`);
      await this.customProviderService.update(id, ctx.tenantId, { apiKey: body.apiKey }, ctx.userId);
    } else {
      await this.providerService.upsertProvider(
        null,
        ctx.tenantId,
        provider,
        body.apiKey,
        (body.authType as never) ?? 'api_key',
        undefined,
        body.label,
        ctx.userId,
      );
    }
    return { attached: true, provider };
  }

  @Post(':provider/keys/verify')
  async verifyKey(
    @TenantCtx() ctx: TenantContext,
    @Param('provider') provider: string,
    @Body() body: VerifyProviderKeyDto,
  ) {
    if (!ctx.tenantId) throw new NotFoundException('No tenant context');
    if (!body?.apiKey) throw new BadRequestException('apiKey is required');
    const result = await this.providerKeyService.verifyKeyMatches(
      ctx.tenantId,
      provider,
      body.apiKey,
    );
    return result;
  }
}
