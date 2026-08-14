import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { InstallMetadata } from '../entities/install-metadata.entity';

export const SINGLETON_ID = 'singleton';

@Injectable()
export class InstallIdService {
  constructor(
    @InjectRepository(InstallMetadata)
    private readonly repo: Repository<InstallMetadata>,
  ) {}

  async getOrCreate(): Promise<InstallMetadata> {
    const existing = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    if (existing) return existing;

    // `orIgnore()` handles the parallel-boot race: if two workers race on
    // first boot, only one row wins and the other silently no-ops.
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(InstallMetadata)
      .values({
        id: SINGLETON_ID,
        install_id: randomUUID(),
        first_send_at: this.computeFirstSendAt(),
        last_sent_at: null,
      })
      .orIgnore()
      .execute();

    const row = await this.repo.findOne({ where: { id: SINGLETON_ID } });
    if (!row) throw new Error('install_metadata row missing after upsert');
    return row;
  }

  async markSent(now: Date): Promise<void> {
    await this.repo.update(SINGLETON_ID, { last_sent_at: now.toISOString() });
  }

  /**
   * Random 0–24h offset on first boot. Prevents a fleet of installs booted
   * via a rolling upgrade from all hitting the ingest at the same minute.
   */
  private computeFirstSendAt(): string {
    const jitterMs = Math.floor(Math.random() * 24 * 60 * 60 * 1000);
    return new Date(Date.now() + jitterMs).toISOString();
  }
}
