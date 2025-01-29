import { MiddlewareConsumer, Module, forwardRef } from '@nestjs/common'
import { EndpointService } from './endpoint.service'
import { EndpointController } from './endpoint.controller'
import { MatchEndpointMiddleware } from './middlewares/match-endpoint.middleware'
import { ManifestModule } from '../manifest/manifest.module'
import { AuthModule } from '../auth/auth.module'
import { PolicyModule } from '../policy/policy.module'

@Module({
  imports: [
    forwardRef(() => ManifestModule),
    forwardRef(() => AuthModule),
    PolicyModule
  ],
  providers: [EndpointService],
  controllers: [EndpointController],
  exports: [EndpointService]
})
export class EndpointModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MatchEndpointMiddleware).forRoutes(EndpointController)
  }
}
