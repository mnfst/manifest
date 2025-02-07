import { Module, forwardRef } from '@nestjs/common'
import { BackendSDK } from './backend-sdk'
import { UploadModule } from '../upload/upload.module'
import { CrudModule } from '../crud/crud.module'

@Module({
  imports: [UploadModule, forwardRef(() => CrudModule)],
  providers: [BackendSDK],
  exports: [BackendSDK]
})
export class SdkModule {}
