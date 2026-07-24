import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestRecording,
  type RecordingResponseBody,
} from '../../entities/request-recording.entity';
import type { ProxyApiMode } from './proxy-types';

@Injectable()
export class RequestRecordingService {
  constructor(
    @InjectRepository(RequestRecording)
    private readonly recordingRepo: Repository<RequestRecording>,
  ) {}

  async start(
    requestId: string,
    requestBody: Record<string, unknown>,
    apiFormat: ProxyApiMode,
  ): Promise<void> {
    await this.recordingRepo.save(
      this.recordingRepo.create({
        request_id: requestId,
        request_body: requestBody,
        response_body: null,
        api_format: apiFormat,
        size_bytes: serializedBytes(requestBody),
      }),
    );
  }

  async finish(requestId: string, responseBody: RecordingResponseBody): Promise<void> {
    const recording = await this.recordingRepo.findOne({
      where: { request_id: requestId },
      select: ['request_id', 'request_body'],
    });
    if (!recording) return;

    recording.response_body = responseBody;
    recording.size_bytes = serializedBytes(recording.request_body) + serializedBytes(responseBody);
    recording.updated_at = new Date().toISOString();
    await this.recordingRepo.save(recording);
  }
}

function serializedBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return 0;
  }
}
