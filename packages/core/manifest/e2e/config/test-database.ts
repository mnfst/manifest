import { AdminEventSubscriber } from '../../src/entity/subscribers/AdminEventSubscriber'
import { DataSourceOptions } from 'typeorm'

// Alternative DB configuration for testing (memory).
export default (): { database: DataSourceOptions } => {
  return {
    database: {
      type: 'sqlite',
      database: ':memory:',
      dropSchema: true,
      subscribers: [AdminEventSubscriber],
      synchronize: true
    }
  }
}
