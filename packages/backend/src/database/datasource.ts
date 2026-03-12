import 'dotenv/config';
import { DataSource } from 'typeorm';

const isLocalMode = process.env['MANIFEST_MODE'] === 'local';

function createDataSource(): DataSource {
  if (isLocalMode) {
    const dbPath = process.env['MANIFEST_DB_PATH'] || ':memory:';
    return new DataSource({
      type: 'sqljs',
      location: dbPath === ':memory:' ? undefined : dbPath,
      autoSave: dbPath !== ':memory:',
      entities: ['src/entities/!(*.spec).ts'],
      synchronize: true,
    });
  }

  const databaseUrl =
    process.env['MIGRATION_DATABASE_URL'] ??
    process.env['DATABASE_URL'] ??
    'postgresql://myuser:mypassword@localhost:5432/mydatabase';

  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: ['src/entities/!(*.spec).ts'],
    migrations: ['src/database/migrations/!(*.spec).ts'],
    extra: { options: '-c timezone=UTC' },
  });
}

export default createDataSource();
