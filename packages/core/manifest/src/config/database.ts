import { AdminEventSubscriber } from '../entity/subscribers/AdminEventSubscriber'
import { BetterSqlite3ConnectionOptions } from 'typeorm/driver/better-sqlite3/BetterSqlite3ConnectionOptions'

export default (): { database: BetterSqlite3ConnectionOptions } => {
  return {
    database: {
      type: 'better-sqlite3',
      database: `${process.cwd()}/manifest/backend.db`,
      subscribers: [AdminEventSubscriber],
      synchronize: true
    }
  }
}
