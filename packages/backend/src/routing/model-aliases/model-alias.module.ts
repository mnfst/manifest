import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExposedModelRoute } from '../../entities/exposed-model-route.entity';
import { ModelDiscoveryModule } from '../../model-discovery/model-discovery.module';
import { HeaderTiersModule } from '../header-tiers/header-tiers.module';
import { ResolveModule } from '../resolve/resolve.module';
import { RoutingCoreModule } from '../routing-core/routing-core.module';
import { ModelAliasController } from './model-alias.controller';
import { ModelAliasService } from './model-alias.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExposedModelRoute]),
    RoutingCoreModule,
    ModelDiscoveryModule,
    forwardRef(() => ResolveModule),
    HeaderTiersModule,
  ],
  controllers: [ModelAliasController],
  providers: [ModelAliasService],
  exports: [ModelAliasService],
})
export class ModelAliasModule {}
