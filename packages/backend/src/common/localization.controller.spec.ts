import { LocaleService } from './services/locale.service';
import { TenantCacheService } from './services/tenant-cache.service';
import { LocalizationController } from './localization.controller';

describe('LocalizationController', () => {
  const getTenantLocale = jest.fn();
  const getStoredTenantLocale = jest.fn();
  const setTenantLocale = jest.fn();
  const ensureForUser = jest.fn();
  const controller = new LocalizationController(
    { getTenantLocale, getStoredTenantLocale, setTenantLocale } as unknown as LocaleService,
    { ensureForUser } as unknown as TenantCacheService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns the resolved workspace locale', async () => {
    getStoredTenantLocale.mockResolvedValue('ru');
    await expect(controller.getLocale({ tenantId: 't1', userId: 'u1' })).resolves.toEqual({
      locale: 'ru',
    });
  });

  it('updates the current workspace locale', async () => {
    setTenantLocale.mockResolvedValue('ru');
    await expect(
      controller.setLocale({ tenantId: 't1', userId: 'u1' }, { locale: 'ru' }),
    ).resolves.toEqual({ locale: 'ru' });
    expect(setTenantLocale).toHaveBeenCalledWith('t1', 'ru');
  });

  it('creates a workspace for a fresh authenticated user before persisting', async () => {
    ensureForUser.mockResolvedValue('created-tenant');
    setTenantLocale.mockResolvedValue('ru');
    await controller.setLocale({ tenantId: null, userId: 'u1' }, { locale: 'ru' });
    expect(ensureForUser).toHaveBeenCalledWith('u1');
    expect(setTenantLocale).toHaveBeenCalledWith('created-tenant', 'ru');
  });

  it('keeps ownerless contexts on the English fallback', async () => {
    await expect(
      controller.setLocale({ tenantId: null, userId: null }, { locale: 'ru' }),
    ).resolves.toEqual({ locale: 'en' });
    expect(setTenantLocale).not.toHaveBeenCalled();
  });
});
