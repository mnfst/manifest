import { Entity, Column, PrimaryColumn } from 'typeorm';

export interface RecordingResponseBody {
  type: 'json' | 'stream';
  body?: unknown;
  raw_sse?: string;
}

@Entity('message_recordings')
export class MessageRecording {
  @PrimaryColumn('varchar')
  message_id!: string;

  @Column('jsonb', { nullable: true })
  request_body!: Record<string, unknown> | null;

  @Column('jsonb', { nullable: true })
  response_body!: RecordingResponseBody | null;

  @Column('jsonb', { nullable: true })
  response_headers!: Record<string, string> | null;

  @Column('integer', { nullable: true })
  size_bytes!: number | null;

  @Column('timestamptz')
  created_at!: string;
}
