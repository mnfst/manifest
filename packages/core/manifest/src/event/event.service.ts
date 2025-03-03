import { Injectable } from '@nestjs/common'
import { CollectionController } from '../crud/controllers/collection.controller'
import { SingleController } from '../crud/controllers/single.controller'
import { crudEvents } from './crud-events'
import { CrudEventName } from '../../../types/src'

@Injectable()
export class EventService {
  /**
   * Gets the related crud event of a function.
   *
   * @param functionCalled the name of the function called
   * @param moment the moment of the event
   *
   * @returns event
   */
  getRelatedCrudEvent(
    functionCalled: keyof CollectionController | keyof SingleController,
    moment: 'before' | 'after'
  ): CrudEventName {
    return crudEvents.find(
      (event) =>
        event.relatedFunctions.includes(functionCalled) &&
        event.moment === moment
    )?.name
  }
}
