import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions'
import { AdminEventSubscriber } from '../entity/subscribers/AdminEventSubscriber'

export default (): { database: SqliteConnectionOptions } => {
  return {
    database: {
      type: 'sqlite',
      database:
        process.env.DB_DATABASE || `${process.cwd()}/manifest/backend.db`,
      dropSchema: process.env.DB_DROP_SCHEMA === 'true' || false,
      synchronize: true
    }
  }
}
