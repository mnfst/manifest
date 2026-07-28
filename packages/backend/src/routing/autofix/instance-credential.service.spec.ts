import { Repository } from 'typeorm';
import { decrypt, encrypt, getEncryptionSecret } from '../../common/utils/crypto.util';
import { InstanceCredential } from '../../entities/instance-credential.entity';
import {
  INSTANCE_CREDENTIAL_SCHEMA_VERSION,
  INSTANCE_CREDENTIAL_SINGLETON_ID,
  InstanceCredentialService,
} from './instance-credential.service';

function makeRepo(rows: InstanceCredential[] = []) {
  const storage = [...rows];
  const execute = jest.fn(async () => {
    const pending = values.mock.calls.at(-1)?.[0] as InstanceCredential;
    if (!storage.some((row) => row.id === pending.id)) storage.push(pending);
  });
  const values = jest.fn().mockReturnThis();
  const builder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values,
    orIgnore: jest.fn().mockReturnThis(),
    execute,
  };
  const repo = {
    findOne: jest.fn(async () => storage[0] ?? null),
    createQueryBuilder: jest.fn(() => builder),
    delete: jest.fn(async (criteria: { id: string; instance_id: string }) => {
      const index = storage.findIndex(
        (row) => row.id === criteria.id && row.instance_id === criteria.instance_id,
      );
      if (index >= 0) storage.splice(index, 1);
      return { affected: 1, raw: [] };
    }),
  } as unknown as Repository<InstanceCredential>;
  return { repo, storage, builder, values };
}

describe('InstanceCredentialService', () => {
  const previousKey = process.env.MANIFEST_ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.MANIFEST_ENCRYPTION_KEY = 'instance-credential-test-key-32-chars';
  });

  afterAll(() => {
    if (previousKey === undefined) delete process.env.MANIFEST_ENCRYPTION_KEY;
    else process.env.MANIFEST_ENCRYPTION_KEY = previousKey;
  });

  it('decrypts an existing singleton without registering', async () => {
    const { repo } = makeRepo([
      {
        id: INSTANCE_CREDENTIAL_SINGLETON_ID,
        instance_id: 'existing-id',
        secret_encrypted: encrypt('existing-secret', getEncryptionSecret()),
        registered_at: new Date().toISOString(),
        schema_version: 1,
      },
    ]);
    const service = new InstanceCredentialService(repo);
    const register = jest.fn();

    await expect(service.getOrRegister(register)).resolves.toEqual({
      instanceId: 'existing-id',
      secret: 'existing-secret',
    });
    expect(register).not.toHaveBeenCalled();
  });

  it('registers lazily, encrypts the secret, persists schema metadata, and memoizes', async () => {
    const { repo, storage, builder } = makeRepo();
    const service = new InstanceCredentialService(repo);
    const register = jest
      .fn()
      .mockResolvedValue({ instance_id: 'issued-id', secret: 'issued-secret' });

    const first = await service.getOrRegister(register);
    const second = await service.getOrRegister(register);

    expect(first).toEqual({ instanceId: 'issued-id', secret: 'issued-secret' });
    expect(second).toBe(first);
    expect(register).toHaveBeenCalledTimes(1);
    expect(builder.orIgnore).toHaveBeenCalledTimes(1);
    expect(storage[0]).toMatchObject({
      id: INSTANCE_CREDENTIAL_SINGLETON_ID,
      instance_id: 'issued-id',
      schema_version: INSTANCE_CREDENTIAL_SCHEMA_VERSION,
    });
    expect(storage[0].secret_encrypted).not.toContain('issued-secret');
    expect(decrypt(storage[0].secret_encrypted, getEncryptionSecret())).toBe('issued-secret');
  });

  it('shares one in-flight registration across concurrent callers', async () => {
    const { repo } = makeRepo();
    const service = new InstanceCredentialService(repo);
    let release!: (value: { instance_id: string; secret: string }) => void;
    const register = jest.fn(
      () =>
        new Promise<{ instance_id: string; secret: string }>((resolve) => {
          release = resolve;
        }),
    );

    const first = service.getOrRegister(register);
    const second = service.getOrRegister(register);
    await Promise.resolve();
    await Promise.resolve();
    release({ instance_id: 'one-id', secret: 'one-secret' });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { instanceId: 'one-id', secret: 'one-secret' },
      { instanceId: 'one-id', secret: 'one-secret' },
    ]);
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('uses the row that won a cross-replica insert race', async () => {
    const winner: InstanceCredential = {
      id: INSTANCE_CREDENTIAL_SINGLETON_ID,
      instance_id: 'winner-id',
      secret_encrypted: encrypt('winner-secret', getEncryptionSecret()),
      registered_at: new Date().toISOString(),
      schema_version: 1,
    };
    const { repo, storage, builder } = makeRepo();
    builder.execute.mockImplementationOnce(async () => {
      storage.push(winner);
    });
    const service = new InstanceCredentialService(repo);

    await expect(
      service.getOrRegister(async () => ({
        instance_id: 'loser-id',
        secret: 'loser-secret',
      })),
    ).resolves.toEqual({ instanceId: 'winner-id', secret: 'winner-secret' });
  });

  it('clears the persisted and memoized credential so the next call registers again', async () => {
    const { repo } = makeRepo();
    const service = new InstanceCredentialService(repo);
    const register = jest
      .fn()
      .mockResolvedValueOnce({ instance_id: 'first', secret: 'secret-1' })
      .mockResolvedValueOnce({ instance_id: 'second', secret: 'secret-2' });

    await service.getOrRegister(register);
    await service.clear('first');
    await expect(service.getOrRegister(register)).resolves.toEqual({
      instanceId: 'second',
      secret: 'secret-2',
    });
    expect(register).toHaveBeenCalledTimes(2);
  });

  it('does not let a stale 401 delete or evict a newer credential', async () => {
    const { repo, storage } = makeRepo();
    const service = new InstanceCredentialService(repo);
    await service.getOrRegister(async () => ({ instance_id: 'new-id', secret: 'new-secret' }));

    await service.clear('old-id');
    const register = jest.fn();

    await expect(service.getOrRegister(register)).resolves.toEqual({
      instanceId: 'new-id',
      secret: 'new-secret',
    });
    expect(storage[0].instance_id).toBe('new-id');
    expect(register).not.toHaveBeenCalled();
  });

  it('fails closed if registration completes but no singleton row can be read', async () => {
    const { repo } = makeRepo();
    (repo.findOne as jest.Mock).mockResolvedValue(null);
    const service = new InstanceCredentialService(repo);

    await expect(
      service.getOrRegister(async () => ({ instance_id: 'id', secret: 'secret' })),
    ).rejects.toThrow('instance_credential row missing after registration');
  });
});
