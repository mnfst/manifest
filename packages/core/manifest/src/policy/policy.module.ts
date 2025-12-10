import { forwardRef, Module } from '@nestjs/common'
import { PolicyService } from './policy.service'
import { EntityModule } from '../entity/entity.module'

@Module({
  imports: [forwardRef(() => EntityModule)],
  providers: [PolicyService],
  exports: [PolicyService]
})
export class PolicyModule {}
