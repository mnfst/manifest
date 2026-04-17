import 'dotenv/config';
import { DataSource } from 'typeorm';

function createDataSource(): DataSource {
  const databaseUrl =
    process.env['MIGRATION_DATABASE_URL'] ??
    process.env['DATABASE_URL'] ??
    'postgresql://myuser:mypassword@localhost:5432/mydatabase';

  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: ['src/entities/!(*.spec).ts'],
    migrations: ['src/database/migrations/!(*.spec).ts'],
  });
}

export default createDataSource();
