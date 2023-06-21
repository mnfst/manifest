import { Entity } from 'typeorm'
import { EntityDefinition } from '~shared/interfaces/entity-definition'

export const CaseEntity = (
  entityDefinition: EntityDefinition
): ClassDecorator => {
  return (target: any): any => {
    // Extend the Entity decorator from TypeORM.
    Entity()(target)

    // Set the entity definition on the target.
    target.definition = entityDefinition
  }
}
