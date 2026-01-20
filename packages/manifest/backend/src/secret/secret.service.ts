import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { AppSecretEntity } from './secret.entity';
import type { AppSecret, CreateSecretRequest, UpdateSecretRequest } from '@manifest/shared';

/**
 * SECURITY: Encryption utilities for secrets at rest
 * Uses AES-256-GCM with a key derived from BETTER_AUTH_SECRET
 */
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT = 'manifest-secrets-v1'; // Static salt for key derivation

function getEncryptionKey(): Buffer {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    // In development without secret, use a deterministic key (not secure for production)
    return scryptSync('dev-insecure-key', SALT, 32);
  }
  return scryptSync(secret, SALT, 32);
}

function encryptValue(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decryptValue(encryptedValue: string): string {
  // Check if value is encrypted (contains colons for iv:authTag:data format)
  if (!encryptedValue.includes(':')) {
    // Legacy unencrypted value - return as-is
    return encryptedValue;
  }

  const parts = encryptedValue.split(':');
  if (parts.length !== 3) {
    // Invalid format - return as-is (might be unencrypted value with colon)
    return encryptedValue;
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch {
    // Decryption failed - might be legacy unencrypted value
    return encryptedValue;
  }
}

/**
 * Service for AppSecret CRUD operations
 */
@Injectable()
export class SecretService {
  constructor(
    @InjectRepository(AppSecretEntity)
    private readonly secretRepository: Repository<AppSecretEntity>,
  ) {}

  /**
   * List all secrets for an app
   */
  async listByAppId(appId: string): Promise<AppSecret[]> {
    const entities = await this.secretRepository.find({
      where: { appId },
      order: { key: 'ASC' },
    });
    return entities.map((e) => this.entityToSecret(e));
  }

  /**
   * Create a new secret for an app
   */
  async create(appId: string, request: CreateSecretRequest): Promise<AppSecret> {
    // Validate key format (env var naming: starts with letter/underscore, alphanumeric)
    if (!this.isValidKey(request.key)) {
      throw new BadRequestException(
        'Invalid key format. Key must start with a letter or underscore and contain only alphanumeric characters and underscores.'
      );
    }

    // Check for duplicate key
    const existing = await this.secretRepository.findOne({
      where: { appId, key: request.key },
    });
    if (existing) {
      throw new BadRequestException(`Secret with key '${request.key}' already exists for this app`);
    }

    const entity = this.secretRepository.create({
      appId,
      key: request.key,
      value: encryptValue(request.value), // SECURITY: Encrypt at rest
    });

    const saved = await this.secretRepository.save(entity);
    return this.entityToSecret(saved);
  }

  /**
   * Update an existing secret
   */
  async update(secretId: string, request: UpdateSecretRequest): Promise<AppSecret> {
    const entity = await this.secretRepository.findOne({ where: { id: secretId } });
    if (!entity) {
      throw new NotFoundException(`Secret with id ${secretId} not found`);
    }

    if (request.key !== undefined) {
      // Validate key format
      if (!this.isValidKey(request.key)) {
        throw new BadRequestException(
          'Invalid key format. Key must start with a letter or underscore and contain only alphanumeric characters and underscores.'
        );
      }

      // Check for duplicate key (if changing to a different key)
      if (request.key !== entity.key) {
        const existing = await this.secretRepository.findOne({
          where: { appId: entity.appId, key: request.key },
        });
        if (existing) {
          throw new BadRequestException(`Secret with key '${request.key}' already exists for this app`);
        }
      }

      entity.key = request.key;
    }

    if (request.value !== undefined) {
      entity.value = encryptValue(request.value); // SECURITY: Encrypt at rest
    }

    const saved = await this.secretRepository.save(entity);
    return this.entityToSecret(saved);
  }

  /**
   * Delete a secret
   */
  async delete(secretId: string): Promise<void> {
    const entity = await this.secretRepository.findOne({ where: { id: secretId } });
    if (!entity) {
      throw new NotFoundException(`Secret with id ${secretId} not found`);
    }

    await this.secretRepository.remove(entity);
  }

  /**
   * Get the appId for a secret (for authorization checks)
   */
  async getAppIdForSecret(secretId: string): Promise<string | null> {
    const entity = await this.secretRepository.findOne({
      where: { id: secretId },
      select: ['appId'],
    });
    return entity?.appId ?? null;
  }

  /**
   * Validate key format (env var naming convention)
   */
  private isValidKey(key: string): boolean {
    if (!key || key.length === 0 || key.length > 256) {
      return false;
    }
    // Must start with letter or underscore, then alphanumeric or underscore
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key);
  }

  /**
   * Convert entity to AppSecret interface
   * SECURITY: Decrypts the value when reading
   */
  private entityToSecret(entity: AppSecretEntity): AppSecret {
    return {
      id: entity.id,
      appId: entity.appId,
      key: entity.key,
      value: decryptValue(entity.value), // SECURITY: Decrypt on read
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
