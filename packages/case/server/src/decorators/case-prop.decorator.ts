import { Column } from 'typeorm'

import { propTypeCharacteristics } from '../dynamic-entity/prop-types/prop-type-characteristics'
import { PropType } from '../dynamic-entity/prop-types/prop-type.enum'

export const CaseProp = (options: {
  seed: (index?: number) => any
  type: PropType
}): PropertyDecorator => {
  return (target: Object, propertyKey: string) => {
    // Extend the Column decorator from TypeORM.
    Column({
      type: propTypeCharacteristics[options.type].columnType
    })(target, propertyKey)

    Reflect.defineMetadata(`${propertyKey}:seed`, options.seed, target)
    Reflect.defineMetadata(`${propertyKey}:type`, options.type, target)
  }
}
