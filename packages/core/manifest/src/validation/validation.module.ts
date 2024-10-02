import { Module } from '@nestjs/common'
import { ValidationService } from './services/validation.service'

@Module({
  providers: [ValidationService],
  exports: [ValidationService]
})
export class ValidationModule {}
