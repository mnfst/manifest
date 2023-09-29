import { Column, ManyToOne } from 'typeorm'
import { faker } from '@faker-js/faker'

import { PropType } from '../../../shared/enums/prop-type.enum'
import { PropertyDefinition } from '../../../shared/interfaces/property-definition.interface'
import { EnumOptions } from '../../../shared/interfaces/property-options/enum-options.interface'
import { RelationOptions } from '../../../shared/interfaces/property-options/relation-options.interface'
import {
  PropTypeCharacteristics,
  propTypeCharacteristicsRecord
} from '../records/prop-type-characteristics.record'


/**
 * Decorator for defining a property on an entity.
 * @param {PropertyDefinition} [definition] - The property definition
 * @returns {PropertyDecorator} The property decorator
 */
export const Prop = (definition?: PropertyDefinition): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    const defaultType: PropType = PropType.Text
    const typeCharacteristics: PropTypeCharacteristics =
      propTypeCharacteristicsRecord[definition?.type || defaultType]

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
      `${propertyKey}:label`,
      definition?.label || propertyKey,
      target
    )
    Reflect.defineMetadata(
      `${propertyKey}:options`,
      definition?.options || {},
      target
    )

    // Relation (ManyToOne).
    if (definition?.type === PropType.Relation) {
      const relationOptions: RelationOptions =
        definition?.options as RelationOptions

      if (!relationOptions?.entity) {
        throw new Error(`Entity is not provided for "${propertyKey}" property.`)
      }

      // Extend ManyToOne TypeORM decorator.
      ManyToOne(
        (_type) => relationOptions?.entity,
        (entity) => entity[propertyKey],
        {
          onDelete: 'CASCADE',
          nullable: true // Everything is nullable for now (for simplicity).
        }
      )(target, propertyKey)

      // Enum.
    } else if (definition?.type === PropType.Enum) {
      const enumOptions: EnumOptions = definition?.options as EnumOptions

      if (!enumOptions?.enum) {
        throw new Error(`Enum is not provided for "${propertyKey}" property.`)
      }

      Column({
        ...definition?.typeORMOptions,
        nullable: true, // Everything is nullable for now (for simplicity).
        type: typeCharacteristics.columnType,
        enum: enumOptions.enum
      })(target, propertyKey)

      // Override default seed function for enum as we need to return a value from the enum.
      Reflect.defineMetadata(
        `${propertyKey}:seed`,
        definition?.seed ||
        (() => faker.helpers.arrayElement(Object.values(enumOptions.enum))),
        target
      )
    } else {
      // Extend the Column decorator from TypeORM.
      Column({
        ...definition?.typeORMOptions,
        type: typeCharacteristics.columnType,
        nullable: true // Everything is nullable for now (for simplicity).
      })(target, propertyKey)
    }
  }
}
