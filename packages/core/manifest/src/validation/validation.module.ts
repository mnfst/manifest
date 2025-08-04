import { forwardRef, Module } from '@nestjs/common'
import { ValidationService } from './services/validation.service'
import { ManifestModule } from '../manifest/manifest.module'

@Module({
  imports: [forwardRef(() => ManifestModule)],
  providers: [ValidationService],
  exports: [ValidationService]
})
export class ValidationModule {}
