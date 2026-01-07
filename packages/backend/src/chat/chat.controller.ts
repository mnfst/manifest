import { Controller, Get, Post, Body, Headers, HttpException, HttpStatus, Sse, MessageEvent } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { ChatService } from './chat.service';
import type { ModelListResponse, ValidateKeyRequest, ValidateKeyResponse, PreviewChatRequest } from '@chatgpt-app-builder/shared';

/**
 * Chat controller for LLM preview functionality
 * Provides endpoints for chat streaming, model listing, and API key validation
 */
@Controller('api/chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * GET /api/chat/models
   * Returns list of available LLM models
   */
  @Get('models')
  async getModels(): Promise<ModelListResponse> {
    return this.chatService.getModels();
  }

  /**
   * POST /api/chat/validate-key
   * Validates an OpenAI API key
   */
  @Post('validate-key')
  async validateKey(@Body() body: ValidateKeyRequest): Promise<ValidateKeyResponse> {
    if (!body.apiKey) {
      throw new HttpException('apiKey is required', HttpStatus.BAD_REQUEST);
    }
    return this.chatService.validateApiKey(body.apiKey);
  }

  /**
   * POST /api/chat/stream
   * Streams a chat response from OpenAI with MCP tool access
   * Requires x-api-key header with OpenAI API key
   */
  @Post('stream')
  @Sse()
  streamChat(
    @Body() body: PreviewChatRequest,
    @Headers('x-api-key') apiKey: string,
  ): Observable<MessageEvent> {
    if (!apiKey) {
      throw new HttpException('x-api-key header is required', HttpStatus.UNAUTHORIZED);
    }

    if (!body.flowId) {
      throw new HttpException('flowId is required', HttpStatus.BAD_REQUEST);
    }

    if (!body.model) {
      throw new HttpException('model is required', HttpStatus.BAD_REQUEST);
    }

    if (!body.messages || body.messages.length === 0) {
      throw new HttpException('messages array is required', HttpStatus.BAD_REQUEST);
    }

    return this.chatService.streamChat(body, apiKey).pipe(
      map((event) => ({
        data: JSON.stringify(event),
      })),
    );
  }
}
