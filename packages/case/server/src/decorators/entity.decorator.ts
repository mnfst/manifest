import { Entity as TypeORMEntity } from 'typeorm'
import { EntityDefinition } from '../../../shared/interfaces/entity-definition.interface'

/**
 * Class decorator for defining metadata and database entity type
 * @param {EntityDefinition} entityDefinition - The entity definition
 * @returns {ClassDecorator} The class decorator
 */
export const Entity = (entityDefinition: EntityDefinition): ClassDecorator => {
  return (target: any): any => {
    // Extend the Entity decorator from TypeORM.
    TypeORMEntity()(target)

    // Set the entity definition on the target.
    target.definition = entityDefinition
  }
}
