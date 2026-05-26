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
import { KiroOauthService } from './kiro-oauth.service';
import { KiroOauthController } from './kiro-oauth.controller';
import { XaiOauthController } from './xai/xai-oauth.controller';
import { XaiOauthService } from './xai/xai-oauth.service';
import { OAuthPendingFlowStore } from './core';
import { GeminiOauthService } from './gemini-oauth.service';
import { GeminiOauthController } from './gemini-oauth.controller';
import { CodeAssistClientService } from './codeassist-client.service';

@Module({
  imports: [RoutingCoreModule, ModelDiscoveryModule],
  controllers: [
    OpenaiOauthController,
    MinimaxOauthController,
    AnthropicOauthController,
    GeminiOauthController,
    KiroOauthController,
    XaiOauthController,
  ],
  providers: [
    OpenaiOauthService,
    MinimaxOauthService,
    CopilotDeviceAuthService,
    AnthropicOauthService,
    KiroOauthService,
    XaiOauthService,
    OAuthPendingFlowStore,
    GeminiOauthService,
    CodeAssistClientService,
  ],
  exports: [
    OpenaiOauthService,
    MinimaxOauthService,
    CopilotDeviceAuthService,
    AnthropicOauthService,
    GeminiOauthService,
    KiroOauthService,
    XaiOauthService,
  ],
})
export class OAuthModule {}
