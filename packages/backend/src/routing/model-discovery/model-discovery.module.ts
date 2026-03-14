import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProvider } from '../../entities/user-provider.entity';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { ProviderModelFetcherService } from './provider-model-fetcher.service';
import { ModelDiscoveryService } from './model-discovery.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserProvider, CustomProvider])],
  providers: [ProviderModelFetcherService, ModelDiscoveryService],
  exports: [ModelDiscoveryService, ProviderModelFetcherService],
})
export class ModelDiscoveryModule {}
