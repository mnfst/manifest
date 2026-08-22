import { ProviderKeyService } from './provider-key.service';
import { hashKey } from '../../common/utils/hash.util';

function makeService(rows: Array<{ provider: string; key_hash: string | null; is_active: boolean }>) {
  const providerRepo = {
    find: jest.fn().mockResolvedValue(rows),
  } as never;
  // ProviderKeyService requires many constructor deps; build a minimal instance
  // via Object.create and inject only what verifyKeyMatches touches.
  const svc = Object.create(ProviderKeyService.prototype) as ProviderKeyService;
  (svc as unknown as { providerRepo: unknown }).providerRepo = providerRepo;
  return { svc, providerRepo };
}

describe('ProviderKeyService.verifyKeyMatches', () => {
  it('returns match:true when a posted key hashes to a stored key_hash', async () => {
    const secret = 'sk-original-secret';
    const { svc } = makeService([
      { provider: 'openai', key_hash: hashKey(secret), is_active: true },
    ]);
    const res = await svc.verifyKeyMatches('t1', 'openai', secret);
    expect(res).toEqual({ match: true });
  });

  it('returns match:false for a wrong key', async () => {
    const { svc } = makeService([
      { provider: 'openai', key_hash: hashKey('sk-right'), is_active: true },
    ]);
    const res = await svc.verifyKeyMatches('t1', 'openai', 'sk-wrong');
    expect(res).toEqual({ match: false });
  });

  it('matches across provider aliases (openai == OPENAI)', async () => {
    const secret = 'sk-foo';
    const { svc } = makeService([
      { provider: 'OPENAI', key_hash: hashKey(secret), is_active: true },
    ]);
    const res = await svc.verifyKeyMatches('t1', 'openai', secret);
    expect(res).toEqual({ match: true });
  });

  it('returns match:false when no keyed row exists for the provider', async () => {
    const { svc } = makeService([
      { provider: 'anthropic', key_hash: hashKey('sk-x'), is_active: true },
    ]);
    const res = await svc.verifyKeyMatches('t1', 'openai', 'sk-whatever');
    expect(res).toEqual({ match: false });
  });
});
