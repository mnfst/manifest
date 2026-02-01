import { paginate, PaginateOptions } from './paginate';
import type { Repository } from 'typeorm';

interface TestEntity {
  id: string;
  name: string;
}

function createMockRepository(
  items: TestEntity[],
  total: number,
): Repository<TestEntity> {
  return {
    findAndCount: jest.fn().mockResolvedValue([items, total]),
  } as unknown as Repository<TestEntity>;
}

describe('paginate', () => {
  it('should return correct metadata for a full page', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
    }));
    const repo = createMockRepository(items, 25);

    const result = await paginate(repo, {
      query: { page: 1, limit: 10 },
    });

    expect(result.items).toHaveLength(10);
    expect(result.total).toBe(25);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(10);
    expect(result.totalPages).toBe(3);
  });

  it('should use defaults when query is omitted', async () => {
    const repo = createMockRepository([], 0);

    const result = await paginate(repo);

    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
    expect(result.totalPages).toBe(0);
    expect(repo.findAndCount).toHaveBeenCalledWith({
      where: undefined,
      order: undefined,
      skip: 0,
      take: 20,
    });
  });

  it('should use defaults when query fields are undefined', async () => {
    const repo = createMockRepository([], 0);

    await paginate(repo, { query: {} });

    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('should calculate skip correctly for page 3', async () => {
    const repo = createMockRepository([], 100);

    await paginate(repo, { query: { page: 3, limit: 15 } });

    expect(repo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 30, take: 15 }),
    );
  });

  it('should ceil totalPages for non-even division', async () => {
    const repo = createMockRepository([], 7);

    const result = await paginate(repo, {
      query: { page: 1, limit: 3 },
    });

    expect(result.totalPages).toBe(3); // ceil(7/3) = 3
  });

  it('should return totalPages 0 when total is 0', async () => {
    const repo = createMockRepository([], 0);

    const result = await paginate(repo, {
      query: { page: 1, limit: 10 },
    });

    expect(result.totalPages).toBe(0);
  });

  it('should pass where and order to repository', async () => {
    const repo = createMockRepository([], 0);
    const options: PaginateOptions<TestEntity> = {
      query: { page: 1, limit: 5 },
      where: { name: 'test' } as any,
      order: { name: 'ASC' } as any,
    };

    await paginate(repo, options);

    expect(repo.findAndCount).toHaveBeenCalledWith({
      where: { name: 'test' },
      order: { name: 'ASC' },
      skip: 0,
      take: 5,
    });
  });
});
