import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions'

export default (): { database: SqliteConnectionOptions } => {
  return {
    database: {
      type: 'sqlite',
      database:
        process.env.DATABASE_PATH || `${process.cwd()}/manifest/backend.db`,
      dropSchema: process.env.DB_DROP_SCHEMA === 'true' || false,
      synchronize: true
    }
  }
}
