import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { decrypt, encrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import { InstanceCredential } from '../../entities/instance-credential.entity';
import type { RegisterInstanceResponse } from './phoenix.types';

export const INSTANCE_CREDENTIAL_SINGLETON_ID = 'singleton';
export const INSTANCE_CREDENTIAL_SCHEMA_VERSION = 1;

export interface AutofixInstanceCredential {
  instanceId: string;
  secret: string;
}

/**
 * Loads and persists the anonymous credential used by self-hosted Autofix.
 * Registration is supplied by the HTTP client so storage stays independent of
 * transport, while the in-flight promise prevents duplicate registration
 * inside one process.
 */
@Injectable()
export class InstanceCredentialService {
  private cached: AutofixInstanceCredential | null = null;
  private inFlight: Promise<AutofixInstanceCredential> | null = null;

  constructor(
    @InjectRepository(InstanceCredential)
    private readonly repo: Repository<InstanceCredential>,
  ) {}

  async getOrRegister(
    register: () => Promise<RegisterInstanceResponse>,
  ): Promise<AutofixInstanceCredential> {
    if (this.cached) return this.cached;
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.loadOrRegister(register);
    try {
      this.cached = await this.inFlight;
      return this.cached;
    } finally {
      this.inFlight = null;
    }
  }

  async clear(rejectedInstanceId: string): Promise<void> {
    if (this.cached?.instanceId === rejectedInstanceId) this.cached = null;
    // A different replica may already have replaced the rejected credential.
    // Match both singleton id and instance id so a stale 401 cannot delete the
    // new winner and split replicas across multiple Phoenix identities.
    await this.repo.delete({
      id: INSTANCE_CREDENTIAL_SINGLETON_ID,
      instance_id: rejectedInstanceId,
    });
  }

  private async loadOrRegister(
    register: () => Promise<RegisterInstanceResponse>,
  ): Promise<AutofixInstanceCredential> {
    const existing = await this.repo.findOne({
      where: { id: INSTANCE_CREDENTIAL_SINGLETON_ID },
    });
    if (existing) return this.fromEntity(existing);

    const issued = await register();
    await this.repo
      .createQueryBuilder()
      .insert()
      .into(InstanceCredential)
      .values({
        id: INSTANCE_CREDENTIAL_SINGLETON_ID,
        instance_id: issued.instance_id,
        secret_encrypted: encrypt(issued.secret, getEncryptionSecret()),
        registered_at: new Date().toISOString(),
        schema_version: INSTANCE_CREDENTIAL_SCHEMA_VERSION,
      })
      .orIgnore()
      .execute();

    // Another replica may have won the singleton insert. Always re-read and use
    // the stored winner, discarding the credential issued to this loser.
    const stored = await this.repo.findOne({
      where: { id: INSTANCE_CREDENTIAL_SINGLETON_ID },
    });
    if (!stored) throw new Error('instance_credential row missing after registration');
    return this.fromEntity(stored);
  }

  private fromEntity(row: InstanceCredential): AutofixInstanceCredential {
    return {
      instanceId: row.instance_id,
      secret: decrypt(row.secret_encrypted, getEncryptionSecret()),
    };
  }
}
