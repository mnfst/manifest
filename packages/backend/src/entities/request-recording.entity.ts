import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { timestampDefault, timestampType } from '../common/utils/postgres-sql';

export interface RecordingResponseBody {
  type: 'json' | 'stream';
  body?: unknown;
  raw_sse?: string;
}

/**
 * Opt-in request/response payload capture.
 *
 * The request is the ownership boundary: provider attempts remain in
 * agent_messages, while the caller's original conversation is stored once.
 */
@Entity('request_recordings')
@Index('idx_request_recordings_created_at', ['created_at'])
export class RequestRecording {
  @PrimaryColumn('varchar')
  request_id!: string;

  @Column('jsonb')
  request_body!: Record<string, unknown>;

  @Column('jsonb', { nullable: true })
  response_body!: RecordingResponseBody | null;

  @Column('varchar')
  api_format!: string;

  @Column('integer', { default: 0 })
  size_bytes!: number;

  @Column(timestampType(), { default: timestampDefault() })
  created_at!: string;

  @Column(timestampType(), { default: timestampDefault() })
  updated_at!: string;
}
