import { faker } from '@faker-js/faker'
import { Column, ManyToOne } from 'typeorm'

import { PropType } from '../../../../shared/enums/prop-type.enum'
import { PropertyDefinition } from '../../../../shared/interfaces/property-definition.interface'
import { EnumOptions } from '../../../../shared/interfaces/property-options/enum-options.interface'
import { RelationOptions } from '../../../../shared/interfaces/property-options/relation-options.interface'
import {
  PropTypeCharacteristics,
  propTypeCharacteristicsRecord
} from '../records/prop-type-characteristics.record'

export const Prop = (prop?: PropertyDefinition): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    const defaultType: PropType = PropType.Text
    const typeCharacteristics: PropTypeCharacteristics =
      propTypeCharacteristicsRecord[prop?.type || defaultType]

    // Set the property prop on the target.
    Reflect.defineMetadata(
      `${propertyKey}:seed`,
      prop?.seed || typeCharacteristics.defaultSeedFunction,
      target
    )
    Reflect.defineMetadata(
      `${propertyKey}:type`,
      prop?.type || defaultType,
      target
    )
    Reflect.defineMetadata(
      `${propertyKey}:label`,
      prop?.label || propertyKey,
      target
    )
    Reflect.defineMetadata(
      `${propertyKey}:options`,
      prop?.options || {},
      target
    )

    // Validators.
    if (prop?.validators) {
      prop?.validators.forEach((validator: PropertyDecorator) => {
        validator(target, propertyKey)
      })
    }

    // Relation (ManyToOne).
    if (prop?.type === PropType.Relation) {
      const relationOptions: RelationOptions = prop?.options as RelationOptions

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
    } else if (prop?.type === PropType.Enum) {
      const enumOptions: EnumOptions = prop?.options as EnumOptions

      if (!enumOptions?.enum) {
        throw new Error(`Enum is not provided for "${propertyKey}" property.`)
      }

      Column({
        ...prop?.typeORMOptions,
        nullable: true, // Enums are nullable for now at DB level (for simplicity).
        type: typeCharacteristics.columnType,
        enum: enumOptions.enum
      })(target, propertyKey)

      // Override default seed function for enum as we need to return a value from the enum.
      Reflect.defineMetadata(
        `${propertyKey}:seed`,
        prop?.seed ||
          (() => faker.helpers.arrayElement(Object.values(enumOptions.enum))),
        target
      )
    } else {
      // Extend the Column decorator from TypeORM.
      Column({
        ...prop?.typeORMOptions,
        type: typeCharacteristics.columnType,
        nullable: true // Everything is nullable for now at DB level (for simplicity).
      })(target, propertyKey)
    }
  }
}
