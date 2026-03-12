import { Module } from '@nestjs/common';
import { GeminiAuthController } from './gemini-auth.controller';
import { GeminiAuthService } from './gemini-auth.service';

@Module({
  controllers: [GeminiAuthController],
  providers: [GeminiAuthService],
  exports: [GeminiAuthService],
})
export class GeminiAuthModule {}
