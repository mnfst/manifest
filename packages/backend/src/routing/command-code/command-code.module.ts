import { Module } from '@nestjs/common';
import { CommandCodeAuthService } from './command-code-auth.service';

/**
 * Command Code adapter module. Kept deliberately tiny and isolated from the
 * routing hot path: model discovery rides the shared provider-model-fetcher
 * registry and chat/streaming rides the shared proxy (OpenAI / Anthropic wire
 * formats), so this module only owns Command Code-specific auth validation.
 */
@Module({
  providers: [CommandCodeAuthService],
  exports: [CommandCodeAuthService],
})
export class CommandCodeModule {}
