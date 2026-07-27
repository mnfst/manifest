import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { timestampDefault, timestampType } from '../common/utils/postgres-sql';

export interface RecordingResponseBody {
  type: 'json' | 'stream';
  body?: unknown;
  raw_sse?: string;
}

export interface StoredRequestRecording {
  version: 1;
  request_body: Record<string, unknown>;
  response_body: RecordingResponseBody;
}

export type RequestRecordingStatus = 'pending' | 'ready' | 'failed';
export type RequestRecordingStorageBackend = 'filesystem' | 's3';

/**
 * Opt-in request/response payload capture.
 *
 * PostgreSQL keeps only the request-owned pointer and lifecycle metadata.
 * Complete payloads live in the configured filesystem or S3-compatible store.
 */
@Entity('request_recordings')
@Index('idx_request_recordings_created_at', ['created_at'])
export class RequestRecording {
  @PrimaryColumn('varchar')
  request_id!: string;

  @Column('varchar')
  storage_key!: string;

  @Column('varchar')
  storage_backend!: RequestRecordingStorageBackend;

  @Column('varchar', { default: 'pending' })
  status!: RequestRecordingStatus;

  @Column('varchar')
  api_format!: string;

  @Column('varchar', { default: 'gzip' })
  content_encoding!: 'gzip';

  @Column('integer', { default: 0 })
  size_bytes!: number;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
