import { Module } from '@nestjs/common';
import { RoutingCoreModule } from '../routing-core/routing-core.module';
import { ModelDiscoveryModule } from '../../model-discovery/model-discovery.module';
import { OpenaiOauthService } from './openai-oauth.service';
import { OpenaiOauthController } from './openai-oauth.controller';
import { MinimaxOauthService } from './minimax-oauth.service';
import { MinimaxOauthController } from './minimax-oauth.controller';
import { GeminiOauthService } from './gemini-oauth.service';
import { GeminiOauthController } from './gemini-oauth.controller';
import { CopilotDeviceAuthService } from './copilot-device-auth.service';

@Module({
  imports: [RoutingCoreModule, ModelDiscoveryModule],
  controllers: [OpenaiOauthController, MinimaxOauthController, GeminiOauthController],
  providers: [
    OpenaiOauthService,
    MinimaxOauthService,
    GeminiOauthService,
    CopilotDeviceAuthService,
  ],
  exports: [OpenaiOauthService, MinimaxOauthService, GeminiOauthService, CopilotDeviceAuthService],
})
export class OAuthModule {}
