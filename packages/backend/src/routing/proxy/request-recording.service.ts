import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RequestRecording,
  type StoredRequestRecording,
} from '../../entities/request-recording.entity';
import { RequestRecordingStorageService } from '../../common/services/request-recording-storage.service';
import { encodeRequestRecording } from '../../common/utils/request-recording-codec';
import type { ProxyApiMode } from './proxy-types';

@Injectable()
export class RequestRecordingService {
  constructor(
    @InjectRepository(RequestRecording)
    private readonly recordingRepo: Repository<RequestRecording>,
    private readonly storage: RequestRecordingStorageService,
  ) {}

  async start(requestId: string, apiFormat: ProxyApiMode): Promise<boolean> {
    const backend = this.storage.backend;
    if (!backend) return false;

    await this.recordingRepo.save(
      this.recordingRepo.create({
        request_id: requestId,
        storage_key: this.storage.objectKey(requestId),
        storage_backend: backend,
        status: 'pending',
        api_format: apiFormat,
        content_encoding: 'gzip',
        size_bytes: 0,
      }),
    );
    return true;
  }

  async finish(requestId: string, payload: StoredRequestRecording): Promise<void> {
    const recording = await this.recordingRepo.findOne({
      where: { request_id: requestId },
    });
    if (!recording) return;

    try {
      const encoded = await encodeRequestRecording(payload);
      await this.storage.put(recording.storage_key, encoded);
      recording.status = 'ready';
      recording.size_bytes = encoded.byteLength;
      recording.updated_at = new Date().toISOString();
      await this.recordingRepo.save(recording);
    } catch (error) {
      recording.status = 'failed';
      recording.updated_at = new Date().toISOString();
      await this.recordingRepo.save(recording).catch(() => undefined);
      throw error;
    }
  }
}
