import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantProvider } from '../entities/tenant-provider.entity';
import { AgentEnabledProvider } from '../entities/agent-enabled-provider.entity';
import { CustomProvider } from '../entities/custom-provider.entity';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { ProviderModelFetcherService } from './provider-model-fetcher.service';
import { ModelDiscoveryService } from './model-discovery.service';
import { OpencodeGoCatalogService } from './opencode-go-catalog.service';
import { CopilotTokenService } from '../routing/proxy/copilot-token.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TenantProvider, AgentEnabledProvider, CustomProvider]),
    ModelPricesModule,
  ],
  providers: [
    ProviderModelFetcherService,
    ModelDiscoveryService,
    OpencodeGoCatalogService,
    CopilotTokenService,
  ],
  exports: [ModelDiscoveryService, ProviderModelFetcherService, OpencodeGoCatalogService],
})
export class ModelDiscoveryModule {}
