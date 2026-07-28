import { Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../../auth/current-user.decorator';
import { TenantCtx, TenantContext } from '../../common/decorators/tenant-context.decorator';
import { TenantCacheService } from '../../common/services/tenant-cache.service';
import { MANIFEST_PROVIDER_ID } from '../../common/constants/manifest-credits';
import {
  isProviderAvailableForDeployment,
  MANIFEST_CLOUD_ONLY_MESSAGE,
} from '../../common/utils/provider-availability';
import { ManifestProviderService } from './manifest-provider.service';

class EnsureManifestBody {
  /** Optional gifted Manifest Credits key. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  apiKey?: string;
}

@Controller('api/v1/providers/manifest')
export class ManifestProviderController {
  constructor(
    private readonly manifestProvider: ManifestProviderService,
    private readonly tenantCache: TenantCacheService,
  ) {}

  /**
   * Idempotent ensure: auto-mint when eligible, or store a pasted virtual key.
   * Never returns the raw API key.
   */
  @Post('ensure')
  async ensure(
    @TenantCtx() ctx: TenantContext,
    @CurrentUser() user: { id?: string; email?: string },
    @Body() body: EnsureManifestBody,
  ) {
    if (!isProviderAvailableForDeployment(MANIFEST_PROVIDER_ID)) {
      throw new NotFoundException(MANIFEST_CLOUD_ONLY_MESSAGE);
    }

    const tenantId =
      ctx.tenantId ?? (user.id ? await this.tenantCache.ensureForUser(user.id) : null);
    if (!tenantId) {
      return {
        connected: false,
        connection_id: null,
        source: 'none' as const,
        auto_available: false,
      };
    }

    return this.manifestProvider.ensureConnection({
      tenantId,
      userId: ctx.userId ?? user.id ?? null,
      userEmail: user.email ?? null,
      apiKey: body?.apiKey,
    });
  }
}
