import { Column, ManyToOne } from 'typeorm'
import { PropType } from '~shared/enums/prop-type.enum'
import { PropertyDefinition } from '~shared/interfaces/property-definition.interface'

import {
  PropTypeCharacteristics,
  propTypeCharacteristicsRecord
} from '../records/prop-type-characteristics.record'

export const CaseProp = (
  definition?: PropertyDefinition
): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    const defaultType: PropType = PropType.String
    const typeCharacteristics: PropTypeCharacteristics =
      propTypeCharacteristicsRecord[definition?.type || defaultType]

    if (definition?.type === PropType.Relation) {
      // Many to one relation.
      ManyToOne(
        (_type) => definition?.settings?.entity,
        (entity) => entity[propertyKey]
      )(target, propertyKey)
    } else {
      // Extend the Column decorator from TypeORM.
      Column({
        type: typeCharacteristics.columnType,
        nullable: true // Everything is nullable for now (for simplicity).
      })(target, propertyKey)
    }

    // Set the property definition on the target.
    Reflect.defineMetadata(
      `${propertyKey}:seed`,
      definition?.seed || typeCharacteristics.defaultSeedFunction,
      target
    )
    Reflect.defineMetadata(
      `${propertyKey}:type`,
      definition?.type || defaultType,
      target
    )
    Reflect.defineMetadata(
      `${propertyKey}:name`,
      definition?.name || propertyKey,
      target
    )
    Reflect.defineMetadata(
      `${propertyKey}:settings`,
      definition?.settings || {},
      target
    )
  }
}
