import 'dotenv/config';
import { DataSource } from 'typeorm';

const databaseUrl =
  process.env['DATABASE_URL'] ??
  'postgresql://myuser:mypassword@localhost:5432/mydatabase';

export default new DataSource({
  type: 'postgres',
  url: databaseUrl,
  entities: ['src/entities/*.ts'],
  migrations: ['src/database/migrations/*.ts'],
});
