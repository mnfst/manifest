import { SHA3 } from 'crypto-js'
import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent
} from 'typeorm'

@EventSubscriber()
export class AdminEventSubscriber implements EntitySubscriberInterface {
  /**
   * Indicates that this subscriber only listens to Admin entity.
   */
  listenTo() {
    return 'Admin' // The name should match the name in your EntitySchema
  }

  /**
   * Hashes the password before inserting it into the database.
   */
  beforeInsert(event: InsertEvent<any>) {
    event.entity.password = SHA3(event.entity.password).toString()
  }

  /**
   * Hashes the password before updating it in the database (if changed).
   */
  beforeUpdate(event: UpdateEvent<any>) {
    if (event.entity.password) {
      event.entity.password = SHA3(event.entity.password).toString()
    } else {
      delete event.entity.password
    }
  }
}
