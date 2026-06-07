import { AddMessageRetention1790500000000 } from './1790500000000-AddMessageRetention';

describe('AddMessageRetention1790500000000', () => {
	const migration = new AddMessageRetention1790500000000();
	let queries: string[];

	const mockQueryRunner = {
		query: jest.fn().mockImplementation((sql: string) => {
			queries.push(sql);
			return Promise.resolve();
		}),
	} as never;

	beforeEach(() => {
		queries = [];
		jest.clearAllMocks();
	});

	it('exposes the expected migration name', () => {
		expect(migration.name).toBe('AddMessageRetention1790500000000');
	});

	it('adds message_retention_days column with default null', async () => {
		await migration.up(mockQueryRunner);
		expect(queries).toHaveLength(1);
		expect(queries[0]).toContain(
			'ALTER TABLE install_metadata ADD COLUMN message_retention_days integer DEFAULT NULL',
		);
	});

	it('drops the column on rollback', async () => {
		await migration.down(mockQueryRunner);
		expect(queries).toHaveLength(1);
		expect(queries[0]).toContain('ALTER TABLE install_metadata DROP COLUMN message_retention_days');
	});
});
