import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  encrypt,
  isEncrypted,
} from '../../common/utils/crypto.util';

export class EncryptApiKeys1771900000000 implements MigrationInterface {
  name = 'EncryptApiKeys1771900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const secret =
      process.env['MANIFEST_ENCRYPTION_KEY'] ||
      process.env['BETTER_AUTH_SECRET'];

    if (!secret || secret.length < 32) {
      console.warn(
        'EncryptApiKeys: No encryption secret found. Skipping — set MANIFEST_ENCRYPTION_KEY or BETTER_AUTH_SECRET.',
      );
      return;
    }

    const tableExists = await queryRunner.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'user_providers'`,
    );
    if (tableExists.length === 0) return;

    const rows: { id: string; api_key_encrypted: string }[] =
      await queryRunner.query(
        `SELECT id, api_key_encrypted FROM "user_providers" WHERE api_key_encrypted IS NOT NULL AND api_key_encrypted != ''`,
      );

    let encrypted = 0;
    for (const row of rows) {
      if (isEncrypted(row.api_key_encrypted)) continue;

      const ciphertext = encrypt(row.api_key_encrypted, secret);
      await queryRunner.query(
        `UPDATE "user_providers" SET api_key_encrypted = $1 WHERE id = $2`,
        [ciphertext, row.id],
      );
      encrypted++;
    }

    if (encrypted > 0) {
      console.log(
        `EncryptApiKeys: Encrypted ${encrypted} plaintext API key(s).`,
      );
    }
  }

  public async down(): Promise<void> {
    // Cannot reverse: decryption requires the secret and we don't store plaintext.
  }
}
