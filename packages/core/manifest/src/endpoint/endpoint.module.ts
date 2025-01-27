import { Module } from '@nestjs/common'
import { EndpointService } from './endpoint.service'
import { EndpointController } from './endpoint.controller'
import { ManifestModule } from '../manifest/manifest.module'

@Module({
  imports: [ManifestModule],
  providers: [EndpointService],
  controllers: [EndpointController],
  exports: [EndpointService]
})
export class EndpointModule {}
