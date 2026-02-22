import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserProvider } from '../entities/user-provider.entity';
import { TierAssignment } from '../entities/tier-assignment.entity';
import { ModelPricesModule } from '../model-prices/model-prices.module';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { TierAutoAssignService } from './tier-auto-assign.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserProvider, TierAssignment]),
    ModelPricesModule,
  ],
  controllers: [RoutingController],
  providers: [RoutingService, TierAutoAssignService],
  exports: [RoutingService, TierAutoAssignService],
})
export class RoutingModule {}
