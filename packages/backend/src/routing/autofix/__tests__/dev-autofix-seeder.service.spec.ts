import { DevAutofixSeederService } from '../dev-autofix-seeder.service';

describe('DevAutofixSeederService', () => {
  const agentRepo = { findOne: jest.fn() };
  const messageRepo = { count: jest.fn(), insert: jest.fn() };
  const requestRepo = { upsert: jest.fn() };
  let service: DevAutofixSeederService;

  beforeEach(() => {
    jest.clearAllMocks();
    messageRepo.count.mockResolvedValue(0);
    messageRepo.insert.mockResolvedValue(undefined);
    requestRepo.upsert.mockResolvedValue(undefined);
    agentRepo.findOne.mockResolvedValue({ id: 'agent-1', name: 'demo-agent' });
    service = new DevAutofixSeederService(
      agentRepo as never,
      messageRepo as never,
      requestRepo as never,
    );
  });

  it('inserts representative healed and unresolved Auto-fix attempts', async () => {
    await expect(service.ensureSeeded('tenant-1')).resolves.toBe(22);

    expect(agentRepo.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenant_id: 'tenant-1', is_playground: false }),
      order: { created_at: 'ASC' },
    });
    const rows = messageRepo.insert.mock.calls[0]![0] as Array<Record<string, unknown>>;
    const requests = requestRepo.upsert.mock.calls[0]![0] as Array<Record<string, unknown>>;
    const originals = rows.filter((row) => row['autofix_role'] === 'original');
    const retries = rows.filter((row) => row['autofix_role'] === 'retry');
    expect(originals).toHaveLength(11);
    expect(retries).toHaveLength(11);
    expect(originals.every((row) => row['status'] === 'failed')).toBe(true);
    expect(originals.every((row) => row['attempt_number'] === 1)).toBe(true);
    expect(originals.every((row) => row['superseded'] === true)).toBe(true);
    expect(retries.every((row) => row['attempt_number'] === 2)).toBe(true);
    expect(retries.filter((row) => row['status'] === 'success')).toHaveLength(8);
    const failedRetries = retries.filter((row) => row['status'] === 'failed');
    expect(failedRetries).toHaveLength(3);
    expect(failedRetries.every((row) => row['error_message'])).toBe(true);
    expect(rows.every((row) => row['tenant_id'] === 'tenant-1')).toBe(true);
    expect(requests).toHaveLength(11);
    expect(new Set(rows.map((row) => row['request_id']))).toEqual(
      new Set(requests.map((request) => request['id'])),
    );
    expect(rows).toHaveLength(requests.length * 2);
    expect(requests.filter((request) => request['status'] === 'success')).toHaveLength(8);
    expect(requests.filter((request) => request['status'] === 'failed')).toHaveLength(3);
  });

  it('is idempotent for a tenant that already has dev Auto-fix rows', async () => {
    messageRepo.count.mockResolvedValue(1);

    await expect(service.ensureSeeded('tenant-1')).resolves.toBe(0);
    expect(agentRepo.findOne).not.toHaveBeenCalled();
    expect(messageRepo.insert).not.toHaveBeenCalled();
    expect(requestRepo.upsert).not.toHaveBeenCalled();
  });

  it('does nothing when the tenant has no non-Playground agent', async () => {
    agentRepo.findOne.mockResolvedValue(null);

    await expect(service.ensureSeeded('tenant-1')).resolves.toBe(0);
    expect(messageRepo.insert).not.toHaveBeenCalled();
    expect(requestRepo.upsert).not.toHaveBeenCalled();
  });
});
