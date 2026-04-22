import { MultiAccountProvider1777100000000 } from './1777100000000-MultiAccountProvider';

describe('MultiAccountProvider1777100000000', () => {
  let migration: MultiAccountProvider1777100000000;

  beforeEach(() => {
    migration = new MultiAccountProvider1777100000000();
  });

  it('should have a name property matching the class name + timestamp', () => {
    expect(migration.name).toBe('MultiAccountProvider1777100000000');
  });

  it('should expose up and down methods', () => {
    expect(typeof migration.up).toBe('function');
    expect(typeof migration.down).toBe('function');
  });
});
