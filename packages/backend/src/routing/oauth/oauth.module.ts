import { Module } from '@nestjs/common';
import { RoutingCoreModule } from '../routing-core/routing-core.module';
import { ModelDiscoveryModule } from '../../model-discovery/model-discovery.module';
import { OpenaiOauthService } from './openai-oauth.service';
import { OpenaiOauthController } from './openai-oauth.controller';
import { MinimaxOauthService } from './minimax-oauth.service';
import { MinimaxOauthController } from './minimax-oauth.controller';
import { CopilotDeviceAuthService } from './copilot-device-auth.service';
import { AnthropicOauthService } from './anthropic/anthropic-oauth.service';
import { AnthropicOauthController } from './anthropic/anthropic-oauth.controller';
import { OAuthPendingFlowStore } from './core';

@Module({
  imports: [RoutingCoreModule, ModelDiscoveryModule],
  controllers: [OpenaiOauthController, MinimaxOauthController, AnthropicOauthController],
  providers: [
    OpenaiOauthService,
    MinimaxOauthService,
    CopilotDeviceAuthService,
    AnthropicOauthService,
    OAuthPendingFlowStore,
  ],
  exports: [
    OpenaiOauthService,
    MinimaxOauthService,
    CopilotDeviceAuthService,
    AnthropicOauthService,
  ],
})
export class OAuthModule {}
