import { Body, Controller, Get, Put, UnauthorizedException, UseGuards } from '@nestjs/common';
import { TenantCtx, TenantContext } from './decorators/tenant-context.decorator';
import { UpdateLocaleDto } from './dto/update-locale.dto';
import { AppLocale } from './i18n/locale';
import { LocaleService } from './services/locale.service';
import { TenantCacheService } from './services/tenant-cache.service';
import { SessionOnlyGuard } from './guards/session-only.guard';

@Controller('api/v1/settings/locale')
@UseGuards(SessionOnlyGuard)
export class LocalizationController {
  constructor(
    private readonly locales: LocaleService,
    private readonly tenantCache: TenantCacheService,
  ) {}

  @Get()
  async getLocale(@TenantCtx() ctx: TenantContext): Promise<{ locale: AppLocale | null }> {
    return { locale: await this.locales.getStoredTenantLocale(ctx.tenantId) };
  }

  @Put()
  async setLocale(
    @TenantCtx() ctx: TenantContext,
    @Body() body: UpdateLocaleDto,
  ): Promise<{ locale: AppLocale }> {
    const tenantId =
      ctx.tenantId ?? (ctx.userId ? await this.tenantCache.ensureForUser(ctx.userId) : null);
    if (!tenantId) {
      throw new UnauthorizedException('An authenticated user is required to update the locale.');
    }
    return { locale: await this.locales.setTenantLocale(tenantId, body.locale) };
  }
}
