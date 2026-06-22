import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BackfillState } from '../../entities/backfill-state.entity';
import { MessageProviderBackfillBootService } from './message-provider-backfill.boot.service';

/**
 * Wires the post-deploy backfill boot task. The DataSource is provided globally
 * by DatabaseModule; this only needs the BackfillState marker repository.
 */
@Module({
  imports: [TypeOrmModule.forFeature([BackfillState])],
  providers: [MessageProviderBackfillBootService],
})
export class BackfillModule {}
