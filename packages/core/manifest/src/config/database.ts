import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions'

export default (): { database: SqliteConnectionOptions } => {
  return {
    database: {
      type: 'sqlite',
      database: `${process.cwd()}/manifest/backend.db`,
      dropSchema: false,
      synchronize: true
    }
  }
}
