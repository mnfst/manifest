import { MiddlewareConsumer, Module } from '@nestjs/common'
import { EndpointService } from './endpoint.service'
import { EndpointController } from './endpoint.controller'
import { ManifestModule } from '../manifest/manifest.module'
import { MatchEndpointMiddleware } from './middlewares/match-endpoint.middleware'

@Module({
  imports: [ManifestModule],
  providers: [EndpointService],
  controllers: [EndpointController],
  exports: [EndpointService]
})
export class EndpointModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MatchEndpointMiddleware).forRoutes(EndpointController)
  }
}
