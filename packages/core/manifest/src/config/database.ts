import { BetterSqlite3ConnectionOptions } from 'typeorm/driver/better-sqlite3/BetterSqlite3ConnectionOptions'

export default (): { database: BetterSqlite3ConnectionOptions } => {
  return {
    database: {
      type: 'better-sqlite3',
      database:
        process.env.DB_DATABASE || `${process.cwd()}/manifest/backend.db`,
      dropSchema: process.env.DB_DROP_SCHEMA === 'true' || false,
      synchronize: true
    }
  }
}
