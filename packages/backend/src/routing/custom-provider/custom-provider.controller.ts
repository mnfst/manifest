import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.instance';
import { CustomProviderService } from './custom-provider.service';
import { ProviderService } from '../routing-core/provider.service';
import {
  CreateCustomProviderDto,
  ProbeCustomProviderDto,
  UpdateCustomProviderDto,
} from '../dto/custom-provider.dto';

@Controller('api/v1/custom-providers')
export class CustomProviderController {
  constructor(
    private readonly customProviderService: CustomProviderService,
    private readonly providerService: ProviderService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const [providers, userProviders] = await Promise.all([
      this.customProviderService.list(user.id),
      this.providerService.getProviders(user.id),
    ]);
    if (providers.length === 0) return [];

    return providers.map((cp) => {
      const provKey = CustomProviderService.providerKey(cp.id);
      const up = userProviders.find((u) => u.provider === provKey);
      return {
        id: cp.id,
        name: cp.name,
        base_url: cp.base_url,
        api_kind: cp.api_kind,
        has_api_key: !!up?.api_key_encrypted,
        models: cp.models,
        created_at: cp.created_at,
      };
    });
  }

  @Post('probe')
  async probe(@Body() body: ProbeCustomProviderDto) {
    const models = await this.customProviderService.probeModels(
      body.base_url,
      body.apiKey,
      body.api_kind,
      body.provider_name,
    );
    return { models };
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: CreateCustomProviderDto) {
    const cp = await this.customProviderService.create(user.id, body);
    const provKey = CustomProviderService.providerKey(cp.id);
    const up = (await this.providerService.getProviders(user.id)).find(
      (u) => u.provider === provKey,
    );

    return {
      id: cp.id,
      name: cp.name,
      base_url: cp.base_url,
      api_kind: cp.api_kind,
      has_api_key: !!up?.api_key_encrypted,
      models: cp.models,
      created_at: cp.created_at,
    };
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: UpdateCustomProviderDto,
  ) {
    const cp = await this.customProviderService.update(id, user.id, body);
    const provKey = CustomProviderService.providerKey(cp.id);
    const up = (await this.providerService.getProviders(user.id)).find(
      (u) => u.provider === provKey,
    );

    return {
      id: cp.id,
      name: cp.name,
      base_url: cp.base_url,
      api_kind: cp.api_kind,
      has_api_key: !!up?.api_key_encrypted,
      models: cp.models,
      created_at: cp.created_at,
    };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.customProviderService.remove(user.id, id);
    return { ok: true };
  }
}
