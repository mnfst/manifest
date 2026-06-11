import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProvider } from '../entities/user-provider.entity';
import { AgentProviderAccess } from '../entities/agent-provider-access.entity';
import { CustomProvider } from '../entities/custom-provider.entity';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { ProviderModelFetcherService } from './provider-model-fetcher.service';
import { ModelDiscoveryService } from './model-discovery.service';
import { OpencodeGoCatalogService } from './opencode-go-catalog.service';
import { CopilotTokenService } from '../routing/proxy/copilot-token.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProvider, AgentProviderAccess, CustomProvider]),
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
