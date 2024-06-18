import { Module } from '@nestjs/common'
import { OpenApiService } from './services/open-api.service'
import { OpenApiCrudService } from './services/open-api-crud.service'

@Module({
  providers: [OpenApiService, OpenApiCrudService]
})
export class OpenApiModule {}
