import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomProvider } from '../../entities/custom-provider.entity';
import { RoutingCoreModule } from '../routing-core/routing-core.module';
import { ModelPricesModule } from '../../model-prices/model-prices.module';
import { CustomProviderController } from './custom-provider.controller';
import { CustomProviderService } from './custom-provider.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomProvider]), RoutingCoreModule, ModelPricesModule],
  controllers: [CustomProviderController],
  providers: [CustomProviderService],
  exports: [CustomProviderService],
})
export class CustomProviderModule {}
