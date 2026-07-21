import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { AppLocale, DEFAULT_LOCALE, isAppLocale, normalizeLocale } from '../i18n/locale';

@Injectable()
export class LocaleService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async getTenantLocale(tenantId: string | null | undefined): Promise<AppLocale> {
    if (!tenantId) return DEFAULT_LOCALE;
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId }, select: ['locale'] });
    return normalizeLocale(tenant?.locale);
  }

  async getStoredTenantLocale(tenantId: string | null | undefined): Promise<AppLocale | null> {
    if (!tenantId) return null;
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId }, select: ['locale'] });
    return isAppLocale(tenant?.locale) ? tenant.locale : null;
  }

  async setTenantLocale(tenantId: string, locale: AppLocale): Promise<AppLocale> {
    await this.tenantRepo.update({ id: tenantId }, { locale });
    return locale;
  }
}
