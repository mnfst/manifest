import { Entity as TypeORMEntity } from 'typeorm'
import { EntityDefinition } from '../../../shared/interfaces/entity-definition.interface'

export const Entity = (
  entityDefinition?: Partial<EntityDefinition>
): ClassDecorator => {
  return (target: any): any => {
    // Extend the Entity decorator from TypeORM.
    TypeORMEntity()(target)

    // Set the entity definition on the target.
    target.definition = entityDefinition
  }
}
