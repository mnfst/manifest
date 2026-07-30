import { REQUEST_QUOTA_CONFIG_TABLE } from '../../billing/request-quota-window';
import { HardenRequestQuotaTimeZone1801600000000 } from './1801600000000-HardenRequestQuotaTimeZone';

const LEGACY_FUNCTION_DEFINITION = `
  CREATE OR REPLACE FUNCTION public.count_tenant_request_usage()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $function$
  BEGIN
    IF (NEW."timestamp" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' < counter_cutover_at THEN
      RETURN NEW;
    END IF;
    UPDATE "requests" r
       SET "quota_counted" = true
     WHERE r."timestamp" >= '2026-07-09 09:06:52'::timestamp
    RETURNING
      GREATEST(
        date_trunc('month', (r."timestamp" AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),
        '2026-07-09 09:06:52'::timestamp
      )
      INTO counted_tenant_id, counted_window_start;
    RETURN NEW;
  END;
  $function$
`;

describe('HardenRequestQuotaTimeZone1801600000000', () => {
  const originalManifestMode = process.env['MANIFEST_MODE'];
  let statements: Array<{ sql: string; params?: unknown[] }>;
  let installedDefinition: string;
  const queryRunner = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      statements.push({ sql, params });
      if (sql.includes('pg_get_functiondef')) return [{ definition: installedDefinition }];
      if (sql.includes(`SELECT "storage_time_zone" FROM "${REQUEST_QUOTA_CONFIG_TABLE}"`)) {
        return [{ storage_time_zone: 'UTC' }];
      }
      return [];
    }),
  };

  beforeEach(() => {
    process.env['MANIFEST_MODE'] = 'cloud';
    installedDefinition = LEGACY_FUNCTION_DEFINITION;
    statements = [];
    jest.clearAllMocks();
  });

  afterAll(() => {
    if (originalManifestMode === undefined) delete process.env['MANIFEST_MODE'];
    else process.env['MANIFEST_MODE'] = originalManifestMode;
  });

  it('preserves the installed timezone and reset literals without touching counters', async () => {
    await new HardenRequestQuotaTimeZone1801600000000().up(queryRunner as never);

    const sql = statements.map((statement) => statement.sql).join('\n');
    expect(sql).toContain(`CREATE TABLE "${REQUEST_QUOTA_CONFIG_TABLE}"`);
    expect(statements.find((statement) => statement.sql.includes('INSERT INTO'))?.params).toEqual([
      'UTC',
    ]);
    expect(sql).toContain('r."timestamp" >= \'2026-07-09 09:06:52\'::timestamp');
    expect(sql).toContain('AT TIME ZONE request_storage_time_zone');
    expect(sql).toContain(`FROM "${REQUEST_QUOTA_CONFIG_TABLE}"`);
    expect(sql).not.toContain('UPDATE "tenant_request_usage"');
  });

  it('fails before schema changes when the installed function cannot be inspected', async () => {
    installedDefinition = 'CREATE FUNCTION count_tenant_request_usage() RETURNS trigger';

    await expect(
      new HardenRequestQuotaTimeZone1801600000000().up(queryRunner as never),
    ).rejects.toThrow('Could not read request quota timezone');

    expect(statements).toHaveLength(1);
  });

  it('does nothing for self-hosted installations', async () => {
    process.env['MANIFEST_MODE'] = 'selfhosted';

    await new HardenRequestQuotaTimeZone1801600000000().up(queryRunner as never);

    expect(statements).toEqual([]);
  });

  it('restores a literal timezone on rollback', async () => {
    installedDefinition = LEGACY_FUNCTION_DEFINITION.replaceAll(
      "AT TIME ZONE 'UTC'",
      'AT TIME ZONE request_storage_time_zone',
    );

    await new HardenRequestQuotaTimeZone1801600000000().down(queryRunner as never);

    const sql = statements.map((statement) => statement.sql).join('\n');
    expect(sql).toContain('NEW."timestamp" AT TIME ZONE \'UTC\'');
    expect(sql).toContain(`DROP TABLE "${REQUEST_QUOTA_CONFIG_TABLE}"`);
  });
});
