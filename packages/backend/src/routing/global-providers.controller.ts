import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.instance';
import { ProviderService } from './routing-core/provider.service';
import { serializeProviderConnection } from './provider-response';

@Controller('api/v1/providers')
export class GlobalProvidersController {
  constructor(private readonly providerService: ProviderService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const providers = await this.providerService.getProviders(user.id);
    return providers.map(serializeProviderConnection);
  }
}
