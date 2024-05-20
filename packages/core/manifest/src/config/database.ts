import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions'
import { AdminEventSubscriber } from '../entity/subscribers/AdminEventSubscriber'

export default (): { database: SqliteConnectionOptions } => {
  return {
    database: {
      type: 'sqlite',
      database: `${process.cwd()}/manifest/backend.db`,
      subscribers: [AdminEventSubscriber],
      synchronize: true
    }
  }
}
