import { Module } from '@nestjs/common'
import { PolicyService } from './policy.service'

@Module({
  providers: [PolicyService],
  exports: [PolicyService]
})
export class PolicyModule {}
