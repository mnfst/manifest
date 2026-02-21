import 'dotenv/config';
import { DataSource } from 'typeorm';

const isLocalMode = process.env['MANIFEST_MODE'] === 'local';

function createDataSource(): DataSource {
  if (isLocalMode) {
    const dbPath = process.env['MANIFEST_DB_PATH'] || ':memory:';
    return new DataSource({
      type: 'better-sqlite3',
      database: dbPath,
      entities: ['src/entities/*.ts'],
      synchronize: true,
    });
  }

  const databaseUrl =
    process.env['DATABASE_URL'] ??
    'postgresql://myuser:mypassword@localhost:5432/mydatabase';

  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: ['src/entities/*.ts'],
    migrations: ['src/database/migrations/*.ts'],
  });
}

export default createDataSource();
